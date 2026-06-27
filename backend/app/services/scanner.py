"""LLM scan service for GEOTrack AI.

Provides functions to call OpenRouter (via OpenAI SDK), run assertions
on LLM responses (URL presence, brand presence, rank detection),
and calculate Share of Voice (SOV) percentages.
"""

import re
import time
from urllib.parse import urlparse

import httpx

from app.services.openrouter import OPENROUTER_SEMAPHORE
from app.config import settings


# ---------------------------------------------------------------------------
# Core scan function
# ---------------------------------------------------------------------------
async def scan_prompt(
    text: str,
    api_key: str,
    model: str = "openai/gpt-4o-mini",
    temperature: float = 0.1,
    model_metadata: dict | None = None,
) -> dict:
    """Send a prompt to an LLM via OpenRouter and return structured results.

    Returns
    -------
    dict with keys:
        response_text, latency_ms, tokens_used, cost, error (or None)
    """
    start = time.monotonic()

    if not api_key:
        return {
            "response_text": "",
            "latency_ms": 0,
            "tokens_used": 0,
            "cost": 0.0,
            "error": "Aucune clé API OpenRouter configurée pour cette organisation",
            "retryable": False,
        }

    try:
        async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
            supported = set((model_metadata or {}).get("supported_parameters") or [])
            request_payload = {
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful assistant. Answer naturally and accurately. "
                            "When recommending companies, products or sources, use a numbered list."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                "usage": {"include": True},
            }
            if not supported or "temperature" in supported:
                request_payload["temperature"] = temperature
            if "max_completion_tokens" in supported and "max_tokens" not in supported:
                request_payload["max_completion_tokens"] = 1200
            else:
                request_payload["max_tokens"] = 1200

            async with OPENROUTER_SEMAPHORE:
                response = await client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": settings.cors_origins_list[0] if settings.cors_origins_list else "https://geotrack.ai",
                        "X-Title": "GEOTrack AI",
                    },
                    json=request_payload,
                )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        detail = str(exc)
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                detail = exc.response.json().get("error", {}).get("message") or exc.response.text
            except Exception:
                detail = exc.response.text
        retryable = not isinstance(exc, httpx.HTTPStatusError) or exc.response.status_code in {408, 409, 429} or exc.response.status_code >= 500
        return {
            "response_text": "",
            "latency_ms": int((time.monotonic() - start) * 1000),
            "tokens_used": 0,
            "cost": 0.0,
            "error": detail[:1000],
            "retryable": retryable,
        }

    elapsed_ms = int((time.monotonic() - start) * 1000)
    choices = payload.get("choices") or []
    response_text = choices[0].get("message", {}).get("content", "") if choices else ""
    usage = payload.get("usage") or {}
    total_tokens = int(usage.get("total_tokens") or 0)
    cost = float(usage.get("cost") or 0.0)
    if not cost and model_metadata:
        pricing = model_metadata.get("pricing") or {}
        try:
            cost = (
                int(usage.get("prompt_tokens") or 0) * float(pricing.get("prompt") or 0)
                + int(usage.get("completion_tokens") or 0) * float(pricing.get("completion") or 0)
            )
        except (TypeError, ValueError):
            cost = 0.0

    return {
        "response_text": response_text or "",
        "latency_ms": elapsed_ms,
        "tokens_used": total_tokens,
        "cost": round(cost, 6),
        "error": None,
        "retryable": False,
    }


# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------
def _strip_markdown_url(text: str) -> str:
    """Remove markdown link syntax ``[label](url)`` and return just URL part."""
    return re.sub(r"\[([^\]]*)\]\(([^)]+)\)", r"\2", text)


def _normalise_domain(value: str) -> str:
    candidate = value.strip().lower()
    parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
    domain = parsed.netloc or parsed.path.split("/", 1)[0]
    return domain.removeprefix("www.").split(":", 1)[0]


def _contains_brand(text: str, brand: str) -> bool:
    brand = brand.strip()
    return bool(brand) and bool(re.search(rf"(?<!\w){re.escape(brand)}(?!\w)", text, re.IGNORECASE))


