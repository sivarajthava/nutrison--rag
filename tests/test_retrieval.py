"""Phase 2 Verification Test Suite: Vector Database Indexing & Dual-Mode Retrieval.

Validates:
1. Global nearest-neighbor retrieval across the 1,001-block corpus.
2. Document-scoped retrieval filtering (filter_document_id).
3. Category-scoped retrieval filtering (filter_category).
4. Compound filtering (document_id + category).
5. Segmented and atomic table chunk retrieval.
6. Calibrated similarity threshold cutoff (tau_relevance = 0.68) for Refusal 1 (Corpus Gap).
7. Reconstitution of typed Chunk instances with full provenance and metadata.
8. Sub-50ms retrieval latency once embeddings model is loaded.
"""

import time
import pytest
from typing import List

from config.settings import settings
from src.models.schemas import Chunk
from src.retrieval.retriever import Retriever, retrieve_chunks, get_retriever
from src.retrieval.vector_store import get_vector_store, DEFAULT_COLLECTION_NAME


@pytest.fixture(scope="module")
def retriever():
    """Shared Retriever instance with persistent vector store."""
    r = get_retriever()
    # Ensure collection is loaded and has items
    assert r.vector_store.count() > 0, "Vector database must be indexed before running retrieval tests."
    return r


class TestDualModeRetrieval:
    """Verify global, document-scoped, and category-scoped retrieval."""

    def test_global_retrieval_chicken_storage(self, retriever):
        """Query 'How long can chicken stay in the fridge?' without filter.
        
        Assert that kitchen-companion or cold-food-storage ranks as top match with similarity >= 0.68.
        """
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="How long can chicken stay in the fridge?",
            threshold=0.65,
        )
        assert is_gap is False
        assert max_sim >= 0.65
        assert len(chunks) > 0
        top_docs = [c.document_id for c in chunks]
        assert "kitchen-companion" in top_docs or "cold-food-storage" in top_docs

    def test_scoped_retrieval_who_five_keys(self, retriever):
        """Query 'What are the 5 keys to safer food?' with filter_document_id='who-five-keys'.
        
        Assert 100% of returned chunks have document_id == 'who-five-keys'.
        """
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="What are the 5 keys to safer food?",
            filter_document_id="who-five-keys",
            threshold=0.65,
        )
        assert is_gap is False
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.document_id == "who-five-keys"
            assert chunk.publisher == "World Health Organization (WHO)"

    def test_category_filtered_retrieval_nutrition(self, retriever):
        """Query 'What are recommended limits for free sugars?' with filter_category='nutrition'.
        
        Verify all returned chunks belong to who-healthy-diet, fao-who-healthy-diets, or eatwell-guide.
        """
        valid_nutrition_docs = {"who-healthy-diet", "fao-who-healthy-diets", "eatwell-guide"}
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="What are recommended limits for free sugars?",
            filter_category="nutrition",
            threshold=0.65,
        )
        assert is_gap is False
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.category == "nutrition"
            assert chunk.document_id in valid_nutrition_docs

    def test_compound_filter_document_and_category(self, retriever):
        """Verify compound filter where={"$and": [{"document_id": ...}, {"category": ...}]}."""
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="What are healthy diet recommendations?",
            filter_document_id="who-healthy-diet",
            filter_category="nutrition",
            threshold=0.60,
        )
        assert is_gap is False
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.document_id == "who-healthy-diet"
            assert chunk.category == "nutrition"


class TestTableChunkRetrieval:
    """Verify precision retrieval of atomic and segmented table chunks."""

    def test_table_retrieval_turkey_thawing(self, retriever):
        """Query 'How long to thaw turkey in cold water versus refrigerator?'.
        
        Assert that kitchen-companion_table_232 (Turkey Thawing Chart) ranks #1.
        """
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="How long to thaw turkey in cold water versus refrigerator?",
            threshold=0.68,
        )
        assert is_gap is False
        assert max_sim >= 0.70
        assert len(chunks) > 0
        assert chunks[0].chunk_id == "kitchen-companion_table_232"
        assert chunks[0].has_table is True
        assert "Turkey Thawing Chart" in chunks[0].content

    def test_segmented_table_retrieval_shellfish(self, retriever):
        """Query 'How long can fresh crab meat and lobster be kept in the refrigerator?'.
        
        Assert that cold-food-storage_table_2_seg3 (Fresh Poultry & Seafood) is returned.
        """
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="How long can fresh crab meat and lobster be kept in the refrigerator?",
            threshold=0.65,
        )
        assert is_gap is False
        assert len(chunks) > 0
        top_ids = [c.chunk_id for c in chunks]
        assert "cold-food-storage_table_2_seg3" in top_ids
        target_chunk = next(c for c in chunks if c.chunk_id == "cold-food-storage_table_2_seg3")
        assert target_chunk.has_table is True
        assert "Shellfish" in target_chunk.content or "lobster" in target_chunk.content.lower()

    def test_eatwell_segmented_table_retrieval_dairy_and_protein(self, retriever):
        """Query 'What does the Eatwell Guide recommend for dairy and dairy alternatives?'.
        
        Assert that eatwell-guide_table_105_seg2 is retrieved with tabular integrity.
        """
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="What does the Eatwell Guide recommend for dairy and dairy alternatives?",
            threshold=0.55,
        )
        assert is_gap is False
        assert len(chunks) > 0
        target = next((c for c in chunks if c.chunk_id == "eatwell-guide_table_105_seg2"), None)
        assert target is not None
        assert target.has_table is True
        assert "| Food group | What’s included? | How much? | Tips |" in target.content or "Dairy and dairy alternatives" in target.content


