"""
Collects a token-efficient picture of a GitHub repository for the analyzer.

GitHub cost per analysis: 2 REST calls (repo metadata + recursive tree). File
contents (README, manifests, key source files) are fetched from
raw.githubusercontent.com pinned to the commit SHA, which does not count
against the REST rate limit.

When a repo has no usable README we rank every file by how likely it is to
explain the project (manifests > entry points > core source dirs, with
penalties for tests/vendor/generated code) and send condensed versions of the
top files instead: head of the file, docstrings, imports and signatures.
"""
import os
import posixpath
import re
from concurrent.futures import ThreadPoolExecutor

import requests

GITHUB_API = "https://api.github.com"
RAW_BASE = "https://raw.githubusercontent.com"

README_RE = re.compile(r"^readme(\.(md|markdown|rst|txt|adoc|org))?$", re.I)
MIN_README_CHARS = 200  # shorter than this (after cleanup) is treated as "no README"

# Directories that never contain the project's own source.
EXCLUDED_DIRS = {
    "node_modules", "vendor", "vendors", "third_party", "thirdparty", "external", "dist", "build",
    "out", "target", "bin", "obj", ".git", ".github", "__pycache__", "coverage", ".venv", "venv",
    "env", ".idea", ".vscode", ".next", ".nuxt", "bower_components", "site-packages", ".gradle",
    "pods", "deps", "_build", ".tox", ".mypy_cache", ".pytest_cache", "htmlcov", "public",
    ".devcontainer", ".husky", ".circleci", ".gitlab", ".changeset", ".yarn",
}
BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp", ".pdf", ".zip", ".gz", ".tar",
    ".jar", ".war", ".class", ".so", ".dll", ".exe", ".dylib", ".woff", ".woff2", ".ttf", ".eot",
    ".otf", ".mp3", ".mp4", ".wav", ".avi", ".mov", ".bin", ".pkl", ".pt", ".pth", ".h5", ".onnx",
    ".npy", ".npz", ".parquet", ".db", ".sqlite", ".lock", ".map", ".pyc", ".ipynb_checkpoints",
}
LOCKFILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "pipfile.lock", "cargo.lock",
    "go.sum", "composer.lock", "gemfile.lock", "podfile.lock", "uv.lock", "bun.lockb",
}
# Manifests describe the project (name, description, deps) at very high signal/token.
MANIFESTS = {
    "package.json": 100, "pyproject.toml": 100, "setup.py": 90, "setup.cfg": 85, "cargo.toml": 100,
    "go.mod": 95, "pom.xml": 85, "build.gradle": 75, "build.gradle.kts": 75, "composer.json": 90,
    "gemfile": 60, "pubspec.yaml": 95, "mix.exs": 85, "requirements.txt": 70, "pipfile": 65,
    "environment.yml": 60, "cmakelists.txt": 60, "makefile": 35, "dockerfile": 50,
    "docker-compose.yml": 45, "docker-compose.yaml": 45, "procfile": 40, "app.json": 40,
    "manifest.json": 45, "action.yml": 80, "action.yaml": 80, "mkdocs.yml": 70, "deno.json": 80,
}
MANIFEST_SUFFIXES = {".gemspec": 90, ".csproj": 80, ".cabal": 85, ".nimble": 85}
DOC_NAMES = {"contributing.md": 30, "changelog.md": 25, "history.md": 20, "index.md": 45,
             "overview.md": 55, "about.md": 55, "description": 40, "intro.md": 50}

CODE_EXT = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".go", ".rs", ".java", ".kt", ".kts",
    ".scala", ".rb", ".php", ".cs", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".swift", ".m",
    ".dart", ".lua", ".ex", ".exs", ".erl", ".hs", ".clj", ".r", ".jl", ".sh", ".vue", ".svelte",
    ".sol", ".zig", ".nim", ".ml", ".fs", ".pl", ".groovy",
}
MAIN_DIRS = {"src": 30, "lib": 25, "app": 28, "cmd": 25, "pkg": 20, "core": 28, "internal": 15,
             "server": 20, "api": 18, "backend": 18, "source": 22, "main": 15, "engine": 20,
             "packages": 10, "crates": 15, "frontend": 10, "client": 8}
