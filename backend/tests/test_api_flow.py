import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import async_session
from app.models.project import Prompt
from app.models.scan_result import ScanBatch, ScanResult
from app.models.project import Project
from app.services.scan_queue import _temperature_for_project


def test_project_contract_keeps_description_and_models(client, account, project):
    assert project["description"] == "Projet de test"
    assert project["enabled_models"] == ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"]

    response = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": [" piscine Marseille ", "piscine Marseille"], "theme": "Piscine"},
    )
    assert response.status_code == 201
    assert len(response.json()) == 1


def test_tracking_settings_apply_temperature_and_global_frequency(client, account, project):
    response = client.put(
        "/api/settings",
        headers=account["headers"],
        json={"settings": {"temperature": "0.7", "frequency": "disabled"}},
    )
    assert response.status_code == 200, response.text
    assert response.json()["temperature"] == "0.7"
    assert response.json()["frequency"] == "disabled"

    updated_project = client.get(
        f"/api/projects/{project['id']}",
        headers=account["headers"],
    )
    assert updated_project.status_code == 200, updated_project.text
    assert updated_project.json()["frequency"] == "disabled"

    async def configured_temperature():
        async with async_session() as db:
            current = await db.get(Project, uuid.UUID(project["id"]))
            return await _temperature_for_project(db, current)

    assert asyncio.run(configured_temperature()) == 0.7

    invalid_temperature = client.put(
        "/api/settings",
        headers=account["headers"],
        json={"settings": {"temperature": "1.5"}},
    )
    assert invalid_temperature.status_code == 422

    invalid_frequency = client.put(
        "/api/settings",
        headers=account["headers"],
        json={"settings": {"frequency": "every-minute"}},
    )
    assert invalid_frequency.status_code == 422


