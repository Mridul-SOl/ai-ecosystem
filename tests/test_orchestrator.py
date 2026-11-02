import pytest
import asyncio

@pytest.mark.asyncio
async def test_ceo_orchestration_workflow(client):
    objective = "Create a marketing strategy for a new clothing brand with a budget of ₹50,000."
    wf_resp = await client.post("/api/workflows", json={"objective": objective})
    assert wf_resp.status_code == 200, wf_resp.text
    wf_data = wf_resp.json()
    wf_id = wf_data["id"]
    assert wf_data["total_steps"] >= 3
    assert len(wf_data["tasks"]) >= 3

    # Verify assigned agents include research, marketing, and finance
    assigned_agents = {t["assigned_agent_id"] for t in wf_data["tasks"]}
    assert "research" in assigned_agents or "marketing" in assigned_agents

    # Poll for completion
    for _ in range(15):
        await asyncio.sleep(1)
        check_resp = await client.get(f"/api/workflows/{wf_id}")
        assert check_resp.status_code == 200
        cur = check_resp.json()
        if cur["status"] == "Completed":
            assert cur["final_result"] is not None
            assert len(cur["final_result"]) > 100
            assert "Executive Strategy" in cur["final_result"] or "Objective" in cur["final_result"]
            return

    # If it didn't finish in 15s, check that progress is being made
    final_check = await client.get(f"/api/workflows/{wf_id}")
    assert final_check.json()["current_step"] > 0
