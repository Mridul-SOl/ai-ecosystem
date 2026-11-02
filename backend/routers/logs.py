from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from backend.database import get_db
from backend.models import ActivityLog
from backend.schemas import ActivityLogResponse

router = APIRouter(prefix="/api/logs", tags=["Activity Logs"])

@router.get("", response_model=List[ActivityLogResponse])
async def list_logs(
    level: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db)
):
    query = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)

    if level and level != "all":
        query = query.where(ActivityLog.level == level.upper())
    if agent_id and agent_id != "all":
        query = query.where(ActivityLog.agent_id == agent_id)

    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/clear")
async def clear_logs(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ActivityLog))
    await db.commit()
    return {"message": "All activity logs cleared."}
