import pytest
import asyncio

@pytest.mark.asyncio
async def test_task_lifecycle_and_approval(client):
    # 1. Create a task that requires approval
    task_payload = {
        "title": "Audit SSL Certs and Threat Surface",
        "description": "Perform network scan and review certificate expiration.",
        "department": "Information Security & Compliance",
        "assigned_agent_id": "security",
        "priority": "High",
        "requires_approval": True
    }
    create_resp = await client.post("/api/tasks", json=task_payload)
    assert create_resp.status_code == 200
    task_data = create_resp.json()
    task_id = task_data["id"]
    assert task_data["status"] == "Pending"
    assert task_data["requires_approval"] is True

    # Allow background dispatcher to transition task to Awaiting Approval
    await asyncio.sleep(0.8)

    get_resp = await client.get(f"/api/tasks/{task_id}")
    assert get_resp.status_code == 200
    current_status = get_resp.json()["status"]
    assert current_status in ["Awaiting Approval", "Pending", "Running"]

    # Approve task
    appr_resp = await client.post(f"/api/tasks/{task_id}/approve")
    assert appr_resp.status_code == 200
    assert appr_resp.json()["is_approved"] is True

    # Cancel a task
    cancel_resp = await client.post(f"/api/tasks/{task_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "Cancelled"

    # Retry a task
    retry_resp = await client.post(f"/api/tasks/{task_id}/retry")
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "Pending"
