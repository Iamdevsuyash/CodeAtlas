"""The ReAct agent loop: tool execution, trace capture, iteration cap, dedupe.

Gemini is faked (ScriptedGeminiClient) but the tools run for real against an
in-memory Qdrant, so these assert the true request/response threading and that
the answer's cited path reflects what the tools actually returned.
"""

from app.agent import run_agent
from tests.support import (
    ScriptedGeminiClient,
    fc_response,
    is_forced_summary_turn,
    latest_tool_result,
    multi_fc_response,
    sample_chunks,
    text_response,
)


def test_loop_runs_tool_then_answers_with_correct_citation(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    def responder(contents, index):
        if index == 0:
            return fc_response("grep", {"pattern": "def login"})
        match = latest_tool_result(contents)["matches"][0]
        return text_response(f"The login route is defined in {match['file_path']}:{match['line_number']}.")

    result = run_agent(
        "Where is the login route defined?", collection,
        client=ScriptedGeminiClient(responder), store=store, model="fake",
    )

    assert result.stop_reason == "answered"
    assert result.iterations_used == 2
    assert "auth/routes.py:9" in result.answer  # cited path/line is actually correct
    assert len(result.trace) == 2
    assert result.trace[0]["tool_calls"][0]["name"] == "grep"
    assert result.trace[0]["tool_calls"][0]["result"]["matches"][0]["file_path"] == "auth/routes.py"
    assert result.trace[0]["tool_calls"][0]["tool_ms"] >= 0
    assert result.trace[1]["final"] is True


def test_loop_forces_final_answer_at_iteration_cap(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    def responder(contents, index):
        if is_forced_summary_turn(contents):
            return text_response("Forced summary: the repo has auth/, utils/, and app.py.")
        return fc_response("list_directory", {"path": ""})  # never stops on its own

    result = run_agent(
        "map the repo", collection,
        client=ScriptedGeminiClient(responder), store=store, model="fake", max_iterations=3,
    )

    assert result.stop_reason == "max_iterations"
    assert result.iterations_used == 3
    assert result.trace[-1]["forced"] is True
    assert result.trace[-1]["final"] is True
    assert "Forced summary" in result.answer
    assert len(result.trace) == 4  # 3 tool-calling turns + 1 forced summary


def test_loop_flags_duplicate_tool_calls(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    def responder(contents, index):
        if index < 2:
            return fc_response("grep", {"pattern": "login"})
        return text_response("done: auth/routes.py:9")

    result = run_agent("q", collection, client=ScriptedGeminiClient(responder), store=store, model="fake")

    duplicate_result = result.trace[1]["tool_calls"][0]["result"]
    assert "_note" in duplicate_result
    assert "Repeated" in duplicate_result["_note"]


def test_loop_executes_parallel_tool_calls(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    def responder(contents, index):
        if index == 0:
            return multi_fc_response([("list_directory", {"path": ""}), ("grep", {"pattern": "login"})])
        return text_response("done")

    result = run_agent("q", collection, client=ScriptedGeminiClient(responder), store=store, model="fake")

    assert [tc["name"] for tc in result.trace[0]["tool_calls"]] == ["list_directory", "grep"]


def test_loop_surfaces_bad_tool_arguments(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    def responder(contents, index):
        if index == 0:
            return fc_response("search_code", {"bogus_arg": "x"})  # wrong kwarg -> error result
        return text_response("done")

    result = run_agent("q", collection, client=ScriptedGeminiClient(responder), store=store, model="fake")

    assert "error" in result.trace[0]["tool_calls"][0]["result"]
