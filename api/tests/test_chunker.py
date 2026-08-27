from pathlib import Path

from app.chunker import chunk_file, chunk_repository


def test_chunk_file_keeps_complete_python_definitions(tmp_path: Path):
    source = tmp_path / "example.py"
    source.write_text(
        "import os\n\n\ndef greet(name):\n    return f'hello {name}'\n\n\nclass Greeter:\n    def greet(self):\n        return 'hi'\n"
    )

    chunks = chunk_file(source, tmp_path)

    assert [(chunk["chunk_type"], chunk["start_line"], chunk["end_line"]) for chunk in chunks] == [
        ("function", 4, 5), ("class", 8, 10)
    ]
    assert chunks[0]["content"].startswith("def greet")
    assert "def greet(self)" in chunks[1]["content"]
    assert all(chunk["file_path"] == "example.py" and chunk["language"] == "python" for chunk in chunks)


def test_chunk_repository_skips_binary_large_and_ignored_directories(tmp_path: Path):
    (tmp_path / "ok.py").write_text("def included():\n    return True\n")
    (tmp_path / "binary.py").write_bytes(b"\0not source")
    (tmp_path / "large.py").write_bytes(b"#" * (500 * 1024 + 1))
    ignored = tmp_path / "node_modules"
    ignored.mkdir()
    (ignored / "ignored.py").write_text("def ignored(): pass\n")

    chunks = chunk_repository(tmp_path)

    assert [chunk["file_path"] for chunk in chunks] == ["ok.py"]
