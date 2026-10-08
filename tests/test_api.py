"""Flask route tests using the test client and an in-memory SQLite DB (no network)."""
import os
import unittest
from unittest import mock

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("GEMINI_API_KEYS", "test-key-1,test-key-2")

import backend1  # noqa: E402
import repo_insight  # noqa: E402


class ApiTests(unittest.TestCase):
    def setUp(self):
        backend1.analysis_cache = backend1.TTLCache()
        backend1.app.config["TESTING"] = True
        backend1.app.config["SESSION_COOKIE_SECURE"] = False
        self.c = backend1.app.test_client()
        with backend1.app.app_context():
            backend1.db.drop_all()
            backend1.db.create_all()

    def test_health(self):
        self.assertEqual(self.c.get("/api/health").json["status"], "OK")

    def test_register_login_status_logout(self):
        r = self.c.post("/api/register", json={"username": "ana", "password": "pw"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.c.post("/api/register", json={"username": "ana", "password": "x"}).status_code, 400)
        self.assertEqual(self.c.post("/api/login", json={"username": "ana", "password": "bad"}).status_code, 401)
        self.assertEqual(self.c.post("/api/login", json={"username": "ana", "password": "pw"}).status_code, 200)
        self.assertTrue(self.c.get("/api/status").json["logged_in"])
        self.assertEqual(self.c.post("/api/logout").status_code, 200)
        self.assertFalse(self.c.get("/api/status").json["logged_in"])

    def test_login_without_body_is_401_not_500(self):
        self.assertEqual(self.c.post("/api/login").status_code, 401)

    def test_posts_and_comments(self):
        self.assertEqual(self.c.post("/api/posts", json={"repo_name": "a/b"}).status_code, 400)
        self.assertEqual(self.c.post("/api/posts", json={"repo_name": "a/b", "idea": "cool"}).status_code, 201)
        posts = self.c.get("/api/posts").json
        self.assertEqual(posts[0]["idea"], "cool")
        pid = posts[0]["id"]
        self.assertEqual(self.c.post(f"/api/posts/{pid}/comments", json={"text": "+1"}).status_code, 201)
        self.assertEqual(self.c.get(f"/api/posts/{pid}/comments").json[0]["text"], "+1")
        self.assertEqual(self.c.get("/api/posts").json[0]["comments_count"], 1)

    def test_discussions_crud(self):
        self.assertEqual(self.c.post("/api/discussions", json={"title": "t"}).status_code, 400)
        d = self.c.post("/api/discussions", json={"author": "u1", "title": "Hi", "content": "Hello"}).json
        self.assertEqual((d["author"], d["likes"], d["replies"]), ("u1", 0, []))
        self.assertEqual(self.c.post(f"/api/discussions/{d['id']}/like").json["likes"], 1)
        self.assertEqual(self.c.post(f"/api/discussions/{d['id']}/like").json["likes"], 2)
        r = self.c.post(f"/api/discussions/{d['id']}/replies", json={"content": "yo"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json["author"], "Anonymous")
        self.assertEqual(len(self.c.get(f"/api/discussions/{d['id']}/replies").json), 1)
        listed = self.c.get("/api/discussions").json
        self.assertEqual(listed[0]["replies"][0]["content"], "yo")
        self.assertEqual(self.c.get("/api/discussions/999").status_code, 404)

    def test_analyze_validation(self):
        self.assertEqual(self.c.post("/api/analyze", json={}).status_code, 400)
        self.assertEqual(self.c.post("/api/analyze", json={"repo_url": "https://gitlab.com/a/b"}).status_code, 400)

    def test_analyze_without_readme_returns_generated_readme(self):
        info = {
            "owner": "u", "name": "snake", "sha": "abc", "description": "", "topics": [], "language": "Python",
            "homepage": "", "stars": 1, "license": "", "file_count": 2, "tree_truncated": False,
            "paths": ["main.py", "requirements.txt"], "tree_compact": "main.py\nrequirements.txt",
            "readme_path": None, "readme": "", "readme_source": "generated",
            "key_files": [{"path": "main.py", "score": 80, "reason": "entry-point name", "size": 900}],
            "snippets": [{"path": "main.py", "content": "import pygame"}],
        }
        ai = {"purpose": "A snake game", "category": "Game", "tech_stack": ["Python", "pygame"],
              "readme_summary_md": "> Inferred", "structure_md": "- main.py", "setup_md": "```\npip install pygame\n```",
              "generated_readme_md": "# snake\n\nA game."}
        with mock.patch.object(repo_insight, "collect", return_value=info), \
                mock.patch.object(backend1.gemini, "generate", return_value=(ai, {"model": "m", "usage": {"totalTokenCount": 9}})) as gen:
            r = self.c.post("/api/analyze", json={"repo_url": "https://github.com/u/snake"})
        self.assertEqual(r.status_code, 200, r.json)
        body = r.json
        self.assertEqual(body["readme_source"], "generated")
        self.assertIn("<h1>snake</h1>", body["generated_readme"])
        self.assertEqual(body["project_overview"]["purpose"], "A snake game")
        self.assertIn("<code>", body["setup_guide"])
        self.assertEqual(body["file_structure"], "main.py\nrequirements.txt")
        prompt, kwargs = gen.call_args[0][0], gen.call_args[1]
        self.assertIn("NO usable README", prompt)
        self.assertIn("generated_readme_md", kwargs["schema"]["required"])

        # Second request is served from the analysis cache without touching GitHub or Gemini.
        with mock.patch.object(repo_insight, "collect") as col, mock.patch.object(backend1.gemini, "generate") as gen2:
            r2 = self.c.post("/api/analyze", json={"repo_url": "https://github.com/U/Snake"})
        self.assertTrue(r2.json["ai_meta"]["cached"])
        col.assert_not_called()
        gen2.assert_not_called()

    def test_analyze_reports_github_errors(self):
        with mock.patch.object(repo_insight, "collect", side_effect=repo_insight.RepoError("Repository not found", 404)):
            r = self.c.post("/api/analyze", json={"repo_url": "https://github.com/u/nope"})
        self.assertEqual(r.status_code, 404)

    def test_ai_status_masks_keys(self):
        body = self.c.get("/api/ai/status").get_data(as_text=True)
        self.assertNotIn("test-key-1", body)


if __name__ == "__main__":
    unittest.main()
