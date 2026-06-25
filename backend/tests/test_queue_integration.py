import asyncio
import os
import uuid

import pytest
from arq import Worker, create_pool
from arq.connections import RedisSettings
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.scan_result import ScanBatch, ScanResult
from app.services.scan_queue import enqueue_scan, scan_prompt_job


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_REDIS_TESTS") != "1",
    reason="Set RUN_REDIS_TESTS=1 when a disposable Redis is available",
)


def test_real_redis_worker_is_idempotent(client, account, project, monkeypatch):
    prompt = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["où acheter une piscine à Marseille ?"]},
    )
    assert prompt.status_code == 201

    async def fake_scan(*args, **kwargs):
        return {
            "response_text": "1. Cabesto — https://cabesto.com",
            "latency_ms": 10,
            "tokens_used": 12,
            "cost": 0.00001,
            "error": None,
            "retryable": False,
        }

    async def fake_metadata(*args, **kwargs):
        return {}

    monkeypatch.setattr("app.services.scan_queue.scan_prompt", fake_scan)
    monkeypatch.setattr("app.services.scan_queue.get_model_metadata", fake_metadata)

    async def run_worker():
        summary = await enqueue_scan(project["id"], specific_model="openai/gpt-5.4-mini")
        worker = Worker(
            functions=[scan_prompt_job],
            redis_settings=RedisSettings.from_dsn(settings.redis_url),
            burst=True,
            allow_abort_jobs=True,
        )
        await worker.async_run()

        async with async_session() as db:
            results = list((await db.execute(
                select(ScanResult).where(ScanResult.batch_id == uuid.UUID(summary["batch_id"]))
            )).scalars().all())
            batch = await db.get(ScanBatch, uuid.UUID(summary["batch_id"]))
            assert len(results) == 1
            assert batch.completed_jobs == 1
            assert batch.status == "completed"

        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await redis.flushdb()
        await redis.close()

    asyncio.run(run_worker())
