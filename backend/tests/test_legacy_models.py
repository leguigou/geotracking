import asyncio
import uuid

from app.database import async_session
from app.models.project import Project
from app.services.openrouter import resolve_legacy_project_models


def test_legacy_aliases_are_resolved_and_persisted(project, monkeypatch):
    catalog = [
        {
            "id": "openai/gpt-current-mini",
            "name": "OpenAI Current Mini",
            "created": 1,
            "pricing": {"prompt": "0.000001", "completion": "0.000002"},
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "supported_parameters": ["temperature", "max_tokens"],
        },
        {
            "id": "anthropic/claude-current-haiku",
            "name": "Claude Current Haiku",
            "created": 1,
            "pricing": {"prompt": "0.000001", "completion": "0.000002"},
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "supported_parameters": ["temperature", "max_tokens"],
        },
    ]

    async def fake_catalog(*args, **kwargs):
        return catalog

    monkeypatch.setattr("app.services.openrouter.get_catalog", fake_catalog)

    async def resolve():
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            current.enabled_models = ["chatgpt", "claude"]
            resolved = await resolve_legacy_project_models(db, current)
            await db.commit()
        async with async_session() as db:
            persisted = await db.get(Project, uuid.UUID(project["id"]))
            return resolved, persisted.enabled_models

    resolved, persisted = asyncio.run(resolve())
    assert resolved == ["openai/gpt-current-mini", "anthropic/claude-current-haiku"]
    assert persisted == resolved
