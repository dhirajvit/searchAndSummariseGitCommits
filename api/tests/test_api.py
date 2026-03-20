from unittest.mock import patch, MagicMock
import os
import sys
from pathlib import Path

# Ensure api/ is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["GITHUB_CLIENT_ID"] = "test-client-id"
os.environ["GITHUB_CLIENT_SECRET"] = "test-client-secret"
os.environ["X_API_KEY"] = "test-api-key"
os.environ["OPENAI_API_KEY"] = "test-openai-key"

from fastapi.testclient import TestClient
from index import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestGithubCallback:
    @patch("index.requests.post")
    def test_successful_token_exchange(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "gho_abc123"}
        mock_post.return_value = mock_response

        response = client.get("/api/github/callback?code=test-code")

        assert response.status_code == 200
        assert response.json() == {"access_token": "gho_abc123"}
        mock_post.assert_called_once_with(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": "test-client-id",
                "client_secret": "test-client-secret",
                "code": "test-code",
            },
            headers={"Accept": "application/json"},
        )

    @patch("index.requests.post")
    def test_failed_token_exchange(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"error": "bad_verification_code"}
        mock_post.return_value = mock_response

        response = client.get("/api/github/callback?code=bad-code")

        assert response.status_code == 400
        assert response.json()["detail"] == "Failed to get access token"


class TestGithubCommits:
    @patch("index.requests.get")
    def test_successful_commits_fetch(self, mock_get):
        # First call: list commits, second call: commit detail
        commits_response = MagicMock()
        commits_response.status_code = 200
        commits_response.json.return_value = [
            {
                "sha": "abc123",
                "commit": {
                    "message": "fix bug",
                    "author": {"name": "dev", "date": "2026-01-01T00:00:00Z"},
                },
            }
        ]

        detail_response = MagicMock()
        detail_response.status_code = 200
        detail_response.json.return_value = {
            "files": [{"filename": "index.ts"}, {"filename": "utils.ts"}]
        }

        mock_get.side_effect = [commits_response, detail_response]

        response = client.get(
            "/api/github/commits?repo=user/repo",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["commits"]) == 1
        assert data["commits"][0]["sha"] == "abc123"
        assert data["commits"][0]["message"] == "fix bug"
        assert data["commits"][0]["files"] == ["index.ts", "utils.ts"]

    @patch("index.requests.get")
    def test_github_api_error(self, mock_get):
        error_response = MagicMock()
        error_response.status_code = 404
        error_response.json.return_value = {"message": "Not Found"}
        mock_get.return_value = error_response

        response = client.get(
            "/api/github/commits?repo=nonexistent/repo",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 404


class TestSummarize:
    @patch("index.summarize")
    def test_successful_summarize(self, mock_summarize):
        mock_summarize.return_value = "Fixed a bug in the auth module."

        response = client.post(
            "/api/github/summarize",
            json={
                "message": "fix auth bug",
                "author": "dev",
                "date": "2026-01-01",
                "files": ["auth.py"],
            },
            headers={"x-api-key": "test-api-key"},
        )

        assert response.status_code == 200
        assert response.json() == {"summary": "Fixed a bug in the auth module."}

    @patch("index.summarize")
    def test_invalid_api_key(self, mock_summarize):
        response = client.post(
            "/api/github/summarize",
            json={"message": "fix bug", "author": "dev", "date": "2026-01-01", "files": []},
            headers={"x-api-key": "wrong-key"},
        )

        assert response.status_code == 401
        mock_summarize.assert_not_called()


class TestBuildPrompt:
    def test_build_prompt_with_files(self):
        from summarizer.context import build_prompt

        result = build_prompt("fix bug", "dev", "2026-01-01", ["index.ts", "utils.ts"])
        assert "fix bug" in result
        assert "dev" in result
        assert "index.ts, utils.ts" in result

    def test_build_prompt_no_files(self):
        from summarizer.context import build_prompt

        result = build_prompt("fix bug", "dev", "2026-01-01", [])
        assert "no files" in result
