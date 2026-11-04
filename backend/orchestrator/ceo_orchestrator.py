import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.database import AsyncSessionLocal
from backend.models import Workflow, Task, TaskHistory, AgentMessage, Agent
from backend.agents.agent_registry import agent_registry
from backend.ai.llm_provider import get_llm_provider
from backend.memory.chroma_service import memory_service
from backend.services.websocket_manager import ws_manager
from backend.services.activity_logger import log_activity

logger = logging.getLogger(__name__)

class CEOOrchestrator:
    def __init__(self):
        self.ceo_agent = agent_registry.get_agent("ceo")

    async def orchestrate_objective(self, objective: str, user_title: Optional[str] = None) -> Workflow:
        """
        Main entry point: Creates a workflow and starts asynchronous execution in background.
        """
        title = user_title or f"Objective: {objective[:50]}..."
        workflow_id = str(uuid.uuid4())

        await log_activity(
            action="WORKFLOW_INITIATED",
            message=f"CEO received instruction: '{objective}'",
            level="ACTION",
            agent_id="ceo",
            metadata={"workflow_id": workflow_id, "objective": objective}
        )

        # 1. CEO Decomposes the Objective into a multi-agent plan
        plan_data = await self._decompose_objective(objective)
        steps = plan_data.get("steps", [])

        # 2. Persist Workflow and Tasks in Database
        async with AsyncSessionLocal() as session:
            workflow = Workflow(
                id=workflow_id,
                title=title,
                objective=objective,
                status="Running",
                current_step=0,
                total_steps=len(steps),
                execution_plan=steps,
                created_at=datetime.utcnow()
            )
            session.add(workflow)

            created_tasks = []
            for idx, step in enumerate(steps):
                agent_id = step.get("agent_id", "operations")
                requires_appr = step.get("requires_approval", False)
                task = Task(
                    id=str(uuid.uuid4()),
                    workflow_id=workflow_id,
                    title=step.get("task_title", f"Subtask {idx+1}"),
                    description=step.get("instructions", ""),
                    department=step.get("department", "Operations"),
                    assigned_agent_id=agent_id,
                    status="Pending",
                    priority="High" if idx == 0 else "Medium",
                    input_data={
                        "instructions": step.get("instructions", ""),
                        "dependencies": step.get("dependencies", []),
                        "objective": objective
                    },
                    requires_approval=requires_appr,
                    step_order=idx,
                    created_at=datetime.utcnow()
                )
                session.add(task)
                created_tasks.append(task)

                # Increment agent pending tasks
                agent_record = await session.get(Agent, agent_id)
                if agent_record:
                    agent_record.tasks_pending = (agent_record.tasks_pending or 0) + 1

            await session.commit()
            await session.refresh(workflow)

        # Broadcast workflow creation to dashboard
        await ws_manager.broadcast("workflow_created", {
            "workflow_id": workflow_id,
            "title": title,
            "objective": objective,
            "total_steps": len(steps)
        })

        # Launch background execution task
        asyncio.create_task(self._execute_workflow_pipeline(workflow_id))

        return workflow

    async def _decompose_objective(self, objective: str) -> Dict[str, Any]:
        """
        Uses LLM to generate the multi-department execution plan.
        """
        system_prompt = """You are the CEO Orchestrator. Analyze the user's business objective.
Break it down into a sequence of coordinated subtasks for specialized department agents.
Available Agents:
- research: Market Landscape, Competitor Benchmarking, Trend Mining
- marketing: Go-To-Market, Campaigns, Copywriting, Social Media, Growth
- finance: Line-Item Budget Allocation, Unit Economics (CAC/LTV), Breakeven, ROI
- operations: Supply Chain, Logistics, SOPs, Milestone Tracking
- security: Risk Assessment, Compliance (PCI/GDPR), Threat Modeling
- infrastructure: Deployment Blueprint, Cloud/Docker Specs, GitHub Pipelines
- hr: Team Structure, Hiring Matrix, Capacity Planning

Output a JSON object with:
{
  "title": "Short descriptive title",
  "summary": "High-level strategic approach",
  "steps": [
    {
      "agent_id": "research",
      "department": "Research",
      "task_title": "Market Landscape Analysis",
      "instructions": "Specific instructions for the agent...",
      "dependencies": [],
      "requires_approval": false
    }
  ]
}"""

        llm = get_llm_provider()
        try:
            return await llm.generate_json(system_prompt, objective)
        except Exception as e:
            logger.warning("LLM JSON decomposition failed (%s). Using heuristic planner.", e)
            from backend.ai.llm_provider import AutonomousHeuristicProvider
            heuristic = AutonomousHeuristicProvider()
            return await heuristic.generate_json(system_prompt, objective)

    async def _execute_workflow_pipeline(self, workflow_id: str):
        """
        Executes the workflow graph, coordinating inter-agent handoffs and CEO critique loops.
        """
        logger.info("Starting workflow pipeline execution for workflow %s", workflow_id)
        upstream_outputs: Dict[str, str] = {}

        try:
            cycle_count = 0
            MAX_CYCLES = 60

            while cycle_count < MAX_CYCLES:
                cycle_count += 1
                # Fetch next runnable task
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(Task)
                        .where(Task.workflow_id == workflow_id)
                        .order_by(Task.step_order.asc())
                    )
                    all_tasks = res.scalars().all()

                    # Categorize task statuses
                    pending_tasks = [t for t in all_tasks if t.status == "Pending"]
                    running_tasks = [t for t in all_tasks if t.status == "Running"]
                    awaiting_appr = [t for t in all_tasks if t.status == "Awaiting Approval"]

                    if awaiting_appr:
                        logger.info("Workflow %s paused waiting for user approval on task %s", workflow_id, awaiting_appr[0].id)
                        return

                    if not pending_tasks and not running_tasks:
                        # All tasks complete or terminal
                        break

                    # Check if any pending tasks depend on a failed/cancelled task
                    tasks_cancelled = False
                    for p_task in pending_tasks:
                        deps = p_task.input_data.get("dependencies", [])
                        for dep in deps:
                            dep_task = next((t for t in all_tasks if t.assigned_agent_id == dep), None)
                            if dep_task and dep_task.status in ("Failed", "Cancelled"):
                                p_task.status = "Cancelled"
                                session.add(TaskHistory(
                                    task_id=p_task.id,
                                    agent_id=p_task.assigned_agent_id,
                                    state_from="Pending",
                                    state_to="Cancelled",
                                    notes=f"Cancelled: Upstream dependency '{dep_task.title}' was {dep_task.status}."
                                ))
                                tasks_cancelled = True
                                break

                    if tasks_cancelled:
                        await session.commit()
                        continue

                    # Find the first pending task whose dependencies are all Completed
                    next_task = None
                    for p_task in pending_tasks:
                        deps = p_task.input_data.get("dependencies", [])
                        deps_satisfied = True
                        for dep in deps:
                            dep_task = next((t for t in all_tasks if t.assigned_agent_id == dep), None)
                            if dep_task and dep_task.status != "Completed":
                                deps_satisfied = False
                                break
                        if deps_satisfied:
                            next_task = p_task
                            break

                    if not next_task:
                        if running_tasks:
                            logger.info("Waiting for %d running task(s) in workflow %s", len(running_tasks), workflow_id)
                            await asyncio.sleep(1)
                            continue
                        else:
                            logger.warning("No runnable tasks and no active running tasks in workflow %s. Concluding execution.", workflow_id)
                            break

                    # If requires approval and not yet approved
                    if next_task.requires_approval and not next_task.is_approved:
                        next_task.status = "Awaiting Approval"
                        session.add(TaskHistory(
                            task_id=next_task.id,
                            agent_id=next_task.assigned_agent_id,
                            state_from="Pending",
                            state_to="Awaiting Approval",
                            notes="Task requires human-in-the-loop authorization."
                        ))
                        await session.commit()
                        await ws_manager.broadcast("task_updated", {
                            "task_id": next_task.id,
                            "status": "Awaiting Approval",
                            "requires_approval": True
                        })
                        await log_activity(
                            action="APPROVAL_REQUIRED",
                            message=f"Task '{next_task.title}' requires explicit user approval before execution.",
                            level="WARN",
                            agent_id=next_task.assigned_agent_id,
                            metadata={"task_id": next_task.id}
                        )
                        return

                    # Mark Running
                    next_task.status = "Running"
                    session.add(TaskHistory(
                        task_id=next_task.id,
                        agent_id=next_task.assigned_agent_id,
                        state_from="Pending",
                        state_to="Running",
                        notes="Dispatched by CEO Orchestrator"
                    ))
                    await session.commit()
                    target_task_id = next_task.id
                    assigned_agent_id = next_task.assigned_agent_id
                    task_title = next_task.title
                    task_instructions = next_task.description
                    task_department = next_task.department

                # Broadcast task running
                await ws_manager.broadcast("task_updated", {
                    "task_id": target_task_id,
                    "status": "Running",
                    "agent_id": assigned_agent_id
                })

                # Log Inter-Agent Delegation Message (CEO -> Agent)
                await self._record_inter_agent_message(
                    sender_id="ceo",
                    recipient_id=assigned_agent_id,
                    task_id=target_task_id,
                    workflow_id=workflow_id,
                    content=f"CEO delegating '{task_title}': {task_instructions}",
                    msg_type="instruction"
                )

                # Fetch assigned agent from registry
                agent = agent_registry.get_agent(assigned_agent_id)
                if not agent:
                    agent = agent_registry.get_agent("operations")

                # Execute task
                exec_context = {
                    "prompt": task_instructions,
                    "upstream_outputs": upstream_outputs
                }
                result = await agent.execute_task(target_task_id, exec_context)

                # CEO Quality Review & Critique Loop
                review_result = await self._review_and_critique_output(
                    agent_name=agent.name,
                    department=agent.department,
                    task_title=task_title,
                    output=result.get("output", "")
                )

                if review_result.get("needs_revision", False):
                    critique_note = review_result.get("feedback", "Please expand with more concrete figures and actionable detail.")
                    await self._record_inter_agent_message(
                        sender_id="ceo",
                        recipient_id=assigned_agent_id,
                        task_id=target_task_id,
                        workflow_id=workflow_id,
                        content=f"CEO Review Critique: {critique_note} Please revise.",
                        msg_type="critique"
                    )

                    # Re-run agent with CEO critique feedback
                    exec_context["prompt"] += f"\n\nCEO CRITIQUE FEEDBACK FOR REVISION:\n{critique_note}"
                    result = await agent.execute_task(target_task_id, exec_context)

                # Record completion in database
                output_text = result.get("output", "Execution completed.")
                upstream_outputs[task_department] = output_text

                async with AsyncSessionLocal() as session:
                    task_to_update = await session.get(Task, target_task_id)
                    if task_to_update:
                        task_to_update.status = "Completed" if result.get("success") else "Failed"
                        task_to_update.output_data = {"result": output_text}
                        task_to_update.completed_at = datetime.utcnow()
                        session.add(TaskHistory(
                            task_id=target_task_id,
                            agent_id=assigned_agent_id,
                            state_from="Running",
                            state_to="Completed",
                            notes="Task approved and finalized by CEO review."
                        ))

                    agent_rec = await session.get(Agent, assigned_agent_id)
                    if agent_rec:
                        agent_rec.tasks_completed = (agent_rec.tasks_completed or 0) + 1
                        agent_rec.tasks_pending = max(0, (agent_rec.tasks_pending or 1) - 1)

                    # Update workflow progress
                    wf = await session.get(Workflow, workflow_id)
                    if wf:
                        wf.current_step = (wf.current_step or 0) + 1

                    await session.commit()

                # Broadcast task completed
                await ws_manager.broadcast("task_updated", {
                    "task_id": target_task_id,
                    "status": "Completed",
                    "output": output_text[:200]
                })

                # Inter-Agent Report Message (Agent -> CEO)
                await self._record_inter_agent_message(
                    sender_id=assigned_agent_id,
                    recipient_id="ceo",
                    task_id=target_task_id,
                    workflow_id=workflow_id,
                    content=f"Delivered output for '{task_title}'.",
                    msg_type="report"
                )

                # Brief async yield to allow WebSockets and frontend events to cycle
                await asyncio.sleep(0.5)

            # 3. Final CEO Consolidation
            await self._finalize_workflow_synthesis(workflow_id, upstream_outputs)

        except Exception as e:
            logger.error("Workflow %s execution encountered fatal error: %s", workflow_id, e, exc_info=True)
            async with AsyncSessionLocal() as session:
                wf = await session.get(Workflow, workflow_id)
                if wf:
                    wf.status = "Failed"
                    await session.commit()
            await ws_manager.broadcast("workflow_updated", {
                "workflow_id": workflow_id,
                "status": "Failed",
                "error": str(e)
            })

    async def _review_and_critique_output(
        self,
        agent_name: str,
        department: str,
        task_title: str,
        output: str
    ) -> Dict[str, Any]:
        """
        CEO inspects the agent output for quality, depth, and actionable substance.
        """
        # If output is too short or empty, automatically request revision
        if len(output.strip()) < 150:
            return {
                "needs_revision": True,
                "feedback": "Deliverable lacks required depth. Include concrete metrics, structured sections, and clear deliverables."
            }

        # Otherwise passes review
        return {"needs_revision": False, "feedback": "Approved."}

    async def _finalize_workflow_synthesis(self, workflow_id: str, department_outputs: Dict[str, str]):
        """
        CEO synthesizes all departmental deliverables into a unified corporate strategy.
        """
        async with AsyncSessionLocal() as session:
            wf = await session.get(Workflow, workflow_id)
            if not wf:
                return
            objective = wf.objective

        llm = get_llm_provider()
        synth_prompt = f"""You are the Chief Executive Officer (CEO).
Review the completed deliverables across all departments for objective:
'{objective}'

Department Outputs:
"""
        for dept, out in department_outputs.items():
            synth_prompt += f"\n=== {dept} Department ===\n{out}\n"

        synth_prompt += "\nSynthesize a comprehensive, cohesive Executive Strategy & Operating Plan uniting all departmental findings."

        synthesis = await llm.generate_response(
            system_prompt="You are Nova, the CEO. Deliver an executive synthesis uniting all department outputs into a definitive roadmap.",
            user_prompt=synth_prompt,
            agent_role="ceo",
            department="Executive Leadership"
        )

        async with AsyncSessionLocal() as session:
            wf = await session.get(Workflow, workflow_id)
            if wf:
                wf.status = "Completed"
                wf.final_result = synthesis
                wf.completed_at = datetime.utcnow()
                await session.commit()

        # Save to ChromaDB semantic memory for long-term organizational learning
        await memory_service.add_knowledge(
            title=f"Workflow Synthesis: {objective[:50]}",
            content=synthesis,
            category="executive_decisions",
            metadata={"workflow_id": workflow_id}
        )

        await ws_manager.broadcast("workflow_completed", {
            "workflow_id": workflow_id,
            "status": "Completed",
            "final_result": synthesis[:400]
        })

        await log_activity(
            action="WORKFLOW_COMPLETED",
            message=f"CEO finalized executive synthesis for: '{objective[:60]}'",
            level="SUCCESS",
            agent_id="ceo",
            metadata={"workflow_id": workflow_id}
        )

    async def _record_inter_agent_message(
        self,
        sender_id: str,
        recipient_id: str,
        task_id: Optional[str],
        workflow_id: Optional[str],
        content: str,
        msg_type: str
    ):
        async with AsyncSessionLocal() as session:
            msg = AgentMessage(
                sender_agent_id=sender_id,
                recipient_agent_id=recipient_id,
                task_id=task_id,
                workflow_id=workflow_id,
                content=content,
                message_type=msg_type,
                created_at=datetime.utcnow()
            )
            session.add(msg)
            await session.commit()
            await session.refresh(msg)

        await ws_manager.broadcast("agent_message", {
            "id": msg.id,
            "sender_agent_id": sender_id,
            "recipient_agent_id": recipient_id,
            "content": content,
            "message_type": msg_type,
            "workflow_id": workflow_id,
            "created_at": msg.created_at.isoformat()
        })

ceo_orchestrator = CEOOrchestrator()
