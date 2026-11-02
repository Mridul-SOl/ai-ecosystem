import logging
from typing import Dict, List, Optional
from sqlalchemy.future import select
from backend.database import AsyncSessionLocal
from backend.models import Agent, User, SystemSettings
from backend.auth import get_password_hash
from backend.agents.definitions import AGENT_DEFINITIONS, create_agent_from_def, BaseAgent

logger = logging.getLogger(__name__)

class AgentRegistry:
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
        for definition in AGENT_DEFINITIONS:
            agent_instance = create_agent_from_def(definition)
            self._agents[definition["agent_id"]] = agent_instance

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        return self._agents.get(agent_id.lower())

    def list_agents(self) -> List[BaseAgent]:
        return list(self._agents.values())

    async def seed_database(self):
        """
        Synchronizes agents and seeds default admin account and settings into SQLite.
        """
        async with AsyncSessionLocal() as session:
            # 1. Seed or update Agents
            for defn in AGENT_DEFINITIONS:
                result = await session.execute(select(Agent).where(Agent.id == defn["agent_id"]))
                existing = result.scalar_one_or_none()
                if not existing:
                    agent_record = Agent(
                        id=defn["agent_id"],
                        name=defn["name"],
                        department=defn["department"],
                        role=defn["role"],
                        description=defn["description"],
                        system_prompt=defn["system_prompt"],
                        avatar=defn["avatar"],
                        capabilities=defn["capabilities"],
                        status="idle",
                        tasks_completed=0,
                        tasks_pending=0,
                        is_active=True
                    )
                    session.add(agent_record)
                else:
                    # Update fields that might have changed
                    existing.name = defn["name"]
                    existing.department = defn["department"]
                    existing.role = defn["role"]
                    existing.description = defn["description"]
                    existing.system_prompt = defn["system_prompt"]
                    existing.avatar = defn["avatar"]
                    existing.capabilities = defn["capabilities"]

            # 2. Seed Default Admin User if no users exist
            user_result = await session.execute(select(User))
            if not user_result.scalars().first():
                admin_user = User(
                    email="admin@aiecosystem.internal",
                    hashed_password=get_password_hash("admin123456"),
                    full_name="Executive Administrator",
                    role="admin",
                    is_active=True
                )
                session.add(admin_user)
                logger.info("Created default administrator user: admin@aiecosystem.internal / admin123456")

            # 3. Seed Default System Settings if not present
            default_settings = [
                ("llm_provider", "groq", False),
                ("groq_model", "llama-3.3-70b-versatile", False),
                ("groq_api_key", "", True),
                ("openai_model", "gpt-4o-mini", False),
                ("ollama_model", "llama3", False),
                ("require_approval_email", "true", False),
                ("require_approval_github", "true", False),
                ("theme", "dark", False)
            ]
            for key, val, is_sec in default_settings:
                s_res = await session.execute(select(SystemSettings).where(SystemSettings.key == key))
                if not s_res.scalar_one_or_none():
                    session.add(SystemSettings(key=key, value=val, is_secret=is_sec))

            await session.commit()
            logger.info("Agent registry database sync complete. %d agents registered.", len(self._agents))

agent_registry = AgentRegistry()
