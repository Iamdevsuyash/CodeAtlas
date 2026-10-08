
import os
import sys
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from gemini_pool import GeminiPool, GeminiError, TTLCache
import repo_insight
from markdown import markdown
import traceback
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user


# The emoji log lines crash on Windows consoles/redirects (cp1252) - force UTF-8.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# --- Step 1: Load API Keys & Configure ---
load_dotenv()
app = Flask(__name__)

# Ensure the instance folder exists
os.makedirs(app.instance_path, exist_ok=True)

# Ensure tmp directory exists for SQLite in production
os.makedirs('/tmp', exist_ok=True)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', os.urandom(32))
# Use PostgreSQL in production, SQLite as local fallback


database_url = os.getenv('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    # Fix for newer SQLAlchemy versions that require postgresql:// instead of postgres://
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or f"sqlite:///{os.path.join(app.instance_path, 'ideas.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
# CORS configuration: read from env CORS_ORIGINS (comma-separated) or use sensible defaults

cors_env = os.getenv('CORS_ORIGINS', 'https://gitatlas.netlify.app,https://codeatlas.netlify.app,http://localhost:3000,http://localhost:5000,http://localhost:8765')

allowed_origins = [o.strip() for o in cors_env.split(',') if o.strip()]
print(f"🔒 Backend CORS allowed origins: {allowed_origins}")
CORS(app, supports_credentials=True, origins=allowed_origins)

app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True  # Required for cross-site cookies over HTTPS

login_manager = LoginManager()
login_manager.init_app(app)

# Initialize database tables on app startup (critical for production)
def init_database():
    """Initialize database tables if they don't exist"""
    try:
        with app.app_context():
            db.create_all()
            print("✅ Database tables created/verified successfully")
            
            # Verify tables exist by checking User table
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"📊 Available tables: {tables}")
            
            return True
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False


# Global error handler to ensure CORS headers are always applied
@app.errorhandler(500)
def handle_500_error(e):
    response = jsonify({"error": "Internal server error"})
    response.status_code = 500
    return response

# CORS is handled by flask-cors configuration above


# --- Database Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.Text)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    repo_name = db.Column(db.String(100), nullable=False)
    idea = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    comments = db.relationship('Comment', backref='post', lazy=True, cascade="all, delete-orphan")

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)

class Discussion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100), nullable=False, default='Anonymous')
    title = db.Column(db.String(300), nullable=False)
    content = db.Column(db.Text, nullable=False)
    likes = db.Column(db.Integer, nullable=False, default=0)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    replies = db.relationship('DiscussionReply', backref='discussion', lazy=True,
                              cascade="all, delete-orphan", order_by='DiscussionReply.timestamp')

    def to_dict(self):
        return {'id': self.id, 'author': self.author, 'title': self.title, 'content': self.content,
                'likes': self.likes, 'timestamp': self.timestamp.isoformat() + 'Z',
                'replies': [r.to_dict() for r in self.replies]}


