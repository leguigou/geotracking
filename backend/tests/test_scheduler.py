import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.database import async_session
from app.models.project import Project
from app.models.scan_result import ScanBatch
from app.services.scheduler import _as_utc, enqueue_due_projects


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
            current.created_at = now - timedelta(days=10)
            current.last_scheduled_scan_at = now - timedelta(days=8)
            await db.commit()
        count = await enqueue_due_projects(now)
        second_count = await enqueue_due_projects(now + timedelta(minutes=1))
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            return count, second_count, current.last_scheduled_scan_at

    count, second_count, scheduled_at = asyncio.run(run())
    assert count >= 1
    assert second_count == 0
    assert project["id"] in calls
    assert _as_utc(scheduled_at) == now


def test_recent_batch_prevents_scheduler_scan_storm(project, monkeypatch):
    now = datetime.now(timezone.utc)
    calls = []

    async def fake_enqueue(project_id, specific_model=None):
        calls.append(project_id)
        return {"batch_id": str(uuid.uuid4()), "enqueued": 1}

    monkeypatch.setattr("app.services.scheduler.enqueue_scan", fake_enqueue)

    async def run():
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            current.frequency = "daily"
            current.created_at = now - timedelta(days=10)
            current.last_scheduled_scan_at = now - timedelta(days=2)
            db.add(
                ScanBatch(
                    project_id=current.id,
                    status="completed",
                    total_jobs=1,
                    completed_jobs=1,
                    created_at=now - timedelta(minutes=1),
                    completed_at=now - timedelta(minutes=1),
                )
            )
            await db.commit()
        return await enqueue_due_projects(now)

    assert asyncio.run(run()) == 0
    assert calls == []
