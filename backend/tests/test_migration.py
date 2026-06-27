import sqlite3

from alembic import command
from alembic.config import Config

from app.config import settings


def _upgrade_database(database) -> None:
    previous_url = settings.database_url
    settings.database_url = f"sqlite+aiosqlite:///{database.as_posix()}"
    try:
        config = Config("alembic.ini")
        command.upgrade(config, "head")
    finally:
        settings.database_url = previous_url


def test_fresh_database_migrations_create_geo_audit_history(tmp_path):
    database = tmp_path / "fresh.db"
    _upgrade_database(database)
    connection = sqlite3.connect(database)
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    connection.close()
    assert "geo_audits" in tables


def test_legacy_database_is_upgraded(tmp_path):
    database = tmp_path / "legacy.db"
    connection = sqlite3.connect(database)
    connection.executescript(
        """
        CREATE TABLE projects (
            id CHAR(32) PRIMARY KEY,
            organization_id CHAR(32) NOT NULL,
            name VARCHAR(255) NOT NULL,
            target_url TEXT NOT NULL,
            brand_names JSON,
            enabled_models JSON,
            frequency VARCHAR(20),
            is_active BOOLEAN,
            active_scan_jobs JSON,
            created_at DATETIME
        );
        CREATE TABLE prompts (
            id CHAR(32) PRIMARY KEY,
            project_id CHAR(32) NOT NULL,
            text TEXT NOT NULL,
            theme VARCHAR(100),
            is_active BOOLEAN,
            created_at DATETIME
        );
        CREATE TABLE scan_results (
            id CHAR(32) PRIMARY KEY,
            project_id CHAR(32) NOT NULL,
            prompt_id CHAR(32) NOT NULL,
            model VARCHAR(50) NOT NULL,
            response_text TEXT NOT NULL,
            has_url BOOLEAN,
            has_brand BOOLEAN,
            rank INTEGER,
            latency_ms INTEGER,
            tokens_used INTEGER,
            cost FLOAT,
            scanned_at DATETIME
        );
        """
    )
    connection.close()

    _upgrade_database(database)

    connection = sqlite3.connect(database)
    project_columns = {row[1] for row in connection.execute("PRAGMA table_info(projects)")}
    result_columns = {row[1] for row in connection.execute("PRAGMA table_info(scan_results)")}
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    connection.close()

    assert {"description", "last_scheduled_scan_at"} <= project_columns
    assert {"batch_id", "error"} <= result_columns
    assert "scan_batches" in tables
    assert "geo_audits" in tables
