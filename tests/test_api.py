"""Phase 5 Verification Test Suite: FastAPI REST API Gateway.

Validates:
1. GET /v1/health: Vector store telemetry and health status.
2. GET /v1/documents: Authoritative corpus registry catalog (7 documents).
3. GET /v1/documents/{document_id}: Document lookup and 404 error handling.
4. POST /v1/chat: Synchronous grounded chat execution.
5. POST /v1/chat: Deterministic safety guardrail refusal (Refusal 2).
6. POST /v1/chat: Out-of-corpus similarity threshold refusal (Refusal 1).
7. POST /v1/chat: Document-scoped query filtering.
8. Validation error handling (422) for invalid request payloads.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.app import app
from src.models.schemas import ChatResponse


@pytest.fixture(scope="module")
def client():
    """Shared TestClient instance with lifespan context."""
    with TestClient(app) as test_client:
        yield test_client


class TestHealthAndDocumentsEndpoints:
    """Verify system diagnostics and corpus registry endpoints."""

    def test_health_check(self, client):
        response = client.get("/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["vector_store"]["total_chunks"] > 0
        assert data["corpus_documents_count"] == 7

    def test_health_check_root_alias(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_list_documents(self, client):
        response = client.get("/v1/documents")
        assert response.status_code == 200
        docs = response.json()
        assert len(docs) == 7
        doc_ids = {d["document_id"] for d in docs}
        assert "who-five-keys" in doc_ids
        assert "cold-food-storage" in doc_ids
        assert "eatwell-guide" in doc_ids

    def test_get_single_document_success(self, client):
        response = client.get("/v1/documents/who-five-keys")
        assert response.status_code == 200
        doc = response.json()
        assert doc["document_id"] == "who-five-keys"
        assert "World Health Organization" in doc["publisher"]

    def test_get_single_document_not_found(self, client):
        response = client.get("/v1/documents/non-existent-doc-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestSynchronousChatEndpoint:
    """Verify end-to-end grounded RAG and dual refusal flows via POST /v1/chat."""

    def test_chat_grounded_success(self, client):
        payload = {
            "query": "How long to thaw turkey in cold water versus refrigerator?"
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert len(data["response_text"]) > 0
        assert len(data["citations"]) > 0
        assert data["latency_ms"] is not None
        assert data["latency_ms"] > 0

    def test_chat_document_scoping(self, client):
        payload = {
            "query": "What are the 5 keys to safer food?",
            "filter_document_id": "who-five-keys"
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        for citation in data["citations"]:
            assert "who-five-keys" in citation["source_url"] or "Five Keys" in citation["document_title"]

    def test_chat_refusal_out_of_scope_guardrail(self, client):
        """Violates Refusal 2: Personalized calorie prescription and target weight loss."""
        payload = {
            "query": "I want to cut to 1200 calories to lose 15 pounds in a month."
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REFUSAL_OUT_OF_SCOPE"
        assert "cannot provide personalized medical nutrition therapy" in data["response_text"]
        assert len(data["citations"]) == 0

    def test_chat_refusal_medical_treatment(self, client):
        """Violates Refusal 2: Disease cure/treatment."""
        payload = {
            "query": "What diet cures type 2 diabetes?"
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REFUSAL_OUT_OF_SCOPE"
        assert "cannot provide personalized medical nutrition therapy" in data["response_text"]

    def test_chat_refusal_not_in_corpus(self, client):
        """Triggers Refusal 1: Inquiry not present in authoritative corpus."""
        payload = {
            "query": "Can I store raw camel milk at 25°C for a week?"
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REFUSAL_NOT_IN_CORPUS"
        assert "do not contain information" in data["response_text"]
        assert len(data["searched_documents"]) == 7

    def test_chat_validation_error_empty_query(self, client):
        payload = {
            "query": ""
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "Validation Error"

    def test_chat_validation_error_overlong_query(self, client):
        """Query exceeding max_length=1000 triggers 422 validation error."""
        payload = {
            "query": "A" * 1001
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "Validation Error"

    def test_chat_category_scoping(self, client):
        """Query with filter_category='nutrition' restricts citations to nutrition documents."""
        payload = {
            "query": "What are recommended limits for free sugars?",
            "filter_category": "nutrition"
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert len(data["citations"]) > 0

    def test_chat_custom_threshold_override(self, client):
        """A very high threshold override forces Refusal 1 (Corpus Gap)."""
        payload = {
            "query": "Safe minimum internal cooking temperatures",
            "threshold": 0.99
        }
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REFUSAL_NOT_IN_CORPUS"

    def test_chat_malformed_json_handling(self, client):
        """Malformed JSON payload triggers 422 validation error with structured body."""
        response = client.post(
            "/v1/chat",
            content=b"{malformed json: true",
            headers={"content-type": "application/json"}
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "Validation Error"


class TestExplorerEndpoints:
    """Verify diagnostic explorer REST endpoints."""

    def test_get_blocks_all(self, client):
        """GET /v1/blocks returns all 1,001 blocks."""
        response = client.get("/v1/blocks")
        assert response.status_code == 200
        blocks = response.json()
        assert len(blocks) == 1001
        assert blocks[0]["document_id"] == "cold-food-storage"

    def test_get_blocks_filtered(self, client):
        """GET /v1/blocks filtered by document and type."""
        response = client.get("/v1/blocks?document_id=who-five-keys&block_type=list_item")
        assert response.status_code == 200
        blocks = response.json()
        assert len(blocks) > 0
        for b in blocks:
            assert b["document_id"] == "who-five-keys"
            assert b["type"] == "list_item"

    def test_get_chunks_all(self, client):
        """GET /v1/chunks returns all 160 assembled chunks."""
        response = client.get("/v1/chunks")
        assert response.status_code == 200
        chunks = response.json()
        assert len(chunks) == 160

    def test_get_chunks_filtered_table(self, client):
        """GET /v1/chunks filtered by has_table=true."""
        response = client.get("/v1/chunks?has_table=true")
        assert response.status_code == 200
        chunks = response.json()
        assert len(chunks) > 0
        for c in chunks:
            assert c["has_table"] is True

    def test_retrieval_debug_endpoint(self, client):
        """POST /v1/retrieval/debug tests similarity and threshold evaluation."""
        payload = {
            "query": "How long can chicken stay in the fridge?",
            "top_k": 4,
            "threshold": 0.53,
        }
        response = client.post("/v1/retrieval/debug", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["max_similarity"] >= 0.53
        assert data["meets_threshold"] is True
        assert data["is_corpus_gap"] is False
        assert len(data["chunks"]) > 0

    def test_retrieval_debug_gap_query(self, client):
        """POST /v1/retrieval/debug with out of corpus query detects gap."""
        payload = {
            "query": "Can I store raw camel milk at 25°C for a week?",
            "threshold": 0.68,
        }
        response = client.post("/v1/retrieval/debug", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["meets_threshold"] is False
        assert data["is_corpus_gap"] is True

    def test_guardrails_check_violation(self, client):
        """POST /v1/guardrails/check detects safety violation."""
        payload = {"query": "Diet to cure cancer naturally"}
        response = client.post("/v1/guardrails/check", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["violated"] is True
        assert data["category"] == "medical_treatment"
        assert data["pattern_matched"] is not None

    def test_guardrails_check_safe(self, client):
        """POST /v1/guardrails/check allows safe query."""
        payload = {"query": "What are WHO recommendations on free sugars?"}
        response = client.post("/v1/guardrails/check", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["violated"] is False
        assert data["category"] is None

