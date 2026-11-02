import asyncio
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Task, TaskHistory, Agent
from backend.schemas import TaskResponse, TaskCreate, TaskUpdate
from backend.agents.agent_registry import agent_registry
from backend.services.websocket_manager import ws_manager
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/tasks", tags=["Task Management"])

async def _get_task_with_history(db: AsyncSession, task_id: str) -> Optional[Task]:
    result = await db.execute(
        select(Task).options(selectinload(Task.history)).where(Task.id == task_id)
    )
    return result.scalar_one_or_none()

@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db)
):
    query = select(Task).options(selectinload(Task.history)).order_by(Task.created_at.desc()).limit(limit)

    if status and status != "all":
        query = query.where(Task.status == status)
    if department and department != "all":
        query = query.where(Task.department == department)
    if agent_id and agent_id != "all":
        query = query.where(Task.assigned_agent_id == agent_id)

    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=TaskResponse)
async def create_task(task_in: TaskCreate, db: AsyncSession = Depends(get_db)):
    # Validate agent
    agent = await db.get(Agent, task_in.assigned_agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail=f"Agent '{task_in.assigned_agent_id}' does not exist.")

    task_id = str(uuid.uuid4())
    new_task = Task(
        id=task_id,
        title=task_in.title,
        description=task_in.description,
        department=task_in.department,
        assigned_agent_id=task_in.assigned_agent_id,
        priority=task_in.priority or "Medium",
        status="Pending",
        input_data=task_in.input_data or {},
        requires_approval=task_in.requires_approval or False,
        workflow_id=task_in.workflow_id,
        created_at=datetime.utcnow()
    )
    db.add(new_task)

    # Increment pending task count on agent
    agent.tasks_pending = (agent.tasks_pending or 0) + 1

    history = TaskHistory(
        task_id=task_id,
        agent_id=new_task.assigned_agent_id,
        state_from="None",
        state_to="Pending",
        notes="Task created by operator."
    )
    db.add(history)

    await db.commit()
    await db.refresh(new_task)

    await ws_manager.broadcast("task_created", {
        "task_id": new_task.id,
        "title": new_task.title,
        "assigned_agent_id": new_task.assigned_agent_id,
        "status": new_task.status
    })

    await log_activity(
        action="TASK_CREATED",
        message=f"Created task '{new_task.title}' assigned to {agent.name}",
        agent_id=new_task.assigned_agent_id,
        metadata={"task_id": new_task.id}
    )

    # Automatically dispatch async execution for standalone tasks
    asyncio.create_task(_run_standalone_task(new_task.id))

    return await _get_task_with_history(db, task_id)

async def _run_standalone_task(task_id: str):
    await asyncio.sleep(0.5)
    from backend.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        t = await session.get(Task, task_id)
        if not t or t.status != "Pending":
            return
        if t.requires_approval and not t.is_approved:
            t.status = "Awaiting Approval"
            await session.commit()
            await ws_manager.broadcast("task_updated", {"task_id": task_id, "status": "Awaiting Approval"})
            return

        t.status = "Running"
        await session.commit()

        agent_id = t.assigned_agent_id
        instructions = t.description

    agent = agent_registry.get_agent(agent_id)
    if agent:
        res = await agent.execute_task(task_id, {"prompt": instructions})
        async with AsyncSessionLocal() as session:
            t = await session.get(Task, task_id)
            if t:
                t.status = "Completed" if res.get("success") else "Failed"
                t.output_data = {"result": res.get("output", "")}
                t.completed_at = datetime.utcnow()
                session.add(TaskHistory(
                    task_id=task_id,
                    agent_id=agent_id,
                    state_from="Running",
                    state_to=t.status,
                    notes="Standalone task finished."
                ))
                ag = await session.get(Agent, agent_id)
                if ag:
                    ag.tasks_completed = (ag.tasks_completed or 0) + 1
                    ag.tasks_pending = max(0, (ag.tasks_pending or 1) - 1)
                await session.commit()
        await ws_manager.broadcast("task_updated", {"task_id": task_id, "status": t.status})

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task).options(selectinload(Task.history)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/{task_id}/retry", response_model=TaskResponse)
async def retry_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    task.status = "Pending"
    task.error_message = None

    history = TaskHistory(
        task_id=task.id,
        agent_id=task.assigned_agent_id,
        state_from=old_status,
        state_to="Pending",
        notes="Operator requested task retry."
    )
    db.add(history)
    await db.commit()
    await db.refresh(task)

    await ws_manager.broadcast("task_updated", {"task_id": task.id, "status": "Pending"})
    await log_activity(
        action="TASK_RETRIED",
        message=f"Task '{task.title}' retried.",
        level="ACTION",
        agent_id=task.assigned_agent_id
    )

    asyncio.create_task(_run_standalone_task(task.id))
    return await _get_task_with_history(db, task_id)

@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    task.status = "Cancelled"

    history = TaskHistory(
        task_id=task.id,
        agent_id=task.assigned_agent_id,
        state_from=old_status,
        state_to="Cancelled",
        notes="Task cancelled by user."
    )
    db.add(history)

    # Decrement pending if it was pending
    agent = await db.get(Agent, task.assigned_agent_id)
    if agent and old_status in ["Pending", "Assigned", "Awaiting Approval"]:
        agent.tasks_pending = max(0, (agent.tasks_pending or 1) - 1)

    await db.commit()

    await ws_manager.broadcast("task_updated", {"task_id": task.id, "status": "Cancelled"})
    await log_activity(
        action="TASK_CANCELLED",
        message=f"Task '{task.title}' cancelled.",
        level="WARN",
        agent_id=task.assigned_agent_id
    )
    return await _get_task_with_history(db, task_id)

@router.post("/{task_id}/approve", response_model=TaskResponse)
async def approve_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_approved = True
    task.status = "Pending"

    history = TaskHistory(
        task_id=task.id,
        agent_id=task.assigned_agent_id,
        state_from="Awaiting Approval",
        state_to="Pending",
        notes="Consequential action explicitly approved by operator."
    )
    db.add(history)
    await db.commit()

    await ws_manager.broadcast("task_updated", {"task_id": task.id, "status": "Pending", "is_approved": True})
    await log_activity(
        action="ACTION_APPROVED",
        message=f"Operator approved task '{task.title}' for execution.",
        level="SUCCESS",
        agent_id=task.assigned_agent_id
    )

    # Resume execution if standalone or workflow
    if task.workflow_id:
        from backend.orchestrator.ceo_orchestrator import ceo_orchestrator
        asyncio.create_task(ceo_orchestrator._execute_workflow_pipeline(task.workflow_id))
    else:
        asyncio.create_task(_run_standalone_task(task.id))

    return await _get_task_with_history(db, task_id)

@router.post("/{task_id}/reject", response_model=TaskResponse)
async def reject_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.is_approved = False
    task.status = "Failed"
    task.error_message = "Rejected by operator during approval review."

    history = TaskHistory(
        task_id=task.id,
        agent_id=task.assigned_agent_id,
        state_from="Awaiting Approval",
        state_to="Failed",
        notes="Rejected by operator."
    )
    db.add(history)
    await db.commit()

    await ws_manager.broadcast("task_updated", {"task_id": task.id, "status": "Failed"})
    await log_activity(
        action="ACTION_REJECTED",
        message=f"Operator rejected task '{task.title}'.",
        level="WARN",
        agent_id=task.assigned_agent_id
    )
    return await _get_task_with_history(db, task_id)

