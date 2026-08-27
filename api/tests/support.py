"""Test support: a scripted fake Gemini client and small data helpers.

Not collected by pytest (module name isn't ``test_*``). The fake mirrors the
google-genai surface the agent loop uses — ``client.models.generate_content(...)``
returning a real ``types.GenerateContentResponse`` — so tests exercise the true
request/response threading without any network.
"""

from __future__ import annotations

from collections.abc import Callable

from google.genai import types


def fc_response(name: str, args: dict) -> types.GenerateContentResponse:
    """A model turn that calls a single tool."""
    part = types.Part.from_function_call(name=name, args=args)
    return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[part]))])


def multi_fc_response(calls: list[tuple[str, dict]]) -> types.GenerateContentResponse:
    """A model turn that calls several tools at once (parallel function calls)."""
    parts = [types.Part.from_function_call(name=name, args=args) for name, args in calls]
    return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=parts))])


def text_response(text: str) -> types.GenerateContentResponse:
    """A model turn that returns a final text answer."""
    return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part(text=text)]))])


def latest_tool_result(contents: list):
    """Return the most recent function-response ``result`` in the conversation."""
    for content in reversed(contents):
        for part in (content.parts or []):
            if getattr(part, "function_response", None):
                return (part.function_response.response or {}).get("result")
    return None


def is_forced_summary_turn(contents: list) -> bool:
    """True if the last user turn is the forced-final-answer directive."""
    last = contents[-1]
    return any(getattr(part, "text", "") and "maximum number of tool calls" in part.text for part in (last.parts or []))


class _ScriptedModels:
    def __init__(self, responder: Callable[[list, int], types.GenerateContentResponse]) -> None:
        self._responder = responder
        self.calls: list[tuple] = []

    def generate_content(self, *, model, contents, config=None):
        self.calls.append((model, list(contents), config))
        return self._responder(list(contents), len(self.calls) - 1)


class ScriptedGeminiClient:
    """Fake genai.Client whose ``.models.generate_content`` runs ``responder``.

    ``responder(contents, call_index) -> types.GenerateContentResponse``.
    """

    def __init__(self, responder: Callable[[list, int], types.GenerateContentResponse]) -> None:
        self.models = _ScriptedModels(responder)


def sample_chunks() -> list[dict[str, object]]:
    """Hand-crafted chunks (fake vectors ok) modeling a tiny repo. ``auth/routes.py``
    has two definitions with a gap between them so read_file's gap marker shows."""
    return [
        {"content": "def login():\n    \"\"\"Log a user in.\"\"\"\n    return start_session()", "file_path": "auth/routes.py", "start_line": 9, "end_line": 11, "chunk_type": "function", "language": "python"},
        {"content": "def authenticate(user, password):\n    return True", "file_path": "auth/routes.py", "start_line": 16, "end_line": 17, "chunk_type": "function", "language": "python"},
        {"content": "def create_app():\n    return Flask(__name__)", "file_path": "app.py", "start_line": 5, "end_line": 6, "chunk_type": "function", "language": "python"},
        {"content": "def slugify(text):\n    return text.lower()", "file_path": "utils/helpers.py", "start_line": 3, "end_line": 4, "chunk_type": "function", "language": "python"},
    ]