def run_assertions(
    response_text: str,
    target_url: str,
    brand_names: list[str],
    include_competitors: bool = False,
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
    dict with keys ``has_url``, ``has_brand`` and ``rank``.
    ``rank`` is the 1-based position of the first numbered list item that
    mentions the URL or brand; ``None`` if not found in a list.
    When ``include_competitors`` is true, the return value also contains a
    ``competitors`` list of dicts ``{"name": str, "url": str | None, "rank": int | None}``.
    """
    cleaned = _strip_markdown_url(response_text)
    target_lower = _normalise_domain(target_url)

    # --- URL presence (case-insensitive substring match) ---
    has_url = bool(target_lower) and target_lower in cleaned.lower().replace("www.", "")

    # --- Brand presence (case-insensitive) ---
    has_brand = any(_contains_brand(response_text, brand) for brand in brand_names)

    # --- Rank detection: look for numbered list items ---
    rank = None
    for line in response_text.split("\n"):
        stripped = line.strip()
        match = re.match(r"^\s*(?:(\d+)[.)]\s+)", stripped)
        if match:
            item_num = int(match.group(1))
            item_body = stripped[match.end():].lower()
            if target_lower in item_body or any(_contains_brand(item_body, brand) for brand in brand_names):
                rank = item_num
                break

    payload = {
        "has_url": has_url,
        "has_brand": has_brand,
        "rank": rank,
    }
    if include_competitors:
        payload["competitors"] = _extract_competitors(response_text, target_url, brand_names)
    return payload


# ---------------------------------------------------------------------------
# Competitor extraction
# ---------------------------------------------------------------------------
_URL_RE = re.compile(r"https?://(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)(?:/\S*)?")
_LIST_ITEM_RE = re.compile(r"^\s*(?:(\d+)[.)]\s+)(.+)$", re.MULTILINE)
_BULLET_ITEM_RE = re.compile(r"^\s*[-+*]\s+(.+)$")
_MARKDOWN_RE = re.compile(r"[*_`~]+")
_GENERIC_COMPETITOR_PREFIXES = (
    "alternative",
    "boutique",
    "catégorie",
    "fabricant",
    "enseigne",
    "magasin",
    "marque",
    "option",
    "plateforme",
    "revendeur",
    "site",
    "spécialiste",
    "vente en ligne",
)


def _competitor_name(item_text: str) -> str:
    """Return the leading brand name from a list item, without Markdown."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", item_text)
    text = _URL_RE.sub("", text)
    text = _MARKDOWN_RE.sub("", text).strip()
    name = re.split(r"\s+(?:—|–|-)(?:\s+|$)|:\s+", text, maxsplit=1)[0]
    return name.strip(" \t\r\n'\"«»,;:!?().[]{}")


def _is_generic_competitor_name(name: str) -> bool:
    lowered = name.casefold()
    return any(
        lowered == prefix or lowered.startswith(f"{prefix} ")
        for prefix in _GENERIC_COMPETITOR_PREFIXES
    )


def _extract_competitors(
    response_text: str,
    target_url: str,
    brand_names: list[str],
) -> list[dict]:
    """Extract all competitors (URLs + named entities) from an LLM response.

    Returns a sorted list of unique competitors, each with:
      - name: display name (brand or domain)
      - url: the actual URL if found
      - rank: position in numbered list (1-based) or None
      - is_target: True if this IS the target brand/URL being tracked
    """
    target_domain = _normalise_domain(target_url)
    all_brands_lower = {b.casefold().strip() for b in brand_names if b.strip()}

    seen: set[str] = set()
    competitors: list[dict] = []

    # 1. Extract all URLs from the text
    for match in _URL_RE.finditer(response_text):
        domain = match.group(1).lower().removeprefix("www.")
        if domain not in seen:
            seen.add(domain)
            is_target = domain == target_domain
            competitors.append({
                "name": domain,
                "url": match.group(0).rstrip("/)"),
                "rank": None,
                "is_target": is_target,
            })

    # 2. Extract recommendation items. A numbered line followed by bullets is
    # a category heading, so only its children are treated as competitors.
    lines = response_text.splitlines()
    recommendation_items: list[tuple[int, str]] = []
    next_rank = 1
    for index, line in enumerate(lines):
        numbered_match = _LIST_ITEM_RE.match(line)
        bullet_match = _BULLET_ITEM_RE.match(line)
        if numbered_match:
            has_bullet_children = False
            for following in lines[index + 1:]:
                if not following.strip():
                    continue
                has_bullet_children = bool(_BULLET_ITEM_RE.match(following))
                break
            if not has_bullet_children:
                item_rank = int(numbered_match.group(1))
                recommendation_items.append((item_rank, numbered_match.group(2).strip()))
                next_rank = max(next_rank, item_rank + 1)
        elif bullet_match:
            recommendation_items.append((next_rank, bullet_match.group(1).strip()))
            next_rank += 1

    for rank, item_text in recommendation_items:
        name = _competitor_name(item_text)
        if not name or len(name) > 60 or _is_generic_competitor_name(name):
            continue

        item_url_match = _URL_RE.search(item_text)
        if item_url_match:
            domain = item_url_match.group(1).lower().removeprefix("www.")
            existing = next((c for c in competitors if c["url"] and domain in c["url"].lower()), None)
            if existing:
                existing["name"] = name
                existing["rank"] = rank
                seen.add(name.casefold())
                continue

        name_lower = name.casefold()
        is_target = name_lower in all_brands_lower or any(b in name_lower for b in all_brands_lower)

        if name_lower not in seen:
            seen.add(name_lower)
            url_match = _URL_RE.search(item_text)
            competitors.append({
                "name": name,
                "url": url_match.group(0).rstrip("/)") if url_match else None,
                "rank": rank,
                "is_target": is_target,
            })
        else:
            existing = next((c for c in competitors if c["name"].casefold() == name_lower), None)
            if existing and existing["rank"] is None:
                existing["rank"] = rank

    # Sort: target first, then by rank, then by name
    competitors.sort(key=lambda c: (not c["is_target"], c["rank"] or 999, c["name"]))
    return competitors


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
