"""ARQ-based asynchronous scan queue for GEOTrack AI.

Provides:
- ``enqueue_scan(project_id)`` — enqueue all prompts for a project.
- ``create_worker()`` — build the ARQ Worker instance.
- ``scan_prompt_job`` — the job function that runs inside ARQ.
"""

import uuid
from datetime import datetime, timezone

from arq import create_pool, Worker
from arq.connections import RedisSettings
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.project import Project, Prompt
from app.models.scan_result import ScanResult
from app.services.scanner import scan_prompt, run_assertions


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------
async def enqueue_scan(project_id: str, specific_model: str | None = None) -> dict:
    """Fetch all prompts for *project_id* and enqueue a scan job per prompt/model pair.

    Returns a summary dict with ``enqueued`` count and ``project_id``.
    """
    redis = await create_pool(
        RedisSettings.from_dsn(settings.redis_url)
    )

    try:
        async with async_session() as db:
            result = await db.execute(
                select(Project).where(Project.id == project_id)
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ValueError(f"Project {project_id} not found")

            prompts_result = await db.execute(
                select(Prompt).where(Prompt.project_id == project_id)
            )
            prompts = prompts_result.scalars().all()

        enqueued = 0
        job_ids: list[str] = []
        models = [specific_model] if specific_model else (project.enabled_models or ["openai/gpt-4o-mini"])
        for prompt in prompts:
            for model in models:
                job_id = f"scan-{prompt.id}-{model}-{uuid.uuid4().hex[:8]}"
                await redis.enqueue_job(
                    "scan_prompt_job",
                    prompt_id=str(prompt.id),
                    text=prompt.text,
                    model=model,
                    target_url=project.target_url,
                    brand_names=project.brand_names or [],
                    project_id=str(project_id),
                    _job_id=job_id,
                )
                job_ids.append(job_id)
                enqueued += 1

        # Stocker les job_ids dans le projet pour permettre l'annulation
        if job_ids:
            async with async_session() as db:
                result = await db.execute(
                    select(Project).where(Project.id == project_id)
                )
                p = result.scalar_one_or_none()
                if p:
                    p.active_scan_jobs = job_ids
                    await db.commit()

        return {"project_id": project_id, "enqueued": enqueued, "job_ids": job_ids}

    finally:
        redis.close()


# ---------------------------------------------------------------------------
# Job function (called by ARQ worker)
# ---------------------------------------------------------------------------
async def scan_prompt_job(ctx, *, prompt_id, text, model, target_url, brand_names, project_id):
    """ARQ job: call the LLM, run assertions, persist a ScanResult."""
    result = await scan_prompt(text, model=model)
    response_text = result["response_text"]
    error = result.get("error")

    assertions = run_assertions(response_text, target_url, brand_names)

    async with async_session() as db:
        scan_result = ScanResult(
            project_id=uuid.UUID(project_id),
            prompt_id=uuid.UUID(prompt_id),
            model=model,
            response_text=response_text,
            has_url=assertions["has_url"],
            has_brand=assertions["has_brand"],
            rank=assertions["rank"],
            latency_ms=result["latency_ms"],
            tokens_used=result["tokens_used"],
            cost=result["cost"],
            scanned_at=datetime.now(timezone.utc),
        )
        db.add(scan_result)
        await db.commit()

    return {
        "prompt_id": prompt_id,
        "model": model,
        "has_url": assertions["has_url"],
        "has_brand": assertions["has_brand"],
        "rank": assertions["rank"],
        "error": error,
    }


# ---------------------------------------------------------------------------
# Worker factory
# ---------------------------------------------------------------------------
async def create_worker() -> Worker:
    """Build and return an ARQ Worker configured for GEOTrack scan jobs."""
    return Worker(
        settings=RedisSettings.from_dsn(settings.redis_url),
        functions=[scan_prompt_job],
        on_startup=None,
        on_shutdown=None,
        poll_delay=1.0,
        max_tries=3,
        keep_result=3600,  # 1 hour
    )
