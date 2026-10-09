"""Phase 4 Verification Test Suite: Grounded Synthesis, Citations & Streaming.

Validates:
1. Multi-document segregated formatting (WHO vs Eatwell Guide without blending).
2. Citation extraction and validation compliance.
3. Fallback to Refusal 1 when context chunks are empty.
4. Asynchronous token and citation streaming.
"""

import pytest
import asyncio
from src.models.schemas import Chunk, ChatResponse, Citation, GroundedSection
from src.generation.prompt_templates import (
    GROUNDED_SYSTEM_PROMPT,
    format_segregated_context,
    format_synthesis_user_prompt,
)
from src.generation.citation_formatter import (
    extract_and_validate_citations,
    format_citation_string,
)
from src.generation.synthesizer import GroundedSynthesizer, get_synthesizer


@pytest.fixture
def mock_chunks():
    """Sample chunks from two different authorities."""
    chunk1 = Chunk(
        chunk_id="who-healthy-diet_35_40",
        document_id="who-healthy-diet",
        document_title="Healthy Diet Fact Sheet N°394",
        publisher="World Health Organization (WHO)",
        year=2020,
        category="nutrition",
        source_url="https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
        content="Less than 30% of total energy intake should come from fats. Unsaturated fats are preferable to saturated fats.",
        section_heading="Healthy diet > Fats",
        block_ordinals=[35, 36],
        min_ordinal=35,
        max_ordinal=36,
        similarity_score=0.85,
    )
    chunk2 = Chunk(
        chunk_id="eatwell-guide_table_105_seg3",
        document_id="eatwell-guide",
        document_title="The Eatwell Guide: Helping you eat a healthy, balanced diet",
        publisher="Public Health England / NHS / UK Food Standards Agency",
        year=2018,
        category="nutrition",
        source_url="https://www.gov.uk/government/publications/the-eatwell-guide",
        content="| Food group | What's included? | Tips |\n| Oils and spreads | Unsaturated oils | Use sparingly. |",
        section_heading="8 tips for eating well",
        block_ordinals=[105],
        min_ordinal=105,
        max_ordinal=105,
        has_table=True,
        similarity_score=0.82,
    )
    return [chunk1, chunk2]


class TestContextFormattingAndCitations:
    """Verify prompt formatting, context segregation, and citation extraction."""

    def test_format_segregated_context(self, mock_chunks):
        formatted = format_segregated_context(mock_chunks)
        assert "=== SOURCE: Healthy Diet Fact Sheet N°394" in formatted
        assert "=== SOURCE: The Eatwell Guide" in formatted
        assert "Canonical URL: https://www.who.int" in formatted
        assert "Canonical URL: https://www.gov.uk" in formatted

    def test_citation_string_formatting(self, mock_chunks):
        c_str = format_citation_string(mock_chunks[0])
        assert c_str == "[Healthy Diet Fact Sheet N°394 | World Health Organization (WHO), 2020 | https://www.who.int/news-room/fact-sheets/detail/healthy-diet]"

    def test_extract_and_validate_citations(self, mock_chunks):
        sample_text = (
            "### Healthy Diet Fact Sheet N°394 (World Health Organization (WHO))\n\n"
            "Keep fat intake below 30% [Healthy Diet Fact Sheet N°394 | World Health Organization (WHO), 2020 | https://www.who.int/news-room/fact-sheets/detail/healthy-diet].\n\n"
            "### The Eatwell Guide (Public Health England / NHS / UK Food Standards Agency)\n\n"
            "Choose unsaturated oils [The Eatwell Guide: Helping you eat a healthy, balanced diet | Public Health England / NHS / UK Food Standards Agency, 2018 | https://www.gov.uk/government/publications/the-eatwell-guide]."
        )
        text, citations, sections = extract_and_validate_citations(sample_text, mock_chunks)
        assert len(citations) >= 2
        titles = [c.document_title for c in citations]
        assert "Healthy Diet Fact Sheet N°394" in titles
        assert "The Eatwell Guide: Helping you eat a healthy, balanced diet" in titles
        assert len(sections) == 2


class TestGroundedSynthesizer:
    """Verify synchronous generation and streaming generation contracts."""

    def test_empty_context_fallback(self):
        synthesizer = get_synthesizer()
        response = synthesizer.generate_grounded_answer(
            query="What are dietary guidelines for camel milk?",
            chunks=[],
        )
        assert response.status == "REFUSAL_NOT_IN_CORPUS"
        assert len(response.searched_documents) == 7

    def test_cross_document_fat_intake(self, mock_chunks):
        synthesizer = get_synthesizer()
        response = synthesizer.generate_grounded_answer(
            query="What are the recommendations on fat intake and cooking oils?",
            chunks=mock_chunks,
        )
        assert response.status == "SUCCESS"
        assert len(response.sections) >= 2
        publishers = [s.publisher for s in response.sections]
        assert "World Health Organization (WHO)" in publishers
        assert "Public Health England / NHS / UK Food Standards Agency" in publishers
        assert len(response.citations) >= 2

    @pytest.mark.asyncio
    async def test_streaming_synthesis(self, mock_chunks):
        synthesizer = get_synthesizer()
        events = []
        async for event in synthesizer.stream_grounded_answer(
            query="What are the recommendations on fat intake?",
            chunks=mock_chunks,
        ):
            events.append(event)

        token_events = [e for e in events if e.get("type") == "token"]
        citation_events = [e for e in events if e.get("type") == "citations"]

        assert len(token_events) > 0
        assert len(citation_events) == 1
        assert len(citation_events[0]["citations"]) >= 2

    def test_groq_gpt_oss_120b_synthesis(self, mock_chunks):
        """Verify synthesis using Groq openai/gpt-oss-120b model configuration."""
        synthesizer = GroundedSynthesizer(provider="groq", model_name="openai/gpt-oss-120b")
        assert synthesizer.provider == "groq"
        assert synthesizer.model_name == "openai/gpt-oss-120b"
        response = synthesizer.generate_grounded_answer(
            query="What are the recommendations on fat intake?",
            chunks=mock_chunks,
        )
        assert response.status == "SUCCESS"
        assert len(response.citations) >= 2

    def test_groq_qwen_36_27b_synthesis(self, mock_chunks):
        """Verify synthesis using Groq qwen/qwen3.6-27b model configuration."""
        synthesizer = GroundedSynthesizer(provider="groq", model_name="qwen/qwen3.6-27b")
        assert synthesizer.provider == "groq"
        assert synthesizer.model_name == "qwen/qwen3.6-27b"
        response = synthesizer.generate_grounded_answer(
            query="What are the recommendations on cooking oil?",
            chunks=mock_chunks,
        )
        assert response.status == "SUCCESS"
        assert len(response.citations) >= 2