ENTRY_STEMS = {"main": 45, "__main__": 45, "index": 35, "app": 40, "server": 38, "cli": 35,
               "manage": 30, "wsgi": 25, "asgi": 25, "program": 35, "lib": 35, "mod": 12,
               "__init__": 15, "run": 25, "start": 22, "bot": 30, "application": 35, "core": 22,
               "init": 10, "setup": 0}
PENALTY_DIRS = {
    "test": -45, "tests": -45, "__tests__": -45, "spec": -40, "specs": -40, "e2e": -40,
    "testing": -35, "example": -25, "examples": -25, "sample": -25, "samples": -25, "demo": -20,
    "demos": -20, "benchmark": -30, "benchmarks": -30, "bench": -30, "scripts": -15,
    "migrations": -35, "fixtures": -40, "mocks": -40, "assets": -30, "static": -30, "data": -25,
    "datasets": -30, "locales": -35, "i18n": -35, "docs": -10, "doc": -10, "tools": -10,
    "config": -10, "configs": -10, "ci": -30, "generated": -50, "proto": -15, "stubs": -40,
    "legacy": -30, "deprecated": -40, "archive": -40, "typings": -30, "types": -10,
    "fuzz": -40, "testdata": -45, "playground": -25, "sandbox": -25,
}

FILE_CHAR_BUDGET = 2500       # max condensed chars per source file
MANIFEST_CHAR_BUDGET = 1800   # max chars per manifest
CONTEXT_CHAR_BUDGET = 24000   # total chars of file content sent when there is no README
README_CHAR_BUDGET = 12000    # README is trimmed to this after cleanup
TREE_CHAR_BUDGET = 6000       # compressed file tree in prompts
MAX_KEY_FILES = 10


class RepoError(Exception):
    def __init__(self, message, status=500):
        super().__init__(message)
        self.status = status


def parse_github_url(url):
    m = re.search(r"github\.com[/:]([^/\s]+)/([^/\s#?]+)", url or "")
    if not m:
        return None, None
    repo = re.sub(r"\.git$", "", m.group(2).strip())
    return m.group(1), repo


