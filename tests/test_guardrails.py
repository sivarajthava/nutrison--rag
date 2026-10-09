"""Phase 3 Verification Test Suite: Deterministic Safety Guardrails & Dual Refusal Mechanisms.

Validates:
1. Deterministic interception of personalized calorie goals, target body weights, and medical diagnosis/treatments.
2. Zero false positives on valid dietary guidelines and public health informational queries.
3. Accurate construction of Refusal 2 (Out of Scope by Design) payloads directing users to healthcare professionals.
4. Accurate construction of Refusal 1 (Not in Corpus) payloads enumerating all 7 authoritative publications.
"""

import pytest

from src.models.schemas import ChatResponse, RefusalResponse
from src.guardrails.safety_filter import check_safety_guardrail, SafetyViolation
from src.guardrails.refusal_handlers import (
    build_out_of_scope_refusal,
    get_out_of_scope_refusal_payload,
    build_not_in_corpus_refusal,
    get_not_in_corpus_refusal_payload,
    get_searched_document_descriptions,
    OUT_OF_SCOPE_MESSAGE,
)


class TestSafetyGuardrailViolations:
    """Verify code-level deterministic blocking for out-of-scope medical/calorie/weight queries."""

    @pytest.mark.parametrize(
        "query,expected_category",
        [
            ("I want to cut to 1200 calories to lose 15 pounds in a month.", "calorie_prescription"),
            ("What diet cures type 2 diabetes?", "medical_treatment"),
            ("What should I weigh if I am 5 feet 10 inches?", "weight_prescription"),
            ("How many calories should I eat to burn fat?", "calorie_prescription"),
            ("Can this diet reverse hypertension?", "medical_treatment"),
            ("My BMI is 32, how do I drop 20 kg fast?", "weight_prescription"),
            ("What is a diet to treat celiac disease?", "medical_treatment"),
            ("Please give me medical advice for kidney disease.", "medical_treatment"),
            ("What is my calorie target for myself?", "calorie_prescription"),
            ("Calculate my maintenance calories please.", "calorie_prescription"),
            ("How to lose 10 kg in two weeks?", "weight_prescription"),
            ("Am I overweight if I eat 2000 calories?", "weight_prescription"),
            ("Diet to cure cancer naturally", "medical_treatment"),
        ],
    )
    def test_out_of_scope_queries_are_blocked(self, query: str, expected_category: str):
        violation = check_safety_guardrail(query)
        assert violation is not None, f"Query '{query}' should have been intercepted as out of scope!"
        assert isinstance(violation, SafetyViolation)
        assert violation.category == expected_category
        assert len(violation.pattern_matched) > 0


class TestSafetyGuardrailFalsePositivePrevention:
    """Verify that objective informational queries about guidelines are NEVER blocked."""

    @pytest.mark.parametrize(
        "query",
        [
            "How long can cooked chicken stay in the fridge?",
            "What are WHO recommendations on free sugars?",
            "What does the Eatwell Guide say about beans and pulses?",
            "What do guidelines say about reducing sugar to prevent disease?",
            "What is the Eatwell Guide proportion for fruits and vegetables?",
            "What are the 5 keys to safer food?",
            "What are the daily energy requirements by age and gender?",
            "How long to thaw turkey in cold water versus refrigerator?",
            "Safe minimum internal cooking temperatures for poultry and pork",
            "What are the cold storage limits for fresh fish and seafood?",
            "What does the guide say about saturated fat and salt intake?",
            "What temperature should the refrigerator be kept at?",
        ],
    )
    def test_safe_guidelines_queries_pass_through(self, query: str):
        violation = check_safety_guardrail(query)
        assert violation is None, f"Safe query '{query}' was falsely blocked by guardrails: {violation}"


class TestRefusalHandlers:
    """Verify formatting and content of Refusal 1 and Refusal 2 payloads."""

    def test_build_out_of_scope_refusal(self):
        query = "What diet cures type 2 diabetes?"
        violation = check_safety_guardrail(query)
        assert violation is not None

        response = build_out_of_scope_refusal(query, violation)
        assert isinstance(response, ChatResponse)
        assert response.status == "REFUSAL_OUT_OF_SCOPE"
        assert response.query == query
        assert "physician or registered dietitian" in response.response_text
        assert "I cannot provide personalized medical nutrition therapy" in response.response_text
        assert len(response.sections) == 0
        assert len(response.citations) == 0
        assert len(response.searched_documents) == 0

    def test_get_out_of_scope_refusal_payload(self):
        query = "How many calories should I eat per day?"
        payload = get_out_of_scope_refusal_payload(query)
        assert isinstance(payload, RefusalResponse)
        assert payload.status == "REFUSAL_OUT_OF_SCOPE"
        assert payload.type == "OUT_OF_SCOPE_BY_DESIGN"
        assert "registered dietitian" in payload.suggested_action
        assert payload.message == OUT_OF_SCOPE_MESSAGE

    def test_build_not_in_corpus_refusal(self):
        query = "Can I store raw camel milk at 25°C for a week?"
        response = build_not_in_corpus_refusal(query)
        assert isinstance(response, ChatResponse)
        assert response.status == "REFUSAL_NOT_IN_CORPUS"
        assert response.query == query
        assert len(response.searched_documents) == 7

        # Assert all 7 documents from corpus registry are listed in the response text
        from config.settings import get_corpus_registry
        registry = get_corpus_registry()
        for doc_id, meta in registry.items():
            assert meta.title in response.response_text
            assert any(meta.title in s_doc for s_doc in response.searched_documents)


    def test_get_not_in_corpus_refusal_payload(self):
        query = "Unknown query outside corpus"
        payload = get_not_in_corpus_refusal_payload(query)
        assert isinstance(payload, RefusalResponse)
        assert payload.status == "REFUSAL_NOT_IN_CORPUS"
        assert payload.type == "NOT_IN_CORPUS"
        assert len(payload.searched_documents) == 7
        assert "The Eatwell Guide" in payload.message

    def test_get_searched_document_descriptions(self):
        docs = get_searched_document_descriptions()
        assert len(docs) == 7
        for d in docs:
            assert "(" in d and ")" in d  # Contains publisher and year
