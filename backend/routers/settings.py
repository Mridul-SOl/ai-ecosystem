from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.database import get_db
from backend.models import SystemSettings
from backend.schemas import SettingsUpdate
from backend.config import settings
from backend.ai.llm_provider import get_llm_provider
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSettings))
    records = result.scalars().all()

    settings_dict = {}
    for r in records:
        if r.is_secret:
            # Mask secret
            val = r.value
            if len(val) > 8:
                masked = val[:3] + "..." + val[-3:]
            elif val:
                masked = "••••••••"
            else:
                masked = ""
            settings_dict[r.key] = masked
        else:
            settings_dict[r.key] = r.value

    # Include environmental defaults
    return {
        "stored": settings_dict,
        "runtime": {
            "app_name": settings.APP_NAME,
            "app_env": settings.APP_ENV,
            "default_provider": settings.DEFAULT_LLM_PROVIDER,
            "openai_configured": bool(settings.OPENAI_API_KEY),
            "ollama_base_url": settings.OLLAMA_BASE_URL,
            "require_approval_email": settings.REQUIRE_APPROVAL_FOR_EMAIL,
            "require_approval_github": settings.REQUIRE_APPROVAL_FOR_GITHUB
        }
    }

@router.post("")
async def update_settings(payload: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    for key, val in payload.settings.items():
        res = await db.execute(select(SystemSettings).where(SystemSettings.key == key))
        record = res.scalar_one_or_none()
        is_secret = any(s in key.lower() for s in ["key", "secret", "password", "token"])

        if record:
            # If user sent masked bullets, don't overwrite with masked string
            if "••" not in val:
                record.value = val
        else:
            session_item = SystemSettings(key=key, value=val, is_secret=is_secret)
            db.add(session_item)

        # Update runtime settings
        if key == "llm_provider":
            settings.DEFAULT_LLM_PROVIDER = val
        elif key == "openai_api_key" and "••" not in val:
            settings.OPENAI_API_KEY = val
        elif key == "ollama_base_url":
            settings.OLLAMA_BASE_URL = val
        elif key == "github_token" and "••" not in val:
            settings.GITHUB_TOKEN = val

    await db.commit()
    await log_activity(
        action="SETTINGS_UPDATED",
        message="System configuration parameters updated.",
        level="ACTION"
    )
    return {"message": "Settings updated successfully."}

@router.post("/test-llm")
async def test_llm_connection():
    llm = get_llm_provider()
    try:
        reply = await llm.generate_response(
            system_prompt="You are a health check system.",
            user_prompt="Respond with 'AI ECOSYSTEM Online' and your active provider name."
        )
        return {
            "status": "online",
            "provider": type(llm).__name__,
            "response": reply
        }
    except Exception as e:
        return {
            "status": "error",
            "provider": type(llm).__name__,
            "error": str(e)
        }
