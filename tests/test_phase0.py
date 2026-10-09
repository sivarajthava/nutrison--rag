"""Phase 0 Verification Test Suite: Environment, Settings & Data Contracts.

Validates:
1. Application settings and paths resolution.
2. Canonical corpus registry integrity (7 authoritative documents).
3. 100% schema compliance across all 1,001 blocks in data/blocks.jsonl.
4. Pydantic contracts for Chunk, Citation, GroundedSection, ChatRequest/Response, Refusal, and SSE events.
"""

import json
from pathlib import Path
import pytest

from config.settings import settings, get_settings, get_corpus_registry
from src.models.schemas import (
    BlockRecord,
    DocumentMetadata,
    Chunk,
    Citation,
    GroundedSection,
    ChatRequest,
    ChatResponse,
    RefusalResponse,
    SSEStatusData,
    SSETokenData,
    SSECitationsData,
    SSERefusalData,
    SSEDoneData,
    SSEErrorData,
)

EXPECTED_DOCUMENTS = {
    "cold-food-storage",
    "who-healthy-diet",
    "fao-who-healthy-diets",
    "who-five-keys",
    "eatwell-guide",
    "fsa-chill",
    "kitchen-companion",
}


class TestSettings:
    """Verify application configuration and environment parameter parsing."""

    def test_settings_defaults(self):
        conf = get_settings()
        assert conf.SIMILARITY_THRESHOLD == 0.53
        assert conf.RETRIEVAL_TOP_K == 6
        assert conf.EMBEDDING_PROVIDER in ["local", "gemini"]
        assert conf.EMBEDDING_MODEL_NAME == "all-MiniLM-L6-v2"
        assert conf.LLM_PROVIDER in ["groq", "gemini"]
        assert conf.GROQ_MODEL in ["openai/gpt-oss-120b", "qwen/qwen3.6-27b"]
        assert conf.GEMINI_MODEL == "gemini-2.5-flash"
        assert conf.FASTAPI_PORT == 8000

    def test_path_resolution(self):
        conf = get_settings()
        data_path = conf.get_data_blocks_path()
        registry_path = conf.get_corpus_registry_path()
        chroma_dir = conf.get_chroma_persist_dir()

        assert data_path.exists(), f"data/blocks.jsonl must exist at: {data_path}"
        assert registry_path.exists(), f"config/corpus_registry.yaml must exist at: {registry_path}"
        assert chroma_dir.name == "vectordb"


class TestCorpusRegistry:
    """Verify authoritative metadata registry for all 7 documents."""

    def test_registry_contains_all_seven_documents(self):
        registry = get_corpus_registry()
        assert set(registry.keys()) == EXPECTED_DOCUMENTS
        assert len(registry) == 7

    def test_registry_metadata_fields(self):
        registry = get_corpus_registry()
        for doc_id, doc in registry.items():
            assert isinstance(doc, DocumentMetadata)
            assert doc.document_id == doc_id
            assert len(doc.title) > 0
            assert len(doc.publisher) > 0
            assert doc.year >= 2000
            assert doc.category in ["nutrition", "food_safety"]
            assert doc.source_url.startswith("https://")
            assert len(doc.description) > 10


