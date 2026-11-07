from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# User Schemas
class UserRegister(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: Optional[str] = "admin"

class UserLogin(BaseModel):
    email: str
    password: str

class SupabaseSyncRequest(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    role: Optional[str] = "member"
    password: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Agent Schemas
class AgentBase(BaseModel):
    name: str
    department: str
    role: str
    description: str
    system_prompt: str
    avatar: Optional[str] = None
    capabilities: List[str] = []

class AgentResponse(AgentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    tasks_completed: int
    tasks_pending: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

class AgentDirectChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

# Task Schemas
class TaskCreate(BaseModel):
    title: str
    description: str
    department: str
    assigned_agent_id: str
    priority: Optional[str] = "Medium"
    input_data: Optional[Dict[str, Any]] = {}
    requires_approval: Optional[bool] = False
    workflow_id: Optional[str] = None

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    is_approved: Optional[bool] = None

class TaskHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    state_from: str
    state_to: str
    notes: Optional[str]
    timestamp: datetime

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    department: str
    assigned_agent_id: str
    status: str
    priority: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    error_message: Optional[str]
    requires_approval: bool
    is_approved: bool
    workflow_id: Optional[str]
    step_order: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    history: List[TaskHistoryResponse] = []

# Workflow Schemas
class WorkflowCreate(BaseModel):
    objective: str
    title: Optional[str] = None

class WorkflowStep(BaseModel):
    agent_id: str
    department: str
    task_title: str
    instructions: str
    dependencies: List[str] = []
    requires_approval: bool = False

class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    objective: str
    status: str
    current_step: int
    total_steps: int
    execution_plan: List[Dict[str, Any]]
    final_result: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    tasks: List[TaskResponse] = []

# Agent Message / Chat Schemas
class AgentMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_agent_id: str
    recipient_agent_id: str
    task_id: Optional[str]
    workflow_id: Optional[str]
    content: str
    message_type: str
    metadata_json: Dict[str, Any]
    created_at: datetime

class ChatRequest(BaseModel):
    message: str
    stream: Optional[bool] = False

# Activity Log Schema
class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    level: str
    agent_id: Optional[str]
    action: str
    message: str
    metadata_json: Dict[str, Any]
    created_at: datetime

# Memory Query Schemas
class MemoryItem(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any]
    distance: Optional[float] = None

class MemoryQueryRequest(BaseModel):
    query: str
    agent_id: Optional[str] = None
    limit: Optional[int] = 5

class MemoryAddRequest(BaseModel):
    content: str
    agent_id: Optional[str] = "global"
    category: Optional[str] = "general"
    metadata: Optional[Dict[str, Any]] = {}

# Settings Schema
class SettingItem(BaseModel):
    key: str
    value: str
    is_secret: bool

class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

# Analytics Schema
class AnalyticsResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    running_tasks: int
    pending_tasks: int
    awaiting_approval_tasks: int
    active_workflows: int
    completed_workflows: int
    agent_stats: List[Dict[str, Any]]
    task_throughput: List[Dict[str, Any]]
    recent_activity_count: int
