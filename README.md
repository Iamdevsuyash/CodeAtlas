# 🚀 CodeAtlas

> **A Full-Stack Web Application for Discovering, Analyzing, and Discussing Trending GitHub Repositories**

🌐 **Live Demo:** [https://gitatlas.netlify.app](https://gitatlas.netlify.app)

---

## 📌 What is CodeAtlas?

CodeAtlas is a developer-focused platform where you can:
- Explore **trending GitHub repositories**
- Get **AI-powered analysis** of any GitHub repo — README summary, folder structure breakdown, setup guide
- **Discuss ideas** with other developers in a threaded forum
- Browse a curated **API Hub** of public APIs

Built with a React frontend, Flask REST API backend, PostgreSQL database, and Google Gemini AI integration.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 User Authentication | Register, login, logout — session managed via Flask-Login |
| 📈 Trending Repositories | Search and explore GitHub's trending repos by language and topic |
| 🤖 AI Repository Analyzer | Paste any GitHub repo URL — get an AI-generated summary, tech stack, and setup guide |
| 💡 Ideas & Discussion Forum | Share ideas on repos, reply to others in threaded conversations |
| 🧩 API Hub | Browse categorized public APIs for learning and integration |
| 🔄 Real-time Updates | Live discussion updates without page refresh using Gun.js |

---

## 🧰 Tech Stack

### Frontend
- **React** — Component-based UI
- **JavaScript (ES6+)**
- **CSS3**
- Deployed on **Netlify**

### Backend
- **Python 3**
- **Flask** — REST API framework
- **Flask-Login** — User session management
- **Flask-CORS** — Cross-origin request handling
- **SQLAlchemy** — ORM for database operations
- Deployed on **Render**

### Database
- **SQLite** — Local development
- **PostgreSQL** — Production (hosted on Render)

### External APIs
- **GitHub API** — Fetch repository data, README, folder structure
- **Google Gemini AI API** — AI-powered repository analysis and summarization

### Real-time
- **Gun.js** — Decentralized real-time database for live discussion updates
- Deployed as a separate **Node.js** server on Render

---

## 🏗️ Architecture

```
React Frontend (Netlify)
        │
        │  REST API calls (HTTP/JSON)
        ▼
Flask Backend (Render)
        │                    │
        ▼                    ▼
PostgreSQL DB          GitHub API + Gemini AI
(Render)

Gun.js Server (Render) ← Real-time discussion updates
```

---

## 🤖 How AI Analyzer Works

```
User pastes GitHub repo URL
        ↓
Flask fetches README + folder structure via GitHub API
        ↓
Data sent to Google Gemini AI with analysis prompt
        ↓
Gemini returns: Summary | Tech Stack | Setup Guide | Use Cases
        ↓
React displays results as formatted cards
```

---

## 🗄️ Database Design

Two main tables managed via SQLAlchemy ORM:

- **User** — id, username, email, password (hashed)
- **Post** — id, repo_name, idea, author, created_at
- **Reply** — id, content, author, post_id (foreign key → Post)

---

## ⚙️ Local Setup

### Prerequisites
- Python 3.9+
- Node.js 16+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Iamdevsuyash/CodeAtlas.git
cd CodeAtlas
```

### 2. Backend Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
# Create a .env file and add:
GITHUB_TOKEN=your_github_token_here
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here

# Run backend
python backend1.py
```
Backend runs at: `http://localhost:5000`

### 3. Frontend Setup
```bash
cd Frontend
npm install
npm start
```
Frontend runs at: `http://localhost:3000`

---

## 🔑 API Keys

| Key | Where to Get |
|-----|-------------|
| `GITHUB_TOKEN` | github.com → Settings → Developer Settings → Personal Access Tokens |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |

---

## 📡 Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login user |
| POST | `/api/logout` | Logout user |
| GET | `/api/user` | Get current logged-in user |
| GET | `/api/trending` | Fetch trending GitHub repos |
| GET | `/api/analyze/<repo_url>` | AI analysis of a GitHub repo |
| GET | `/api/posts` | Fetch all discussion posts |
| POST | `/api/posts` | Create a new idea post |
| POST | `/api/posts/<id>/reply` | Reply to a post |
| GET | `/api/health` | Server health check |

---

## 🚀 Deployment

### Frontend → Netlify
```
Base directory:    Frontend
Build command:     npm run build
Publish directory: Frontend/build

Environment Variables:
REACT_APP_API_URL = https://codeatlas-backend.onrender.com
REACT_APP_GUN_URL = https://codeatlas-gunjs.onrender.com
```

### Backend → Render
```
Environment:   Python 3
Build Command: pip install -r requirements.txt
Start Command: python backend1.py

Environment Variables:
FLASK_ENV        = production
GITHUB_TOKEN     = your_token
GEMINI_API_KEY   = your_key
DATABASE_URL     = (auto-set by Render PostgreSQL)
CORS_ORIGINS     = https://gitatlas.netlify.app
```

### Gun.js Server → Render
```
Environment:   Node
Build Command: npm install
Start Command: node gun-server.js
```

---

## 📁 Project Structure

```
CodeAtlas/
├── Frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page-level components
│   │   └── App.js          # Root component
│   └── package.json
│
├── Backend/
│   ├── backend1.py         # Flask app — all API routes
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Environment variables (not committed)
│
├── Gunserver/
│   ├── gun-server.js       # Gun.js real-time server
│   └── package.json
│
├── render.yaml             # Render deployment config
└── README.md
```

---

## 🔒 Security

- Passwords are hashed before storing
- API keys stored in environment variables — never committed to GitHub
- `.env` file added to `.gitignore`
- CORS configured to allow only trusted origins
- HTTPS enforced on all deployed services

---

## 👨‍💻 Author

**Suyash** — [GitHub](https://github.com/Iamdevsuyash)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
