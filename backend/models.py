import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(50), primary_key=True)  # "ceo", "hr", "marketing", etc.
    name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    role = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=False)
    avatar = Column(String(255), nullable=True)
    status = Column(String(50), default="idle")  # idle, busy, thinking, error, offline
    tasks_completed = Column(Integer, default=0)
    tasks_pending = Column(Integer, default=0)
    capabilities = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("Task", back_populates="agent", foreign_keys="Task.assigned_agent_id")

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    objective = Column(Text, nullable=False)
    status = Column(String(50), default="Pending")  # Pending, Running, Completed, Failed, Paused
    current_step = Column(Integer, default=0)
    total_steps = Column(Integer, default=0)
    execution_plan = Column(JSON, default=list)  # List of subtasks and dependency graph
    final_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    tasks = relationship("Task", back_populates="workflow", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    department = Column(String(100), nullable=False)
    assigned_agent_id = Column(String(50), ForeignKey("agents.id"), nullable=False)
    status = Column(String(50), default="Pending")  # Pending, Assigned, Running, Awaiting Approval, Completed, Failed, Cancelled
    priority = Column(String(50), default="Medium")  # Low, Medium, High, Critical
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)
    requires_approval = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    workflow_id = Column(String(36), ForeignKey("workflows.id"), nullable=True)
    step_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    agent = relationship("Agent", back_populates="tasks", foreign_keys=[assigned_agent_id])
    workflow = relationship("Workflow", back_populates="tasks")
    history = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")

class TaskHistory(Base):
    __tablename__ = "task_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id"), nullable=False)
    agent_id = Column(String(50), nullable=False)
    state_from = Column(String(50), nullable=False)
    state_to = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="history")

class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sender_agent_id = Column(String(50), nullable=False)
    recipient_agent_id = Column(String(50), nullable=False)
    task_id = Column(String(36), nullable=True)
    workflow_id = Column(String(36), nullable=True)
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="chat")  # instruction, report, critique, revision, chat, system
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    level = Column(String(20), default="INFO")  # INFO, WARN, ERROR, ACTION, SUCCESS
    agent_id = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    is_secret = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
