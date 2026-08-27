"""Tools over a Qdrant collection.

read_file / list_directory / grep run offline against a hand-seeded in-memory
collection (fake vectors). search_code runs against the fixture repo indexed with
real embeddings (skips if the model can't load offline).
"""

from app.tools import grep, list_directory, read_file, search_code
from tests.support import sample_chunks


def test_read_file_numbers_lines_and_marks_gaps(in_memory_store):
    store, collection = in_memory_store(sample_chunks())
    result = read_file(collection, "auth/routes.py", store=store)

    assert result["found"] is True
    assert result["language"] == "python"
    assert "     9 | def login():" in result["content"]  # real line number shown
    assert "not indexed" in result["content"]  # gap between the two defs is marked
    assert "    16 | def authenticate(user, password):" in result["content"]


def test_read_file_missing_suggests_by_suffix(in_memory_store):
    store, collection = in_memory_store(sample_chunks())
    result = read_file(collection, "routes.py", store=store)

    assert result["found"] is False
    assert "auth/routes.py" in result["did_you_mean"]


def test_list_directory_root_and_subdir(in_memory_store):
    store, collection = in_memory_store(sample_chunks())

    root = list_directory(collection, "", store=store)
    assert set(root["directories"]) == {"auth", "utils"}
    assert root["files"] == ["app.py"]

    sub = list_directory(collection, "auth", store=store)
    assert sub["files"] == ["routes.py"]
    assert sub["directories"] == []


def test_list_directory_unknown_path(in_memory_store):
    store, collection = in_memory_store(sample_chunks())
    result = list_directory(collection, "does/not/exist", store=store)
    assert result["found"] is False


def test_grep_finds_line_with_absolute_number(in_memory_store):
    store, collection = in_memory_store(sample_chunks())
    result = grep(collection, r"def login", store=store)

    assert result["match_count"] == 1
    match = result["matches"][0]
    assert match["file_path"] == "auth/routes.py"
    assert match["line_number"] == 9


def test_grep_invalid_regex_is_reported(in_memory_store):
    store, collection = in_memory_store(sample_chunks())
    result = grep(collection, r"(unclosed", store=store)

    assert "error" in result
    assert result["matches"] == []


def test_search_code_finds_login_file(real_indexed_store):
    store, collection, _chunks = real_indexed_store
    result = search_code(collection, "where is the user login route defined", top_k=3, store=store)

    assert result["hits"], "expected at least one hit"
    top = result["hits"][0]
    assert top["file_path"] == "auth/routes.py"
    assert top["score"] is not None
    assert "snippet" in top
