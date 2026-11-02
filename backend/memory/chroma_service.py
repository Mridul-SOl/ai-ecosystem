import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.config import settings

logger = logging.getLogger(__name__)

class ChromaMemoryService:
    def __init__(self):
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        self.client = None
        self.memories_collection = None
        self.knowledge_collection = None
        self.fallback_mode = False
        self._fallback_store: List[Dict[str, Any]] = []
        self._init_client()

    def _init_client(self):
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self.client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            self.memories_collection = self.client.get_or_create_collection(
                name="agent_memories",
                metadata={"hnsw:space": "cosine"}
            )
            self.knowledge_collection = self.client.get_or_create_collection(
                name="organization_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("ChromaDB initialized successfully at %s", self.persist_dir)
        except Exception as e:
            logger.warning("ChromaDB failed to initialize (%s). Falling back to resilient semantic store.", e)
            self.fallback_mode = True

    async def add_memory(
        self,
        agent_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        mem_id = str(uuid.uuid4())
        meta = metadata or {}
        meta["agent_id"] = agent_id
        meta["timestamp"] = datetime.utcnow().isoformat()

        # Chroma requires metadata values to be str, int, float, or bool
        sanitized_meta = {k: str(v) if not isinstance(v, (int, float, bool)) else v for k, v in meta.items()}

        if not self.fallback_mode and self.memories_collection:
            try:
                self.memories_collection.add(
                    ids=[mem_id],
                    documents=[text],
                    metadatas=[sanitized_meta]
                )
                return mem_id
            except Exception as e:
                logger.error("Failed to add memory to ChromaDB: %s. Using fallback.", e)

        # Fallback in-memory / list storage
        self._fallback_store.append({
            "id": mem_id,
            "document": text,
            "metadata": sanitized_meta,
            "created_at": datetime.utcnow()
        })
        return mem_id

    async def query_memories(
        self,
        query: str,
        agent_id: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        results = []
        if not self.fallback_mode and self.memories_collection:
            try:
                where_clause = {"agent_id": agent_id} if agent_id and agent_id != "all" else None
                chroma_res = self.memories_collection.query(
                    query_texts=[query],
                    n_results=min(limit, 10),
                    where=where_clause
                )
                if chroma_res and "ids" in chroma_res and chroma_res["ids"]:
                    ids = chroma_res["ids"][0]
                    docs = chroma_res["documents"][0] if "documents" in chroma_res else []
                    metas = chroma_res["metadatas"][0] if "metadatas" in chroma_res else []
                    dists = chroma_res.get("distances", [[0] * len(ids)])[0]

                    for i in range(len(ids)):
                        results.append({
                            "id": ids[i],
                            "text": docs[i] if i < len(docs) else "",
                            "metadata": metas[i] if i < len(metas) else {},
                            "distance": dists[i] if i < len(dists) else 0.0
                        })
                return results
            except Exception as e:
                logger.warning("Chroma query failed (%s), searching fallback memory.", e)

        # Fallback text matching
        query_words = set(query.lower().split())
        scored = []
        for item in self._fallback_store:
            if agent_id and agent_id != "all" and item["metadata"].get("agent_id") != agent_id:
                continue
            doc_lower = item["document"].lower()
            score = sum(1 for w in query_words if w in doc_lower)
            scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        for _, item in scored[:limit]:
            results.append({
                "id": item["id"],
                "text": item["document"],
                "metadata": item["metadata"],
                "distance": 0.1
            })
        return results

    async def add_knowledge(
        self,
        title: str,
        content: str,
        category: str = "general",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        doc_id = str(uuid.uuid4())
        meta = metadata or {}
        meta["title"] = title
        meta["category"] = category
        meta["timestamp"] = datetime.utcnow().isoformat()
        sanitized_meta = {k: str(v) if not isinstance(v, (int, float, bool)) else v for k, v in meta.items()}

        if not self.fallback_mode and self.knowledge_collection:
            try:
                self.knowledge_collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[sanitized_meta]
                )
                return doc_id
            except Exception as e:
                logger.error("Failed to add knowledge to Chroma: %s", e)

        self._fallback_store.append({
            "id": doc_id,
            "document": f"{title}\n{content}",
            "metadata": sanitized_meta,
            "created_at": datetime.utcnow()
        })
        return doc_id

    async def list_recent_memories(self, limit: int = 50) -> List[Dict[str, Any]]:
        if not self.fallback_mode and self.memories_collection:
            try:
                data = self.memories_collection.get(limit=limit)
                items = []
                if data and "ids" in data:
                    ids = data["ids"]
                    docs = data.get("documents", [])
                    metas = data.get("metadatas", [])
                    for i in range(len(ids)):
                        items.append({
                            "id": ids[i],
                            "text": docs[i] if i < len(docs) else "",
                            "metadata": metas[i] if i < len(metas) else {}
                        })
                if items:
                    return items
            except Exception as e:
                logger.warning("Failed listing memories from Chroma: %s", e)

        return [
            {
                "id": item["id"],
                "text": item["document"],
                "metadata": item["metadata"]
            }
            for item in self._fallback_store[:limit]
        ]

memory_service = ChromaMemoryService()