def test_prompt_can_be_fully_edited_and_is_audited(client, account, project):
    created = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["robot piscine initial"], "theme": "Piscine"},
    )
    assert created.status_code == 201, created.text
    prompt_id = created.json()[0]["id"]

    updated = client.patch(
        f"/api/projects/{project['id']}/prompts/{prompt_id}",
        headers=account["headers"],
        json={
            "text": "  Quel robot de piscine choisir à Aubagne ?  ",
            "theme": "  Robots piscine  ",
            "is_active": False,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["text"] == "Quel robot de piscine choisir à Aubagne ?"
    assert updated.json()["theme"] == "Robots piscine"
    assert updated.json()["is_active"] is False

    empty = client.patch(
        f"/api/projects/{project['id']}/prompts/{prompt_id}",
        headers=account["headers"],
        json={"text": "   "},
    )
    assert empty.status_code == 422

    logs = client.get("/api/audit-logs?limit=200", headers=account["headers"])
    edited = next(
        entry
        for entry in logs.json()["items"]
        if entry["action"] == "prompt.updated" and entry["resource_id"] == prompt_id
    )
    assert edited["details"]["project_id"] == project["id"]
    assert edited["details"]["changes"]["theme"] == "Robots piscine"


def test_audit_logs_include_actor_and_complete_metadata(client, account, project):
    response = client.get("/api/audit-logs?limit=200", headers=account["headers"])
    assert response.status_code == 200, response.text
    payload = response.json()
    logs = payload["items"]
    assert payload["total"] >= len(logs)
    assert payload["limit"] == 200
    assert payload["offset"] == 0
    created = next(
        entry
        for entry in logs
        if entry["action"] == "project.created" and entry["resource_id"] == project["id"]
    )
    assert created["organization_id"]
    assert created["user_id"]
    assert created["user_email"].startswith("user-")
    assert created["user_name"] == "Test User"
    assert created["details"]["name"] == "Cabesto"
    assert "ip_address" in created


def test_audit_logs_support_server_pagination_and_search(client, account, project):
    for index in range(3):
        response = client.patch(
            f"/api/projects/{project['id']}",
            headers=account["headers"],
            json={"description": f"Version {index}"},
        )
        assert response.status_code == 200, response.text

    first_page = client.get(
        "/api/audit-logs?limit=2&offset=0",
        headers=account["headers"],
    )
    second_page = client.get(
        "/api/audit-logs?limit=2&offset=2",
        headers=account["headers"],
    )
    assert first_page.status_code == 200, first_page.text
    assert second_page.status_code == 200, second_page.text
    assert first_page.json()["total"] >= 4
    assert len(first_page.json()["items"]) == 2
    assert first_page.json()["items"][0]["id"] != second_page.json()["items"][0]["id"]

    maximum = client.get("/api/audit-logs?limit=500", headers=account["headers"])
    assert maximum.status_code == 200, maximum.text
    assert maximum.json()["limit"] == 500

    searched = client.get(
        "/api/audit-logs?limit=50&search=Version%202",
        headers=account["headers"],
    )
    assert searched.status_code == 200, searched.text
    assert searched.json()["total"] == 1
    assert searched.json()["items"][0]["details"]["description"] == "Version 2"


def test_project_create_accepts_legacy_model_slugs(client, account):
    response = client.post(
        "/api/projects",
        headers=account["headers"],
        json={
            "name": "Legacy Models",
            "target_url": "legacy.example.com",
            "brand_names": ["Legacy"],
            "models": ["chatgpt", "claude"],
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["enabled_models"] == ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"]


def test_scan_accepts_model_in_json_body(client, account, project, monkeypatch):
    client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["meilleure piscine"]},
    )
    captured = {}

    async def fake_enqueue(project_id, specific_model=None):
        captured["model"] = specific_model
        return {"batch_id": "00000000-0000-0000-0000-000000000001", "enqueued": 1}

    monkeypatch.setattr("app.api.scans.enqueue_scan", fake_enqueue)
    response = client.post(
        f"/api/projects/{project['id']}/scan",
        headers=account["headers"],
        json={"model": "openai/gpt-5.4-mini"},
    )
    assert response.status_code == 202, response.text
    assert captured["model"] == "openai/gpt-5.4-mini"

    query_response = client.post(
        f"/api/projects/{project['id']}/scan?model=anthropic%2Fclaude-haiku-4.5",
        headers=account["headers"],
        json={},
    )
    assert query_response.status_code == 202, query_response.text
    assert captured["model"] == "anthropic/claude-haiku-4.5"


def test_assistant_model_is_used_for_rewrite_and_response_analysis(client, account, monkeypatch):
    configured = client.put(
        "/api/settings",
        headers=account["headers"],
        json={
            "settings": {
                "openrouter_api_key": "sk-or-test",
                "assistant_model": "openai/gpt-5.4-mini",
            }
        },
    )
    assert configured.status_code == 200, configured.text

    calls = []

    async def fake_call(api_key, model, system_prompt, user_prompt, max_tokens):
        calls.append({"api_key": api_key, "model": model, "user_prompt": user_prompt})
        return "Analyse ou réécriture générée"

    monkeypatch.setattr("app.api.settings._call_assistant", fake_call)

    rewrite = client.post(
        "/api/settings/rewrite-prompt",
        headers=account["headers"],
        json={"text": "robot piscine aubagne"},
    )
    assert rewrite.status_code == 200, rewrite.text
    assert rewrite.json()["model"] == "openai/gpt-5.4-mini"

    analysis = client.post(
        "/api/settings/analyze-response",
        headers=account["headers"],
        json={"prompt_text": "Quel robot choisir ?", "response_text": "Leroy Merlin est cité."},
    )
    assert analysis.status_code == 200, analysis.text
    assert analysis.json()["model"] == "openai/gpt-5.4-mini"
    assert [call["model"] for call in calls] == [
        "openai/gpt-5.4-mini",
        "openai/gpt-5.4-mini",
    ]


def test_latest_batch_and_history_have_dashboard_contract(client, account, project):
    prompt_response = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["où acheter une piscine ?"], "theme": "Piscine"},
    )
    prompt_id = prompt_response.json()[0]["id"]

    async def seed_result():
        async with async_session() as db:
            batch = ScanBatch(
                project_id=uuid.UUID(project["id"]),
                status="completed",
                total_jobs=1,
                completed_jobs=1,
                failed_jobs=0,
                completed_at=datetime.now(timezone.utc),
            )
            db.add(batch)
            await db.flush()
            db.add(
                ScanResult(
                    batch_id=batch.id,
                    project_id=uuid.UUID(project["id"]),
                    prompt_id=uuid.UUID(prompt_id),
                    model="openai/gpt-5.4-mini",
                    response_text="Cabesto — https://cabesto.com",
                    has_url=True,
                    has_brand=True,
                    scanned_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()

    asyncio.run(seed_result())
    latest = client.get(f"/api/projects/{project['id']}/results/latest", headers=account["headers"])
    assert latest.status_code == 200, latest.text
    payload = latest.json()
    assert payload["batch"]["status"] == "completed"
    assert payload["overall"]["openai/gpt-5.4-mini"] == 100.0
    assert payload["prompts"][0]["openai/gpt-5.4-mini"] is True
    assert payload["prompts"][0]["theme"] == "Piscine"

    history = client.get(f"/api/projects/{project['id']}/history", headers=account["headers"])
    assert history.status_code == 200
    history_entry = history.json()[0]
    assert history_entry["openai/gpt-5.4-mini"] == 100.0
    assert history_entry["total_jobs"] == 1
    assert history_entry["completed_jobs"] == 1

    overview = client.get("/api/dashboard/overview", headers=account["headers"])
    assert overview.status_code == 200, overview.text
    dashboard = overview.json()
    project_row = next(row for row in dashboard["projects"] if row["id"] == project["id"])
    assert project_row["overall"]["openai/gpt-5.4-mini"] == 100.0
    assert dashboard["totals"]["prompts"] >= 1


def test_latest_dashboard_keeps_latest_snapshot_for_each_model(client, account, project):
    prompt_id = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["quel robot de piscine choisir ?"]},
    ).json()[0]["id"]
    now = datetime.now(timezone.utc)

    async def seed_snapshots():
        async with async_session() as db:
            first_batch = ScanBatch(
                project_id=uuid.UUID(project["id"]),
                status="completed",
                total_jobs=2,
                completed_jobs=2,
                created_at=now - timedelta(hours=1),
                completed_at=now - timedelta(hours=1),
            )
            db.add(first_batch)
            await db.flush()
            db.add_all([
                ScanResult(
                    batch_id=first_batch.id,
                    project_id=uuid.UUID(project["id"]),
                    prompt_id=uuid.UUID(prompt_id),
                    model="openai/gpt-5.4-mini",
                    response_text="Ancienne réponse OpenAI",
                    has_url=False,
                    has_brand=False,
                    scanned_at=now - timedelta(hours=1),
                ),
                ScanResult(
                    batch_id=first_batch.id,
                    project_id=uuid.UUID(project["id"]),
                    prompt_id=uuid.UUID(prompt_id),
                    model="anthropic/claude-haiku-4.5",
                    response_text="Cabesto est recommandé par Claude",
                    has_url=False,
                    has_brand=True,
                    scanned_at=now - timedelta(hours=1),
                ),
            ])
            latest_batch = ScanBatch(
                project_id=uuid.UUID(project["id"]),
                requested_model="openai/gpt-5.4-mini",
                status="completed",
                total_jobs=1,
                completed_jobs=1,
                created_at=now,
                completed_at=now,
            )
            db.add(latest_batch)
            await db.flush()
            db.add(
                ScanResult(
                    batch_id=latest_batch.id,
                    project_id=uuid.UUID(project["id"]),
                    prompt_id=uuid.UUID(prompt_id),
                    model="openai/gpt-5.4-mini",
                    response_text="Cabesto est maintenant recommandé par OpenAI",
                    has_url=False,
                    has_brand=True,
                    scanned_at=now,
                )
            )
            await db.commit()

    asyncio.run(seed_snapshots())
    response = client.get(
        f"/api/projects/{project['id']}/results/latest",
        headers=account["headers"],
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["overall"]["openai/gpt-5.4-mini"] == 100.0
    assert payload["overall"]["anthropic/claude-haiku-4.5"] == 100.0
    responses_by_model = {item["model"]: item["response_text"] for item in payload["results"]}
    assert responses_by_model["openai/gpt-5.4-mini"].startswith("Cabesto est maintenant")
    assert responses_by_model["anthropic/claude-haiku-4.5"].startswith("Cabesto est recommandé")

    logs = client.get(
        f"/api/projects/{project['id']}/results",
        headers=account["headers"],
    )
    assert logs.status_code == 200, logs.text
    assert logs.json()[0]["response_text"].startswith("Cabesto est maintenant")

    history = client.get(
        f"/api/projects/{project['id']}/history",
        headers=account["headers"],
    )
    assert history.status_code == 200, history.text
    assert history.json()[0]["scan_date"].startswith(now.date().isoformat())

    overview = client.get("/api/dashboard/overview", headers=account["headers"]).json()
    project_row = next(row for row in overview["projects"] if row["id"] == project["id"])
    assert project_row["overall"]["openai/gpt-5.4-mini"] == 100.0
    assert project_row["enabled_models"] == ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"]
    assert project_row["overall"]["anthropic/claude-haiku-4.5"] == 100.0


def test_prompt_delete_is_tenant_safe_and_project_delete_cascades_explicitly(client, account, project):
    prompt = client.post(
        f"/api/projects/{project['id']}/prompts",
        headers=account["headers"],
        json={"texts": ["prompt privé"]},
    ).json()[0]

    other = client.post(
        "/api/auth/register",
        json={
            "email": f"other-{project['id']}@example.com",
            "password": "test-password-123",
            "full_name": "Other",
            "organization_name": "Other Org",
        },
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    forbidden = client.delete(
        f"/api/projects/{project['id']}/prompts/{prompt['id']}", headers=other_headers
    )
    assert forbidden.status_code == 404

    deleted = client.delete(f"/api/projects/{project['id']}", headers=account["headers"])
    assert deleted.status_code == 204
