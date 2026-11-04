import pytest

@pytest.mark.asyncio
async def test_supabase_sync_instant_authorization(client):
    """
    Verifies that Supabase users are instantly provisioned and authorized
    without email confirmation barrier.
    """
    sync_payload = {
        "id": "supa-user-instant-999",
        "email": "executive_leader@enterprise.ai",
        "username": "executive_leader",
        "role": "admin"
    }

    resp = await client.post("/api/auth/supabase-sync", json=sync_payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "executive_leader@enterprise.ai"
    assert data["user"]["full_name"] == "executive_leader"
    assert data["user"]["is_active"] is True

    # Verify that the issued token accesses protected endpoints
    token = data["access_token"]
    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "executive_leader@enterprise.ai"

@pytest.mark.asyncio
async def test_unauthenticated_request_handling(client):
    """
    Verifies that requests without valid credentials fail cleanly with 401.
    """
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
