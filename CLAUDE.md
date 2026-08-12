# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CodeAtlas is a full-stack app for discovering trending GitHub repos, analyzing them with Gemini AI, and collaborating. It is composed of **four independently-runnable services**, three of which are deployed (see `render.yaml` and `netlify.toml`):

| Service | Path | Runtime | Local port | Deployed |
|---------|------|---------|-----------|----------|
| React frontend | `Frontend/` | CRA / react-scripts | 3000 | Netlify |
| Main API | `backend1.py` | Flask | 5000 | Render |
| Gun.js relay | `Gunserver/gun-server.js` | Node/Express | 8765 | Render |
| Discussions API | `backends/server.js` | Node/Express | 3001 | **not** in `render.yaml` — local/legacy |

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

Integration tests hit **running** servers (no framework, just scripts):
```bash
python test_backend.py        # needs Flask up on :5000
python test_discussions.py    # needs backends/server.js up on :3001
```

There is no Python linter configured. Frontend lint is CRA's built-in ESLint (`react-app` preset) run during `npm start`/`build`.

## Architecture

**Frontend** is a single-route SPA. `App.js` renders only `/` → `HomePage`, which holds `activeSection` state and renders `ContentArea`. `ContentArea` is a `switch` that maps section keys (`trending`, `analyzer`, `devtools`, `apihub`, `ideas`, `projects`) to section components; `Sidebar` sets the active key. There is no client-side router beyond the SPA fallback, so navigation = changing `activeSection`, not URLs.

**All frontend network config lives in `Frontend/src/config/api.js`.** Use `getApiUrl(endpoint)` for the Flask API and `getGunUrl()` for the relay — do not hardcode URLs in components. Note two gotchas:
- `BASE_URL` falls back to `https://codeatlas1.onrender.com` and is overridable via `REACT_APP_API_URL`.
- `GUN_URL` is **hardcoded** to the Render relay and does *not* read `REACT_APP_GUN_URL` (despite that var existing in `netlify.toml`/`DEPLOYMENT.md`).

**`backend1.py` is the entire Flask backend in one file.** SQLAlchemy models: `User` (Flask-Login, password hashed via Werkzeug), `Post` (a repo "idea"), and `Comment` (replies, cascade-deleted with the post). It picks PostgreSQL when `DATABASE_URL` is set (rewriting `postgres://` → `postgresql://`), otherwise SQLite at `instance/ideas.db`. `db.create_all()` runs at import time via `init_database()` **and** again in `__main__`. The `/api/analyze` route chains four steps — fetch README, summarize, fetch file tree, analyze structure, build setup guide — each calling the Gemini model (`gemini-2.5-pro`); any step's error aborts with 500.

**Auth is cross-site cookie sessions**: `SESSION_COOKIE_SAMESITE='None'` and `SESSION_COOKIE_SECURE=True`, and CORS uses `supports_credentials=True`. Frontend fetches must send `credentials: 'include'` (see `defaultFetchOptions`). Secure cookies mean auth won't round-trip over plain HTTP unless origins/protocols line up.

**Real-time collaboration (Projects/Teams) uses Gun.js, not the Flask DB.** `ProjectsSection.js` instantiates a Gun client against `getGunUrl()` and reads/writes graph nodes (`teams`, `chat_<id>`, `members_<id>`, `tasks_<id>`, `presence_<id>`) directly. The relay in `Gunserver/` is a stateless peer (`radisk:false`, `localStorage:false`) — chat/kanban/presence state is not persisted server-side.

**Two independent discussion systems coexist** and `IdeasSection.js` talks to both: Flask `/api/posts` + `/api/posts/<id>/comments` ("ideas", in the SQL DB) and `backends/server.js` `/api/discussions` ("discussions", stored in `backends/discussions.json`). The discussions Node service is not deployed via `render.yaml`.

`DependencyGraph.js` renders the repo file tree from `/api/analyze` as an interactive D3 force graph, coloring nodes by file extension.

## Environment variables

Backend: `GITHUB_TOKEN`, `GEMINI_API_KEY` (analyze/trending degrade with clear errors if unset), `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (comma-separated), `FLASK_ENV` (`production` disables debug), `PORT`.
Frontend (build-time): `REACT_APP_API_URL`. Relay: `CORS_ORIGINS`, `PORT`, `NODE_ENV`.

Deployment specifics live in `DEPLOYMENT.md` and `render.yaml`; `gun-sync-diagnostic.js` / `test-gun-local.js` are ad-hoc Gun connectivity probes.
