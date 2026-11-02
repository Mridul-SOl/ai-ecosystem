import logging
from typing import Optional, Dict, Any
from datetime import datetime
from backend.database import AsyncSessionLocal
from backend.models import ActivityLog
from backend.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

async def log_activity(
    action: str,
    message: str,
    level: str = "INFO",
    agent_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> ActivityLog:
    """
    Persists activity log in database and broadcasts via WebSocket.
    """
    meta = metadata or {}
    async with AsyncSessionLocal() as session:
        log_entry = ActivityLog(
            level=level,
            agent_id=agent_id,
            action=action,
            message=message,
            metadata_json=meta,
            created_at=datetime.utcnow()
        )
        session.add(log_entry)
        await session.commit()
        await session.refresh(log_entry)

    # Broadcast to frontend dashboard in real-time
    await ws_manager.broadcast("activity_log", {
        "id": log_entry.id,
        "level": log_entry.level,
        "agent_id": log_entry.agent_id,
        "action": log_entry.action,
        "message": log_entry.message,
        "metadata_json": log_entry.metadata_json,
        "created_at": log_entry.created_at.isoformat()
    })

    return log_entry
