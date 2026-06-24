"""Settings API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Dict, Optional
import httpx

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.setting import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


class TestKeyRequest(BaseModel):
    api_key: str | None = None


@router.get("")
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Setting).where(Setting.organization_id == current_user.organization_id)
    )
    settings_list = result.scalars().all()
    return {s.key: s.value for s in settings_list}


@router.put("")
async def update_settings(
    req: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    for key, value in req.settings.items():
        result = await db.execute(
            select(Setting).where(
                Setting.organization_id == org_id,
                Setting.key == key,
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            setting = Setting(organization_id=org_id, key=key, value=value)
            db.add(setting)
    await db.flush()

    result = await db.execute(
        select(Setting).where(Setting.organization_id == org_id)
    )
    settings_list = result.scalars().all()
    return {s.key: s.value for s in settings_list}


@router.post("/test-openrouter")
async def test_openrouter(
    req: TestKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test si la clé API OpenRouter est valide.

    Si *api_key* est fournie dans le body, teste cette clé directement.
    Sinon, lit la clé depuis les settings de l'organisation.
    Utilise le même client OpenAI SDK que le scanner pour une validation réaliste.
    """
    api_key = req.api_key

    # Si pas de clé dans la requête, lire depuis la DB
    if not api_key:
        result = await db.execute(
            select(Setting).where(
                Setting.organization_id == current_user.organization_id,
                Setting.key == "openrouter_api_key",
            )
        )
        setting = result.scalar_one_or_none()
        api_key = setting.value if setting else ""

    if not api_key:
        raise HTTPException(status_code=400, detail="Aucune clé API configurée")

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            default_headers={
                "HTTP-Referer": (
                    settings.cors_origins_list[0]
                    if settings.cors_origins_list
                    else "https://geotrack.ai"
                ),
                "X-Title": "GEOTrack AI",
            },
        )
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        if response.choices and response.choices[0].message.content is not None:
            return {
                "status": "ok",
                "message": "Connexion réussie — clé API valide",
            }
        return {
            "status": "error",
            "message": "Réponse inattendue de l'API",
        }
    except Exception as e:
        err_str = str(e)
        if "401" in err_str or "403" in err_str or "Unauthorized" in err_str:
            return {
                "status": "error",
                "message": "Clé API invalide (refusée par OpenRouter)",
            }
        return {
            "status": "error",
            "message": f"Erreur: {err_str[:200]}",
        }


class RewriteRequest(BaseModel):
    text: str
    model: str = "openai/gpt-4o-mini"


@router.get("/available-models")
async def list_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les modèles disponibles sur OpenRouter (20 premiers)."""
    # Récupérer la clé API
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == current_user.organization_id,
            Setting.key == "openrouter_api_key",
        )
    )
    setting = result.scalar_one_or_none()
    api_key = setting.value if setting else ""

    if not api_key:
        return {"models": [], "has_key": False, "message": "Aucune clé API configurée"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code != 200:
                return {"models": [], "has_key": True, "message": "Impossible de récupérer les modèles"}

            data = resp.json()
            # Filtrer les modèles de chat populaires, prendre les 30 premiers
            models = [
                {
                    "id": m["id"],
                    "name": m.get("name", m["id"]),
                    "provider": m.get("vendor", {}).get("name", "?"),
                    "pricing": m.get("pricing", {}),
                }
                for m in data.get("data", [])
                if "text" in m.get("architecture", {}).get("modality", "text") or True
            ][:30]
            return {"models": models, "has_key": True, "message": f"{len(models)} modèles disponibles"}
    except Exception:
        return {"models": [], "has_key": True, "message": "Erreur de connexion à OpenRouter"}


@router.post("/rewrite-prompt")
async def rewrite_prompt(
    req: RewriteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reformule un texte saisi en un prompt utilisateur bien rédigé,
    en utilisant le modèle OpenRouter choisi.
    """
    # Récupérer la clé API
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == current_user.organization_id,
            Setting.key == "openrouter_api_key",
        )
    )
    setting = result.scalar_one_or_none()
    api_key = setting.value if setting else ""

    if not api_key:
        raise HTTPException(status_code=400, detail="Aucune clé API OpenRouter configurée")

    system_prompt = (
        "Tu es un rédacteur expert en prompts pour l'IA. "
        "Réécris la requête de l'utilisateur en une question claire, naturelle et détaillée, "
        "comme si un humain la posait à un assistant IA. "
        "Ne réponds PAS à la question, réécris-la seulement. "
        "Utilise un ton naturel et conversationnel. "
        "Retourne UNIQUEMENT le prompt réécrit, sans commentaire ni guillemets."
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.text},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            if resp.status_code != 200:
                body = resp.text[:200]
                raise HTTPException(
                    status_code=502,
                    detail=f"Erreur du modèle {req.model}: HTTP {resp.status_code} — {body}",
                )

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            # Nettoyer les guillemets superflus
            content = content.strip('"').strip("'").strip()
            return {"rewritten": content}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Impossible de se connecter à OpenRouter")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur inattendue: {str(e)[:200]}")
