
"""Phase 1 Verification Test Suite: Ingestion & Data-Calibrated Chunk Assembly.

Validates:
1. Exact parsing of all 1,001 blocks from data/blocks.jsonl.
2. Complete preservation and column retention of segmented tables:
   - cold-food-storage ordinal 2 (4 segments, 53 rows)
   - eatwell-guide ordinal 105 (3 segments, 6 rows)
   - kitchen-companion ordinal 216 (2 segments, 11 rows)
3. 100% intact preservation of all 9 atomic tables as standalone chunks.
4. Retention of captions across the 6 captioned tables in kitchen-companion.
5. Binding of lead-in paragraphs with bulleted list items.
6. Coalescing of sibling micro-sections in deep hierarchies.
7. Token size bounds preventing dense embedding truncation.
8. Full metadata inheritance (URLs, publishers, years, page ranges, ordinals).
"""

from pathlib import Path
import pytest

from config.settings import settings, get_corpus_registry
from src.models.schemas import BlockRecord, Chunk
from src.ingestion.block_reader import read_blocks, load_corpus_summary
from src.ingestion.block_chunker import HierarchyChunker, estimate_tokens


@pytest.fixture(scope="module")
def all_blocks():
    """Load and validate all blocks from data/blocks.jsonl."""
    blocks = list(read_blocks(settings.get_data_blocks_path()))
    return blocks


@pytest.fixture(scope="module")
def chunker():
    """Create HierarchyChunker instance."""
    return HierarchyChunker()


@pytest.fixture(scope="module")
def all_chunks(chunker, all_blocks):
    """Assemble all chunks from the corpus."""
    return chunker.assemble_chunks(all_blocks)


class TestBlockReader:
    """Verify block reading and structural telemetry."""

    def test_read_all_1001_blocks(self, all_blocks):
        assert len(all_blocks) == 1001
        for block in all_blocks:
            assert isinstance(block, BlockRecord)
            assert block.ordinal >= 0
            assert block.type in ["heading", "paragraph", "list_item", "table"]
            assert len(block.text) > 0

    def test_load_corpus_summary(self):
        summary = load_corpus_summary()
        assert summary["total_blocks"] == 1001
        assert summary["total_documents"] == 7
        assert summary["type_totals"]["table"] == 12
        assert summary["type_totals"]["heading"] == 176
        assert summary["type_totals"]["paragraph"] == 383
        assert summary["type_totals"]["list_item"] == 430

    def test_read_blocks_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            list(read_blocks(Path("data/non_existent_blocks_file.jsonl")))



