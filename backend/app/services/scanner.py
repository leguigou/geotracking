"""LLM scan service for GEOTrack AI.

Provides functions to call OpenRouter (via OpenAI SDK), run assertions
on LLM responses (URL presence, brand presence, rank detection),
and calculate Share of Voice (SOV) percentages.
"""

import re
import time
from typing import Optional

from openai import OpenAI

from app.config import settings


# ---------------------------------------------------------------------------
# OpenRouter client (lazy singleton)
# ---------------------------------------------------------------------------
_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    """Return a singleton OpenAI client pointed at OpenRouter."""
    global _client
    if _client is None:
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openai_api_key,
            default_headers={
                "HTTP-Referer": (
                    settings.cors_origins_list[0]
                    if settings.cors_origins_list
                    else "https://geotrack.ai"
                ),
                "X-Title": "GEOTrack AI",
            },
        )
    return _client


# ---------------------------------------------------------------------------
# Core scan function
# ---------------------------------------------------------------------------
async def scan_prompt(
    text: str,
    model: str = "openai/gpt-4o-mini",
    temperature: float = 0.1,
) -> dict:
    """Send a prompt to an LLM via OpenRouter and return structured results.

    Returns
    -------
    dict with keys:
        response_text, latency_ms, tokens_used, cost, error (or None)
    """
    client = _get_client()
    start = time.monotonic()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant. Answer concisely and "
                        "accurately. When listing sources or recommendations, "
                        "use numbered lists where appropriate."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=temperature,
        )
    except Exception as exc:
        return {
            "response_text": "",
            "latency_ms": int((time.monotonic() - start) * 1000),
            "tokens_used": 0,
            "cost": 0.0,
            "error": str(exc),
        }

    elapsed_ms = int((time.monotonic() - start) * 1000)
    choice = response.choices[0] if response.choices else None
    response_text = choice.message.content if choice else ""
    usage = response.usage

    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    total_tokens = usage.total_tokens if usage else 0

    # Conservative cost estimate: $2/M input, $8/M output (gpt-4o-mini)
    cost = (prompt_tokens * 2.0 + completion_tokens * 8.0) / 1_000_000

    return {
        "response_text": response_text or "",
        "latency_ms": elapsed_ms,
        "tokens_used": total_tokens,
        "cost": round(cost, 6),
        "error": None,
    }


# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------
def _strip_markdown_url(text: str) -> str:
    """Remove markdown link syntax ``[label](url)`` and return just URL part."""
    return re.sub(r"\[([^\]]*)\]\(([^)]+)\)", r"\2", text)


def run_assertions(
    response_text: str,
    target_url: str,
    brand_names: list[str],
) -> dict:
    """Analyse an LLM response for brand presence, URL presence, and rank.

    Parameters
    ----------
    response_text : str
        Raw text output from the LLM.
    target_url : str
        The URL to look for (e.g. ``https://example.com/page``).
    brand_names : list[str]
        Brand names / company names to detect (case-insensitive).

    Returns
    -------
    dict with keys ``has_url``, ``has_brand``, ``rank``.
    ``rank`` is the 1-based position of the first numbered list item that
    mentions the URL or brand; ``None`` if not found in a list.
    """
    cleaned = _strip_markdown_url(response_text)
    target_lower = target_url.lower()

    # --- URL presence (case-insensitive substring match) ---
    has_url = target_lower in cleaned.lower()

    # --- Brand presence (case-insensitive) ---
    has_brand = any(
        brand.lower() in response_text.lower() for brand in brand_names
    )

    # --- Rank detection: look for numbered list items ---
    rank = None
    for line in response_text.split("\n"):
        stripped = line.strip()
        match = re.match(r"^\s*(?:(\d+)[.)]\s+)", stripped)
        if match:
            item_num = int(match.group(1))
            item_body = stripped[match.end() :].lower()
            if target_lower in item_body or any(
                b.lower() in item_body for b in brand_names
            ):
                rank = item_num
                break

    return {
        "has_url": has_url,
        "has_brand": has_brand,
        "rank": rank,
    }


# ---------------------------------------------------------------------------
# SOV calculator
# ---------------------------------------------------------------------------
def calculate_sov(success_count: int, total_count: int) -> float:
    """Return share-of-voice as a percentage (0-100).

    ``success_count`` / ``total_count`` * 100, with safe division by zero.
    """
    if total_count <= 0:
        return 0.0
    return round((success_count / total_count) * 100, 1)
