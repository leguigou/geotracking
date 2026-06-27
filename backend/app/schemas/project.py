"""Project and Prompt schemas."""

import uuid
from typing import Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_url: str = Field(min_length=3)
    description: Optional[str] = None
    brand_names: list[str] = Field(default_factory=list)
    # Legacy provider slugs, e.g. ["chatgpt", "claude"].
    # New clients should prefer enabled_models with full OpenRouter ids.
    models: Optional[list[str]] = None
    enabled_models: list[str] = Field(default_factory=list)
    frequency: Literal["disabled", "daily", "weekly", "biweekly", "monthly"] = "daily"

    @field_validator("name", "target_url")
    @classmethod
    def strip_required_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Ce champ est obligatoire")
        return value

    @field_validator("target_url")
    @classmethod
    def normalise_target_url(cls, value: str) -> str:
        candidate = value if "://" in value else f"https://{value}"
        parsed = urlparse(candidate)
        if not parsed.netloc or "." not in parsed.netloc:
            raise ValueError("URL de site invalide")
        return candidate.rstrip("/")

    @field_validator("brand_names")
    @classmethod
    def clean_brand_names(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

    @field_validator("enabled_models")
    @classmethod
    def validate_model_ids(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if not cleaned:
            return []
        if any("/" not in value for value in cleaned):
            raise ValueError("Utilisez des identifiants OpenRouter complets (provider/model)")
        return cleaned


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    target_url: Optional[str] = None
    description: Optional[str] = None
    brand_names: Optional[list[str]] = None
    enabled_models: Optional[list[str]] = None
    frequency: Optional[Literal["disabled", "daily", "weekly", "biweekly", "monthly"]] = None
    is_active: Optional[bool] = None

    @field_validator("target_url")
    @classmethod
    def normalise_optional_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        candidate = value.strip() if "://" in value else f"https://{value.strip()}"
        parsed = urlparse(candidate)
        if not parsed.netloc or "." not in parsed.netloc:
            raise ValueError("URL de site invalide")
        return candidate.rstrip("/")

    @field_validator("enabled_models")
    @classmethod
    def validate_optional_model_ids(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return values
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if not cleaned or any("/" not in value for value in cleaned):
            raise ValueError("Au moins un identifiant OpenRouter complet est requis")
        return cleaned


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    target_url: str
    description: Optional[str] = None
    brand_names: list[str]
    enabled_models: list[str]
    frequency: str
    is_active: bool
    created_at: datetime
    last_scheduled_scan_at: Optional[datetime] = None

class PromptCreate(BaseModel):
    texts: list[str] = Field(min_length=1)
    theme: Optional[str] = None

    @field_validator("texts")
    @classmethod
    def clean_prompts(cls, values: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if not cleaned:
            raise ValueError("Au moins un prompt non vide est requis")
        return cleaned


class PromptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    text: str
    theme: Optional[str] = None
    is_active: bool = True
    created_at: datetime
