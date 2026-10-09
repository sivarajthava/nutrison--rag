"""Authoritative Prompt Templates and Context Segregation Formatting.

Implements strict negative constraints, multi-document publisher segregation,
and standardized citation requirements for the LLM synthesizer.
"""

from typing import List, Dict
from collections import OrderedDict
from src.models.schemas import Chunk

GROUNDED_SYSTEM_PROMPT = """You are an authoritative Dietary and Food Safety Guidance Assistant.
Your answers are STRICTLY grounded in the provided context excerpts.

RULES:
1. Grounding: Answer ONLY based on the provided context chunks. NEVER use external or parametric knowledge.
2. Citation Requirement: Every recommendation or factual claim MUST include an exact inline citation in this format:
   [Document Title | Publisher, Year | Source URL]
3. Multi-Document Structure: If context chunks come from multiple publications or publishers, you MUST structure your answer into separate, clearly labeled markdown sections per publication (e.g. "### Healthy Diet Fact Sheet N°394 (World Health Organization)"). NEVER combine statements from different publishers into a generic or blended consensus statement like "The guidelines recommend...".
4. Negative Constraint: Do not give personalized medical advice, individual calorie prescriptions, or target body weight plans.
5. Missing Details: If the context only partially covers the inquiry, state clearly what is known from the authoritative sources and what is missing.
"""


def format_segregated_context(chunks: List[Chunk]) -> str:
    """Format and group retrieved chunks strictly by document_id and publisher.
    
    Prevents source blending by presenting clean, demarcated context blocks.
    
    Args:
        chunks: List of retrieved Chunk objects.
        
    Returns:
        Formatted context string with explicit document boundaries.
    """
    if not chunks:
        return "No relevant context excerpts available."

    # Group chunks preserving first-seen document order
    grouped: Dict[str, List[Chunk]] = OrderedDict()
    for chunk in chunks:
        grouped.setdefault(chunk.document_id, []).append(chunk)

    sections = []
    for doc_id, doc_chunks in grouped.items():
        first = doc_chunks[0]
        header = (
            f"=== SOURCE: {first.document_title} ({first.publisher}, {first.year}) ===\n"
            f"Canonical URL: {first.source_url}\n"
            f"Category: {first.category}"
        )

        chunk_texts = []
        for c in doc_chunks:
            table_info = f" [Table: {c.table_caption or c.sub_label}]" if c.has_table else ""
            heading_info = f"[Section: {c.section_heading}{table_info}] (Chunk: {c.chunk_id})"
            chunk_texts.append(f"{heading_info}\n{c.content.strip()}")

        body = "\n\n".join(chunk_texts)
        sections.append(f"{header}\n\n{body}\n=== END SOURCE: {first.document_title} ===")

    return "\n\n" + ("\n\n" + "-" * 60 + "\n\n").join(sections) + "\n\n"


def format_synthesis_user_prompt(query: str, chunks: List[Chunk]) -> str:
    """Construct complete user prompt combining inquiry and segregated evidence.
    
    Args:
        query: User prompt query string.
        chunks: Retrieved context chunks.
        
    Returns:
        Structured user prompt string.
    """
    context_str = format_segregated_context(chunks)
    return (
        f"USER QUESTION: {query}\n\n"
        f"AUTHORITATIVE CONTEXT EXCERPTS:{context_str}\n\n"
        f"Please provide an accurate, grounded answer addressing the user's question. "
        f"Remember to cite each claim with [Document Title | Publisher, Year | Source URL] "
        f"and create separate labeled sections for each distinct publication."
    )
