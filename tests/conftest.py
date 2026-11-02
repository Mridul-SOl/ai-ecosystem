import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.database import engine, Base
from backend.agents.agent_registry import agent_registry

@pytest.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await agent_registry.seed_database()
    yield

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
