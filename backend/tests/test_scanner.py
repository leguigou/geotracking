from app.services.openrouter import model_provider_key, recommended_models
from app.services.scanner import calculate_sov, run_assertions


def test_assertions_normalise_domain_and_detect_rank():
    response = "1. Concurrent\n2. Cabesto — https://www.cabesto.com/piscines\n3. Autre"
    assertions = run_assertions(response, "https://cabesto.com", ["Cabesto"])
    assert assertions == {"has_url": True, "has_brand": True, "rank": 2}


def test_sov_handles_zero_and_rounding():
    assert calculate_sov(0, 0) == 0.0
    assert calculate_sov(2, 3) == 66.7


def test_live_catalog_recommendations_use_actual_model_ids():
    models = [
        {
            "id": "openai/gpt-5.4-mini",
            "name": "OpenAI Mini",
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "pricing": {},
        },
        {
            "id": "anthropic/claude-haiku-4.5",
            "name": "Claude Haiku",
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "pricing": {},
        },
    ]
    recommended = recommended_models(models)
    assert recommended["chatgpt"]["id"] == "openai/gpt-5.4-mini"
    assert recommended["claude"]["id"] == "anthropic/claude-haiku-4.5"
    assert model_provider_key(recommended["chatgpt"]["id"]) == "chatgpt"
