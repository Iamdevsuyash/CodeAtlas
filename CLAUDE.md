# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CodeAtlas is a full-stack app for discovering trending GitHub repos, analyzing them with Gemini AI, and collaborating. It is composed of **four independently-runnable services**, three of which are deployed (see `render.yaml` and `netlify.toml`):

| Service | Path | Runtime | Local port | Deployed |
|---------|------|---------|-----------|----------|
| React frontend | `Frontend/` | CRA / react-scripts | 3000 | Netlify |
| Main API | `backend1.py` | Flask | 5000 | Render |
| Gun.js relay | `Gunserver/gun-server.js` | Node/Express | 8765 | Render |
| Discussions API (legacy) | `backends/server.js` | Node/Express | 3001 | **not** deployed — superseded by Flask `/api/discussions` |

## Commands

Flask backend (from repo root):
```bash
pip install -r requirements.txt
python backend1.py            # serves on PORT (default 5000)
```

Frontend (from `Frontend/`):
```bash
npm install
npm start                     # dev server on 3000
npm run build                 # production build -> Frontend/build
npm test                      # CRA/Jest watch mode
npm test -- --watchAll=false src/App.test.js   # run one test file, no watch
```

Gun.js relay (from `Gunserver/`): `npm install && npm start`
Discussions API (from `backends/`): `npm install && npm start`

Python unit/API tests (offline — GitHub and Gemini are faked; `/api/*` uses in-memory SQLite):
```bash
python -m unittest discover -s tests                         # all
python -m unittest tests.test_gemini_pool                    # one module
```
Ad-hoc scripts that hit a **running** Flask on :5000: `python test_backend.py`, `python test_discussions.py`.

There is no Python linter configured. Frontend lint is CRA's built-in ESLint (`react-app` preset) run during `npm start`/`build`.

## Architecture

**Frontend** is a single-route SPA. `App.js` renders only `/` → `HomePage`, which holds `activeSection` state and renders `ContentArea`. `ContentArea` is a `switch` that maps section keys (`trending`, `analyzer`, `devtools`, `apihub`, `ideas`, `projects`) to section components; `Sidebar` sets the active key. There is no client-side router beyond the SPA fallback, so navigation = changing `activeSection`, not URLs.

**All frontend network config lives in `Frontend/src/config/api.js`.** Use `getApiUrl(endpoint)` for the Flask API and `getGunUrl()` for the relay — do not hardcode URLs in components. Note two gotchas:
- `BASE_URL` falls back to `https://codeatlas1.onrender.com` and is overridable via `REACT_APP_API_URL`.
- `GUN_URL` is **hardcoded** to the Render relay and does *not* read `REACT_APP_GUN_URL` (despite that var existing in `netlify.toml`/`DEPLOYMENT.md`).

**`backend1.py` holds all Flask routes and models**, with two helper modules:
- `gemini_pool.py` — Gemini REST client (no SDK) over a pool of keys from `GEMINI_API_KEYS`. Picks the least-loaded/least-recently-used key, cools down keys on 429 (honouring `RetryInfo`; per-day quota = 1h), disables keys on 401/403/invalid, falls through `GEMINI_MODELS` on 404/5xx, and caches identical prompts. `thinkingLevel` defaults to `minimal` (≈80% fewer tokens). `/api/ai/status` shows masked per-key stats.
- `repo_insight.py` — gathers repo context with 2 GitHub REST calls (repo + recursive tree); file contents come from `raw.githubusercontent.com` at the commit SHA (no rate limit). If the README is missing or < 200 chars it ranks files (`score_file`/`rank_files`: manifests first, entry-point names, `src/`/`lib/`/`cmd/`/project-named dirs; penalties for tests/examples/vendor/generated) and sends condensed snippets (head + imports + signatures) within fixed char budgets.
SQLAlchemy models: `User` (Flask-Login, password hashed via Werkzeug), `Post` (a repo "idea"), `Comment` (replies, cascade-deleted with the post), and `Discussion`/`DiscussionReply`. It picks PostgreSQL when `DATABASE_URL` is set (rewriting `postgres://` → `postgresql://`), otherwise SQLite at `instance/ideas.db`. `db.create_all()` runs at import time via `init_database()` **and** again in `__main__`. `/api/analyze` makes **one** Gemini call with a JSON `responseSchema` that returns every section (summary, structure, setup, purpose/category/tech stack, and `generated_readme_md` when the repo has no README). Responses are cached per `owner/repo` for 30 min (`analysis_cache`; pass `refresh: true` to bypass). The response also carries `readme_source` (`repository`|`generated`), `key_files`, `file_structure` (full path list used by the graph) and `ai_meta`. Note `db.create_all()` must run after all models are defined — `init_database()` is called right after the model classes.

**Auth is cross-site cookie sessions**: `SESSION_COOKIE_SAMESITE='None'` and `SESSION_COOKIE_SECURE=True`, and CORS uses `supports_credentials=True`. Frontend fetches must send `credentials: 'include'` (see `defaultFetchOptions`). Secure cookies mean auth won't round-trip over plain HTTP unless origins/protocols line up.

**Real-time collaboration (Projects/Teams) uses Gun.js, not the Flask DB.** `ProjectsSection.js` instantiates a Gun client against `getGunUrl()` and reads/writes graph nodes (`teams`, `chat_<id>`, `members_<id>`, `tasks_<id>`, `presence_<id>`) directly. The relay in `Gunserver/` is a stateless peer (`radisk:false`, `localStorage:false`) — chat/kanban/presence state is not persisted server-side.

`IdeasSection.js` has two tabs, both served by Flask/SQL: "ideas" (`Post`/`Comment`, `/api/posts`) and "discussions" (`Discussion`/`DiscussionReply`, `/api/discussions`, ported from the legacy `backends/server.js`).

`DependencyGraph.js` renders `analysis.file_structure` as a drill-down D3 force graph (hub node = current folder; node ids are prefixed `dir:`/`file:`). `AnalyzerSection` keeps a module-level cache so switching sections doesn't re-run analysis.

## Environment variables

Backend: `GITHUB_TOKEN`, `GEMINI_API_KEYS` (comma-separated; legacy `GEMINI_API_KEY` is also read), optional `GEMINI_MODELS` / `GEMINI_THINKING_LEVEL`, `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (comma-separated), `FLASK_ENV` (`production` disables the sample-posts seeding route), `FLASK_DEBUG=1` (opt-in debug server; never on public hosts), `PORT`.
Frontend (build-time): `REACT_APP_API_URL`. Relay: `CORS_ORIGINS`, `PORT`, `NODE_ENV`.

Deployment specifics live in `DEPLOYMENT.md` and `render.yaml`; `gun-sync-diagnostic.js` / `test-gun-local.js` are ad-hoc Gun connectivity probes.
