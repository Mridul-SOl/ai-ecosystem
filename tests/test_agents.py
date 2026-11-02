import pytest

@pytest.mark.asyncio
async def test_all_eight_agents_exist(client):
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    agents = resp.json()
    assert len(agents) == 8

    expected_ids = {"ceo", "hr", "marketing", "finance", "operations", "research", "security", "infrastructure"}
    actual_ids = {a["id"] for a in agents}
    assert expected_ids == actual_ids

    for agent in agents:
        assert agent["name"]
        assert agent["department"]
        assert agent["role"]
        assert len(agent["capabilities"]) > 0

@pytest.mark.asyncio
async def test_direct_agent_chat(client):
    # Direct chat with Marketing Agent Chloe
    resp = await client.post("/api/agents/marketing/chat", json={
        "message": "What are the best channels for reaching Gen Z consumers for apparel?"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_id"] == "marketing"
    assert "reply" in data
    assert len(data["reply"]) > 50

@pytest.mark.asyncio
async def test_agent_history(client):
    resp = await client.get("/api/agents/marketing/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
    assert "tasks" in data