class TestBlockRecordValidation:
    """Verify that all 1,001 canonical records in data/blocks.jsonl conform to BlockRecord schema."""

    def test_validate_all_1001_blocks(self):
        blocks_path = settings.get_data_blocks_path()
        assert blocks_path.exists()

        records = []
        doc_ids = set()
        type_counts = {"heading": 0, "paragraph": 0, "list_item": 0, "table": 0}

        with open(blocks_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                line_str = line.strip()
                if not line_str:
                    continue
                block = BlockRecord.model_validate_json(line_str)
                records.append(block)
                doc_ids.add(block.document_id)
                type_counts[block.type] += 1

                # Specific integrity assertions
                assert block.document_id in EXPECTED_DOCUMENTS
                assert block.ordinal >= 0
                assert isinstance(block.text, str) and len(block.text) > 0
                assert isinstance(block.heading_path, list)

                if block.type == "heading":
                    assert block.level is not None
                    assert 1 <= block.level <= 6
                elif block.type == "table":
                    assert block.header is not None
                    assert block.rows is not None
                    assert len(block.header) > 0
                    assert len(block.rows) > 0

        # Exact empirical counts matching corpus profile
        assert len(records) == 1001
        assert doc_ids == EXPECTED_DOCUMENTS
        assert type_counts["heading"] == 176
        assert type_counts["paragraph"] == 383
        assert type_counts["list_item"] == 430
        assert type_counts["table"] == 12


class TestDataContracts:
    """Verify Pydantic models for Chunk, Citation, Section, Chat, and SSE."""

    def test_chunk_model(self):
        chunk = Chunk(
            chunk_id="test_doc_0_5",
            document_id="cold-food-storage",
            document_title="Cold Food Storage Chart",
            publisher="FDA",
            year=2021,
            category="food_safety",
            source_url="https://example.com",
            content="[Document: Cold Food Storage | Section: Refrigerator]\n\nChicken: 1 to 2 days.",
            section_heading="Cold Food Storage > Refrigerator",
            block_ordinals=[0, 1, 2],
            min_ordinal=0,
            max_ordinal=2,
            chunk_type="table",
            has_table=True,
            similarity_score=0.88,
        )
        assert chunk.document_name == "Cold Food Storage Chart"
        assert chunk.has_table is True
        assert chunk.similarity_score == 0.88

    def test_citation_model(self):
        citation = Citation(
            document_title="Healthy Diet Fact Sheet N°394",
            publisher="WHO",
            year=2020,
            source_url="https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
            section_heading="Healthy diet > FOR ADULTS",
            chunk_id="who_healthy_diet_0_5",
            similarity_score=0.75,
        )
        assert citation.document_name == "Healthy Diet Fact Sheet N°394"
        assert citation.formatted_citation == (
            "[Healthy Diet Fact Sheet N°394 | WHO, 2020 | "
            "https://www.who.int/news-room/fact-sheets/detail/healthy-diet]"
        )

    def test_grounded_section_model(self):
        section = GroundedSection(
            publisher="WHO",
            document_title="Healthy Diet Fact Sheet N°394",
            source_url="https://www.who.int",
            summary_text="Adults should limit free sugars to under 10% of total energy.",
        )
        assert section.content == section.summary_text
        assert len(section.citations) == 0

    def test_chat_request_and_response(self):
        req = ChatRequest(query="How long can fresh chicken stay in the fridge?", filter_document_id=None)
        assert req.query.startswith("How long")

        resp = ChatResponse(
            status="SUCCESS",
            query=req.query,
            response_text="Fresh chicken can be stored 1 to 2 days.",
            searched_documents=["Cold Food Storage Chart"],
            latency_ms=120,
        )
        assert resp.status == "SUCCESS"
        assert resp.latency_ms == 120

    def test_refusal_response_auto_sync(self):
        refusal1 = RefusalResponse(
            status="REFUSAL_NOT_IN_CORPUS",
            message="No verified guidance on camel milk.",
            searched_documents=list(EXPECTED_DOCUMENTS),
        )
        assert refusal1.type == "NOT_IN_CORPUS"

        refusal2 = RefusalResponse(
            status="REFUSAL_OUT_OF_SCOPE",
            message="Cannot calculate calorie prescriptions.",
            suggested_action="Consult a registered dietitian.",
        )
        assert refusal2.type == "OUT_OF_SCOPE_BY_DESIGN"

    def test_sse_models(self):
        status_ev = SSEStatusData(stage="retrieving")
        assert status_ev.stage == "retrieving"

        token_ev = SSETokenData(delta="According to")
        assert token_ev.delta == "According to"

        done_ev = SSEDoneData(latency_ms=450, chunks_retrieved=4)
        assert done_ev.chunks_retrieved == 4

        error_ev = SSEErrorData(message="Failed to connect", code="GATEWAY_ERROR")
        assert error_ev.code == "GATEWAY_ERROR"