class DiscussionReply(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100), nullable=False, default='Anonymous')
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    discussion_id = db.Column(db.Integer, db.ForeignKey('discussion.id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'author': self.author, 'content': self.content,
                'timestamp': self.timestamp.isoformat() + 'Z'}


# Tables must be created after every model is defined.
init_database()

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# Securely load API keys
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
# Multi-key Gemini pool: GEMINI_API_KEYS="k1,k2,..." (GEMINI_API_KEY still works).
gemini = GeminiPool.from_env(os.environ)
github = repo_insight.GitHubClient(GITHUB_TOKEN)
# Finished analyses by owner/repo: repeat requests skip GitHub and Gemini entirely.
analysis_cache = TTLCache(max_items=200, ttl=30 * 60)
if gemini.configured:
    print(f"🤖 Gemini pool ready: {len(gemini.status()['keys'])} key(s), models={gemini.models}")
else:
    print("⚠️ GEMINI_API_KEYS is not set. /api/analyze will return a setup error.")

# --- Helper Functions ---
parse_github_url = repo_insight.parse_github_url

_SECTIONS = {
    "purpose": {"type": "STRING", "description": "One sentence: what the project does and for whom."},
    "category": {"type": "STRING", "description": "Short label, e.g. 'Web framework', 'CLI tool', 'ML library'."},
    "tech_stack": {"type": "ARRAY", "items": {"type": "STRING"}},
    "readme_summary_md": {"type": "STRING"},
    "structure_md": {"type": "STRING"},
    "setup_md": {"type": "STRING"},
}
ANALYSIS_SCHEMA = {"type": "OBJECT", "properties": _SECTIONS, "required": list(_SECTIONS)}
INFERRED_SCHEMA = {
    "type": "OBJECT",
    "properties": {**_SECTIONS, "generated_readme_md": {"type": "STRING"}},
    "required": list(_SECTIONS) + ["generated_readme_md"],
}


def _repo_header(info):
    bits = [f"Repository: {info['owner']}/{info['name']}"]
    for label, key in (("Description", "description"), ("Primary language", "language"),
                       ("Homepage", "homepage"), ("License", "license")):
        if info.get(key):
            bits.append(f"{label}: {info[key]}")
    if info.get("topics"):
        bits.append("Topics: " + ", ".join(info["topics"]))
    bits.append(f"Files: {info['file_count']}")
    return "\n".join(bits)


def _snippets_block(info):
    return "\n\n".join(f"### {s['path']}\n```\n{s['content']}\n```" for s in info["snippets"])


def build_analysis_prompt(info):
    """One prompt that yields every analyzer section (was 3 calls that each resent the README)."""
    inferred = info["readme_source"] == "generated"
    rules = (
        "You are a senior engineer documenting a GitHub repository. Be concise and concrete; "
        "never invent features you cannot see evidence for. Markdown fields use '-' bullets and "
        "fenced code blocks for commands.\n"
        "- readme_summary_md: purpose (1 bullet), 2-4 key features, main technologies; "
        "include the single most useful code/usage example if one exists.\n"
        "- structure_md: project type and architecture (1 bullet), 2-4 main components/folders, "
        "notable scripts or config files, and the main entry point file name.\n"
        "- setup_md: required tools, install commands, run/test commands, env/config setup.\n"
    )
    if inferred:
        rules += (
            "- This repository has NO usable README. Infer what it does from the metadata, the "
            "file tree and the ranked key files (manifests first, then likely entry points). "
            "readme_summary_md must start with '> Inferred from source code — the repository has "
            "no README.'\n"
            "- generated_readme_md: a complete README for the project: '# <name>', one-paragraph "
            "description, Features, Tech stack, Project structure, Getting started, Usage. Keep it "
            "under 450 words.\n"
        )
    parts = [rules, "## Metadata", _repo_header(info)]
    if info.get("readme"):
        parts += ["## README" + (" (short stub)" if inferred else ""), info["readme"]]
    if info["snippets"]:
        parts += ["## Key files (condensed: head, imports, signatures)", _snippets_block(info)]
    parts += ["## File tree (compressed)", info["tree_compact"]]
    return "\n\n".join(parts), (INFERRED_SCHEMA if inferred else ANALYSIS_SCHEMA)


def _md(text):
    return markdown(text or "", extensions=["fenced_code", "tables"])


# --- Auth Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 400
        
        new_user = User(username=username)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201

        
    except Exception as e:
        print("Registration error:", e)
        traceback.print_exc()  # 🔹 Full error in Render logs
        return jsonify({'error': 'Registration failed', 'details': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({"message": "Logged in successfully", "user": {"username": user.username}}), 200
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/status', methods=['GET'])
def status():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "user": {"username": current_user.username}}), 200
    return jsonify({"logged_in": False}), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if db.engine else "disconnected"
    })

