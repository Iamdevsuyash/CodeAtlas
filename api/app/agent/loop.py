"""The ReAct agent loop: reason over one repository by calling tools.

``run_agent`` drives a manual tool-calling loop against Gemini (function calling
is driven by us, not the SDK's automatic mode, so we can cap iterations, capture
a full trace, and force a final answer). Each turn we send the conversation +
tool schemas; if the model calls a tool we execute it, append the result, and
loop; if it returns text we stop. The threading of tool responses mirrors the
google-genai SDK's own automatic-function-calling implementation.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from time import perf_counter

from google.genai import types

from app.agent.prompts import FORCED_SUMMARY_DIRECTIVE, SYSTEM_PROMPT
from app.clients.gemini import get_gemini_client
from app.config import get_settings
from app.qdrant_store import QdrantStore
from app.tools import grep, list_directory, read_file, search_code

logger = logging.getLogger(__name__)

DEFAULT_MAX_ITERATIONS = 8

TOOL_FUNCS = {
    "search_code": search_code,
    "read_file": read_file,
    "list_directory": list_directory,
    "grep": grep,
}


@dataclass
class AgentResult:
    """Outcome of an agent run: the answer plus the full reasoning/tool trace."""

    answer: str
    trace: list[dict] = field(default_factory=list)
    iterations_used: int = 0
    stop_reason: str = "answered"  # "answered" | "max_iterations"

    def to_dict(self) -> dict:
        return {
            "answer": self.answer,
            "trace": self.trace,
            "iterations_used": self.iterations_used,
            "stop_reason": self.stop_reason,
        }


def _build_tools() -> types.Tool:
    """Gemini function declarations. ``collection_name`` is intentionally absent —
    the loop binds it, so the model only chooses what to look for, not where."""
    schema, kind = types.Schema, types.Type
    return types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="search_code",
            description="Semantic search over the repository's code. Returns the most relevant function/class definitions with file path, line range, and a content snippet. Use this FIRST to orient.",
            parameters=schema(type=kind.OBJECT, properties={
                "query": schema(type=kind.STRING, description="Natural-language description of what to find, e.g. 'user login route handler'."),
                "top_k": schema(type=kind.INTEGER, description="Number of results to return (default 5, max 20)."),
            }, required=["query"]),
        ),
        types.FunctionDeclaration(
            name="read_file",
            description="Return the indexed content of one file WITH line numbers, so you can read a promising search hit in full and cite exact lines.",
            parameters=schema(type=kind.OBJECT, properties={
                "file_path": schema(type=kind.STRING, description="Repository-relative path exactly as shown by search_code/grep/list_directory."),
            }, required=["file_path"]),
        ),
        types.FunctionDeclaration(
            name="list_directory",
            description="List the files and subdirectories directly under a repository path. Use an empty path for the repository root.",
            parameters=schema(type=kind.OBJECT, properties={
                "path": schema(type=kind.STRING, description="Repository-relative directory path; empty string for the root."),
            }, required=[]),
        ),
        types.FunctionDeclaration(
            name="grep",
            description="Exact/regex line search across the indexed code. Use for precise symbols or strings, e.g. '@app.route' or 'def login'.",
            parameters=schema(type=kind.OBJECT, properties={
                "pattern": schema(type=kind.STRING, description="A Python regular expression (matched case-insensitively)."),
            }, required=["pattern"]),
        ),
    ])


def _normalize_args(args: dict) -> dict:
    """Coerce integral floats to ints (Gemini returns numbers as floats)."""
    return {key: int(value) if isinstance(value, float) and value.is_integer() else value for key, value in args.items()}


def _response_text(response: types.GenerateContentResponse) -> str:
    """Concatenate the text parts of a response (skips function-call parts safely)."""
    candidate = response.candidates[0] if response.candidates else None
    if not candidate or not candidate.content or not candidate.content.parts:
        return ""
    return "".join(part.text for part in candidate.content.parts if getattr(part, "text", None)).strip()


def _summarize_result(name: str, result: object) -> str:
    """One-line, log-friendly summary of a tool result."""
    if not isinstance(result, dict):
        return str(result)[:120]
    if "error" in result:
        return f"error: {result['error']}"
    if name == "search_code":
        hits = result.get("hits", [])
        top = f" top={hits[0]['file_path']}:{hits[0]['start_line']}" if hits else ""
        return f"{len(hits)} hits{top}"
    if name == "read_file":
        return f"found={result.get('found')} chars={len(str(result.get('content', '')))}" if result.get("found") else "not found"
    if name == "list_directory":
        return f"{len(result.get('directories', []))} dirs, {len(result.get('files', []))} files"
    if name == "grep":
        return f"{result.get('match_count', 0)} matches" + (" (truncated)" if result.get("truncated") else "")
    return ", ".join(result.keys())


def _execute_tool(name: str, args: dict, collection_name: str, store: QdrantStore, seen: dict) -> object:
    """Run a tool, returning a JSON-able result. Errors and repeats become
    model-visible feedback rather than exceptions, so the agent can adapt."""
    func = TOOL_FUNCS.get(name)
    if func is None:
        return {"error": f"unknown tool '{name}'"}
    key = (name, json.dumps(args, sort_keys=True, default=str))
    if key in seen:
        cached = seen[key]
        if isinstance(cached, dict):
            return {**cached, "_note": "Repeated call with identical arguments — this is the same result as before. Do not repeat tool calls; change your query or answer."}
        return cached
    try:
        result = func(collection_name, **args, store=store)
    except TypeError as error:  # bad/unknown arguments from the model
        return {"error": f"invalid arguments for {name}: {error}"}
    except Exception as error:  # noqa: BLE001 - surface tool failures to the model
        result = {"error": f"{type(error).__name__}: {error}"}
    seen[key] = result
    return result


def _log_iteration(entry: dict, collection_name: str) -> None:
    calls = [f"{tool_call['name']}({json.dumps(tool_call['args'], default=str)})->{tool_call['result_summary']}[{tool_call['tool_ms']}ms]" for tool_call in entry["tool_calls"]]
    logger.info(
        "agent iter=%s collection=%s llm_ms=%s%s tools=%s reasoning=%r",
        entry["iteration"], collection_name, entry["llm_ms"],
        " FINAL" if entry["final"] else "", calls or "none",
        (entry["reasoning"] or "")[:200],
    )


def _force_final_answer(client, model: str, contents: list, collection_name: str) -> tuple[str, dict]:
    """Force a text answer after the tool-call cap: re-ask with no tools available."""
    contents.append(types.Content(role="user", parts=[types.Part(text=FORCED_SUMMARY_DIRECTIVE)]))
    config = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.0)
    started = perf_counter()
    response = client.models.generate_content(model=model, contents=contents, config=config)
    llm_ms = round((perf_counter() - started) * 1000, 1)
    answer = _response_text(response)
    entry = {"iteration": None, "reasoning": answer, "llm_ms": llm_ms, "tool_calls": [], "final": True, "forced": True}
    _log_iteration(entry, collection_name)
    return answer, entry


def run_agent(
    question: str,
    collection_name: str,
    *,
    client=None,
    store: QdrantStore | None = None,
    model: str | None = None,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
) -> AgentResult:
    """Answer ``question`` about the repo indexed as ``collection_name``.

    ``client`` (Gemini) and ``store`` (Qdrant) are injectable for testing. The
    loop runs at most ``max_iterations`` tool-calling turns, then forces a final
    answer rather than looping forever. Returns the answer and a full trace.
    """
    client = client or get_gemini_client()
    store = store or QdrantStore()
    model = model or get_settings().gemini_model
    tools = _build_tools()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[tools],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.0,
    )

    contents: list = [types.Content(role="user", parts=[types.Part(text=question)])]
    trace: list[dict] = []
    seen_calls: dict = {}
    logger.info("agent start collection=%s question=%r max_iterations=%s", collection_name, question[:200], max_iterations)

    for iteration in range(1, max_iterations + 1):
        started = perf_counter()
        response = client.models.generate_content(model=model, contents=contents, config=config)
        llm_ms = round((perf_counter() - started) * 1000, 1)
        reasoning = _response_text(response)
        function_calls = response.function_calls or []
        entry = {"iteration": iteration, "reasoning": reasoning, "llm_ms": llm_ms, "tool_calls": [], "final": False}

        if not function_calls:
            entry["final"] = True
            trace.append(entry)
            _log_iteration(entry, collection_name)
            return AgentResult(answer=reasoning, trace=trace, iterations_used=iteration, stop_reason="answered")

        # Record the model's turn (its function_call parts) so it sees its own actions.
        contents.append(response.candidates[0].content)
        response_parts: list = []
        for function_call in function_calls:
            args = _normalize_args(dict(function_call.args or {}))
            tool_started = perf_counter()
            result = _execute_tool(function_call.name, args, collection_name, store, seen_calls)
            tool_ms = round((perf_counter() - tool_started) * 1000, 1)
            response_parts.append(types.Part.from_function_response(name=function_call.name, response={"result": result}))
            entry["tool_calls"].append({
                "name": function_call.name, "args": args, "result": result,
                "result_summary": _summarize_result(function_call.name, result), "tool_ms": tool_ms,
            })

        contents.append(types.Content(role="user", parts=response_parts))
        trace.append(entry)
        _log_iteration(entry, collection_name)

    # Cap reached with the model still wanting tools: force a final answer.
    answer, forced_entry = _force_final_answer(client, model, contents, collection_name)
    trace.append(forced_entry)
    return AgentResult(answer=answer, trace=trace, iterations_used=max_iterations, stop_reason="max_iterations")
