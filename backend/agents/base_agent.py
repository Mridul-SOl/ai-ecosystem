import logging
from abc import ABC
from typing import Dict, Any, List, Optional
from datetime import datetime
from backend.ai.llm_provider import get_llm_provider
from backend.memory.chroma_service import memory_service
from backend.services.websocket_manager import ws_manager
from backend.services.activity_logger import log_activity
from backend.database import AsyncSessionLocal
from backend.models import Agent, AgentMessage, Task, TaskHistory

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    def __init__(
        self,
        agent_id: str,
        name: str,
        department: str,
        role: str,
        description: str,
        system_prompt: str,
        avatar: str,
        capabilities: List[str]
    ):
        self.agent_id = agent_id
        self.name = name
        self.department = department
        self.role = role
        self.description = description
        self.system_prompt = system_prompt
        self.avatar = avatar
        self.capabilities = capabilities
        self.conversation_history: List[Dict[str, str]] = []

    async def update_status(self, new_status: str):
        """
        Updates database status and broadcasts via WebSockets.
        Valid statuses: 'idle', 'busy', 'thinking', 'error', 'offline'
        """
        async with AsyncSessionLocal() as session:
            agent = await session.get(Agent, self.agent_id)
            if agent:
                agent.status = new_status
                agent.updated_at = datetime.utcnow()
                await session.commit()

        await ws_manager.broadcast("agent_status_changed", {
            "agent_id": self.agent_id,
            "status": new_status,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def recall_relevant_memories(self, query: str, limit: int = 3) -> str:
        """
        Retrieves relevant vector memories from ChromaDB to inject into prompt.
        """
        try:
            memories = await memory_service.query_memories(query, agent_id=self.agent_id, limit=limit)
            if not memories:
                # Try organizational wide memories
                memories = await memory_service.query_memories(query, agent_id="all", limit=2)

            if memories:
                memory_texts = [f"- {m['text']}" for m in memories]
                return "\n\nRelevant Past Learnings & Organizational Memory:\n" + "\n".join(memory_texts)
        except Exception as e:
            logger.warning("Could not recall memories for agent %s: %s", self.agent_id, e)
        return ""

    async def store_decision_memory(self, content: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Saves key decision or output to ChromaDB vector store.
        """
        try:
            await memory_service.add_memory(
                agent_id=self.agent_id,
                text=content,
                metadata=metadata or {"role": self.role, "department": self.department}
            )
        except Exception as e:
            logger.error("Failed to store memory for agent %s: %s", self.agent_id, e)

    async def execute_task(self, task_id: str, input_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Standard task execution pipeline with status management, memory recall,
        LLM reasoning, error handling, and state logging.
        """
        await self.update_status("thinking")
        await log_activity(
            action="TASK_STARTED",
            message=f"{self.name} started working on task {task_id}",
            agent_id=self.agent_id,
            metadata={"task_id": task_id}
        )

        try:
            task_prompt = input_context.get("prompt") or input_context.get("instructions") or "Execute department objective."
            
            # 1. Recall memory
            memory_context = await self.recall_relevant_memories(task_prompt)
            
            # 2. Build full prompt
            full_user_prompt = f"TASK INSTRUCTIONS:\n{task_prompt}"
            if "upstream_outputs" in input_context and input_context["upstream_outputs"]:
                full_user_prompt += f"\n\nINPUT DATA FROM PREVIOUS DEPARTMENTS:\n"
                for dept, out in input_context["upstream_outputs"].items():
                    full_user_prompt += f"\n--- {dept} Department Output ---\n{out}\n"

            if memory_context:
                full_user_prompt += f"\n{memory_context}"

            # 3. LLM Reasoning
            await self.update_status("busy")
            llm = get_llm_provider()
            response_text = await llm.generate_response(
                system_prompt=self.system_prompt,
                user_prompt=full_user_prompt,
                agent_role=self.role,
                department=self.department
            )

            # 4. Store memory of output
            summary_snippet = response_text[:300].strip()
            await self.store_decision_memory(
                content=f"Task: {task_prompt[:100]} | Resolution: {summary_snippet}",
                metadata={"task_id": task_id, "department": self.department}
            )

            # 5. Success logging
            await self.update_status("idle")
            await log_activity(
                action="TASK_COMPLETED",
                message=f"{self.name} completed task successfully.",
                level="SUCCESS",
                agent_id=self.agent_id,
                metadata={"task_id": task_id}
            )

            return {
                "success": True,
                "output": response_text,
                "agent_id": self.agent_id,
                "department": self.department,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error("Agent %s failed on task %s: %s", self.agent_id, task_id, e, exc_info=True)
            await self.update_status("error")
            await log_activity(
                action="TASK_FAILED",
                message=f"{self.name} encountered error: {str(e)}",
                level="ERROR",
                agent_id=self.agent_id,
                metadata={"task_id": task_id, "error": str(e)}
            )
            return {
                "success": False,
                "error": str(e),
                "agent_id": self.agent_id,
                "department": self.department
            }

    async def chat_direct(self, message: str) -> str:
        """
        Direct 1-on-1 chat interaction with the agent.
        """
        await self.update_status("thinking")
        try:
            self.conversation_history.append({"role": "user", "content": message})
            if len(self.conversation_history) > 12:
                self.conversation_history = self.conversation_history[-12:]

            memory_ctx = await self.recall_relevant_memories(message, limit=2)
            prompt = message
            if memory_ctx:
                prompt += f"\n{memory_ctx}"

            llm = get_llm_provider()
            reply = await llm.generate_response(
                system_prompt=self.system_prompt,
                user_prompt=prompt,
                conversation_history=self.conversation_history[:-1],
                agent_role=self.role,
                department=self.department
            )

            self.conversation_history.append({"role": "assistant", "content": reply})
            await self.update_status("idle")
            return reply
        except Exception as e:
            await self.update_status("error")
            logger.error("Agent %s direct chat error: %s", self.agent_id, e)
            return f"I encountered an issue processing your request: {str(e)}"
