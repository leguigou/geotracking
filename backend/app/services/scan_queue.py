"""ARQ-based asynchronous scan queue for GEOTrack AI."""

import uuid
from datetime import datetime, timezone

from arq import Retry, Worker, create_pool
from arq.connections import RedisSettings
from sqlalchemy import select, update

from app.config import settings
from app.database import async_session
from app.models.project import Project, Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.models.setting import Setting
from app.services.openrouter import (
    get_model_metadata,
    get_organization_api_key,
    resolve_legacy_project_models,
)
from app.services.scanner import run_assertions, scan_prompt


async def enqueue_scan(project_id: str, specific_model: str | None = None) -> dict:
    """Create one batch and enqueue every active prompt/model pair."""
    project_uuid = uuid.UUID(str(project_id))

    async with async_session() as db:
        project_result = await db.execute(
            select(Project).where(Project.id == project_uuid).with_for_update()
        )
        project = project_result.scalar_one_or_none()
        if not project:
            raise ValueError(f"Project {project_id} not found")
        if not project.is_active:
            raise ValueError("Le projet est en pause")

        prompts_result = await db.execute(
            select(Prompt).where(Prompt.project_id == project_uuid, Prompt.is_active.is_(True))
        )
        prompts = prompts_result.scalars().all()
        project_models = await resolve_legacy_project_models(db, project)
        models = [specific_model] if specific_model else project_models

        if not prompts:
            raise ValueError("Aucun prompt actif à scanner")
        if not models:
            raise ValueError("Aucun modèle OpenRouter configuré pour ce projet")

        active_result = await db.execute(
            select(ScanBatch).where(
                ScanBatch.project_id == project_uuid,
                ScanBatch.status.in_(("queued", "running")),
            )
        )
        if active_result.scalar_one_or_none():
            raise RuntimeError("Un scan est déjà en cours pour ce projet")

        batch = ScanBatch(
            project_id=project_uuid,
            requested_model=specific_model,
            total_jobs=len(prompts) * len(models),
            status="queued",
        )
        db.add(batch)
        await db.flush()
        batch_id = batch.id
        await db.commit()

    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job_ids: list[str] = []
    try:
        for prompt in prompts:
            for model in models:
                job_id = f"scan-{batch_id}-{uuid.uuid4().hex[:10]}"
                await redis.enqueue_job(
                    "scan_prompt_job",
                    batch_id=str(batch_id),
                    prompt_id=str(prompt.id),
                    text=prompt.text,
                    model=model,
                    target_url=project.target_url,
                    brand_names=project.brand_names or [],
                    project_id=str(project_uuid),
                    job_id=job_id,
                    _job_id=job_id,
                )
                job_ids.append(job_id)
    except Exception:
        async with async_session() as db:
            batch = await db.get(ScanBatch, batch_id)
            if batch:
                batch.status = "failed"
                batch.completed_at = datetime.now(timezone.utc)
                await db.commit()
        raise
    finally:
        await redis.close()

    async with async_session() as db:
        project = await db.get(Project, project_uuid)
        if project:
            project.active_scan_jobs = job_ids
        await db.commit()

    return {
        "batch_id": str(batch_id),
        "project_id": str(project_uuid),
        "enqueued": len(job_ids),
        "job_ids": job_ids,
    }


async def _temperature_for_project(db, project: Project) -> float:
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == project.organization_id,
            Setting.key == "temperature",
        )
    )
    setting = result.scalar_one_or_none()
    try:
        return min(1.0, max(0.0, float(setting.value))) if setting else 0.1
    except (TypeError, ValueError):
        return 0.1


