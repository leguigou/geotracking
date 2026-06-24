from typing import List
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent / 'geotrack.db'}"
    redis_url: str = "redis://localhost:%d" % 6379 + "/0"
    cors_origins: str = "https://geotrack.deloffre.fr,http://localhost:5173,http://localhost:3000"
    jwt_secret: str = "super-secret-key-change-in-prod"
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 30
    environment: str = "development"
    log_level: str = "DEBUG"

    openai_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_timeout_seconds: int = 120
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
