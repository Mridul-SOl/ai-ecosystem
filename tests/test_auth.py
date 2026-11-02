import pytest
import uuid

@pytest.mark.asyncio
async def test_register_and_login(client):
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    reg_resp = await client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "strongPassword123",
        "full_name": "Test Engineer",
        "role": "admin"
    })
    assert reg_resp.status_code == 200, reg_resp.text
    reg_data = reg_resp.json()
    assert reg_data["email"] == unique_email
    assert reg_data["role"] == "admin"

    # Login
    login_resp = await client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "strongPassword123"
    })
    assert login_resp.status_code == 200, login_resp.text
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"

    # Test authenticated /me
    token = login_data["access_token"]
    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == unique_email