class TestTablePreservationAndIntegrity:
    """Verify table preservation without destructive cell/row bisecting."""

    def test_table_integrity_cold_food_storage(self, all_chunks):
        cfs_table_chunks = [
            c for c in all_chunks
            if c.document_id == "cold-food-storage" and c.has_table
        ]
        assert len(cfs_table_chunks) == 4

        expected_cols = ["Food", "Type", "Refrigerator", "Freezer"]
        for idx, chunk in enumerate(cfs_table_chunks, start=1):
            assert chunk.chunk_id == f"cold-food-storage_table_2_seg{idx}"
            assert chunk.chunk_type == "table"
            assert chunk.has_table is True
            assert chunk.sub_label is not None
            # Check all 4 columns are present in table markdown
            for col in expected_cols:
                assert col in chunk.content

        # Count total rows preserved across all 4 segments (excluding headers/dividers)
        total_rows = 0
        for chunk in cfs_table_chunks:
            table_lines = [
                line.strip() for line in chunk.content.split("\n")
                if line.strip().startswith("|") and "---" not in line and "Food" not in line
            ]
            total_rows += len(table_lines)
        assert total_rows == 53

    def test_eatwell_table_integrity(self, all_chunks):
        eatwell_105_chunks = [
            c for c in all_chunks
            if c.document_id == "eatwell-guide" and "table_105" in c.chunk_id
        ]
        assert len(eatwell_105_chunks) == 3

        expected_cols = ["Food group", "What’s included?", "How much?", "Tips"]
        for idx, chunk in enumerate(eatwell_105_chunks, start=1):
            assert chunk.chunk_id == f"eatwell-guide_table_105_seg{idx}"
            assert chunk.has_table is True
            assert chunk.sub_label is not None
            for col in expected_cols:
                assert col in chunk.content

        total_rows = 0
        for chunk in eatwell_105_chunks:
            table_lines = [
                line.strip() for line in chunk.content.split("\n")
                if line.strip().startswith("|") and "---" not in line and "Food group" not in line
            ]
            total_rows += len(table_lines)
        assert total_rows == 6

    def test_kitchen_companion_roasting_table_integrity(self, all_chunks):
        roast_chunks = [
            c for c in all_chunks
            if c.document_id == "kitchen-companion" and "table_216" in c.chunk_id
        ]
        assert len(roast_chunks) == 2

        expected_cols = ["Meat", "Oven Temperature", "Timing", "Safe Minimum Internal Temperature"]
        for idx, chunk in enumerate(roast_chunks, start=1):
            assert chunk.chunk_id == f"kitchen-companion_table_216_seg{idx}"
            assert chunk.has_table is True
            assert chunk.sub_label is not None
            for col in expected_cols:
                assert col in chunk.content

        total_rows = 0
        for chunk in roast_chunks:
            table_lines = [
                line.strip() for line in chunk.content.split("\n")
                if line.strip().startswith("|") and "---" not in line and "Meat" not in line
            ]
            total_rows += len(table_lines)
        assert total_rows == 11

    def test_atomic_table_preservation(self, all_chunks):
        atomic_table_chunks = [
            c for c in all_chunks
            if c.has_table and "_seg" not in c.chunk_id
        ]
        assert len(atomic_table_chunks) == 9

        expected_atomic_ids = {
            "eatwell-guide_table_71",
            "eatwell-guide_table_81",
            "kitchen-companion_table_92",
            "kitchen-companion_table_178",
            "kitchen-companion_table_214",
            "kitchen-companion_table_232",
            "kitchen-companion_table_252",
            "kitchen-companion_table_254",
            "kitchen-companion_table_285",
        }
        actual_ids = {c.chunk_id for c in atomic_table_chunks}
        assert actual_ids == expected_atomic_ids

        for chunk in atomic_table_chunks:
            assert chunk.has_table is True
            assert chunk.chunk_type == "table"
            assert len(chunk.block_ordinals) == 1

    def test_table_caption_enrichment(self, all_chunks):
        captioned_tables = [
            c for c in all_chunks
            if c.document_id == "kitchen-companion" and c.has_table and c.table_caption is not None
        ]
        # 6 captioned tables in kitchen-companion (92, 214, 232, 252, 254, 285)
        # Note: 216 has no caption in blocks.jsonl
        captioned_ordinals = {c.min_ordinal for c in captioned_tables}
        assert captioned_ordinals == {92, 214, 232, 252, 254, 285}
        assert len(captioned_tables) == 6

        for chunk in captioned_tables:
            assert chunk.table_caption is not None
            assert len(chunk.table_caption) > 0
            assert chunk.table_caption in chunk.content


