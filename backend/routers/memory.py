from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from backend.schemas import MemoryQueryRequest, MemoryAddRequest, MemoryItem
from backend.memory.chroma_service import memory_service
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/memory", tags=["Memory System"])

@router.get("/recent")
async def get_recent_memories():
    items = await memory_service.list_recent_memories(limit=30)
    return {"count": len(items), "memories": items}

@router.post("/search")
async def search_memory(req: MemoryQueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty")

    results = await memory_service.query_memories(
        query=req.query,
        agent_id=req.agent_id,
        limit=req.limit or 5
    )
    return {
        "query": req.query,
        "agent_id": req.agent_id,
        "results": results
    }

@router.post("")
async def add_memory_item(req: MemoryAddRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    mem_id = await memory_service.add_memory(
        agent_id=req.agent_id or "global",
        text=req.content,
        metadata={
            "category": req.category or "manual_entry",
            **(req.metadata or {})
        }
    )

    await log_activity(
        action="MEMORY_INDEXED",
        message=f"Indexed new knowledge into vector memory: '{req.content[:50]}...'",
        agent_id=req.agent_id
    )

    return {
        "success": True,
        "memory_id": mem_id,
        "message": "Memory indexed successfully into ChromaDB"
    }
