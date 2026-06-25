"""OpenRouter helpers shared by settings endpoints and scan workers."""

import asyncio
import json
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.setting import Setting


PROVIDER_PRESETS: dict[str, tuple[str, tuple[str, ...]]] = {
    "chatgpt": ("openai/", ("mini", "chat")),
    "claude": ("anthropic/", ("haiku", "sonnet")),
    "perplexity": ("perplexity/", ("sonar",)),
    "gemini": ("google/", ("flash", "gemini")),
    "grok": ("x-ai/", ("fast", "grok")),
    "deepseek": ("deepseek/", ("flash", "chat")),
}

OPENROUTER_SEMAPHORE = asyncio.Semaphore(5)

_catalog_cache: tuple[float, list[dict[str, Any]]] | None = None
CATALOG_TTL_SECONDS = 600


def model_provider_key(model_id: str) -> str:
    """Map an OpenRouter model id to the product's provider key."""
    for key, (prefix, _) in PROVIDER_PRESETS.items():
        if model_id.startswith(prefix):
            return key
    return model_id.split("/", 1)[0].replace("-", "_")


def _is_text_chat_model(model: dict[str, Any]) -> bool:
    architecture = model.get("architecture") or {}
    inputs = architecture.get("input_modalities") or []
    outputs = architecture.get("output_modalities") or []
    model_id = str(model.get("id", ""))
    supported = set(model.get("supported_parameters") or [])
    supports_completion_limit = not supported or bool({"max_tokens", "max_completion_tokens"} & supported)
    return (
        bool(model_id)
        and "text" in inputs
        and "text" in outputs
        and "image" not in outputs
        and "audio" not in outputs
        and "realtime" not in model_id
        and "preview" not in model_id
        and supports_completion_limit
    )


def recommended_models(models: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Pick a currently available, economical text model for each provider."""
    recommendations: dict[str, dict[str, Any]] = {}
    chat_models = [model for model in models if _is_text_chat_model(model)]

    for key, (prefix, preferences) in PROVIDER_PRESETS.items():
        candidates = [model for model in chat_models if str(model.get("id", "")).startswith(prefix)]
        if not candidates:
            continue

        def score(model: dict[str, Any]) -> tuple[int, float, int]:
            model_id = str(model.get("id", "")).lower()
            preference_rank = next(
                (index for index, preference in enumerate(preferences) if preference in model_id),
                len(preferences),
            )
            pricing = model.get("pricing") or {}
            try:
                price = float(pricing.get("prompt") or 0) + float(pricing.get("completion") or 0)
            except (TypeError, ValueError):
                price = 999.0
            # Avoid unavailable/router sentinel prices while favouring economical models.
            if price < 0:
                price = 999.0
            return preference_rank, price, -int(model.get("created") or 0)

        selected = min(candidates, key=score)
        recommendations[key] = compact_model(selected)

    return recommendations


def compact_model(model: dict[str, Any]) -> dict[str, Any]:
    model_id = str(model.get("id", ""))
    return {
        "id": model_id,
        "name": model.get("name") or model_id,
        "provider": model_id.split("/", 1)[0] if "/" in model_id else "openrouter",
        "pricing": model.get("pricing") or {},
        "context_length": model.get("context_length"),
        "supported_parameters": model.get("supported_parameters") or [],
    }


async def fetch_models(api_key: str = "") -> list[dict[str, Any]]:
    """Fetch the live OpenRouter model catalog."""
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{settings.openrouter_base_url}/models", headers=headers)
        response.raise_for_status()
        payload = response.json()
    return [model for model in payload.get("data", []) if _is_text_chat_model(model)]


async def get_catalog(api_key: str = "", force: bool = False) -> list[dict[str, Any]]:
    """Return a short-lived process cache of the live model catalog."""
    global _catalog_cache
    now = time.monotonic()
    if not force and _catalog_cache and now - _catalog_cache[0] < CATALOG_TTL_SECONDS:
        return _catalog_cache[1]
    models = await fetch_models(api_key)
    _catalog_cache = (now, models)
    return models


async def get_model_metadata(model_id: str, api_key: str = "") -> dict[str, Any]:
    try:
        models = await get_catalog(api_key)
    except Exception:
        return {}
    return next((model for model in models if model.get("id") == model_id), {})


async def get_organization_api_key(db: AsyncSession, organization_id) -> str:
    """Read an organization's OpenRouter key, falling back to the environment."""
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == organization_id,
            Setting.key == "openrouter_api_key",
        )
    )
    setting = result.scalar_one_or_none()
    return (setting.value if setting else "") or settings.openai_api_key


async def resolve_legacy_project_models(db: AsyncSession, project) -> list[str]:
    """Translate empty/alias-based legacy configuration to live model IDs."""
    configured = list(project.enabled_models or [])
    if configured and all("/" in model for model in configured):
        return configured

    aliases = [model for model in configured if model in PROVIDER_PRESETS]
    if not aliases:
        result = await db.execute(
            select(Setting).where(
                Setting.organization_id == project.organization_id,
                Setting.key == "models_enabled",
            )
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value:
            try:
                aliases = [value for value in json.loads(setting.value) if value in PROVIDER_PRESETS]
            except (TypeError, ValueError, json.JSONDecodeError):
                aliases = []
    aliases = aliases or ["chatgpt", "claude", "perplexity"]

    api_key = await get_organization_api_key(db, project.organization_id)
    catalog = await get_catalog(api_key)
    presets = recommended_models(catalog)
    resolved = [presets[alias]["id"] for alias in aliases if alias in presets]
    if not resolved:
        raise ValueError("Impossible de résoudre les modèles OpenRouter de cet ancien projet")
    project.enabled_models = resolved
    await db.flush()
    return resolved
