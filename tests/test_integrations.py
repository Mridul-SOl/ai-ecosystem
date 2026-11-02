import pytest

@pytest.mark.asyncio
async def test_github_integration(client):
    resp = await client.post("/api/integrations/github/repo", json={
        "repo_name": "ai-ecosystem-core"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "name" in data
    assert data["name"] == "ai-ecosystem-core"

@pytest.mark.asyncio
async def test_playwright_scrape(client):
    resp = await client.post("/api/integrations/playwright/scrape", json={
        "url": "https://example.com"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "url" in data
    assert "text" in data

@pytest.mark.asyncio
async def test_email_dispatch(client):
    resp = await client.post("/api/integrations/email/send", json={
        "to_email": "executive@example.com",
        "subject": "Q1 Market Strategy Ready",
        "body": "The CEO agent has consolidated the Q1 marketing and financial strategy."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
