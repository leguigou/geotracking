"""Projects CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional

from app.database import get_db
from app.dependencies import get_current_user, get_current_organization
from app.models.user import User
from app.models.project import Project, Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    PromptCreate, PromptResponse,
)
from app.services.audit import log_action
from app.llm_registry import resolve_models

router = APIRouter(prefix="/projects", tags=["projects"])


def _resolve_project_id(project_id: str) -> uuid.UUID:
    """Try to parse project_id as UUID; raise 422 on failure."""
    try:
        return uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid project ID: '{project_id}' (expected UUID format)")


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.organization_id == org_id).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    # Si des slugs frontend sont fournis, les convertir en modèles OpenRouter
    final_models = req.enabled_models
    if req.models:
        final_models = resolve_models(req.models)
    elif not final_models:
        final_models = ["openai/gpt-4o-mini"]

    project = Project(
        organization_id=org_id,
        name=req.name,
        target_url=req.target_url,
        description=req.description,
        brand_names=req.brand_names,
        enabled_models=final_models,
        frequency=req.frequency,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    await log_action(db, org_id, current_user.id, "project.created", "project", str(project.id), {"name": project.name, "url": project.target_url})
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.flush()
    await db.refresh(project)
    await log_action(db, current_user.organization_id, current_user.id, "project.updated", "project", str(project.id), update_data)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await log_action(db, current_user.organization_id, current_user.id, "project.deleted", "project", str(project.id), {"name": project.name})
    await db.execute(delete(ScanResult).where(ScanResult.project_id == uid))
    await db.execute(delete(ScanBatch).where(ScanBatch.project_id == uid))
    await db.delete(project)


# === Prompts (nested under projects) ===

@router.get("/{project_id}/prompts", response_model=List[PromptResponse])
async def list_prompts(
    project_id: str,
    theme: Optional[str] = None,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    # Verify project belongs to org
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Prompt).where(Prompt.project_id == uid)
    if theme:
        query = query.where(Prompt.theme == theme)
    query = query.order_by(Prompt.theme, Prompt.created_at)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{project_id}/prompts", response_model=List[PromptResponse], status_code=201)
async def create_prompts(
    project_id: str,
    req: PromptCreate,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    prompts = [Prompt(project_id=uid, text=text, theme=req.theme) for text in req.texts]
    db.add_all(prompts)
    await db.flush()
    return prompts


class PromptUpdate(BaseModel):
    text: Optional[str] = None
    theme: Optional[str] = None
    is_active: Optional[bool] = None


@router.patch("/{project_id}/prompts/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    project_id: str,
    prompt_id: str,
    req: PromptUpdate,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    pid = _resolve_project_id(prompt_id)
    # Vérifier que le projet appartient à l'org
    result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Prompt).where(Prompt.id == pid, Prompt.project_id == uid)
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prompt, key, value)

    await db.flush()
    await db.refresh(prompt)
    return prompt


@router.delete("/{project_id}/prompts/{prompt_id}", status_code=204)
async def delete_prompt(
    project_id: str,
    prompt_id: str,
    org_id: str = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    uid = _resolve_project_id(project_id)
    pid = _resolve_project_id(prompt_id)
    project_result = await db.execute(
        select(Project).where(Project.id == uid, Project.organization_id == org_id)
    )
    if not project_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")
    result = await db.execute(
        select(Prompt).where(Prompt.id == pid, Prompt.project_id == uid)
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    await db.execute(delete(ScanResult).where(ScanResult.prompt_id == pid))
    await db.delete(prompt)
