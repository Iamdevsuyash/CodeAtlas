"""Code-intelligence tools.

Home for the plain functions this service exposes to an agent
(e.g. search_code, read_file, ...). Backed by Qdrant for vector search
and tree-sitter for parsing. Add modules here as they are written.
"""

from app.tools.code_tools import grep, list_directory, read_file, search_code

__all__ = ["search_code", "read_file", "list_directory", "grep"]
