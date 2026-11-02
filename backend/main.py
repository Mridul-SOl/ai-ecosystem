import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import settings
from backend.database import engine, Base
from backend.agents.agent_registry import agent_registry
from backend.services.websocket_manager import ws_manager
from backend.services.activity_logger import log_activity

# Import all routers
from backend.routers import (
    auth,
    agents,
    tasks,
    workflows,
    chat,
    memory,
    logs,
    analytics,
    settings as settings_router,
    integrations
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ai_ecosystem")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AI ECOSYSTEM database and services...")
    # Initialize SQLite tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schemas initialized.")

    # Seed 8 Agents, Default Admin, and Initial Settings
    await agent_registry.seed_database()
    logger.info("Agent registry ready.")

    await log_activity(
        action="SYSTEM_ONLINE",
        message="AI ECOSYSTEM OS initialized and ready.",
        level="SUCCESS"
    )

    yield

    logger.info("Shutting down AI ECOSYSTEM...")

app = FastAPI(
    title="AI ECOSYSTEM: Multi-Agent AI Business Operating System",
    description="Production-grade multi-agent operating system orchestrated by a central CEO agent.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Real-time WebSockets
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo / heartbeat or client-sent events
            await websocket.send_json({"type": "pong", "message": "Heartbeat acknowledged"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning("WebSocket exception: %s", e)
        ws_manager.disconnect(websocket)

# Mount API Routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(workflows.router)
app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(logs.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(integrations.router)

# Health Check API
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "system": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "agents_online": 8,
        "version": "1.0.0"
    }

# Static Frontend Mount
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/{catchall:path}")
    async def catch_all(catchall: str):
        # Serve index.html for client-side routing if not an API call
        if not catchall.startswith("api/") and not catchall.startswith("ws"):
            file_path = os.path.join(frontend_dir, catchall)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(os.path.join(frontend_dir, "index.html"))
        return {"error": "Not Found"}
