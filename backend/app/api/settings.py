"""Settings API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Dict, Optional
import httpx

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.setting import Setting
from app.services.openrouter import compact_model, get_catalog, recommended_models
from app.config import settings as app_settings

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
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{app_settings.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Say OK"}],
                    "max_tokens": 5,
                },
            )
            if resp.status_code == 200:
                raw_models = await get_catalog(api_key, force=True)
                return {
                    "status": "ok",
                    "message": "Connexion réussie — clé API valide",
                    "models": [compact_model(model) for model in raw_models],
                }
            elif resp.status_code == 401 or resp.status_code == 403:
                return {
                    "status": "error",
                    "message": "Clé API invalide (refusée par OpenRouter)",
                }
            else:
                body = resp.text[:300]
                return {
                    "status": "error",
                    "message": f"Erreur HTTP {resp.status_code}: {body}",
                }
    except httpx.ConnectError:
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
    model: str | None = None


class AnalyzeResponseRequest(BaseModel):
    response_text: str = Field(min_length=1, max_length=50000)
    prompt_text: str = Field(default="", max_length=10000)


async def _assistant_config(db: AsyncSession, organization_id) -> tuple[str, str]:
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == organization_id,
            Setting.key.in_(("openrouter_api_key", "assistant_model")),
        )
    )
    values = {setting.key: setting.value for setting in result.scalars().all()}
    api_key = values.get("openrouter_api_key", "")
    model = values.get("assistant_model", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="Aucune clé API OpenRouter configurée")
    if not model:
        raise HTTPException(
            status_code=400,
            detail="Aucun modèle assistant IA configuré dans les paramètres",
        )
    return api_key, model


async def _call_assistant(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
) -> str:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{app_settings.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Erreur du modèle {model}: HTTP {resp.status_code} — {resp.text[:200]}",
                )
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Impossible de se connecter à OpenRouter")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur inattendue: {str(exc)[:200]}")


@router.get("/available-models")
async def list_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the live text-model catalog and one valid preset per provider."""
    # Récupérer la clé API
    result = await db.execute(
        select(Setting).where(
            Setting.organization_id == current_user.organization_id,
            Setting.key == "openrouter_api_key",
        )
    )
    setting = result.scalar_one_or_none()
    api_key = setting.value if setting else ""
    assistant_result = await db.execute(
        select(Setting).where(
            Setting.organization_id == current_user.organization_id,
            Setting.key == "assistant_model",
        )
    )
    assistant_setting = assistant_result.scalar_one_or_none()

    try:
        raw_models = await get_catalog(api_key)
        models = [compact_model(model) for model in raw_models]
        return {
            "models": models,
            "recommended": recommended_models(raw_models),
            "has_key": bool(api_key),
            "assistant_model": assistant_setting.value if assistant_setting else None,
            "message": f"{len(models)} modèles texte disponibles",
        }
    except Exception as exc:
        return {
            "models": [],
            "recommended": {},
            "has_key": bool(api_key),
            "assistant_model": assistant_setting.value if assistant_setting else None,
            "message": f"Erreur de connexion à OpenRouter: {str(exc)[:120]}",
        }


@router.post("/rewrite-prompt")
async def rewrite_prompt(
    req: RewriteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reformule un prompt avec le modèle assistant configuré."""
    api_key, configured_model = await _assistant_config(db, current_user.organization_id)
    model = configured_model or req.model

    system_prompt = (
        "Tu es un rédacteur expert en prompts pour l'IA. "
        "Réécris la requête de l'utilisateur en une question claire, naturelle et détaillée, "
        "comme si un humain la posait à un assistant IA. "
        "Ne réponds PAS à la question, réécris-la seulement. "
        "Utilise un ton naturel et conversationnel. "
        "Retourne UNIQUEMENT le prompt réécrit, sans commentaire ni guillemets."
    )

    content = await _call_assistant(api_key, model, system_prompt, req.text, 300)
    return {"rewritten": content.strip('"').strip("'").strip(), "model": model}


@router.post("/analyze-response")
async def analyze_response(
    req: AnalyzeResponseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyse une réponse de scan avec le modèle assistant configuré."""
    api_key, model = await _assistant_config(db, current_user.organization_id)
    system_prompt = (
        "Tu es un analyste GEO spécialisé dans la visibilité des marques dans les réponses IA. "
        "Analyse uniquement les informations fournies. Réponds en français, de façon concise et actionnable, "
        "avec quatre sections Markdown : Résumé, Pourquoi la marque ressort ou non, Concurrents observés, "
        "Actions recommandées. N'invente aucune donnée et signale clairement les incertitudes."
    )
    user_prompt = (
        f"Prompt initial :\n{req.prompt_text or 'Non renseigné'}\n\n"
        f"Réponse à analyser :\n{req.response_text}"
    )
    analysis = await _call_assistant(api_key, model, system_prompt, user_prompt, 900)
    return {"analysis": analysis, "model": model}
