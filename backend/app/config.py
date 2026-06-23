from typing import List
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{Path.home()}/geotrack/backend/geotrack.db"
    redis_url: str = "redis://localhost:***@property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