# --- API Routes ---
@app.route('/api/analyze', methods=['POST'])
def analyze_repo_route():
    data = request.get_json(silent=True) or {}
    repo_url = data.get('repo_url')
    if not repo_url:
        return jsonify({"error": "repo_url is required"}), 400

    owner, repo_name = parse_github_url(repo_url)
    if not owner or not repo_name:
        return jsonify({"error": "Invalid GitHub URL"}), 400
    if not gemini.configured:
        return jsonify({"error": "GEMINI_API_KEYS is not configured on the backend."}), 503

    cache_key = f"{owner}/{repo_name}".lower()
    cached = analysis_cache.get(cache_key)
    if cached and not data.get('refresh'):
        return jsonify({**cached, "ai_meta": {**cached["ai_meta"], "cached": True}})

    try:
        info = repo_insight.collect(owner, repo_name, github)
    except repo_insight.RepoError as e:
        return jsonify({"error": str(e)}), e.status
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Could not read repository: {e}"}), 500

    prompt, schema = build_analysis_prompt(info)
    try:
        result, meta = gemini.generate(prompt, schema=schema, max_output_tokens=8192)
    except GeminiError as e:
        return jsonify({"error": f"AI analysis failed: {e}"}), 502

    payload = {
        "readme_summary": _md(result.get("readme_summary_md")),
        "structure_analysis": _md(result.get("structure_md")),
        "setup_guide": _md(result.get("setup_md")),
        "generated_readme": _md(result.get("generated_readme_md")) if result.get("generated_readme_md") else None,
        "generated_readme_markdown": result.get("generated_readme_md"),
        "project_overview": {
            "purpose": result.get("purpose", ""),
            "category": result.get("category", ""),
            "tech_stack": result.get("tech_stack", []),
        },
        "readme_source": info["readme_source"],
        "readme_path": info["readme_path"],
        "key_files": info["key_files"],
        "repo": {k: info[k] for k in ("owner", "name", "sha", "description", "topics", "language",
                                      "stars", "license", "file_count")},
        # Full path list for the dependency graph (the frontend no longer calls GitHub itself).
        "file_structure": "\n".join(info["paths"][:3000]),
        "ai_meta": {
            "model": meta.get("model"),
            "cached": meta.get("cached", False),
            "prompt_chars": len(prompt),
            "tokens": (meta.get("usage") or {}).get("totalTokenCount"),
        },
    }
    analysis_cache.set(cache_key, payload)
    return jsonify(payload)


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Key-pool health (keys are masked to their last 4 characters)."""
    return jsonify(gemini.status())


@app.route('/api/trending', methods=['GET'])
def trending_repos_route():
    search_query = request.args.get('search_query', default=None, type=str)
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    q = [search_query] if search_query else []
    q.append(f"created:>{(datetime.utcnow() - timedelta(days=730)).strftime('%Y-%m-%d')}")
    params = {"q": " ".join(q), "sort": "stars", "order": "desc", "per_page": 12}

    try:
        resp = requests.get("https://api.github.com/search/repositories", params=params,
                            headers=headers, timeout=15)
        resp.raise_for_status()
        items = resp.json().get('items', [])
        result = [{
            'id': r['id'],
            'name': r['full_name'],
            'owner': r['owner']['login'],
            'url': r['html_url'],
            'stars': r['stargazers_count'],
            'description': r['description'] or '',
            'forks': r['forks_count'],
            'watchers': r['watchers_count'],
            'language': r['language'],
        } for r in items]
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"Error searching repos: {e}"}), 500


@app.route('/api/posts', methods=['GET'])
def get_posts():
    try:
        posts = Post.query.order_by(Post.timestamp.desc()).all()
        print(f"Found {len(posts)} posts in database")  # Debug log
        return jsonify([{
            'id': post.id,
            'repo_name': post.repo_name,
            'idea': post.idea,
            'timestamp': post.timestamp.strftime('%Y-%m-%d %H:%M'),
            'comments_count': len(post.comments)
        } for post in posts])
    except Exception as e:
        print(f"Error fetching posts: {e}")  # Debug log
        return jsonify({"error": "Failed to fetch posts"}), 500

@app.route('/api/test/create-sample-posts', methods=['POST'])
def create_sample_posts():
    """Create sample posts for testing (disabled in production)"""
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({"error": "Not available in production"}), 404
    try:
        sample_posts = [
            Post(repo_name="open-webui/open-webui", idea="hello"),
            Post(repo_name="test/repo", idea="This is a test idea for the community"),
            Post(repo_name="awesome/project", idea="Building something amazing with React and Node.js")
        ]
        
        for post in sample_posts:
            db.session.add(post)
        
        db.session.commit()
        return jsonify({"success": True, "message": "Sample posts created successfully!"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create sample posts: {e}"}), 500

@app.route('/api/posts', methods=['POST'])
def add_post():
    data = request.get_json(silent=True) or {}
    repo_name = data.get('repo_name')
    idea = data.get('idea')
    if repo_name and idea:
        try:
            new_post = Post(repo_name=repo_name, idea=idea)
            db.session.add(new_post)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Idea posted successfully!'}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Database error.'}), 500
    return jsonify({'success': False, 'message': 'Missing repository name or idea.'}), 400


# --- Comment (Reply) API ---
@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
def get_comments(post_id):
    post = Post.query.get_or_404(post_id)
    comments = Comment.query.filter_by(post_id=post.id).order_by(Comment.timestamp.asc()).all()
    return jsonify([
        {
            'id': c.id,
            'text': c.text,
            'timestamp': c.timestamp.strftime('%Y-%m-%d %H:%M')
        } for c in comments
    ])

@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.get_json(silent=True) or {}
    text = data.get('text')
    if not text:
        return jsonify({'success': False, 'message': 'Comment text required.'}), 400
    try:
        comment = Comment(text=text, post_id=post.id)
        db.session.add(comment)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Comment added!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Database error.'}), 500

# --- Discussions API (formerly the separate backends/server.js service) ---
@app.route('/api/discussions', methods=['GET'])
def list_discussions():
    items = Discussion.query.order_by(Discussion.timestamp.desc()).all()
    return jsonify([d.to_dict() for d in items])

@app.route('/api/discussions/<int:discussion_id>', methods=['GET'])
def get_discussion(discussion_id):
    d = db.session.get(Discussion, discussion_id)
    if not d:
        return jsonify({'error': 'Discussion not found'}), 404
    return jsonify(d.to_dict())

@app.route('/api/discussions', methods=['POST'])
def create_discussion():
    data = request.get_json(silent=True) or {}
    title, content = (data.get('title') or '').strip(), (data.get('content') or '').strip()
    if not title or not content:
        return jsonify({'error': 'Title and content are required.'}), 400
    d = Discussion(author=(data.get('author') or 'Anonymous').strip()[:100] or 'Anonymous',
                   title=title[:300], content=content)
    db.session.add(d)
    db.session.commit()
    return jsonify(d.to_dict()), 201

@app.route('/api/discussions/<int:discussion_id>/like', methods=['POST'])
def like_discussion(discussion_id):
    d = db.session.get(Discussion, discussion_id)
    if not d:
        return jsonify({'error': 'Discussion not found'}), 404
    d.likes = Discussion.likes + 1  # atomic increment in SQL
    db.session.commit()
    return jsonify({'likes': d.likes})

@app.route('/api/discussions/<int:discussion_id>/replies', methods=['GET'])
def list_replies(discussion_id):
    d = db.session.get(Discussion, discussion_id)
    if not d:
        return jsonify({'error': 'Discussion not found'}), 404
    return jsonify([r.to_dict() for r in d.replies])

@app.route('/api/discussions/<int:discussion_id>/replies', methods=['POST'])
def add_reply(discussion_id):
    d = db.session.get(Discussion, discussion_id)
    if not d:
        return jsonify({'error': 'Discussion not found'}), 404
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'Reply content is required.'}), 400
    r = DiscussionReply(author=(data.get('author') or 'Anonymous').strip()[:100] or 'Anonymous',
                        content=content, discussion_id=d.id)
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201

# --- Run the App ---
if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database initialized successfully")
        except Exception as e:
            print(f"⚠️ Database initialization error: {e}")
            print("📝 Note: Using temporary SQLite database in /tmp/")
    
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') != 'production'
    print(f"🚀 Starting CodeAtlas backend on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
