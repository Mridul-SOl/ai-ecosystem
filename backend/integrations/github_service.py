import logging
from typing import Dict, Any, List, Optional
from backend.config import settings

logger = logging.getLogger(__name__)

class GitHubService:
    def __init__(self):
        self.token = settings.GITHUB_TOKEN

    def is_configured(self) -> bool:
        return bool(self.token and len(self.token.strip()) > 5)

    async def get_repo_info(self, repo_name: str) -> Dict[str, Any]:
        """
        Retrieves repository details using PyGithub if configured, or returns realistic mock.
        """
        if not self.is_configured():
            logger.info("GitHub token not configured, using mock GitHub service.")
            return {
                "name": repo_name,
                "full_name": f"organization/{repo_name}",
                "description": "Enterprise repository managed by AI ECOSYSTEM",
                "default_branch": "main",
                "stars": 42,
                "open_issues": 3,
                "status": "simulated (provide GITHUB_TOKEN in Settings to connect live)"
            }

        try:
            from github import Github, Auth
            auth = Auth.Token(self.token)
            g = Github(auth=auth)
            repo = g.get_repo(repo_name)
            return {
                "name": repo.name,
                "full_name": repo.full_name,
                "description": repo.description or "",
                "default_branch": repo.default_branch,
                "stars": repo.stargazers_count,
                "open_issues": repo.open_issues_count,
                "status": "live"
            }
        except Exception as e:
            logger.error("GitHub API error: %s", e)
            return {"error": str(e), "status": "error"}

    async def create_issue(self, repo_name: str, title: str, body: str) -> Dict[str, Any]:
        """
        Creates an issue on a GitHub repository.
        """
        if not self.is_configured():
            return {
                "issue_id": 101,
                "title": title,
                "body": body,
                "status": "simulated_created",
                "message": "Mock issue created (add GITHUB_TOKEN in Settings to create live GitHub issues)"
            }

        try:
            from github import Github, Auth
            auth = Auth.Token(self.token)
            g = Github(auth=auth)
            repo = g.get_repo(repo_name)
            issue = repo.create_issue(title=title, body=body)
            return {
                "issue_id": issue.number,
                "title": issue.title,
                "html_url": issue.html_url,
                "status": "created"
            }
        except Exception as e:
            logger.error("Failed to create GitHub issue: %s", e)
            return {"error": str(e), "status": "error"}

github_service = GitHubService()
