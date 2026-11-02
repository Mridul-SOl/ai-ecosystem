import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Active connections: %d", len(self.active_connections))
        # Send initial welcome payload
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to AI ECOSYSTEM real-time event stream"
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket client disconnected. Remaining: %d", len(self.active_connections))

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """
        Broadcast structured event to all active clients.
        Example event_types:
          - agent_status_changed
          - task_updated
          - task_created
          - workflow_progress
          - agent_message
          - activity_log
          - approval_required
        """
        message = {
            "type": event_type,
            "data": data
        }
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning("Error sending WebSocket message: %s", e)
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def send_personal(self, websocket: WebSocket, event_type: str, data: Dict[str, Any]):
        try:
            await websocket.send_json({
                "type": event_type,
                "data": data
            })
        except Exception as e:
            logger.warning("Error sending direct WebSocket message: %s", e)
            self.disconnect(websocket)

ws_manager = WebSocketManager()
