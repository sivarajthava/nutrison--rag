"""Structured Refusal Response Handlers for Dietary Guidance RAG Chatbot.

Implements the Dual Refusal Architecture defined in the Problem Statement and Architecture:
- Refusal 1 (Not in Corpus): Triggered when vector retrieval finds zero chunks above the
  relevance cutoff (tau_relevance = 0.68). Explicitly states that the official guidance does
  not cover the inquiry and enumerates all 7 searched documents.
- Refusal 2 (Out of Scope by Design): Triggered deterministically by the pre-retrieval
  safety filter when the user requests medical advice, disease treatment, personalized
  calorie prescriptions, or target body weight plans. Redirects to qualified healthcare professionals.
"""

from typing import Dict, Optional, List
from config.settings import get_corpus_registry
from src.models.schemas import ChatResponse, RefusalResponse, DocumentMetadata
from src.guardrails.safety_filter import SafetyViolation

# Authoritative disclaimer for Refusal 2 (Out of Scope by Design)
OUT_OF_SCOPE_MESSAGE = (
    "I cannot provide personalized medical nutrition therapy, disease diagnoses or treatments, "
    "individual calorie prescriptions, or target body weight plans.\n\n"
    "This system provides general public health and food safety information derived strictly "
    "from authoritative agency publications (WHO, FAO, USDA, FDA, and UK FSA). For personalized health, "
    "clinical nutrition, or medical dietary advice, please consult a qualified physician or registered dietitian."
)


def get_searched_document_descriptions(
    corpus_registry: Optional[Dict[str, DocumentMetadata]] = None,
) -> List[str]:
    """Retrieve formatted list of all 7 authoritative publications in the corpus."""
    registry = corpus_registry or get_corpus_registry()
    descriptions = []
    for doc_id, meta in registry.items():
        descriptions.append(f"{meta.title} ({meta.publisher}, {meta.year})")
    return descriptions


def build_out_of_scope_refusal(
    query: str,
    violation: Optional[SafetyViolation] = None,
) -> ChatResponse:
    """Construct ChatResponse payload for Refusal 2 (Out of Scope by Design).
    
    Args:
        query: User prompt triggering the safety guardrail.
        violation: Optional SafetyViolation telemetry from safety filter.
        
    Returns:
        ChatResponse with status='REFUSAL_OUT_OF_SCOPE'.
    """
    return ChatResponse(
        status="REFUSAL_OUT_OF_SCOPE",
        query=query,
        response_text=OUT_OF_SCOPE_MESSAGE,
        sections=[],
        citations=[],
        searched_documents=[],
    )


def get_out_of_scope_refusal_payload(
    query: str,
    violation: Optional[SafetyViolation] = None,
) -> RefusalResponse:
    """Construct RefusalResponse schema contract for Refusal 2 (Out of Scope by Design)."""
    return RefusalResponse(
        status="REFUSAL_OUT_OF_SCOPE",
        type="OUT_OF_SCOPE_BY_DESIGN",
        message=OUT_OF_SCOPE_MESSAGE,
        searched_documents=[],
        suggested_action="Consult a registered dietitian or licensed medical practitioner.",
    )


def build_not_in_corpus_refusal(
    query: str,
    corpus_registry: Optional[Dict[str, DocumentMetadata]] = None,
) -> ChatResponse:
    """Construct ChatResponse payload for Refusal 1 (Not in Corpus).
    
    Args:
        query: User prompt lacking semantic support in corpus (max_sim < 0.68).
        corpus_registry: Optional registry override.
        
    Returns:
        ChatResponse with status='REFUSAL_NOT_IN_CORPUS' and itemized list of 7 documents.
    """
    doc_descriptions = get_searched_document_descriptions(corpus_registry)
    itemized_list = "\n".join(f"{idx}. {desc}" for idx, desc in enumerate(doc_descriptions, start=1))

    response_text = (
        f"The authoritative public health guidance documents in my corpus do not contain "
        f"information covering your question: \"{query}\".\n\n"
        "The following 7 authoritative publications were searched:\n"
        f"{itemized_list}\n\n"
        "If you are seeking information outside these publications, please refer to specialized "
        "guidelines from the relevant public health authorities."
    )

    return ChatResponse(
        status="REFUSAL_NOT_IN_CORPUS",
        query=query,
        response_text=response_text,
        sections=[],
        citations=[],
        searched_documents=doc_descriptions,
    )


def get_not_in_corpus_refusal_payload(
    query: str,
    corpus_registry: Optional[Dict[str, DocumentMetadata]] = None,
) -> RefusalResponse:
    """Construct RefusalResponse schema contract for Refusal 1 (Not in Corpus)."""
    doc_descriptions = get_searched_document_descriptions(corpus_registry)
    itemized_list = "\n".join(f"{idx}. {desc}" for idx, desc in enumerate(doc_descriptions, start=1))

    message = (
        f"The authoritative public health guidance documents in my corpus do not contain "
        f"information covering your question: \"{query}\".\n\n"
        "The following 7 authoritative publications were searched:\n"
        f"{itemized_list}"
    )

    return RefusalResponse(
        status="REFUSAL_NOT_IN_CORPUS",
        type="NOT_IN_CORPUS",
        message=message,
        searched_documents=doc_descriptions,
        suggested_action="Verify if query relates to one of the 7 authoritative publications or consult relevant agency.",
    )
