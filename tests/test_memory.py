import pytest

@pytest.mark.asyncio
async def test_memory_indexing_and_search(client):
    # Add memory item
    add_resp = await client.post("/api/memory", json={
        "content": "Clothing brand unit economics target: CAC must not exceed ₹400 for first 500 customers.",
        "agent_id": "finance",
        "category": "pricing_rule"
    })
    assert add_resp.status_code == 200
    res_data = add_resp.json()
    assert res_data["success"] is True

    # Search for this memory
    search_resp = await client.post("/api/memory/search", json={
        "query": "clothing brand unit economics CAC target",
        "agent_id": "finance"
    })
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert len(search_data["results"]) > 0

    # Test recent memories endpoint
    rec_resp = await client.get("/api/memory/recent")
    assert rec_resp.status_code == 200
    assert rec_resp.json()["count"] > 0
