# 🚀 CodeAtlas  
*A Full-Stack Web Application for Discovering, Analyzing, and Discussing Trending GitHub Repositories*

---

## 📌 Overview

**CodeAtlas** is a powerful full-stack web app that enables developers to explore trending GitHub repositories, analyze their structure and README files using Gemini AI, and collaborate by sharing ideas. Built with **Flask** and **React**, it offers a seamless and responsive experience for developers and learners alike.

---

## ✨ Features

- 🔐 **User Authentication** — Register, login, and logout securely.  
- 📈 **Trending Repositories** — Search and explore GitHub’s trending repos.  
- 🤖 **Repository Analyzer** — AI-powered README summarization, folder structure analysis, and setup guidance.  
- 💡 **Ideas & Discussion Forum** — Share thoughts and reply to others in threaded conversations.  
- 🧩 **API Hub** — Browse categorized public APIs for integration and learning.  
- 💻 **Modern UI** — React-based responsive interface with smooth navigation.

---

## 🧰 Tech Stack

| Frontend | Backend | Database | APIs |
|----------|---------|----------|------|
| React, JavaScript, CSS | Flask, Flask-Login, SQLAlchemy, Flask-CORS | SQLite | GitHub API, Gemini AI API, Public APIs |

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Iamdevsuyash/CodeAtlas.git
cd CodeAtlas
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
GITHUB_TOKEN="your_github_token"
GEMINI_API_KEY="your_gemini_api_key"
python backend1.py
# Navigate to frontend directory
cd Frontend

# Install frontend dependencies
npm install

# Start the frontend development server
npm start
