import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.database import async_session
from app.models.project import Project
from app.services.scheduler import enqueue_due_projects


def test_due_weekly_project_is_scheduled(project, monkeypatch):
    now = datetime.now(timezone.utc)
    calls = []

    async def fake_enqueue(project_id, specific_model=None):
        calls.append(project_id)
        return {"batch_id": str(uuid.uuid4()), "enqueued": 1}

    monkeypatch.setattr("app.services.scheduler.enqueue_scan", fake_enqueue)

    async def run():
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            current.frequency = "weekly"
            current.last_scheduled_scan_at = now - timedelta(days=8)
            await db.commit()
        count = await enqueue_due_projects(now)
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            return count, current.last_scheduled_scan_at

    count, scheduled_at = asyncio.run(run())
    assert count >= 1
    assert project["id"] in calls
    assert scheduled_at is not None
