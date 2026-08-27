"""Code-intelligence tools the agent calls to reason over an indexed repository.

The Qdrant collection produced by the ingestion pipeline (``app/pipeline.py``) is
the single source of truth. Repositories are cloned into a temp dir, chunked,
embedded, and discarded, so these tools operate over the stored chunks rather
than a working tree on disk. Each chunk is a complete function/class definition
(or a whole small file); code that lives *between* top-level definitions is not
indexed, so ``read_file``/``grep`` see the indexed spans, not raw bytes.

Every tool takes ``collection_name`` first (the agent loop binds it — the model
never chooses the repo) and an optional ``store`` for dependency injection in
tests. Returns are plain JSON-able dicts suitable for a Gemini function response.
"""

from __future__ import annotations

import re

from app.clients.embeddings import embed_text
from app.qdrant_store import QdrantStore

SNIPPET_CHARS = 600  # per-hit content preview returned by search_code
MAX_FILE_CHARS = 20_000  # read_file content cap (keeps tool results bounded)
GREP_MAX_RESULTS = 50


def _store(store: QdrantStore | None) -> QdrantStore:
    return store or QdrantStore()


def _payloads_for(store: QdrantStore, collection_name: str) -> list[dict[str, object]]:
    """All chunk payloads in a collection, as a list (for the non-semantic tools)."""
    return list(store.scroll_all(collection_name))


def search_code(collection_name: str, query: str, top_k: int = 5, *, store: QdrantStore | None = None) -> dict[str, object]:
    """Semantic vector search over the repo. The primary way to orient.

    Returns the top matching definitions with file path, line range, and a
    content snippet (truncated). Use ``read_file`` to see a hit in full.
    """
    top_k = max(1, min(int(top_k or 5), 20))
    points = _store(store).search(collection_name, embed_text(query), top_k)
    hits: list[dict[str, object]] = []
    for point in points:
        payload = point.payload or {}
        content = str(payload.get("content", ""))
        hits.append({
            "file_path": payload.get("file_path"),
            "start_line": payload.get("start_line"),
            "end_line": payload.get("end_line"),
            "chunk_type": payload.get("chunk_type"),
            "language": payload.get("language"),
            "score": round(float(point.score), 4) if point.score is not None else None,
            "snippet": content[:SNIPPET_CHARS] + ("\n…(truncated)" if len(content) > SNIPPET_CHARS else ""),
        })
    return {"query": query, "hits": hits}


def _number_lines(content: str, start_line: int) -> str:
    return "\n".join(f"{start_line + offset:>6} | {line}" for offset, line in enumerate(content.splitlines()))


def read_file(collection_name: str, file_path: str, *, store: QdrantStore | None = None) -> dict[str, object]:
    """Return the indexed content of one file, with absolute line numbers.

    Content is reconstructed from the file's indexed definition chunks (sorted by
    line); gaps between definitions are marked. Cite the line numbers shown here.
    """
    store = _store(store)
    payloads = _payloads_for(store, collection_name)
    chunks = sorted(
        (c for c in payloads if c.get("file_path") == file_path),
        key=lambda c: int(c.get("start_line", 0) or 0),
    )
    if not chunks:
        suggestions = sorted({str(c.get("file_path")) for c in payloads if str(c.get("file_path", "")).endswith(file_path)})
        return {
            "file_path": file_path,
            "found": False,
            "message": f"No indexed content for '{file_path}'. Use list_directory or search_code to find the right path.",
            "did_you_mean": suggestions[:10],
        }

    rendered: list[str] = []
    previous_end = 0
    total = 0
    for chunk in chunks:
        start = int(chunk.get("start_line", 1) or 1)
        end = int(chunk.get("end_line", start) or start)
        if previous_end and start > previous_end + 1:
            rendered.append(f"       ⋯ (lines {previous_end + 1}–{start - 1} not indexed) ⋯")
        block = _number_lines(str(chunk.get("content", "")), start)
        rendered.append(block)
        total += len(block)
        previous_end = max(previous_end, end)
        if total > MAX_FILE_CHARS:
            rendered.append("       ⋯ (remaining indexed content truncated) ⋯")
            break

    return {
        "file_path": file_path,
        "found": True,
        "language": chunks[0].get("language"),
        "indexed_chunks": [{"chunk_type": c.get("chunk_type"), "start_line": c.get("start_line"), "end_line": c.get("end_line")} for c in chunks],
        "content": "\n".join(rendered),
    }


def list_directory(collection_name: str, path: str = "", *, store: QdrantStore | None = None) -> dict[str, object]:
    """List the indexed files and subdirectories directly under ``path`` (repo-root-relative)."""
    store = _store(store)
    normalized = (path or "").strip("/")
    prefix = f"{normalized}/" if normalized else ""
    all_files = sorted({str(c.get("file_path", "")) for c in _payloads_for(store, collection_name) if c.get("file_path")})

    directories: set[str] = set()
    files: set[str] = set()
    for file_path in all_files:
        if prefix and not file_path.startswith(prefix):
            continue
        remainder = file_path[len(prefix):]
        if not remainder:
            continue
        if "/" in remainder:
            directories.add(remainder.split("/", 1)[0])
        else:
            files.add(remainder)

    found = bool(directories or files)
    result: dict[str, object] = {"path": normalized, "found": found, "directories": sorted(directories), "files": sorted(files)}
    if not found:
        result["message"] = f"Nothing indexed under '{normalized or '/'}'. The repo root lists: {sorted({f.split('/', 1)[0] for f in all_files})[:20]}"
    return result


def grep(collection_name: str, pattern: str, *, ignore_case: bool = True, store: QdrantStore | None = None) -> dict[str, object]:
    """Regex/substring search across indexed content. Line-exact, complements search_code.

    Returns matching lines with their file path and absolute line number. Only
    indexed spans are searched (see module docstring).
    """
    try:
        regex = re.compile(pattern, re.IGNORECASE if ignore_case else 0)
    except re.error as error:
        return {"pattern": pattern, "error": f"invalid regular expression: {error}", "matches": []}

    matches: list[dict[str, object]] = []
    for chunk in _payloads_for(_store(store), collection_name):
        base = int(chunk.get("start_line", 1) or 1)
        for offset, line in enumerate(str(chunk.get("content", "")).splitlines()):
            if regex.search(line):
                matches.append({"file_path": chunk.get("file_path"), "line_number": base + offset, "line": line.strip()[:200]})
                if len(matches) >= GREP_MAX_RESULTS:
                    return {"pattern": pattern, "match_count": len(matches), "truncated": True, "matches": matches}
    return {"pattern": pattern, "match_count": len(matches), "truncated": False, "matches": matches}
