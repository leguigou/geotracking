import asyncio
import os

import pytest

from app.services.scanner import scan_prompt


@pytest.mark.skipif(not os.getenv("OPENROUTER_TEST_API_KEY"), reason="No dedicated OpenRouter test key")
def test_live_openrouter_completion():
    result = asyncio.run(
        scan_prompt(
            "Reply with exactly OK",
            api_key=os.environ["OPENROUTER_TEST_API_KEY"],
            model=os.getenv("OPENROUTER_TEST_MODEL", "openai/gpt-4o-mini"),
            temperature=0,
        )
    )
    assert result["error"] is None
    assert "OK" in result["response_text"].upper()
