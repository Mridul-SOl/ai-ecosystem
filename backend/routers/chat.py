import re
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.schemas import ChatRequest
from backend.agents.agent_registry import agent_registry
from backend.orchestrator.ceo_orchestrator import ceo_orchestrator
from backend.services.activity_logger import log_activity
from backend.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

@router.post("")
async def chat_with_ceo(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    msg = req.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    ceo_agent = agent_registry.get_agent("ceo")
    if not ceo_agent:
        raise HTTPException(status_code=500, detail="CEO Agent not initialized")

    # Determine if message is an actionable corporate objective / business prompt
    # Actions include: create, launch, plan, develop, research, strategy, analyze, budget, hire, etc.
    action_keywords = [
        "create", "launch", "plan", "build", "strategy", "campaign",
        "budget", "execute", "analyze", "research", "market", "develop",
        "prepare", "design", "investigate", "scale", "optimize"
    ]
    is_actionable_objective = any(kw in msg.lower() for kw in action_keywords) and len(msg.split()) >= 4

    created_workflow_id = None
    if is_actionable_objective:
        # Trigger CEO orchestration workflow
        wf = await ceo_orchestrator.orchestrate_objective(objective=msg)
        created_workflow_id = wf.id

        reply = (
            f"### Executive Directive Initiated\n\n"
            f"I have received your objective: **\"{msg}\"**\n\n"
            f"**Strategic Execution Plan:**\n"
            f"- I have decomposed this initiative into **{wf.total_steps} coordinated department tasks**.\n"
            f"- Research, Marketing, and Finance agents are being mobilized in sequence.\n"
            f"- Tracking Workflow ID: `{wf.id}`\n\n"
            f"You can monitor live progress on the **Workflows** and **Task Manager** boards. "
            f"I will deliver the consolidated strategy once all departmental reviews are finalized."
        )
    else:
        # Direct conversational answer from CEO
        reply = await ceo_agent.chat_direct(msg)

    await log_activity(
        action="CEO_CHAT",
        message=f"Operator conversed with CEO: '{msg[:50]}...'",
        agent_id="ceo"
    )

    return {
        "reply": reply,
        "workflow_id": created_workflow_id,
        "agent": {
            "id": "ceo",
            "name": ceo_agent.name,
            "role": ceo_agent.role,
            "avatar": ceo_agent.avatar
        }
    }
