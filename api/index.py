import logging
import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
import sys
from pathlib import Path

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from summarizer.agent import summarize

if not os.environ.get("VERCEL"):
    load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
X_API_KEY = os.environ.get("X_API_KEY", "")


def verify_api_key(x_api_key: str = Header()):
    if x_api_key != X_API_KEY:
        logger.warning("Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/api/health")
def health():
    return JSONResponse({"status": "ok"})


@app.get("/api/github/callback")
def github_callback(code: str):
    """Exchange GitHub OAuth code for an access token."""
    logger.info("OAuth callback received, exchanging code for token")
    response = requests.post(
        "https://github.com/login/oauth/access_token",
        json={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
    )
    data = response.json()
    if "access_token" not in data:
        logger.error("GitHub token exchange failed: %s", data)
        raise HTTPException(status_code=400, detail="Failed to get access token")
    logger.info("OAuth token exchange successful")
    return JSONResponse({"access_token": data["access_token"]})


@app.get("/api/github/commits")
def get_commits(repo: str, authorization: str = Header()):
    logger.info("Fetching commits for repo: %s", repo)
    token = authorization.replace("Bearer ", "")
    response = requests.get(
        f"https://api.github.com/repos/{repo}/commits",
        params={"per_page": 20},
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
    )
    if response.status_code != 200:
        logger.error("GitHub API error for repo %s: %s", repo, response.status_code)
        raise HTTPException(
            status_code=response.status_code,
            detail=response.json().get("message", "GitHub API error"),
        )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    commits = []
    for c in response.json():
        sha = c["sha"]
        detail = requests.get(
            f"https://api.github.com/repos/{repo}/commits/{sha}",
            headers=headers,
        )
        files = []
        if detail.status_code == 200:
            files = [f["filename"] for f in detail.json().get("files", [])]
        commits.append({
            "sha": sha,
            "message": c["commit"]["message"],
            "author": c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
            "files": files,
        })
    logger.info("Returning %d commits for repo: %s", len(commits), repo)
    return JSONResponse({"commits": commits})


@app.post("/api/github/summarize")
def summarize_commit(body: dict, x_api_key: str = Header()):
    verify_api_key(x_api_key)
    logger.info("Summarizing commit: %s", body.get("message", "")[:50])
    result = summarize(
        message=body.get("message", ""),
        author=body.get("author", ""),
        date=body.get("date", ""),
        files=body.get("files", []),
    )
    logger.info("Summarization complete")
    return JSONResponse({"summary": result})
