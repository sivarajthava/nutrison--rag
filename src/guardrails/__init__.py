"""Guardrails module for deterministic safety filtering and dual refusal responses."""

from src.guardrails.safety_filter import (
    SafetyViolation,
    check_safety_guardrail,
    ALL_SAFETY_PATTERNS,
)
from src.guardrails.refusal_handlers import (
    OUT_OF_SCOPE_MESSAGE,
    get_searched_document_descriptions,
    build_out_of_scope_refusal,
    get_out_of_scope_refusal_payload,
    build_not_in_corpus_refusal,
    get_not_in_corpus_refusal_payload,
)

__all__ = [
    "SafetyViolation",
    "check_safety_guardrail",
    "ALL_SAFETY_PATTERNS",
    "OUT_OF_SCOPE_MESSAGE",
    "get_searched_document_descriptions",
    "build_out_of_scope_refusal",
    "get_out_of_scope_refusal_payload",
    "build_not_in_corpus_refusal",
    "get_not_in_corpus_refusal_payload",
]
