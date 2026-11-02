from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Agent, Task, AgentMessage
from backend.schemas import AgentResponse, AgentDirectChatRequest
from backend.agents.agent_registry import agent_registry
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/agents", tags=["Agents"])

@router.get("", response_model=List[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.id.asc()))
    agents = result.scalars().all()
    return agents

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id.lower()))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.get("/{agent_id}/history")
async def get_agent_history(agent_id: str, db: AsyncSession = Depends(get_db)):
    # Fetch recent messages sent or received by this agent
    msg_res = await db.execute(
        select(AgentMessage)
        .where((AgentMessage.sender_agent_id == agent_id) | (AgentMessage.recipient_agent_id == agent_id))
        .order_by(AgentMessage.created_at.desc())
        .limit(20)
    )
    messages = msg_res.scalars().all()

    # Fetch recent tasks assigned to this agent
    task_res = await db.execute(
        select(Task)
        .where(Task.assigned_agent_id == agent_id)
        .order_by(Task.created_at.desc())
        .limit(10)
    )
    tasks = task_res.scalars().all()

    return {
        "agent_id": agent_id,
        "messages": [
            {
                "id": m.id,
                "sender": m.sender_agent_id,
                "recipient": m.recipient_agent_id,
                "content": m.content,
                "message_type": m.message_type,
                "created_at": m.created_at.isoformat()
            } for m in messages
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "created_at": t.created_at.isoformat()
            } for t in tasks
        ]
    }

@router.post("/{agent_id}/chat")
async def chat_with_agent(
    agent_id: str,
    chat_req: AgentDirectChatRequest,
    db: AsyncSession = Depends(get_db)
):
    agent_instance = agent_registry.get_agent(agent_id.lower())
    if not agent_instance:
        raise HTTPException(status_code=404, detail="Agent not found in registry")

    reply = await agent_instance.chat_direct(chat_req.message)

    # Record message in database
    msg = AgentMessage(
        sender_agent_id="user",
        recipient_agent_id=agent_id.lower(),
        content=chat_req.message,
        message_type="direct"
    )
    reply_msg = AgentMessage(
        sender_agent_id=agent_id.lower(),
        recipient_agent_id="user",
        content=reply,
        message_type="direct"
    )
    db.add(msg)
    db.add(reply_msg)
    await db.commit()

    await log_activity(
        action="AGENT_DIRECT_CHAT",
        message=f"Direct dialogue with {agent_instance.name}",
        level="INFO",
        agent_id=agent_id.lower()
    )

    return {
        "agent_id": agent_id,
        "agent_name": agent_instance.name,
        "reply": reply
    }

@router.post("/{agent_id}/status")
async def update_agent_status(
    agent_id: str,
    status_update: Dict[str, str],
    db: AsyncSession = Depends(get_db)
):
    new_status = status_update.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing 'status'")

    agent_instance = agent_registry.get_agent(agent_id.lower())
    if not agent_instance:
        raise HTTPException(status_code=404, detail="Agent not found")

    await agent_instance.update_status(new_status)
    return {"agent_id": agent_id, "status": new_status}