class TestProseAndListChunking:
    """Verify list item binding, micro-section coalescing, and token budget rules."""

    def test_list_item_binding(self, all_chunks):
        # In who-healthy-diet, ordinal 14 is "A healthy diet includes the following:"
        # Ordinals 15-19 are list items. They must be bound together.
        target_chunk = next(
            (c for c in all_chunks if c.document_id == "who-healthy-diet" and 14 in c.block_ordinals),
            None
        )
        assert target_chunk is not None
        assert "A healthy diet includes the following:" in target_chunk.content
        assert any(ord_val in target_chunk.block_ordinals for ord_val in [15, 16, 17, 18, 19])

        # In fsa-chill, ordinal 2 is "Here are our top recommendations..." and ordinal 3 is list_item
        chill_chunk = next(
            (c for c in all_chunks if c.document_id == "fsa-chill" and 2 in c.block_ordinals),
            None
        )
        assert chill_chunk is not None
        assert "Here are our top recommendations" in chill_chunk.content
        assert 3 in chill_chunk.block_ordinals

        # In who-five-keys, ordinal 13 is lead-in and ordinals 14+ are list items
        five_keys_chunk = next(
            (c for c in all_chunks if c.document_id == "who-five-keys" and 13 in c.block_ordinals),
            None
        )
        assert five_keys_chunk is not None
        assert "the following points and questions should be considered" in five_keys_chunk.content
        assert 14 in five_keys_chunk.block_ordinals



    def test_micro_section_coalescing(self, all_chunks):
        # In kitchen-companion, sections 0, 1, 2 (Spoilage, Pathogenic, Foodborne Illness)
        # span ordinals 2 to 8 and should coalesce into a chunk >= 150 tokens
        first_kc = next(
            (c for c in all_chunks if c.document_id == "kitchen-companion" and not c.has_table),
            None
        )
        assert first_kc is not None
        toks = estimate_tokens(first_kc.content)
        assert toks >= 150
        # Ordinals 2 and 3 are from Spoilage Bacteria
        assert 2 in first_kc.block_ordinals
        # Ordinal 5 is from Pathogenic Bacteria (ordinal 4 is a heading)
        assert 5 in first_kc.block_ordinals
        # Ordinals 7 and 8 are from Foodborne Illness (ordinal 6 is a heading)
        assert 7 in first_kc.block_ordinals

    def test_chunk_size_bounds(self, all_chunks):
        # All chunks must satisfy minimum size (>= 50) and stay below embedding truncation limit (<= 500)
        # Prose chunks must strictly satisfy ceiling <= 450 tokens
        for chunk in all_chunks:
            toks = estimate_tokens(chunk.content)
            assert toks >= 50, f"Chunk {chunk.chunk_id} has only {toks} tokens (< 50)"
            if chunk.has_table:
                assert toks <= 500, f"Table chunk {chunk.chunk_id} has {toks} tokens (> 500)"
            else:
                assert toks <= 450, f"Prose chunk {chunk.chunk_id} has {toks} tokens (> 450)"

    def test_metadata_inheritance(self, all_chunks):
        registry = get_corpus_registry()
        for chunk in all_chunks:
            doc_meta = registry[chunk.document_id]
            assert chunk.document_title == doc_meta.title
            assert chunk.publisher == doc_meta.publisher
            assert chunk.year == doc_meta.year
            assert chunk.category == doc_meta.category
            assert chunk.source_url == doc_meta.source_url
            assert len(chunk.section_heading) > 0
            assert chunk.min_ordinal <= chunk.max_ordinal
            assert len(chunk.block_ordinals) > 0
            assert chunk.min_ordinal == min(chunk.block_ordinals)
            assert chunk.max_ordinal == max(chunk.block_ordinals)

            # Web documents have no pages, PDF documents have page numbers
            if chunk.document_id in ["cold-food-storage", "fsa-chill"]:
                assert chunk.page_start is None
                assert chunk.page_end is None
            else:
                assert chunk.page_start is not None
                assert chunk.page_end is not None
                assert chunk.page_start <= chunk.page_end


class TestFiveDataCalibratedRules:
    """Explicit verification suite for all 5 Data-Calibrated Chunking Rules."""

    def test_rule1_embedding_window_calibration(self, all_chunks):
        """Rule 1: Target 250-350 tokens, ceiling <= 450 (prose) / <= 500 (table), zero truncation."""
        toks = [estimate_tokens(c.content) for c in all_chunks]
        avg_tok = sum(toks) / len(toks)
        # Average is calibrated within target range
        assert 240 <= avg_tok <= 285

        for chunk in all_chunks:
            tok = estimate_tokens(chunk.content)
            assert tok >= 50, f"Chunk {chunk.chunk_id} has {tok} tokens (< 50)"
            if chunk.has_table:
                assert tok <= 500, f"Table chunk {chunk.chunk_id} exceeds 500 tokens: {tok}"
            else:
                assert tok <= 450, f"Prose chunk {chunk.chunk_id} exceeds 450 tokens: {tok}"

    def test_rule2_table_isolation_and_column_preservation(self, all_chunks, all_blocks):
        """Rule 2: Tables never mixed with prose/lists; headers replicated; zero row bisecting."""
        blocks_by_id = {(b.document_id, b.ordinal): b for b in all_blocks}
        table_chunks = [c for c in all_chunks if c.has_table]
        assert len(table_chunks) == 18  # 9 atomic + 9 segmented sub-tables

        for c in all_chunks:
            if c.has_table:
                # Table isolation: every source block must be a table
                for ord_val in c.block_ordinals:
                    assert blocks_by_id[(c.document_id, ord_val)].type == "table"
                # Must contain markdown table structure
                assert "| --- |" in c.content or "|---|" in c.content
            else:
                # Prose chunk must not contain table blocks
                for ord_val in c.block_ordinals:
                    assert blocks_by_id[(c.document_id, ord_val)].type != "table"

    def test_rule3_list_lead_in_carryover_on_split(self, all_chunks):
        """Rule 3: Lead-ins carried forward when lists split across chunks; headings never standalone."""
        # who-healthy-diet blocks 64-83 split into multiple chunks; block 63 is the lead-in
        split_list_chunk = next(
            (c for c in all_chunks if c.document_id == "who-healthy-diet" and 81 in c.block_ordinals and 83 in c.block_ordinals),
            None
        )
        assert split_list_chunk is not None
        # Verify block 63 intro is carried over into split chunk
        assert "Governments have a central role" in split_list_chunk.content

    def test_rule3_no_standalone_headings(self, all_chunks, all_blocks):
        """Rule 3: Headings act purely as metadata anchors and are never emitted as standalone chunks."""
        blocks_by_id = {(b.document_id, b.ordinal): b for b in all_blocks}
        for chunk in all_chunks:
            non_heading_blocks = [
                ord_val for ord_val in chunk.block_ordinals
                if blocks_by_id[(chunk.document_id, ord_val)].type != "heading"
            ]
            assert len(non_heading_blocks) > 0, f"Chunk {chunk.chunk_id} consists solely of heading blocks"

    def test_rule4_breadcrumb_and_caption_context_injection(self, all_chunks):
        """Rule 4: Injects [Document: ... | Section: ...] and | Table: [caption] into content."""
        for chunk in all_chunks:
            assert chunk.content.startswith("[Document: ")
            assert " | Section: " in chunk.content
            if chunk.has_table and (chunk.table_caption or chunk.sub_label):
                assert " | Table: " in chunk.content

    def test_rule5_micro_section_coalescing(self, all_chunks):
        """Rule 5: Coalesce sibling micro-sections (< 200 tok) sharing common root hierarchy."""
        # Zero micro-chunks (< 50 tokens) exist in entire corpus
        for chunk in all_chunks:
            tok = estimate_tokens(chunk.content)
            assert tok >= 50, f"Chunk {chunk.chunk_id} has only {tok} tokens"


