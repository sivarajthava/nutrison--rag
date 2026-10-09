"""Grounded Synthesis & Attribution Module."""

from src.generation.prompt_templates import (
    GROUNDED_SYSTEM_PROMPT,
    format_segregated_context,
    format_synthesis_user_prompt,
)
from src.generation.citation_formatter import (
    extract_and_validate_citations,
    format_citation_string,
)
from src.generation.synthesizer import (
    GroundedSynthesizer,
    get_synthesizer,
)

__all__ = [
    "GROUNDED_SYSTEM_PROMPT",
    "format_segregated_context",
    "format_synthesis_user_prompt",
    "extract_and_validate_citations",
    "format_citation_string",
    "GroundedSynthesizer",
    "get_synthesizer",
]