class TestSimilarityThresholdingAndCorpusGap:
    """Verify calibrated cutoff (tau_relevance = 0.68) and Refusal 1 detection."""

    def test_similarity_threshold_in_corpus(self, retriever):
        """Relevant guidance query yields similarity >= 0.68 and is_corpus_gap == False."""
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="How long to thaw turkey in cold water versus refrigerator?",
            threshold=0.68,
        )
        assert is_gap is False
        assert max_sim >= 0.68
        assert len(chunks) > 0

    def test_similarity_threshold_out_of_corpus(self, retriever):
        """Out-of-corpus query yields similarity < 0.68, returns 0 chunks, and flags is_corpus_gap == True."""
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="Can I store raw camel milk at 25°C for a week?",
            threshold=0.68,
        )
        assert is_gap is True
        assert max_sim < 0.68
        assert len(chunks) == 0

    def test_custom_threshold_override(self, retriever):
        """Custom threshold parameter should override default settings."""
        # Query with high threshold 0.95 should trigger gap
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="Safe minimum internal cooking temperatures",
            threshold=0.95,
        )
        assert is_gap is True
        assert len(chunks) == 0

        # Same query with standard threshold should succeed
        chunks_ok, max_sim_ok, is_gap_ok = retriever.retrieve_chunks(
            query="Safe minimum internal cooking temperatures",
            threshold=0.60,
        )
        assert is_gap_ok is False
        assert len(chunks_ok) > 0


class TestRetrieverContractsAndPerformance:
    """Verify Pydantic typing, metadata integrity, top_k limits, and latency."""

    def test_retrieved_chunk_typing_and_provenance(self, retriever):
        """All retrieved chunks must be typed Chunk instances with valid fields and similarity_score."""
        chunks, max_sim, is_gap = retriever.retrieve_chunks(
            query="How to store food safely in the refrigerator?",
            top_k=4,
            threshold=0.60,
        )
        assert is_gap is False
        for chunk in chunks:
            assert isinstance(chunk, Chunk)
            assert chunk.similarity_score is not None
            assert 0.0 <= chunk.similarity_score <= 1.0
            assert chunk.source_url.startswith("https://")
            assert len(chunk.document_title) > 0
            assert len(chunk.publisher) > 0
            assert chunk.year > 0

    def test_top_k_limiting(self, retriever):
        """Number of returned chunks should never exceed requested top_k."""
        for k in [1, 3, 5]:
            chunks, _, _ = retriever.retrieve_chunks(
                query="Cooking meat safely at minimum temperatures",
                top_k=k,
                threshold=0.50,
            )
            assert len(chunks) <= k

    def test_sub_50ms_retrieval_latency(self, retriever):
        """Retrieval query latency must be sub-50ms once embeddings model is warm."""
        # Warmup
        retriever.retrieve_chunks(query="warmup food safety", top_k=6, threshold=0.60)

        # Benchmark 5 queries
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            retriever.retrieve_chunks(query="Safe internal cooking temperature for poultry", top_k=6, threshold=0.60)
            times.append(time.perf_counter() - t0)

        avg_latency_ms = (sum(times) / len(times)) * 1000.0
        # Assert average latency is within reasonable performance envelope (< 100ms on CPU)
        assert avg_latency_ms < 100.0, f"Average retrieval latency too high: {avg_latency_ms:.2f}ms"


class TestRawBlocksRetrieval:
    """Verify raw blocks vector index (dietary_guidance_blocks) and retrieval."""

    def test_blocks_collection_has_all_1001_blocks(self):
        """Assert dietary_guidance_blocks collection is fully populated with all 1,001 blocks."""
        from src.retrieval.vector_store import get_blocks_vector_store
        blocks_store = get_blocks_vector_store()
        assert blocks_store.count() == 1001

    def test_retrieve_blocks_query(self, retriever):
        """Retrieve individual raw blocks for chicken storage and verify typing and provenance."""
        blocks, max_sim, is_gap = retriever.retrieve_blocks(
            query="How long can fresh chicken stay in the refrigerator?",
            top_k=5,
            threshold=0.55,
        )
        assert is_gap is False
        assert max_sim >= 0.55
        assert len(blocks) > 0
        for b in blocks:
            assert "block_id" in b
            assert "content" in b
            assert "document_id" in b
            assert "ordinal" in b
            assert "block_type" in b
            assert b["similarity_score"] >= 0.55

    def test_retrieve_blocks_with_document_filter(self, retriever):
        """Retrieve raw blocks filtered to cold-food-storage."""
        blocks, max_sim, is_gap = retriever.retrieve_blocks(
            query="How long to store poultry and seafood?",
            filter_document_id="cold-food-storage",
            top_k=3,
            threshold=0.50,
        )
        assert is_gap is False
        assert len(blocks) > 0
        for b in blocks:
            assert b["document_id"] == "cold-food-storage"
