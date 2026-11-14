from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import academic, copilot, vault, reuse

app = FastAPI(
    title=settings.app_name,
    description=f"Backend services for CampusOS single-campus pilot at {settings.campus_name} ({settings.campus_short})",
    version=settings.version,
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include module routers
app.include_router(academic.router)
app.include_router(copilot.router)
app.include_router(vault.router)
app.include_router(reuse.router)

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

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "environment": settings.environment,
        "campus": settings.campus_short,
    }
