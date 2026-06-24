"""Small database-backed scheduler for recurring project scans."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import async_session
from app.models.project import Project
from app.services.scan_queue import enqueue_scan


FREQUENCY_DELAYS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(days=7),
    "biweekly": timedelta(days=14),
    "monthly": timedelta(days=30),
}


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def enqueue_due_projects(now: datetime | None = None) -> int:
    """Enqueue active projects whose configured interval has elapsed."""
    now = now or datetime.now(timezone.utc)
    async with async_session() as db:
        result = await db.execute(select(Project).where(Project.is_active.is_(True)))
        projects = list(result.scalars().all())

    enqueued = 0
    for project in projects:
        delay = FREQUENCY_DELAYS.get(project.frequency)
        if not delay:
            continue
        baseline = project.last_scheduled_scan_at or project.created_at
        if not baseline or _as_utc(baseline) + delay > now:
            continue
        try:
            await enqueue_scan(str(project.id))
        except (RuntimeError, ValueError):
            continue
        async with async_session() as db:
            current = await db.get(Project, project.id)
            if current:
                current.last_scheduled_scan_at = now
                await db.commit()
        enqueued += 1
    return enqueued


async def scheduler_loop(interval_seconds: int = 60) -> None:
    while True:
        try:
            await enqueue_due_projects()
        except Exception as exc:
            print(f"[scheduler] {exc}")
        await asyncio.sleep(interval_seconds)


if __name__ == "__main__":
    asyncio.run(scheduler_loop())
