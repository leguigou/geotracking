"""Small database-backed scheduler for recurring project scans.

Uses an ``asyncio.Lock`` to prevent concurrent tick executions and an
optimistic database-level guard (``last_scheduled_scan_at`` compared in
WHERE clause) so that even if two scheduler instances run simultaneously
they cannot double-scan the same project.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.database import async_session
from app.models.project import Project
from app.services.scan_queue import enqueue_scan


FREQUENCY_DELAYS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(days=7),
    "biweekly": timedelta(days=14),
    "monthly": timedelta(days=30),
}

_scheduler_lock = asyncio.Lock()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def enqueue_due_projects(now: datetime | None = None) -> int:
    """Enqueue active projects whose configured interval has elapsed.

    Thread- / instance-safe:
    - An ``asyncio.Lock`` prevents overlapping ticks within the same process.
    - The ``last_scheduled_scan_at`` is updated atomically via an UPDATE …
      WHERE … AND … statement so a second scheduler instance cannot re-enqueue
      a project that another instance just claimed.
    """
    now = now or datetime.now(timezone.utc)

    async with _scheduler_lock:
        async with async_session() as db:
            result = await db.execute(
                select(Project).where(Project.is_active.is_(True))
            )
            projects = list(result.scalars().all())

        enqueued = 0
        for project in projects:
            delay = FREQUENCY_DELAYS.get(project.frequency)
            if not delay:
                continue
            baseline = project.last_scheduled_scan_at or project.created_at
            if not baseline or _as_utc(baseline) + delay > now:
                continue

            # Optimistic lock: update only if still at the same baseline.
            async with async_session() as db:
                timestamp_condition = (
                    Project.last_scheduled_scan_at.is_(None)
                    if project.last_scheduled_scan_at is None
                    else Project.last_scheduled_scan_at == project.last_scheduled_scan_at
                )
                result = await db.execute(
                    update(Project)
                    .where(
                        Project.id == project.id,
                        timestamp_condition,
                    )
                    .values(last_scheduled_scan_at=now)
                )
                if result.rowcount == 0:
                    # Another instance already claimed this project → skip.
                    continue
                await db.commit()

            try:
                await enqueue_scan(str(project.id))
            except (RuntimeError, ValueError):
                # Roll back the timestamp so it's retried next tick.
                async with async_session() as db:
                    await db.execute(
                        update(Project)
                        .where(Project.id == project.id)
                        .values(last_scheduled_scan_at=project.last_scheduled_scan_at)
                    )
                    await db.commit()
                continue
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
