"""Settings API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Dict
import httpx

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.setting import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test si la clé API OpenRouter est valide en listant les modèles."""
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
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [m["id"] for m in data.get("data", [])[:5]]
                return {
                    "status": "ok",
                    "message": f"Connexion réussie — {len(data.get('data', []))} modèles disponibles",
                    "models": models,
                }
            elif resp.status_code == 401:
                return {
                    "status": "error",
                    "message": "Clé API invalide (HTTP 401)",
                }
            else:
                return {
                    "status": "error",
                    "message": f"Erreur HTTP {resp.status_code}: {resp.text[:200]}",
                }
    except httpx.ConnectError:
        return {
            "status": "error",
            "message": "Impossible de se connecter à OpenRouter",
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Erreur inattendue: {str(e)[:200]}",
        }
