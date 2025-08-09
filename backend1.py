
import os
import re
import requests
import base64
import google.generativeai as genai
from flask import Flask, request, jsonify, session, make_response
from flask_cors import CORS
from dotenv import load_dotenv
from markdown import markdown
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user


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
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or f"sqlite:///tmp/ideas.db"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
# More permissive CORS configuration for debugging
CORS(app, 
     supports_credentials=True,
     origins='*',
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
     expose_headers=['Content-Type', 'Authorization'])


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

# Call database initialization immediately
init_database()

# CORS is handled by flask-cors configuration above


# --- Database Models ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))

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

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Securely load API keys
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GITHUB_TOKEN or not GEMINI_API_KEY:
    raise ValueError("🔴 Critical Error: GITHUB_TOKEN or GEMINI_API_KEY not found in .env file.")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-pro")
except Exception as e:
    raise RuntimeError(f"🔴 Error configuring Gemini AI: {e}")

# --- Helper Functions ---
def parse_github_url(url):
    pattern = r"https://github\.com/([^/]+)/([^/]+)"
    match = re.search(pattern, url)
    if match:
        return match.group(1), match.group(2).strip()
    return None, None

def get_github_readme(owner, repo_name):
    url = f"https://api.github.com/repos/{owner}/{repo_name}/readme"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        content = base64.b64decode(response.json()['content']).decode('utf-8')
        return content, None
    except requests.exceptions.HTTPError as err:
        return None, f"Could not fetch README. (HTTP Error: {err.response.status_code})"
    except Exception as e:
        return None, f"An unexpected error occurred: {e}"

def summarize_readme_with_gemini(readme_content):
    if not readme_content:
        return None, "README content is empty."
    prompt = f"Summarize the following README in concise bullet points. Include:\n- Main project purpose (1 bullet)\n- 2-4 key features (bullets)\n- Main technologies (bullets)\nIf there are any code examples, show the most important one as a code snippet.\nFormat your response in Markdown.\n---\n{readme_content}"
    try:
        response = model.generate_content(prompt)
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating summary: {e}"

def get_github_file_structure(owner, repo_name):
    repo_url = f"https://api.github.com/repos/{owner}/{repo_name}"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    try:
        repo_info = requests.get(repo_url, headers=headers, timeout=10)
        repo_info.raise_for_status()
        default_branch = repo_info.json()['default_branch']
        tree_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{default_branch}?recursive=1"
        tree_response = requests.get(tree_url, headers=headers, timeout=15)
        tree_response.raise_for_status()
        files = [item['path'] for item in tree_response.json()['tree'] if item['type'] == 'blob']
        return "\n".join(files[:200]), None
    except Exception as e:
        return None, f"Could not fetch file structure: {e}"

def analyze_structure_with_gemini(file_structure):
    if not file_structure:
        return None, "File structure is empty."
    prompt = f"Based only on the file structure below, provide:\n- Project type and likely architecture (1 bullet)\n- 2-4 main components or folders (bullets)\n- Any special scripts or config files (bullets)\nIf you see a main entry point or config, show a code snippet of its filename.\nFormat your response in Markdown.\n---\n{file_structure}"
    try:
        response = model.generate_content(prompt)
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating analysis: {e}"

def get_setup_guide_with_gemini(readme, file_structure):
    prompt = f"Write a brief, step-by-step setup guide for this project as bullet points.\n- List required tools\n- Show install commands as code snippets\n- Show run/test commands as code snippets\n- Mention any .env or config setup if needed\nFormat your response in Markdown.\n---README---\n{readme}\n---FILE STRUCTURE---\n{file_structure}"
    try:
        response = model.generate_content(prompt)
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating setup guide: {e}"


# --- Auth Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    new_user = User(username=username)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
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

# --- API Hub Routes ---
@app.route('/api/apihub/categories', methods=['GET'])
@login_required
def get_api_categories():
    try:
        response = requests.get('https://api.publicapis.org/categories')
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch API categories: {e}"}), 500

@app.route('/api/apihub/entries', methods=['GET'])
@login_required
def get_api_entries():
    category = request.args.get('category')
    if not category:
        return jsonify({"error": "Category parameter is required"}), 400
    try:
        response = requests.get(f'https://api.publicapis.org/entries?category={category}')
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch API entries: {e}"}), 500

# --- API Routes ---
@app.route('/api/analyze', methods=['POST'])
@login_required
def analyze_repo_route():
    data = request.get_json()
    repo_url = data.get('repo_url')
    if not repo_url:
        return jsonify({"error": "repo_url is required"}), 400

    owner, repo_name = parse_github_url(repo_url)
    if not owner or not repo_name:
        return jsonify({"error": "Invalid GitHub URL"}), 400

    readme_content, error = get_github_readme(owner, repo_name)
    if error:
        return jsonify({"error": error}), 500
    
    readme_summary, error = summarize_readme_with_gemini(readme_content)
    if error:
        return jsonify({"error": error}), 500

    file_structure, error = get_github_file_structure(owner, repo_name)
    if error:
        return jsonify({"error": error}), 500

    structure_analysis, error = analyze_structure_with_gemini(file_structure)
    if error:
        return jsonify({"error": error}), 500
        
    setup_guide, error = get_setup_guide_with_gemini(readme_content, file_structure)
    if error:
        return jsonify({"error": error}), 500

    return jsonify({
        "readme_summary": readme_summary,
        "structure_analysis": structure_analysis,
        "setup_guide": setup_guide,
        "file_structure": file_structure,
    })

@app.route('/api/trending', methods=['GET'])
def trending_repos_route():
    search_query = request.args.get('search_query', default=None, type=str)
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    q = [f"{search_query}"] if search_query else []
    q.append(f"created:>{(datetime.utcnow() - timedelta(days=730)).strftime('%Y-%m-%d')}")
    query = '+'.join(q)
    url = f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page=12"
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        items = resp.json().get('items', [])
        result = [{
            'name': r['full_name'],
            'url': r['html_url'],
            'stars': r['stargazers_count'],
            'description': r['description'] or '',
            'forks': r['forks_count'],
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
    """Create sample posts for testing"""
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
@login_required
def add_post():
    data = request.get_json()
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
@login_required
def add_comment(post_id):
    post = Post.query.get_or_404(post_id)
    data = request.get_json()
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