class GitHubClient:
    def __init__(self, token=None, session=None):
        self.http = session or requests.Session()
        self.headers = {"Accept": "application/vnd.github+json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def _get_json(self, url, timeout=15):
        r = self.http.get(url, headers=self.headers, timeout=timeout)
        if r.status_code == 404:
            raise RepoError("Repository not found (or it is private).", 404)
        if r.status_code in (403, 429) and r.headers.get("X-RateLimit-Remaining") == "0":
            raise RepoError("GitHub API rate limit exceeded. Set GITHUB_TOKEN on the backend.", 429)
        r.raise_for_status()
        return r.json()

    def repo(self, owner, name):
        return self._get_json(f"{GITHUB_API}/repos/{owner}/{name}")

    def tree(self, owner, name, ref):
        data = self._get_json(f"{GITHUB_API}/repos/{owner}/{name}/git/trees/{ref}?recursive=1", timeout=25)
        return data.get("sha", ref), data.get("tree", []), bool(data.get("truncated"))

    def raw(self, owner, name, sha, path, max_bytes=200_000):
        url = f"{RAW_BASE}/{owner}/{name}/{sha}/{requests.utils.quote(path)}"
        try:
            r = self.http.get(url, timeout=15, stream=True)
            if not r.ok:
                return None
            buf = r.raw.read(max_bytes, decode_content=True)
            r.close()
            return buf.decode("utf-8", errors="replace")
        except requests.RequestException:
            return None


# --- README handling ----------------------------------------------------------
def find_readme(paths):
    """Best README path: root first, then docs/, then shallowest anywhere."""
    candidates = [p for p in paths if README_RE.match(posixpath.basename(p))]
    if not candidates:
        return None

    def rank(p):
        d = posixpath.dirname(p).lower()
        ext = posixpath.splitext(p)[1].lower()
        return (0 if d == "" else 1 if d in ("docs", "doc", ".github") else 2 + d.count("/"),
                0 if ext in (".md", ".markdown") else 1, len(p))
    return min(candidates, key=rank)


def clean_readme(text):
    """Drop badges, images, HTML and link noise that cost tokens but carry no meaning."""
    if not text:
        return ""
    t = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    t = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", "", t)          # linked badges
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)                       # images
    t = re.sub(r"<img[^>]*>", "", t, flags=re.I)
    t = re.sub(r"</?(p|div|a|picture|source|br|span|img|h\d|sup|sub|details|summary|b|i|center)[^>]*>", "", t, flags=re.I)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1", t)        # keep link text only
    t = re.sub(r"^\s*\[[^\]]+\]:\s*\S+.*$", "", t, flags=re.M)       # reference-style links
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def trim_readme(text, budget=README_CHAR_BUDGET):
    """Keep every heading but shorten long sections so the whole README fits the budget."""
    if len(text) <= budget:
        return text
    sections = re.split(r"(?m)^(?=#{1,6}\s)", text)
    per = max(300, budget // max(1, len(sections)))
    out = []
    for s in sections:
        out.append(s if len(s) <= per else s[:per].rsplit("\n", 1)[0] + "\n…\n")
    joined = "".join(out)
    return joined[:budget]


# --- File ranking -------------------------------------------------------------
def _is_excluded(path):
    parts = path.lower().split("/")
    if any(p in EXCLUDED_DIRS for p in parts[:-1]):
        return True
    name = parts[-1]
    ext = posixpath.splitext(name)[1]
    if name in LOCKFILES or ext in BINARY_EXT:
        return True
    if ".min." in name or name.endswith(("_pb2.py", ".pb.go", ".generated.ts", ".d.ts")):
        return True
    return False


def score_file(path, size, repo_name, package_names=()):
    """Higher = more likely to reveal what the project does. Returns (score, reason)."""
    lower = path.lower()
    parts = lower.split("/")
    name = parts[-1]
    dirs = parts[:-1]
    stem, ext = posixpath.splitext(name)
    depth = len(dirs)

    manifest_val = MANIFESTS.get(name) or next(
        (v for suf, v in MANIFEST_SUFFIXES.items() if name.endswith(suf)), None)
    if manifest_val is not None:
        # A manifest under docs/, tests/, examples/, fuzz/ ... describes tooling, not the project.
        if any(d in PENALTY_DIRS for d in dirs):
            return -100, "non-code"
        return manifest_val - 4 * depth, "manifest"
    if name in DOC_NAMES or (dirs[:1] in (["docs"], ["doc"]) and ext in (".md", ".rst")):
        return DOC_NAMES.get(name, 30) - 5 * depth, "documentation"
    if ext not in CODE_EXT:
        return -100, "non-code"

    score, reasons = 20, []
    if stem in ENTRY_STEMS:
        score += ENTRY_STEMS[stem]
        reasons.append("entry-point name")
    targets = {repo_name.lower(), repo_name.lower().replace("-", "_"), *package_names}
    if stem in targets:
        score += 35
        reasons.append("named after project")
    for d in dirs:
        if d in MAIN_DIRS:
            score += MAIN_DIRS[d]
            reasons.append(f"in {d}/")
        if d in targets:
            score += 30
            reasons.append("in project-named package")
        if d in PENALTY_DIRS:
            score += PENALTY_DIRS[d]
    if stem.startswith("test_") or stem.endswith(("_test", ".test", ".spec", "_spec", "tests")):
        score -= 45
    if stem in ("conftest", "setup", "config", "settings", "constants", "utils", "helpers",
                "types", "version", "__version__"):
        score -= 15
    score -= 6 * depth
    if size is not None:
        if size < 150:
            score -= 25            # stubs / empty __init__
        elif size > 120_000:
            score -= 40            # probably generated or data
        elif 1_000 <= size <= 30_000:
            score += 8             # sweet spot for real logic
    return score, ", ".join(reasons) or "source file"


def rank_files(tree_items, repo_name, package_names=(), limit=MAX_KEY_FILES):
    scored = []
    for it in tree_items:
        if it.get("type") != "blob" or _is_excluded(it["path"]):
            continue
        s, why = score_file(it["path"], it.get("size"), repo_name, package_names)
        if s > 0:
            scored.append((s, it["path"], why, it.get("size")))
    # Manifests first (best signal per token), then code by score.
    scored.sort(key=lambda x: (x[2] != "manifest", -x[0], x[1]))
    # Diversity: at most 3 files per directory and 4 manifests, so neither crowds out source code.
    picked, per_dir, manifests = [], {}, 0
    for s, p, why, size in scored:
        d = posixpath.dirname(p)
        if why == "manifest":
            if manifests >= 4:
                continue
            manifests += 1
        elif per_dir.get(d, 0) >= 3:
            continue
        else:
            per_dir[d] = per_dir.get(d, 0) + 1
        picked.append({"path": p, "score": s, "reason": why, "size": size})
        if len(picked) >= limit:
            break
    return picked


def package_names_from_paths(paths):
    """Top-level python/go/rust package dirs often carry the project's real name."""
    names = set()
    for p in paths:
        parts = p.split("/")
        if len(parts) >= 2 and parts[-1] in ("__init__.py", "mod.rs", "lib.rs"):
            names.add(parts[-2].lower())
        if len(parts) >= 3 and parts[0] in ("cmd",):
            names.add(parts[1].lower())
    return names


# --- Condensing file contents ---------------------------------------------------
SIGNATURE_RE = re.compile(
    r"^\s*(?:"
    r"(?:async\s+)?def\s+\w+|class\s+\w+|"                                     # python
    r"(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+\w+|"           # js/ts
    r"(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>|"
    r"(?:export\s+)?(?:interface|type|enum)\s+\w+|"
    r"func\s+(?:\([^)]*\)\s*)?\w+|type\s+\w+\s+(?:struct|interface)|"          # go
    r"(?:pub(?:\(\w+\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait|impl|mod)\b|"  # rust
    r"(?:public|private|protected|internal)\s+[\w<>\[\], ]+\s+\w+\s*\(|"       # java/c#/kotlin
    r"(?:public\s+)?(?:abstract\s+)?(?:class|interface|object)\s+\w+|"
    r"(?:fun|module|defmodule|def)\s+\w+"
    r")"
)
IMPORT_RE = re.compile(r"^\s*(?:import\s|from\s+\S+\s+import\s|const\s+\w+\s*=\s*require\(|"
                       r"#include\s|use\s+[\w:]+|require\s|using\s+[\w.]+;|package\s+[\w.]+)")
ROUTE_RE = re.compile(r"@(?:app|router|bp|blueprint|api)\.(?:route|get|post|put|delete|patch)\(|"
                      r"\b(?:app|router)\.(?:get|post|put|delete|patch|use)\(\s*['\"]")


def condense_source(text, budget=FILE_CHAR_BUDGET):
    """Head of the file (usually docstring/license/imports) + every signature/route line."""
    if not text:
        return ""
    lines = text.splitlines()
    head, used = [], 0
    for ln in lines[:40]:
        if used + len(ln) > budget * 0.45:
            break
        head.append(ln.rstrip())
        used += len(ln) + 1
    seen_head = len(head)
    sigs, imports = [], []
    for ln in lines[seen_head:]:
        s = ln.rstrip()
        if not s.strip():
            continue
        if SIGNATURE_RE.match(s) or ROUTE_RE.search(s):
            sigs.append(s[:160])
        elif IMPORT_RE.match(s) and len(imports) < 15:
            imports.append(s.strip()[:120])
    body = "\n".join(head)
    rest = imports + (["# --- signatures ---"] if sigs else []) + sigs
    remaining = budget - len(body)
    tail = []
    for ln in rest:
        if remaining - len(ln) - 1 < 0:
            tail.append("…")
            break
        tail.append(ln)
        remaining -= len(ln) + 1
    out = body + ("\n" + "\n".join(tail) if tail else "")
    return re.sub(r"\n{3,}", "\n\n", out)


def condense_manifest(path, text, budget=MANIFEST_CHAR_BUDGET):
    name = posixpath.basename(path).lower()
    if name == "package.json":
        import json
        try:
            d = json.loads(text)
            keep = {k: d[k] for k in ("name", "description", "keywords", "main", "bin", "scripts", "homepage")
                    if k in d}
            for k in ("dependencies", "devDependencies", "peerDependencies"):
                if isinstance(d.get(k), dict):
                    keep[k] = sorted(d[k])[:40]  # names only - versions are noise
            return json.dumps(keep, separators=(",", ":"))[:budget]
        except ValueError:
            pass
    # Generic: drop comments/blank lines, strip version pins from requirement lists.
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s or s.startswith(("#", "//", "<!--")):
            continue
        if name.startswith("requirements"):
            s = re.split(r"[=<>~!;\[ ]", s, 1)[0]
        out.append(s)
    return "\n".join(out)[:budget]


# --- Tree compression -----------------------------------------------------------
def compress_tree(paths, budget=TREE_CHAR_BUDGET, max_depth=4):
    """Indented tree; big directories are summarised as '[N files: .ext, …]' to save tokens."""
    paths = [p for p in paths if not _is_excluded(p)]
    flat = "\n".join(paths)
    if len(flat) <= budget:
        return flat
    root = {}
    for p in paths:
        node = root
        for part in p.split("/")[:-1]:
            node = node.setdefault(part + "/", {})
        node.setdefault("", []).append(p.rsplit("/", 1)[-1])

    def count(node):
        return len(node.get("", [])) + sum(count(v) for k, v in node.items() if k)

    lines = []

    def walk(node, depth):
        indent = "  " * depth
        files = sorted(node.get("", []))
        if len(files) > 8:
            exts = sorted({posixpath.splitext(f)[1] or "(none)" for f in files})[:6]
            key = [f for f in files if posixpath.splitext(f)[0].lower() in ENTRY_STEMS][:4]
            lines.append(f"{indent}[{len(files)} files: {', '.join(exts)}]"
                         + (f" incl. {', '.join(key)}" if key else ""))
        else:
            lines.extend(indent + f for f in files)
        for d in sorted(k for k in node if k):
            lines.append(f"{indent}{d} ({count(node[d])} files)")
            if depth + 1 < max_depth:
                walk(node[d], depth + 1)

    walk(root, 0)
    out = "\n".join(lines)
    return out if len(out) <= budget else out[:budget].rsplit("\n", 1)[0] + "\n…"


# --- Main entry -------------------------------------------------------------------
def collect(owner, name, gh):
    """Gather everything the analyzer prompt needs. Raises RepoError."""
    try:
        meta = gh.repo(owner, name)
        sha, tree, truncated = gh.tree(owner, name, meta.get("default_branch") or "HEAD")
    except RepoError:
        raise
    except requests.RequestException as e:
        raise RepoError(f"Could not reach GitHub: {e}", 502)

    blobs = [t for t in tree if t.get("type") == "blob"]
    paths = [t["path"] for t in blobs]
    info = {
        "owner": owner, "name": name, "sha": sha,
        "description": meta.get("description") or "",
        "topics": meta.get("topics") or [],
        "language": meta.get("language") or "",
        "homepage": meta.get("homepage") or "",
        "stars": meta.get("stargazers_count", 0),
        "license": (meta.get("license") or {}).get("spdx_id") or "",
        "file_count": len(paths), "tree_truncated": truncated,
        "paths": paths,
        "tree_compact": compress_tree(paths),
    }

    readme_path = find_readme(paths)
    readme = clean_readme(gh.raw(owner, name, sha, readme_path)) if readme_path else ""
    info["readme_path"] = readme_path
    if len(readme) >= MIN_README_CHARS:
        info["readme"] = trim_readme(readme)
        info["readme_source"] = "repository"
        # Manifests are still cheap and sharpen the setup guide.
        manifest_items = [t for t in blobs if score_file(t["path"], t.get("size"), name)[1] == "manifest"
                          and t["path"].count("/") <= 1 and not _is_excluded(t["path"])]
        manifest_items.sort(key=lambda t: -score_file(t["path"], t.get("size"), name)[0])
        info["key_files"] = [{"path": t["path"], "score": score_file(t["path"], t.get("size"), name)[0],
                              "reason": "manifest", "size": t.get("size")} for t in manifest_items[:3]]
    else:
        info["readme"] = readme  # may be a short stub; still useful context
        info["readme_source"] = "generated"
        info["key_files"] = rank_files(blobs, name, package_names_from_paths(paths))

    with ThreadPoolExecutor(max_workers=6) as pool:
        texts = list(pool.map(lambda f: gh.raw(owner, name, sha, f["path"]), info["key_files"]))

    budget = CONTEXT_CHAR_BUDGET if info["readme_source"] == "generated" else 4000
    snippets, used = [], 0
    for f, text in zip(info["key_files"], texts):
        if not text:
            continue
        body = (condense_manifest(f["path"], text) if f["reason"] == "manifest"
                else condense_source(text) if posixpath.splitext(f["path"])[1].lower() in CODE_EXT
                else text[:FILE_CHAR_BUDGET])
        if used + len(body) > budget:
            body = body[: max(0, budget - used)]
        if not body:
            break
        snippets.append({"path": f["path"], "content": body})
        used += len(body)
    info["snippets"] = snippets
    return info
