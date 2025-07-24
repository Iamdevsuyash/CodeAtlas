# app.py
import os
import re
import requests
import base64
import google.generativeai as genai
from flask import Flask, render_template, request
from dotenv import load_dotenv
from markdown import markdown

# --- Step 1: Load API Keys & Configure ---
load_dotenv()
app = Flask(__name__, template_folder='templates', static_folder='static')

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

# --- Step 2: GitHub & Gemini Helper Functions ---

# --- Functions for README Summary (from previous version) ---
def parse_github_url(url):
    pattern = r"https://github\.com/([^/]+)/([^/]+)"
    match = re.search(pattern, url)
    if match:
        return match.group(1), match.group(2).strip()
    return None, None

def get_github_readme(owner, repo_name):
    print(f"📥 Fetching README for {owner}/{repo_name}...")
    url = f"https://api.github.com/repos/{owner}/{repo_name}/readme"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        content = base64.b64decode(response.json()['content']).decode('utf-8')
        print("✅ README fetched successfully.")
        return content, None
    except requests.exceptions.HTTPError as err:
        return None, f"Could not fetch README. Repository might be private, or have no README. (HTTP Error: {err.response.status_code})"
    except Exception as e:
        return None, f"An unexpected error occurred while fetching README: {e}"

def summarize_readme_with_gemini(readme_content):
    if not readme_content:
        return None, "README content is empty."
    print("🧠 Generating README summary...")
    prompt = f"""
    As a senior software engineer, analyze the following README and provide a concise summary.
    1. **Project Purpose**: A single sentence explaining what the project does.
    2. **Key Features**: A bulleted list of 3-5 important features.
    3. **Technology Stack**: A brief list of the main technologies mentioned.
    Format your response in Markdown.
    ---
    {readme_content}
    """
    
    try:
        response = model.generate_content(prompt)
        print("✅ README summary generated.")
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating README summary from Gemini: {e}"

# --- 🆕 Functions for Project Structure Analysis ---
def get_github_file_structure(owner, repo_name):
    """Fetches the file structure of a GitHub repository."""
    print(f"🌳 Fetching file structure for {owner}/{repo_name}...")
    # First, get the default branch
    repo_url = f"https://api.github.com/repos/{owner}/{repo_name}"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    try:
        repo_info = requests.get(repo_url, headers=headers, timeout=10)
        repo_info.raise_for_status()
        default_branch = repo_info.json()['default_branch']

        # Then, get the file tree recursively
        tree_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{default_branch}?recursive=1"
        tree_response = requests.get(tree_url, headers=headers, timeout=15)
        tree_response.raise_for_status()

        files = [item['path'] for item in tree_response.json()['tree'] if item['type'] == 'blob']
        # Limit file list to avoid excessively long prompts
        if len(files) > 200:
             files = files[:200]
             print("⚠️ File list truncated to 200 items.")

        print("✅ File structure fetched successfully.")
        return "\n".join(files), None
    except requests.exceptions.HTTPError as err:
        return None, f"Could not fetch file structure. (HTTP Error: {err.response.status_code})"
    except Exception as e:
        return None, f"An unexpected error occurred while fetching file structure: {e}"

def analyze_structure_with_gemini(file_structure):
    """Generates a project architecture analysis from a file list."""
    if not file_structure:
        return None, "File structure is empty."
    print("🏛️ Generating structure analysis...")
    prompt = f"""
    You are a principal software architect. Based *only* on the file structure list provided below, perform a high-level analysis.
    
    1.  **Likely Architecture & Purpose**: What kind of application is this (e.g., Web App, Data Science Project, CLI Tool, Library)? What software architecture or framework might it be using (e.g., Flask, React, Django, Microservices)?
    2.  **Key Components**: Identify the purpose of major directories (e.g., `src`, `tests`, `static`, `components`).
    3.  **Code Organization**: Briefly comment on the project's apparent organization and conventions based on the file and folder names.

    Format the entire response in Markdown. Do not make assumptions about the code *inside* the files.
    ---
    FILE STRUCTURE:
    {file_structure}
    """
    try:
        response = model.generate_content(prompt)
        print("✅ Structure analysis generated.")
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating structure analysis from Gemini: {e}"
def get_setup_guide_with_gemini(readme, file_structure):
    prompt = f"""
    Based on the following README and file structure, guide a junior developer on how to set up and run this project locally.

    Include:
    1. Required software/tools (e.g., Python, Node.js, Docker)
    2. Dependency installation commands
    3. Setup or build commands (if any)
    4. How to run or test the project
    5. Environment variable setup (if found in .env or README)

    Format the output in clear Markdown with step-by-step instructions.

    --- README ---
    {readme}

    --- FILE STRUCTURE ---
    {file_structure}
    """
    try:
        response = model.generate_content(prompt)
        print("✅ Setup guide generated.")
        return markdown(response.text), None
    except Exception as e:
        return None, f"Error generating setup guide from Gemini: {e}"


# --- Step 3: Flask Route ---
@app.route('/', methods=['GET', 'POST'])
def index():
    readme_summary = None
    structure_analysis = None
    setup_guide = None   # ✅ Define it here
    error = None
    repo_url = ""

    if request.method == 'POST':
        repo_url = request.form.get('repo_url')
        owner, repo_name = parse_github_url(repo_url)

        if not owner or not repo_name:
            error = "Invalid GitHub URL. Please use the format: https://github.com/owner/repo"
        else:
            # Fetch README and generate summary
            readme_content, fetch_err = get_github_readme(owner, repo_name)
            if fetch_err:
                error = fetch_err
            else:
                readme_summary, summary_err = summarize_readme_with_gemini(readme_content)
                if summary_err: error = summary_err

            # Fetch file structure and generate analysis
            file_structure, structure_err = get_github_file_structure(owner, repo_name)
            if structure_err:
                error = (error + "\n" + structure_err) if error else structure_err
            else:
                structure_analysis, analysis_err = analyze_structure_with_gemini(file_structure)
                if analysis_err:
                    error = (error + "\n" + analysis_err) if error else analysis_err

            # ✅ Generate setup guide
            setup_guide, setup_err = get_setup_guide_with_gemini(readme_content, file_structure)
            if setup_err:
                error = (error + "\n" + setup_err) if error else setup_err

    return render_template(
        'index.html',
        readme_summary=readme_summary,
        structure_analysis=structure_analysis,
        setup_guide=setup_guide,
        error=error,
        repo_url=repo_url
    )

# --- Run the App ---
if __name__ == '__main__':
    app.run(debug=True)