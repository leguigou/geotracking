"""GEOTrack AI — FastAPI Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.auth import router as auth_router
from app.api.projects import router as projects_router
from app.api.scans import router as scans_router
from app.api.settings import router as settings_router
from app.api.audit import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    await init_db()
    # Seed default admin user if not exists
    try:
        from app.database import async_session_factory
        from app.models.user import User
        from app.services.auth import hash_password
        from sqlalchemy import select

        async with async_session_factory() as session:
            result = await session.execute(select(User).where(User.email == "admin@geotrack.ai"))
            if not result.scalar_one_or_none():
                from app.models.user import Organization
                import uuid

                org = Organization(name="GEOTrack", slug="geotrack-main")
                session.add(org)
                await session.flush()

                admin = User(
                    organization_id=org.id,
                    email="admin@geotrack.ai",
                    password_hash=hash_password("admin123"),
                    full_name="Admin GEOTrack",
                    role="admin",
                )
                session.add(admin)
                await session.commit()
                print("[seed] Admin user created (admin@geotrack.ai / admin123)")
            else:
                print("[seed] Admin user already exists")
    except Exception as e:
        print(f"[seed] Warning: could not seed admin: {e}")
    yield


app = FastAPI(
    title="GEOTrack AI API",
    description="GEO/LLM Rank Tracker",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(scans_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(audit_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
