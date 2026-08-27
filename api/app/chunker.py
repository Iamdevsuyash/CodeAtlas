"""Syntax-aware source code chunking built on tree-sitter.

Chunks are complete function or class-like definitions whenever a grammar
exposes them. Files without a definition are kept as one ``file`` chunk; this
keeps configuration and small scripts searchable without fixed-width splitting.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from tree_sitter import Node
from tree_sitter_language_pack import get_parser


MAX_FILE_BYTES = 500 * 1024
SKIPPED_DIRECTORIES = {".git", "node_modules", "venv", ".venv", "__pycache__"}
LANGUAGES_BY_EXTENSION = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "tsx", ".java": "java", ".go": "go",
    ".rs": "rust", ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp",
    ".cxx": "cpp", ".hpp": "cpp", ".cs": "c_sharp", ".rb": "ruby",
    ".php": "php", ".swift": "swift", ".kt": "kotlin", ".kts": "kotlin",
    ".scala": "scala", ".sh": "bash", ".bash": "bash", ".sql": "sql",
}
DEFINITION_TYPES = {
    "function_definition", "function_declaration", "function_item", "func_declaration",
    "method_definition", "method_declaration", "constructor_declaration",
    "generator_function_declaration", "class_definition", "class_declaration",
    "interface_declaration", "enum_declaration", "struct_item", "trait_item",
    "impl_item", "type_declaration", "object_definition", "module_definition",
}
CLASS_LIKE_TYPES = {
    "class_definition", "class_declaration", "interface_declaration", "enum_declaration",
    "struct_item", "trait_item", "impl_item", "type_declaration", "object_definition",
    "module_definition",
}


def language_for_path(path: Path) -> str | None:
    """Return the language-pack identifier for ``path``, if supported."""
    return LANGUAGES_BY_EXTENSION.get(path.suffix.lower())


def _definition_nodes(node: Node) -> Iterator[Node]:
    """Yield outermost declarations, avoiding overlapping parent chunks."""
    if node.type in DEFINITION_TYPES:
        yield node
        return
    for child in node.children:
        yield from _definition_nodes(child)


def _chunk_type(node: Node) -> str:
    return "class" if node.type in CLASS_LIKE_TYPES else "function"


def chunk_file(path: Path, repo_root: Path | None = None) -> list[dict[str, object]]:
    """Parse one source file into definition chunks, returning no chunks for binaries."""
    language = language_for_path(path)
    if language is None or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        return []
    source = path.read_bytes()
    if b"\0" in source:
        return []
    try:
        source.decode("utf-8")
        parser = get_parser(language)
    except (LookupError, UnicodeDecodeError, ValueError):
        return []

    display_path = str(path.relative_to(repo_root)) if repo_root else str(path)
    root = parser.parse(source).root_node
    definitions = list(_definition_nodes(root)) or ([root] if source.strip() else [])
    chunks: list[dict[str, object]] = []
    for node in definitions:
        content = source[node.start_byte : node.end_byte].decode("utf-8")
        if content.strip():
            chunks.append({
                "content": content, "file_path": display_path,
                "start_line": node.start_point.row + 1, "end_line": node.end_point.row + 1,
                "chunk_type": "file" if node == root else _chunk_type(node), "language": language,
            })
    return chunks


def chunk_repository(repo_root: str | Path) -> list[dict[str, object]]:
    """Walk a repository and return syntax-aware chunks from supported source files."""
    root = Path(repo_root).resolve()
    chunks: list[dict[str, object]] = []
    for path in root.rglob("*"):
        if any(part in SKIPPED_DIRECTORIES for part in path.relative_to(root).parts):
            continue
        if path.is_file():
            chunks.extend(chunk_file(path, root))
    return chunks
