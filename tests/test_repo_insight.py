"""Offline tests for README detection, file ranking and token-saving condensation."""
import unittest

import repo_insight as ri


def blobs(*paths, size=4000):
    return [{"type": "blob", "path": p, "size": size} for p in paths]


class ParseUrlTests(unittest.TestCase):
    def test_variants(self):
        for url in ("https://github.com/psf/requests", "http://www.github.com/psf/requests",
                    "https://github.com/psf/requests.git", "https://github.com/psf/requests/tree/main/src",
                    "git@github.com:psf/requests.git", "github.com/psf/requests#readme"):
            self.assertEqual(ri.parse_github_url(url), ("psf", "requests"), url)
        self.assertEqual(ri.parse_github_url("https://gitlab.com/a/b"), (None, None))


class ReadmeTests(unittest.TestCase):
    def test_find_readme_prefers_root_markdown(self):
        paths = ["docs/README.md", "README.rst", "README.md", "pkg/readme.txt"]
        self.assertEqual(ri.find_readme(paths), "README.md")
        self.assertEqual(ri.find_readme(["src/a.py", "docs/Readme.md"]), "docs/Readme.md")
        self.assertIsNone(ri.find_readme(["src/a.py", "readme_parser.py"]))

    def test_clean_readme_strips_badges_and_html(self):
        text = ("# Tool\n[![CI](https://x/badge.svg)](https://x)\n![logo](logo.png)\n"
                "<p align=center><img src=x></p>\nA [link](https://example.com) here.\n\n\n\nEnd")
        out = ri.clean_readme(text)
        self.assertNotIn("badge", out)
        self.assertNotIn("<p", out)
        self.assertIn("A link here.", out)
        self.assertNotIn("\n\n\n", out)

    def test_trim_readme_keeps_all_headings(self):
        text = "".join(f"## Section {i}\n" + "x" * 3000 + "\n" for i in range(10))
        out = ri.trim_readme(text, budget=6000)
        self.assertLessEqual(len(out), 6000)
        self.assertIn("## Section 0", out)
        self.assertIn("## Section 9", out)


class RankingTests(unittest.TestCase):
    def test_entry_points_and_manifests_beat_tests_and_vendor(self):
        tree = blobs(
            "package.json", "src/index.ts", "src/server.ts", "src/utils/helpers.ts",
            "tests/test_server.ts", "node_modules/lib/index.js", "dist/bundle.min.js",
            "examples/demo/index.ts", "docs/guide.md", "assets/logo.png", "package-lock.json",
        )
        ranked = [f["path"] for f in ri.rank_files(tree, "mytool")]
        self.assertEqual(ranked[0], "package.json")
        self.assertLess(ranked.index("src/index.ts"), ranked.index("examples/demo/index.ts"))
        for bad in ("node_modules/lib/index.js", "dist/bundle.min.js", "assets/logo.png",
                    "package-lock.json", "tests/test_server.ts"):
            self.assertNotIn(bad, ranked)

    def test_python_package_named_after_repo(self):
        tree = blobs("pyproject.toml", "fastthing/__init__.py", "fastthing/core.py",
                     "fastthing/cli.py", "scripts/release.py", "tests/test_core.py", "setup.py")
        names = ri.package_names_from_paths([t["path"] for t in tree])
        self.assertIn("fastthing", names)
        ranked = [f["path"] for f in ri.rank_files(tree, "fast-thing", names)]
        self.assertIn("fastthing/core.py", ranked[:4])
        self.assertLess(ranked.index("fastthing/cli.py"), ranked.index("scripts/release.py"))

    def test_go_cmd_layout(self):
        tree = blobs("go.mod", "cmd/server/main.go", "internal/store/store.go", "internal/store/store_test.go")
        ranked = [f["path"] for f in ri.rank_files(tree, "svc")]
        self.assertEqual(ranked[:2], ["go.mod", "cmd/server/main.go"])
        self.assertNotIn("internal/store/store_test.go", ranked)

    def test_tooling_manifests_and_dev_dirs_ignored(self):
        tree = blobs("Cargo.toml", "fuzz/Cargo.toml", "docs/Makefile", ".devcontainer/setup.sh",
                     "crates/cli/Cargo.toml", "src/main.rs")
        ranked = [f["path"] for f in ri.rank_files(tree, "rg")]
        self.assertEqual(ranked[0], "Cargo.toml")
        for bad in ("fuzz/Cargo.toml", "docs/Makefile", ".devcontainer/setup.sh"):
            self.assertNotIn(bad, ranked)
        self.assertIn("crates/cli/Cargo.toml", ranked)

    def test_diversity_caps_files_per_directory(self):
        tree = blobs("src/main.py", "src/app.py", "src/server.py", "src/cli.py", "src/index.py",
                     "lib/core.py")
        ranked = ri.rank_files(tree, "x")
        self.assertLessEqual(sum(1 for f in ranked if f["path"].startswith("src/")), 3)
        self.assertIn("lib/core.py", [f["path"] for f in ranked])

    def test_size_penalties(self):
        small, _ = ri.score_file("src/main.py", 40, "x")
        mid, _ = ri.score_file("src/main.py", 5000, "x")
        huge, _ = ri.score_file("src/main.py", 500_000, "x")
        self.assertGreater(mid, small)
        self.assertGreater(mid, huge)