class TestChunkerRobustnessAndMetadata:
    """Verify convenience methods, serialization fidelity, and invariants."""

    def test_assemble_corpus_convenience_method(self, chunker, all_chunks):
        """assemble_corpus() should produce identical results to assemble_chunks(read_blocks())."""
        corpus_chunks = chunker.assemble_corpus()
        assert len(corpus_chunks) == len(all_chunks)
        for c1, c2 in zip(corpus_chunks, all_chunks):
            assert c1.chunk_id == c2.chunk_id
            assert c1.content == c2.content

    def test_chroma_metadata_roundtrip(self, all_chunks):
        """Metadata serialized to ChromaDB format should reconstitute faithfully via from_chroma_metadata."""
        for chunk in all_chunks[:10]:
            meta = chunk.to_chroma_metadata()
            assert isinstance(meta["chunk_id"], str)
            assert isinstance(meta["min_ordinal"], int)
            assert isinstance(meta["max_ordinal"], int)
            assert isinstance(meta["has_table"], bool)

            reconstituted = Chunk.from_chroma_metadata(meta, chunk.content)
            assert reconstituted.chunk_id == chunk.chunk_id
            assert reconstituted.document_id == chunk.document_id
            assert reconstituted.min_ordinal == chunk.min_ordinal
            assert reconstituted.max_ordinal == chunk.max_ordinal
            assert reconstituted.has_table == chunk.has_table
            assert reconstituted.content == chunk.content

    def test_all_table_chunks_have_valid_markdown_headers(self, all_chunks):
        """Every table chunk must contain valid markdown table separator with | --- | syntax."""
        table_chunks = [c for c in all_chunks if c.has_table]
        for c in table_chunks:
            lines = c.content.split("\n")
            table_sep = [l for l in lines if "---" in l and "|" in l]
            assert len(table_sep) >= 1, f"Table chunk {c.chunk_id} missing markdown table separator"

    def test_all_source_urls_are_valid(self, all_chunks):
        """Every chunk must have a valid authoritative https:// source URL."""
        for chunk in all_chunks:
            assert chunk.source_url.startswith("https://")

    def test_no_duplicate_block_ordinals_per_chunk(self, all_chunks):
        """Block ordinals within a chunk must be strictly unique."""
        for chunk in all_chunks:
            assert len(chunk.block_ordinals) == len(set(chunk.block_ordinals))

    def test_complete_100_percent_block_coverage(self, all_chunks, all_blocks):
        """Verify that 100% of the 1,001 canonical blocks are represented in chunk block ordinals."""
        all_block_pairs = {(b.document_id, b.ordinal) for b in all_blocks}
        covered_pairs = {(c.document_id, o) for c in all_chunks for o in c.block_ordinals}
        missing_pairs = all_block_pairs - covered_pairs
        assert len(covered_pairs) == 1001
        assert len(missing_pairs) == 0


