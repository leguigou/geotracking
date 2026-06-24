"""Mapping entre slugs frontend et modèles OpenRouter.

Chaque entrée définit :
- Un slug frontend (ex: "chatgpt")
- Un affichage (label, lettre, couleurs)
- Les modèles OpenRouter disponibles dans cette famille
- Le modèle par défaut utilisé pour les scans
"""

from typing import NotRequired, TypedDict


class LLMEntry(TypedDict):
    label: str
    letter: str
    color: str          # Tailwind text color
    bg: str             # Tailwind background
    bar_color: str      # Tailwind bar fill
    chart_color: str    # Hex pour Chart.js
    default_model: str  # OpenRouter model ID pour les scans
    models: NotRequired[list[str]]


LLM_REGISTRY: dict[str, LLMEntry] = {
    "chatgpt": {
        "label": "ChatGPT",
        "letter": "C",
        "color": "text-emerald-600 dark:text-emerald-400",
        "bg": "bg-emerald-500/10",
        "bar_color": "bg-emerald-500",
        "chart_color": "#10b981",
        "default_model": "openai/gpt-4o-mini",
        "models": [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "openai/gpt-4-turbo",
            "openai/gpt-3.5-turbo",
        ],
    },
    "claude": {
        "label": "Claude",
        "letter": "C",
        "color": "text-violet-600 dark:text-violet-400",
        "bg": "bg-violet-500/10",
        "bar_color": "bg-violet-500",
        "chart_color": "#8b5cf6",
        "default_model": "anthropic/claude-3.5-sonnet",
        "models": [
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-opus",
            "anthropic/claude-3-sonnet",
            "anthropic/claude-3-haiku",
        ],
    },
    "perplexity": {
        "label": "Perplexity",
        "letter": "P",
        "color": "text-orange-600 dark:text-orange-400",
        "bg": "bg-orange-500/10",
        "bar_color": "bg-orange-500",
        "chart_color": "#f97316",
        "default_model": "perplexity/llama-3.1-sonar-large-128k",
        "models": [
            "perplexity/llama-3.1-sonar-large-128k",
            "perplexity/llama-3.1-sonar-small-128k",
        ],
    },
    "gemini": {
        "label": "Gemini",
        "letter": "G",
        "color": "text-amber-600 dark:text-amber-400",
        "bg": "bg-amber-500/10",
        "bar_color": "bg-amber-500",
        "chart_color": "#f59e0b",
        "default_model": "google/gemini-2.0-flash-001",
        "models": [
            "google/gemini-2.0-flash-001",
            "google/gemini-1.5-pro",
            "google/gemini-1.5-flash",
        ],
    },
    "grok": {
        "label": "Grok",
        "letter": "X",
        "color": "text-sky-600 dark:text-sky-400",
        "bg": "bg-sky-500/10",
        "bar_color": "bg-sky-500",
        "chart_color": "#06b6d4",
        "default_model": "x-ai/grok-2-1212",
        "models": [
            "x-ai/grok-2-1212",
            "x-ai/grok-vision-1212",
        ],
    },
    "deepseek": {
        "label": "DeepSeek",
        "letter": "D",
        "color": "text-orange-600 dark:text-orange-400",
        "bg": "bg-orange-500/10",
        "bar_color": "bg-orange-500",
        "chart_color": "#f97316",
        "default_model": "deepseek/deepseek-chat",
        "models": [
            "deepseek/deepseek-chat",
            "deepseek/deepseek-r1",
        ],
    },
}


def resolve_models(slugs: list[str]) -> list[str]:
    """Convertit une liste de slugs frontend en liste de modèles OpenRouter (default_model)."""
    resolved: list[str] = []
    for slug in slugs:
        entry = LLM_REGISTRY.get(slug)
        if entry:
            resolved.append(entry["default_model"])
    return resolved


def reverse_resolve(model_id: str) -> str | None:
    """Trouve le slug frontend correspondant à un model_id OpenRouter, ou None."""
    for slug, entry in LLM_REGISTRY.items():
        if model_id in entry.get("models", []):
            return slug
    return None
