"""Project and Prompt schemas."""

import uuid
from typing import Optional

from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    target_url: str
    brand_names: list[str] = []
    enabled_models: list[str] = []
    frequency: str = "daily"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    target_url: Optional[str] = None
    brand_names: Optional[list[str]] = None
    enabled_models: Optional[list[str]] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    target_url: str
    brand_names: list[str]
    enabled_models: list[str]
    frequency: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromptCreate(BaseModel):
    texts: list[str]
    theme: Optional[str] = None


class PromptResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    text: str
    theme: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True
