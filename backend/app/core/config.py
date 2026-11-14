import os
from pathlib import Path
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from backend directory or project root
root_dir = Path(__file__).resolve().parent.parent.parent.parent
env_paths = [
    Path(__file__).resolve().parent.parent.parent / ".env",
    root_dir / ".env",
]
for p in env_paths:
    if p.exists():
        load_dotenv(p)
        break

class Settings(BaseModel):
    app_name: str = "CampusOS API"
    campus_name: str = "Thapar Institute of Engineering & Technology"
    campus_short: str = "TIET"
    version: str = "1.0.0"
    environment: str = os.getenv("ENVIRONMENT", "development")
    backend_host: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))
    
    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ]
    
    # Supabase credentials
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    # Security & Auth Settings
    allow_dev_tokens: bool = (os.getenv("ALLOW_DEV_TOKENS", "true" if os.getenv("ENVIRONMENT", "development") in ("development", "test") else "false").lower() == "true")
    
    # LLM keys (optional)
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

settings = Settings()
