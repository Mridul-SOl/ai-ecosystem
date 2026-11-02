import asyncio
import logging
import os
import shutil
from pathlib import Path
from sqlalchemy import delete, update
from backend.database import AsyncSessionLocal
from backend.models import Task, TaskHistory, Workflow, AgentMessage, ActivityLog, Agent
from backend.memory.chroma_service import memory_service
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clean_database")

async def clean_all_data():
    logger.info("Starting complete removal of test/mock data...")
    
    async with AsyncSessionLocal() as session:
        # 1. Delete dependent tables first
        logger.info("Purging task history records...")
        await session.execute(delete(TaskHistory))
        
        logger.info("Purging tasks...")
        await session.execute(delete(Task))
        
        logger.info("Purging workflows...")
        await session.execute(delete(Workflow))
        
        logger.info("Purging agent messages / direct dialogues...")
        await session.execute(delete(AgentMessage))
        
        logger.info("Purging activity logs...")
        await session.execute(delete(ActivityLog))
        
        # 2. Reset agent operational counters to 0 and status to idle
        logger.info("Resetting agent counters to clean state (0 completed, 0 pending, idle)...")
        await session.execute(
            update(Agent).values(
                tasks_completed=0,
                tasks_pending=0,
                status="idle"
            )
        )
        
        await session.commit()
        logger.info("SQLite database tables purged successfully.")

    # 3. Purge ChromaDB vector collections
    logger.info("Resetting ChromaDB vector collections...")
    try:
        if memory_service.client:
            try:
                memory_service.client.delete_collection("agent_memories")
            except Exception:
                pass
            try:
                memory_service.client.delete_collection("organization_knowledge")
            except Exception:
                pass
            # Recreate empty collections
            memory_service.memories_collection = memory_service.client.get_or_create_collection(
                name="agent_memories",
                metadata={"hnsw:space": "cosine"}
            )
            memory_service.knowledge_collection = memory_service.client.get_or_create_collection(
                name="organization_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
        memory_service._fallback_store = []
        logger.info("ChromaDB collections reset to pristine state.")
    except Exception as e:
        logger.warning(f"Chroma reset warning: {e}")

    logger.info("=== All false/test data has been completely removed! ===")

if __name__ == "__main__":
    asyncio.run(clean_all_data())
