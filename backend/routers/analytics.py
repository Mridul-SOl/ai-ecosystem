from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from backend.database import get_db
from backend.models import Task, Workflow, Agent, ActivityLog
from backend.schemas import AnalyticsResponse

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    # Task metrics
    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar() or 0
    completed_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Completed"))).scalar() or 0
    failed_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Failed"))).scalar() or 0
    running_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Running"))).scalar() or 0
    pending_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Pending"))).scalar() or 0
    awaiting_approval_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Awaiting Approval"))).scalar() or 0

    # Workflow metrics
    active_workflows = (await db.execute(select(func.count(Workflow.id)).where(Workflow.status == "Running"))).scalar() or 0
    completed_workflows = (await db.execute(select(func.count(Workflow.id)).where(Workflow.status == "Completed"))).scalar() or 0

    # Agent breakdown
    agent_res = await db.execute(select(Agent))
    agents = agent_res.scalars().all()
    agent_stats = [
        {
            "id": a.id,
            "name": a.name,
            "department": a.department,
            "role": a.role,
            "status": a.status,
            "tasks_completed": a.tasks_completed or 0,
            "tasks_pending": a.tasks_pending or 0
        } for a in agents
    ]

    # Task throughput
    # Group tasks by department
    dept_res = await db.execute(
        select(Task.department, func.count(Task.id))
        .group_by(Task.department)
    )
    dept_counts = dept_res.all()
    task_throughput = [{"department": row[0], "count": row[1]} for row in dept_counts]

    recent_activity_count = (await db.execute(select(func.count(ActivityLog.id)))).scalar() or 0

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "failed_tasks": failed_tasks,
        "running_tasks": running_tasks,
        "pending_tasks": pending_tasks,
        "awaiting_approval_tasks": awaiting_approval_tasks,
        "active_workflows": active_workflows,
        "completed_workflows": completed_workflows,
        "agent_stats": agent_stats,
        "task_throughput": task_throughput,
        "recent_activity_count": recent_activity_count
    }
