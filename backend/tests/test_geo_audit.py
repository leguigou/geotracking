import asyncio

import pytest

from app.services.geo_audit import (
    AuditFetchError,
    _validate_public_url,
    build_findings,
    parse_page,
)


def test_geo_audit_extracts_page_signals_and_prioritizes_blockers():
    signals = parse_page(
        """
        <!doctype html>
        <html lang="fr">
          <head>
            <title>Cabesto, spécialiste piscine et nautisme</title>
            <meta name="description" content="Équipements et conseils pour la piscine.">
            <meta name="robots" content="noindex">
            <link rel="canonical" href="https://example.com/piscine">
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"Organization","name":"Cabesto"}
            </script>
          </head>
          <body>
            <h1>Quel robot de piscine choisir ?</h1>
            <p>Cabesto vous aide à choisir un robot adapté.</p>
            <a href="/a-propos">À propos</a>
            <img src="/robot.jpg" alt="Robot de piscine">
          </body>
        </html>
        """
    )
    assert signals.title.startswith("Cabesto")
    assert signals.language == "fr"
    assert signals.headings["h1"] == ["Quel robot de piscine choisir ?"]
    assert signals.json_ld_types == ["Organization"]
    assert signals.image_count == 1
    assert signals.images_without_alt == 0

    findings = build_findings(
        signals,
        page_status=200,
        robots_status=200,
        robots={
            "blocks_all": True,
            "bots": {"GPTBot": "blocked", "ClaudeBot": "blocked"},
        },
        sitemap_status=404,
        sitemap_url_count=0,
        llms_status=404,
        brand="Cabesto",
    )
    assert findings[0]["priority"] == "critical"
    assert any(item["title"] == "La page demande à ne pas être indexée" for item in findings)
    assert any(item["title"] == "Des robots de LLM sont bloqués" for item in findings)


def test_geo_audit_rejects_private_network_urls():
    with pytest.raises(AuditFetchError, match="non publique"):
        asyncio.run(_validate_public_url("http://127.0.0.1/admin"))


def test_geo_audit_endpoint_returns_prioritized_report(client, account, monkeypatch):
    async def fake_audit_url(url, brand=""):
        return {
            "url": "https://example.com",
            "final_url": "https://example.com/",
            "brand": brand,
            "generated_at": "2026-06-27T12:00:00+00:00",
            "score": 62,
            "priority_counts": {"critical": 0, "high": 2, "medium": 1, "low": 0},
            "findings": [
                {
                    "priority": "high",
                    "category": "Contenu",
                    "title": "Contenu textuel trop léger",
                    "evidence": "120 mots",
                    "recommendation": "Enrichir la page.",
                }
            ],
            "page": {
                "status": 200,
                "content_type": "text/html",
                "title": "Example",
                "description": "",
                "canonical": "",
                "language": "fr",
                "robots_meta": "",
                "word_count": 120,
                "headings": {"h1": 1},
                "h1": ["Example"],
                "image_count": 0,
                "images_without_alt": 0,
                "json_ld_types": [],
            },
            "robots": {
                "url": "https://example.com/robots.txt",
                "status": 200,
                "blocks_all": False,
                "bots": {"GPTBot": "allowed"},
                "sitemaps": [],
            },
            "sitemap": {
                "url": "https://example.com/sitemap.xml",
                "status": 404,
                "url_count": 0,
            },
            "llms_txt": {
                "url": "https://example.com/llms.txt",
                "status": 404,
                "present": False,
            },
        }

    monkeypatch.setattr("app.api.geo_audits.audit_url", fake_audit_url)
    response = client.post(
        "/api/geo-audits",
        headers=account["headers"],
        json={"url": "example.com", "brand": "Example", "use_ai": False},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["score"] == 62
    assert payload["findings"][0]["priority"] == "high"
    assert payload["ai_summary"] is None

    captured = {}

    async def fake_assistant_config(db, organization_id):
        return "sk-or-test", "openai/selected-summary-model"

    async def fake_assistant_call(api_key, model, system_prompt, user_prompt, max_tokens):
        captured.update({"model": model, "system_prompt": system_prompt})
        return "Diagnostic global\nLe site doit renforcer ses signaux d’entité."

    monkeypatch.setattr("app.api.geo_audits._assistant_config", fake_assistant_config)
    monkeypatch.setattr("app.api.geo_audits._call_assistant", fake_assistant_call)
    with_ai = client.post(
        "/api/geo-audits",
        headers=account["headers"],
        json={"url": "example.com", "brand": "Example", "use_ai": True},
    )
    assert with_ai.status_code == 200, with_ai.text
    assert with_ai.json()["ai_model"] == "openai/selected-summary-model"
    assert with_ai.json()["ai_summary"].startswith("Diagnostic global")
    assert captured["model"] == "openai/selected-summary-model"
    assert "résumé exécutif" in captured["system_prompt"]

    logs = client.get(
        "/api/audit-logs?search=geo_audit.completed",
        headers=account["headers"],
    ).json()
    assert logs["total"] == 2
    assert logs["items"][0]["details"]["score"] == 62
