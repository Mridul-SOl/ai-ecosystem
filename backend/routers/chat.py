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

        # Generate intelligent executive appraisal from CEO Nova via LLM
        from backend.ai.llm_provider import get_llm_provider
        llm = get_llm_provider()

        steps_summary = "\n".join([
            f"- **{step.get('department', 'Department')} ({step.get('agent_id', 'agent').upper()})**: {step.get('task_title', 'Task')}"
            for step in (wf.execution_plan or [])
        ])

        executive_prompt = f"""The operator has issued the following business objective:
"{msg}"

As CEO Nova, I have decomposed this objective into {wf.total_steps} cross-departmental tasks:
{steps_summary}
Workflow ID: `{wf.id}`

Deliver an authoritative, executive-level strategic appraisal to the operator.
Your reply MUST include:
1. **Executive Appraisal & Strategic Thesis**: High-level evaluation of the directive, market opportunity, and key success factors.
2. **Departmental Mobilization Strategy**: Concise explanation of why each department has been assigned their specific mandate and how their outputs interlock.
3. **Core Economic & Operational Guardrails**: Realistic benchmarks (e.g. CAC/LTV targets, unit economics, margin floors, delivery SLAs) to safeguard profitability.
4. **Immediate Next Step**: A note that the multi-agent DAG workflow (ID: `{wf.id}`) has been initialized and is executing live in the background across Task Manager and Workflows boards.

Tone: Decisive, elite executive acumen, zero fluff, commercially rigorous."""

        try:
            reply = await llm.generate_response(
                system_prompt=ceo_agent.system_prompt,
                user_prompt=executive_prompt,
                agent_role="ceo",
                department="Executive Leadership"
            )
        except Exception as e:
            reply = (
                f"### Executive Directive Initiated\n\n"
                f"I have received and mobilized our leadership team for: **\"{msg}\"**\n\n"
                f"**Departmental Mobilization ({wf.total_steps} Initiatives):**\n"
                f"{steps_summary}\n\n"
                f"- **Tracking Workflow ID**: `{wf.id}`\n"
                f"- **Real-time Status**: Live execution underway across Task Manager and Workflows boards. "
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
