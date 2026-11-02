from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.integrations.github_service import github_service
from backend.integrations.playwright_service import playwright_service
from backend.integrations.email_service import email_service
from backend.config import settings
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

class GitHubRepoRequest(BaseModel):
    repo_name: str

class GitHubIssueRequest(BaseModel):
    repo_name: str
    title: str
    body: str

class ScrapeRequest(BaseModel):
    url: str

class EmailSendRequest(BaseModel):
    to_email: str
    subject: str
    body: str

@router.post("/github/repo")
async def get_github_repo(req: GitHubRepoRequest):
    return await github_service.get_repo_info(req.repo_name)

@router.post("/github/issue")
async def create_github_issue(req: GitHubIssueRequest):
    if settings.REQUIRE_APPROVAL_FOR_GITHUB:
        await log_activity(
            action="GITHUB_ISSUE_REQUESTED",
            message=f"GitHub issue creation requested for '{req.repo_name}': {req.title}",
            level="ACTION",
            agent_id="infrastructure"
        )
    return await github_service.create_issue(req.repo_name, req.title, req.body)

@router.post("/playwright/scrape")
async def scrape_web(req: ScrapeRequest):
    await log_activity(
        action="WEB_RESEARCH_SCRAPE",
        message=f"Research agent scraping URL: {req.url}",
        level="ACTION",
        agent_id="research"
    )
    return await playwright_service.scrape_url(req.url)

@router.post("/email/send")
async def send_email(req: EmailSendRequest):
    await log_activity(
        action="EMAIL_DISPATCH",
        message=f"Email dispatch to {req.to_email}: '{req.subject}'",
        level="ACTION",
        agent_id="operations"
    )
    return await email_service.send_email(req.to_email, req.subject, req.body)