class CondenseTests(unittest.TestCase):
    def test_condense_keeps_docstring_and_signatures_drops_bodies(self):
        body = "\n".join(f"    x{i} = compute({i})" for i in range(400))
        src = ('"""Image classifier service."""\nimport torch\nfrom flask import Flask\n\n'
               + "\n".join("# filler" for _ in range(50)) + "\n"
               + "class Model:\n" + body + "\n\ndef predict(img):\n" + body
               + "\n\n@app.route('/predict')\ndef route():\n    pass\n")
        out = ri.condense_source(src, budget=1500)
        self.assertLessEqual(len(out), 1600)
        self.assertIn("Image classifier service", out)
        self.assertIn("class Model:", out)
        self.assertIn("def predict(img):", out)
        self.assertIn("@app.route('/predict')", out)
        self.assertNotIn("compute(399)", out)

    def test_package_json_keeps_description_and_dep_names_only(self):
        pj = '{"name":"t","description":"Tiny CLI","version":"1.0.0","dependencies":{"react":"^18.0.0"},"eslintConfig":{"x":1}}'
        out = ri.condense_manifest("package.json", pj)
        self.assertIn("Tiny CLI", out)
        self.assertIn("react", out)
        self.assertNotIn("^18", out)
        self.assertNotIn("eslintConfig", out)

    def test_requirements_strip_versions(self):
        out = ri.condense_manifest("requirements.txt", "# c\nflask==3.0\ntorch>=2\n")
        self.assertEqual(out, "flask\ntorch")

    def test_compress_tree_summarises_large_dirs(self):
        paths = [f"src/components/C{i}.tsx" for i in range(300)] + ["src/index.tsx", "package.json"]
        out = ri.compress_tree(paths, budget=2000)
        self.assertLessEqual(len(out), 2000)
        self.assertIn("[300 files: .tsx]", out)
        self.assertIn("index.tsx", out)


class GitHubClientTests(unittest.TestCase):
    def test_rejected_token_falls_back_to_anonymous(self):
        class Resp:
            def __init__(self, code):
                self.status_code, self.headers = code, {}

        class Session:
            def __init__(self):
                self.auth_seen = []

            def get(self, url, headers, params, timeout):
                self.auth_seen.append("Authorization" in headers)
                return Resp(401 if "Authorization" in headers else 200)

        sess = Session()
        gh = ri.GitHubClient("expired-token", session=sess)
        self.assertEqual(gh.get("https://api.github.com/x").status_code, 200)
        self.assertEqual(gh.get("https://api.github.com/y").status_code, 200)
        self.assertEqual(sess.auth_seen, [True, False, False])  # token dropped after first 401


class CollectTests(unittest.TestCase):
    """collect() against a fake GitHub client - no network."""

    class FakeGH:
        def __init__(self, files, desc=""):
            self.files, self.desc, self.raw_calls = files, desc, []

        def repo(self, o, n):
            return {"default_branch": "main", "description": self.desc, "topics": ["ml"], "language": "Python"}

        def tree(self, o, n, ref):
            return "abc123", [{"type": "blob", "path": p, "size": len(c)} for p, c in self.files.items()], False

        def raw(self, o, n, sha, path, max_bytes=0):
            self.raw_calls.append(path)
            return self.files.get(path)

    def test_without_readme_uses_ranked_source(self):
        files = {
            "pyproject.toml": '[project]\nname = "imgsort"\ndescription = "Sort photos by face"\n',
            "imgsort/__init__.py": '"""imgsort: groups photos by detected faces."""\n' + "x = 1\n" * 50,
            "imgsort/cluster.py": "import numpy\n\ndef cluster_faces(embs):\n" + "    pass\n" * 200,
            "tests/test_cluster.py": "def test_x():\n    pass\n" * 30,
        }
        gh = self.FakeGH(files)
        info = ri.collect("u", "imgsort", gh)
        self.assertEqual(info["readme_source"], "generated")
        paths = [s["path"] for s in info["snippets"]]
        self.assertEqual(paths[0], "pyproject.toml")
        self.assertIn("imgsort/cluster.py", paths)
        self.assertNotIn("tests/test_cluster.py", paths)
        self.assertLessEqual(sum(len(s["content"]) for s in info["snippets"]), ri.CONTEXT_CHAR_BUDGET)

    def test_with_readme_reads_readme_and_few_manifests(self):
        files = {"README.md": "# Proj\n" + "Real docs. " * 50, "package.json": '{"name":"p"}',
                 "src/index.js": "console.log(1)\n" * 100}
        gh = self.FakeGH(files)
        info = ri.collect("u", "proj", gh)
        self.assertEqual(info["readme_source"], "repository")
        self.assertIn("Real docs", info["readme"])
        self.assertNotIn("src/index.js", gh.raw_calls)  # source files not fetched when README exists

    def test_stub_readme_counts_as_missing(self):
        files = {"README.md": "# x\n", "main.py": '"""Snake game in pygame."""\nimport pygame\n' * 5}
        info = ri.collect("u", "x", self.FakeGH(files))
        self.assertEqual(info["readme_source"], "generated")


if __name__ == "__main__":
    unittest.main()
