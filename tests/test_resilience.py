import pytest
import asyncio
from backend.ai.llm_provider import GroqProvider, AutonomousHeuristicProvider

@pytest.mark.asyncio
async def test_groq_resilient_fallback():
    """
    Verifies that if Groq fails or is unreachable, GroqProvider gracefully
    falls back to AutonomousHeuristicProvider instead of crashing the system.
    """
    # Instantiate with non-existent/invalid API key to simulate connection/auth failure
    failing_groq = GroqProvider(api_key="gsk_invalid_test_key_for_offline_simulation")

    response = await failing_groq.generate_response(
        system_prompt="You are CEO Vikram.",
        user_prompt="Provide a brief strategic overview for launch."
    )
    assert response is not None
    assert len(response) > 50

    json_res = await failing_groq.generate_json(
        system_prompt="You are CEO Vikram.",
        user_prompt="Provide structured breakdown."
    )
    assert isinstance(json_res, dict)
    assert len(json_res) > 0

@pytest.mark.asyncio
async def test_workflow_deadlock_prevention(client):
    """
    Verifies that workflow pipeline executes to terminal status without infinite loop or hanging.
    """
    objective = "Audit quarterly expenses and prepare tax provisions."
    wf_resp = await client.post("/api/workflows", json={"objective": objective})
    assert wf_resp.status_code == 200
    wf_id = wf_resp.json()["id"]

    # Poll workflow execution
    completed_or_failed = False
    for _ in range(25):
        await asyncio.sleep(1)
        check_resp = await client.get(f"/api/workflows/{wf_id}")
        assert check_resp.status_code == 200
        cur = check_resp.json()
        if cur["status"] in ("Completed", "Failed"):
            completed_or_failed = True
            break

    assert completed_or_failed, "Workflow failed to conclude within time window (deadlock detected)"
