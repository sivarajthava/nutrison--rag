"""Grounded LLM Synthesizer and Token Streaming Engine with Groq Orchestration.

Supports high-throughput, low-latency inference on Groq LPU systems:
- Primary Provider: Groq API with openai/gpt-oss-120b or qwen/qwen3.6-27b
- Deterministic Offline Fallback: For testing, network disconnection, or local evaluation
"""

import os
import time
import asyncio
from typing import List, Optional, AsyncIterator, Dict, Any, Literal

from config.settings import settings
from src.models.schemas import Chunk, ChatResponse, Citation, GroundedSection
from src.guardrails.refusal_handlers import build_not_in_corpus_refusal
from src.generation.prompt_templates import (
    GROUNDED_SYSTEM_PROMPT,
    format_synthesis_user_prompt,
)
from src.generation.citation_formatter import (
    extract_and_validate_citations,
    format_citation_string,
)


class GroundedSynthesizer:
    """Synthesizes strictly grounded responses using Groq with strict constraints."""

    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.provider = (provider or settings.LLM_PROVIDER).lower()
        self.model_name = model_name or settings.GROQ_MODEL
        self.api_key = api_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")

        self._groq_client = None
        self._async_groq_client = None

    def _get_groq_client(self):
        """Lazily initialize synchronous Groq client."""
        if self._groq_client is None and self.api_key:
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=self.api_key)
            except Exception:
                self._groq_client = None
        return self._groq_client

    def _get_async_groq_client(self):
        """Lazily initialize asynchronous Groq client."""
        if self._async_groq_client is None and self.api_key:
            try:
                from groq import AsyncGroq
                self._async_groq_client = AsyncGroq(api_key=self.api_key)
            except Exception:
                self._async_groq_client = None
        return self._async_groq_client

    def generate_grounded_answer(
        self,
        query: str,
        chunks: List[Chunk],
    ) -> ChatResponse:
        """Generate a complete, grounded answer with citations and sections.
        
        Args:
            query: Original user inquiry.
            chunks: List of retrieved context chunks meeting the threshold.
            
        Returns:
            ChatResponse populated with response_text, sections, and citations.
        """
        start_time = time.perf_counter()

        # If no chunks provided, trigger Refusal 1 (Corpus Gap)
        if not chunks:
            refusal = build_not_in_corpus_refusal(query)
            refusal.latency_ms = int((time.perf_counter() - start_time) * 1000)
            return refusal

        raw_text = ""
        user_prompt = format_synthesis_user_prompt(query, chunks)

        # 1. Execute via Groq
        try:
            client = self._get_groq_client()
            if client is not None:
                completion = client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": GROUNDED_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.1,
                )
                raw_text = completion.choices[0].message.content or ""
            else:
                raw_text = self._fallback_deterministic_synthesis(query, chunks)
        except Exception:
            raw_text = self._fallback_deterministic_synthesis(query, chunks)

        response_text, citations, sections = extract_and_validate_citations(raw_text, chunks)

        searched_docs = list({c.document_title for c in chunks})
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        return ChatResponse(
            status="SUCCESS",
            query=query,
            response_text=response_text,
            sections=sections,
            citations=citations,
            searched_documents=searched_docs,
            latency_ms=latency_ms,
        )

    async def stream_grounded_answer(
        self,
        query: str,
        chunks: List[Chunk],
    ) -> AsyncIterator[Dict[str, Any]]:
        """Asynchronously stream answer tokens and yield final citations and telemetry.
        
        Yields:
            Dict events:
                - {"type": "token", "delta": str}
                - {"type": "citations", "citations": List[Citation], "sections": List[GroundedSection]}
        """
        if not chunks:
            return

        user_prompt = format_synthesis_user_prompt(query, chunks)

        # 1. Stream via Groq
        if self.provider == "groq":
            try:
                async_client = self._get_async_groq_client()
                if async_client is not None:
                    stream = await async_client.chat.completions.create(
                        model=self.model_name,
                        messages=[
                            {"role": "system", "content": GROUNDED_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=0.1,
                        stream=True,
                    )

                    full_text_accum = []
                    async for chunk in stream:
                        delta = chunk.choices[0].delta.content or ""
                        if delta:
                            full_text_accum.append(delta)
                            yield {"type": "token", "delta": delta}

                    full_text = "".join(full_text_accum)
                    _, citations, sections = extract_and_validate_citations(full_text, chunks)
                    yield {"type": "citations", "citations": citations, "sections": sections}
                    return
            except Exception:
                pass  # Fall through to offline stream

        # 2. Deterministic offline streaming simulation
        offline_text = self._fallback_deterministic_synthesis(query, chunks)
        words = offline_text.split(" ")
        for i, word in enumerate(words):
            delta = word if i == len(words) - 1 else word + " "
            yield {"type": "token", "delta": delta}
            await asyncio.sleep(0.005)

        _, citations, sections = extract_and_validate_citations(offline_text, chunks)
        yield {"type": "citations", "citations": citations, "sections": sections}

    def _fallback_deterministic_synthesis(self, query: str, chunks: List[Chunk]) -> str:
        """Construct grounded, publisher-segregated response text offline."""
        from collections import OrderedDict
        grouped: Dict[str, List[Chunk]] = OrderedDict()
        for c in chunks:
            grouped.setdefault(c.publisher, []).append(c)

        sections = []
        for pub, pub_chunks in grouped.items():
            first = pub_chunks[0]
            header = f"### {pub}\n"
            
            body_parts = []
            for c in pub_chunks:
                citation_str = format_citation_string(c)
                clean_content = c.content.strip()
                body_parts.append(f"{clean_content} {citation_str}")

            section_text = f"{header}\n\n" + "\n\n".join(body_parts)
            sections.append(section_text)

        return "\n\n".join(sections)


# Module-level singleton
_default_synthesizer: Optional[GroundedSynthesizer] = None


def get_synthesizer(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> GroundedSynthesizer:
    """Retrieve or initialize GroundedSynthesizer instance."""
    global _default_synthesizer
    if provider or model_name or api_key:
        return GroundedSynthesizer(provider=provider, model_name=model_name, api_key=api_key)
    if _default_synthesizer is None:
        _default_synthesizer = GroundedSynthesizer()
    return _default_synthesizer