async def scan_prompt_job(
    ctx,
    *,
    batch_id,
    prompt_id,
    text,
    model,
    target_url,
    brand_names,
    project_id,
    job_id,
):
    """Call OpenRouter, persist the result and atomically advance its batch."""
    batch_uuid = uuid.UUID(batch_id)
    project_uuid = uuid.UUID(project_id)

    async with async_session() as db:
        batch = await db.get(ScanBatch, batch_uuid)
        if not batch or batch.status == "cancelled":
            return {"status": "cancelled", "batch_id": batch_id}
        if batch.status == "queued":
            batch.status = "running"
        project = await db.get(Project, project_uuid)
        if not project:
            raise ValueError(f"Project {project_id} not found")
        api_key = await get_organization_api_key(db, project.organization_id)
        temperature = await _temperature_for_project(db, project)
        existing = await db.execute(
            select(ScanResult).where(
                ScanResult.batch_id == batch_uuid,
                ScanResult.prompt_id == uuid.UUID(prompt_id),
                ScanResult.model == model,
            )
        )
        if existing.scalar_one_or_none():
            return {"status": "already_completed", "batch_id": batch_id, "job_id": job_id}
        await db.commit()

    model_metadata = await get_model_metadata(model, api_key)
    result = await scan_prompt(
        text,
        api_key=api_key,
        model=model,
        temperature=temperature,
        model_metadata=model_metadata,
    )
    response_text = result["response_text"]
    error = result.get("error")
    if error and result.get("retryable") and int(ctx.get("job_try", 1)) < 3:
        raise Retry(defer=5 * int(ctx.get("job_try", 1)))
    assertions = run_assertions(response_text, target_url, brand_names)

    async with async_session() as db:
        batch = await db.get(ScanBatch, batch_uuid)
        if not batch or batch.status == "cancelled":
            return {"status": "cancelled", "batch_id": batch_id}

        db.add(
            ScanResult(
                batch_id=batch_uuid,
                project_id=project_uuid,
                prompt_id=uuid.UUID(prompt_id),
                model=model,
                response_text=response_text,
                has_url=assertions["has_url"],
                has_brand=assertions["has_brand"],
                rank=assertions["rank"],
                latency_ms=result["latency_ms"],
                tokens_used=result["tokens_used"],
                cost=result["cost"],
                error=error,
                scanned_at=datetime.now(timezone.utc),
            )
        )
        counter_update = (
            update(ScanBatch)
            .where(ScanBatch.id == batch_uuid, ScanBatch.status != "cancelled")
            .values(
                completed_jobs=ScanBatch.completed_jobs + 1,
                failed_jobs=ScanBatch.failed_jobs + (1 if error else 0),
                status="running",
            )
            .returning(ScanBatch.completed_jobs, ScanBatch.total_jobs)
        )
        counters = (await db.execute(counter_update)).one_or_none()
        await db.commit()

        if counters and counters.completed_jobs >= counters.total_jobs:
            await db.execute(
                update(ScanBatch)
                .where(ScanBatch.id == batch_uuid, ScanBatch.status != "cancelled")
                .values(status="completed", completed_at=datetime.now(timezone.utc))
            )
            project = await db.get(Project, project_uuid)
            if project:
                project.active_scan_jobs = None
            await db.commit()

    return {
        "batch_id": batch_id,
        "prompt_id": prompt_id,
        "model": model,
        "has_url": assertions["has_url"],
        "has_brand": assertions["has_brand"],
        "rank": assertions["rank"],
        "error": error,
        "job_id": job_id,
    }


async def create_worker() -> Worker:
    return Worker(
        functions=WorkerSettings.functions,
        redis_settings=WorkerSettings.redis_settings,
        poll_delay=WorkerSettings.poll_delay,
        max_tries=WorkerSettings.max_tries,
        keep_result=WorkerSettings.keep_result,
        allow_abort_jobs=WorkerSettings.allow_abort_jobs,
    )


class WorkerSettings:
    """Settings consumed by the ARQ command-line worker."""

    functions = [scan_prompt_job]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    poll_delay = 1.0
    max_tries = 3
    keep_result = 3600
    allow_abort_jobs = True
