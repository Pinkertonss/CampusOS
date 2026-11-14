from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.auth import get_current_user_id
from .routers import academic, academic_rbac, copilot, vault, reuse, opportunities, lost_and_found, support, personal_assistant

app = FastAPI(
    title=settings.app_name,
    description=f"Backend services for CampusOS single-campus pilot at {settings.campus_name} ({settings.campus_short})",
    version=settings.version,
)

# CORS configured for localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include feature routers
app.include_router(academic_rbac.router)
app.include_router(academic.router)
app.include_router(academic.academics_router)
app.include_router(academic.academic_singular_router)
app.include_router(copilot.router)
app.include_router(copilot.copilot_public_router)
app.include_router(copilot.guide_router)
app.include_router(copilot.guide_public_router)
app.include_router(vault.router)
app.include_router(vault.vault_public_router)
app.include_router(reuse.router)
app.include_router(reuse.reuse_public_router)
app.include_router(opportunities.router)
app.include_router(opportunities.public_router)
app.include_router(lost_and_found.router)
app.include_router(support.router)
app.include_router(personal_assistant.router)

@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "campus": settings.campus_name,
        "version": settings.version,
        "status": "online",
        "modules": [
            "Academic Dashboard & What-if Planner",
            "Campus Copilot RAG with Actionable AI",
            "Digital Vault with RLS Isolation",
            "Campus Reuse Marketplace & Impact Tracking",
        ]
    }

@app.get("/health")
def health():
    """
    Standard health check endpoint.
    """
    return {
        "status": "ok",
        "app": settings.app_name,
        "campus": settings.campus_short,
        "environment": settings.environment,
    }

@app.get("/api/health")
def api_health():
    """
    API health check endpoint.
    """
    return {
        "status": "ok",
        "environment": settings.environment,
        "campus": settings.campus_short,
    }

@app.get("/api/auth/me")
def get_authenticated_user(user_id: str = Depends(get_current_user_id)):
    """
    Endpoint protected by Supabase JWT verification dependency.
    """
    return {
        "authenticated": True,
        "user_id": user_id,
        "campus": settings.campus_short,
    }
