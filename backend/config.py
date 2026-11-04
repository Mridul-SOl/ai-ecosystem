import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

IS_VERCEL = bool(os.environ.get("VERCEL"))
DEFAULT_DATA_DIR = "/tmp/data" if IS_VERCEL else "./data"
DEFAULT_CHROMA_DIR = "/tmp/chroma" if IS_VERCEL else "./data/chroma"
DEFAULT_DB_URL = f"sqlite+aiosqlite:///{DEFAULT_DATA_DIR}/ai_ecosystem.db"
DEFAULT_SYNC_DB_URL = f"sqlite:///{DEFAULT_DATA_DIR}/ai_ecosystem.db"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    APP_NAME: str = "AI ECOSYSTEM"
    APP_ENV: str = "production" if IS_VERCEL else "development"
    DEBUG: bool = not IS_VERCEL
    SECRET_KEY: str = "super-secret-key-ai-ecosystem-2026-production-ready-jwt"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = DEFAULT_DB_URL
    SQLITE_SYNC_URL: str = DEFAULT_SYNC_DB_URL
    CHROMA_PERSIST_DIR: str = DEFAULT_CHROMA_DIR

    DEFAULT_LLM_PROVIDER: str = "groq"  # groq, openai, ollama, heuristic
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    GITHUB_TOKEN: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    REQUIRE_APPROVAL_FOR_EMAIL: bool = True
    REQUIRE_APPROVAL_FOR_GITHUB: bool = True
    REQUIRE_APPROVAL_FOR_SCRAPING: bool = False

    # Supabase Auth Integration
    SUPABASE_URL: str = "https://ydrwdyerkikqxtdlmytc.supabase.co"
    SUPABASE_KEY: str = "sb_publishable_wtRPHFAEgVlge9YXv8GbZA_OY_w6L5C"
    NEXT_PUBLIC_SUPABASE_URL: str = "https://ydrwdyerkikqxtdlmytc.supabase.co"
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = "sb_publishable_wtRPHFAEgVlge9YXv8GbZA_OY_w6L5C"

    ALLOWED_ORIGINS: List[str] = ["*"]

settings = Settings()
