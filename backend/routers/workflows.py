from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Workflow, Task
from backend.schemas import WorkflowResponse, WorkflowCreate
from backend.orchestrator.ceo_orchestrator import ceo_orchestrator

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])

@router.get("", response_model=List[WorkflowResponse])
async def list_workflows(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Workflow)
        .options(selectinload(Workflow.tasks).selectinload(Task.history))
        .order_by(Workflow.created_at.desc())
        .limit(limit)
    )
    if status and status != "all":
        query = query.where(Workflow.status == status)

    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    workflow_in: WorkflowCreate,
    db: AsyncSession = Depends(get_db)
):
    workflow = await ceo_orchestrator.orchestrate_objective(
        objective=workflow_in.objective,
        user_title=workflow_in.title
    )

    # Re-fetch with loaded tasks
    result = await db.execute(
        select(Workflow)
        .options(selectinload(Workflow.tasks).selectinload(Task.history))
        .where(Workflow.id == workflow.id)
    )
    return result.scalar_one()

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .options(selectinload(Workflow.tasks).selectinload(Task.history))
        .where(Workflow.id == workflow_id)
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf
