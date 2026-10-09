"""Authoritative Pydantic Data Contracts for Dietary Guidance RAG Chatbot.

Defines schemas for blocks, corpus metadata, chunks, retrieval results,
citations, chat requests/responses, guardrail refusals, and SSE streaming events.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, model_validator


# ==============================================================================
# 1. Corpus & Ingestion Data Contracts
# ==============================================================================

class BlockRecord(BaseModel):
    """Schema matching canonical records in data/blocks.jsonl.
    
    Validates all 1,001 structural blocks across the 7 authoritative publications.
    """
    document_id: str = Field(..., description="Canonical document identifier string.")
    ordinal: int = Field(..., ge=0, description="Sequential zero-indexed integer within document.")
    type: Literal["heading", "paragraph", "list_item", "table"] = Field(
        ..., description="Structural category of the block."
    )
    text: str = Field(..., description="Markdown-formatted string representation.")
    heading_path: List[str] = Field(
        default_factory=list, description="Breadcrumb strings (depth 1 to 4)."
    )
    level: Optional[int] = Field(
        default=None, ge=1, le=6, description="Heading depth level (1 through 6) for heading blocks."
    )
    page: Optional[int] = Field(
        default=None, ge=1, description="Page number for PDF-derived documents; None for web sources."
    )
    caption: Optional[str] = Field(
        default=None, description="Explicit caption for table blocks."
    )
    header: Optional[List[str]] = Field(
        default=None, description="Column names list for table blocks."
    )
    rows: Optional[List[List[str]]] = Field(
        default=None, description="2D list of row cells for table blocks."
    )

    def to_chroma_metadata(self, doc_meta: Optional[Any] = None) -> Dict[str, Any]:
        """Serialize block metadata into ChromaDB-compatible primitive scalar types."""
        return {
            "block_id": f"{self.document_id}_block_{self.ordinal}",
            "document_id": self.document_id,
            "ordinal": self.ordinal,
            "block_type": self.type,
            "section_heading": " > ".join(self.heading_path) if self.heading_path else "",
            "level": self.level if self.level is not None else -1,
            "page": self.page if self.page is not None else -1,
            "has_table": self.type == "table",
            "caption": self.caption or "",
            "document_title": doc_meta.title if (doc_meta and hasattr(doc_meta, "title")) else self.document_id,
            "publisher": doc_meta.publisher if (doc_meta and hasattr(doc_meta, "publisher")) else "",
            "year": doc_meta.year if (doc_meta and hasattr(doc_meta, "year")) else 0,
            "category": doc_meta.category if (doc_meta and hasattr(doc_meta, "category")) else "",
            "source_url": doc_meta.source_url if (doc_meta and hasattr(doc_meta, "source_url")) else "",
        }

    def to_search_text(self, doc_meta: Optional[Any] = None) -> str:
        """Format block content with breadcrumbs for dense embedding search."""
        doc_title = doc_meta.title if (doc_meta and hasattr(doc_meta, "title")) else self.document_id
        heading_str = " > ".join(self.heading_path) if self.heading_path else ""
        if self.type == "table" and self.caption:
            return f"[Document: {doc_title} | Section: {heading_str} | Table: {self.caption}]\n\n{self.text}"
        elif heading_str:
            return f"[Document: {doc_title} | Section: {heading_str}]\n\n{self.text}"
        else:
            return f"[Document: {doc_title}]\n\n{self.text}"



class DocumentMetadata(BaseModel):
    """Authoritative metadata record from config/corpus_registry.yaml."""
    document_id: Optional[str] = Field(default=None, description="Canonical document identifier string.")
    title: str = Field(..., description="Full authoritative title of the publication.")
    publisher: str = Field(..., description="Responsible public health / food safety agency.")
    year: int = Field(..., description="Year of publication.")
    category: Literal["nutrition", "food_safety"] = Field(
        ..., description="Classification category."
    )
    source_url: str = Field(..., description="Verifiable canonical source URL.")
    description: str = Field(..., description="Scope and synopsis of the document contents.")


# ==============================================================================
# 2. Chunking & Assembly Data Contracts
# ==============================================================================

class Chunk(BaseModel):
    """Assembly unit produced by BlockChunker for dense indexing and retrieval."""
    chunk_id: str = Field(..., description="Deterministic unique identifier.")
    document_id: str = Field(..., description="Canonical document ID matching registry.")
    document_title: str = Field(..., description="Authoritative publication title.")
    document_name: Optional[str] = Field(
        default=None, description="Alias for document_title for cross-spec compatibility."
    )
    publisher: str = Field(..., description="Authoritative publisher name.")
    year: int = Field(..., description="Publication year.")
    category: Literal["nutrition", "food_safety"] = Field(
        ..., description="Document domain category."
    )
    source_url: str = Field(..., description="Canonical reference URL.")
    content: str = Field(..., description="Enriched markdown text ready for embedding and LLM context.")
    section_heading: str = Field(
        ..., description="Joined breadcrumb string (e.g., 'Category > Section')."
    )
    block_ordinals: List[int] = Field(
        default_factory=list, description="List of source block ordinals merged into this chunk."
    )
    min_ordinal: int = Field(..., ge=0, description="Lowest source block ordinal.")
    max_ordinal: int = Field(..., ge=0, description="Highest source block ordinal.")
    page_start: Optional[int] = Field(default=None, description="Earliest page number, if applicable.")
    page_end: Optional[int] = Field(default=None, description="Latest page number, if applicable.")
    page_numbers: List[int] = Field(
        default_factory=list, description="Unique sorted page numbers contributing to chunk."
    )
    chunk_type: Literal["table", "prose", "list"] = Field(
        default="prose", description="Dominant structural content type."
    )
    has_table: bool = Field(default=False, description="Flag indicating whether chunk contains tabular data.")
    table_caption: Optional[str] = Field(default=None, description="Table caption or sub-table title.")
    sub_label: Optional[str] = Field(default=None, description="Segment or sub-table descriptive label.")
    similarity_score: Optional[float] = Field(
        default=None, description="Cosine similarity score populated at retrieval time."
    )

    @model_validator(mode="after")
    def sync_document_name(self) -> "Chunk":
        if not self.document_name:
            self.document_name = self.document_title
        elif not self.document_title:
            self.document_title = self.document_name
        return self

    def to_chroma_metadata(self) -> Dict[str, Any]:
        """Serialize chunk metadata into ChromaDB-compatible primitive scalar types."""
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "document_title": self.document_title,
            "publisher": self.publisher,
            "year": self.year,
            "category": self.category,
            "source_url": self.source_url,
            "section_heading": self.section_heading,
            "min_ordinal": self.min_ordinal,
            "max_ordinal": self.max_ordinal,
            "block_ordinals": ",".join(str(o) for o in self.block_ordinals),
            "page_start": self.page_start if self.page_start is not None else -1,
            "page_end": self.page_end if self.page_end is not None else -1,
            "chunk_type": self.chunk_type,
            "has_table": self.has_table,
            "table_caption": self.table_caption or "",
            "sub_label": self.sub_label or "",
        }

    @classmethod
    def from_chroma_metadata(
        cls,
        metadata: Dict[str, Any],
        document: str,
        similarity_score: Optional[float] = None,
    ) -> "Chunk":
        """Reconstruct a typed Chunk instance from ChromaDB metadata and document text."""
        raw_ordinals = metadata.get("block_ordinals", "")
        if isinstance(raw_ordinals, str) and raw_ordinals.strip():
            block_ordinals = [int(o.strip()) for o in raw_ordinals.split(",") if o.strip().isdigit()]
        elif isinstance(raw_ordinals, list):
            block_ordinals = [int(o) for o in raw_ordinals]
        else:
            block_ordinals = []

        page_start = metadata.get("page_start")
        if page_start == -1 or page_start is None:
            page_start = None
        else:
            page_start = int(page_start)

        page_end = metadata.get("page_end")
        if page_end == -1 or page_end is None:
            page_end = None
        else:
            page_end = int(page_end)

        return cls(
            chunk_id=metadata["chunk_id"],
            document_id=metadata["document_id"],
            document_title=metadata.get("document_title") or metadata.get("document_name", ""),
            publisher=metadata.get("publisher", ""),
            year=int(metadata.get("year", 0)),
            category=metadata.get("category", "food_safety"),
            source_url=metadata.get("source_url", ""),
            content=document,
            section_heading=metadata.get("section_heading", ""),
            block_ordinals=block_ordinals,
            min_ordinal=int(metadata.get("min_ordinal", block_ordinals[0] if block_ordinals else 0)),
            max_ordinal=int(metadata.get("max_ordinal", block_ordinals[-1] if block_ordinals else 0)),
            page_start=page_start,
            page_end=page_end,
            chunk_type=metadata.get("chunk_type", "prose"),
            has_table=bool(metadata.get("has_table", False)),
            table_caption=metadata.get("table_caption") or None,
            sub_label=metadata.get("sub_label") or None,
            similarity_score=similarity_score,
        )



# ==============================================================================
# 3. Citation & Provenance Data Contracts
# ==============================================================================

class Citation(BaseModel):
    """Verifiable citation linking synthesis claims to source evidence."""
    document_title: str = Field(..., description="Title of the authoritative publication.")
    document_name: Optional[str] = Field(
        default=None, description="Alias for document_title."
    )
    publisher: str = Field(..., description="Publishing organization.")
    year: int = Field(..., description="Publication year.")
    source_url: str = Field(..., description="Canonical source URL.")
    section_heading: str = Field(..., description="Hierarchy breadcrumb section.")
    chunk_id: Optional[str] = Field(default=None, description="Originating chunk identifier.")
    verbatim_text: Optional[str] = Field(
        default=None, description="Exact evidentiary excerpt from the source chunk."
    )
    similarity_score: Optional[float] = Field(
        default=None, description="Retrieved chunk similarity score."
    )

    @model_validator(mode="after")
    def sync_citation_title(self) -> "Citation":
        if not self.document_name:
            self.document_name = self.document_title
        elif not self.document_title:
            self.document_title = self.document_name
        return self

    @property
    def formatted_citation(self) -> str:
        """Standard formatted citation string: [Title | Publisher, Year | URL]."""
        return f"[{self.document_title} | {self.publisher}, {self.year} | {self.source_url}]"


class GroundedSection(BaseModel):
    """Segregated synthesis content grouped strictly by authoritative source."""
    publisher: str = Field(..., description="Publishing agency for this section.")
    document_title: str = Field(..., description="Authoritative document title.")
    document_name: Optional[str] = Field(default=None, description="Alias for document_title.")
    source_url: str = Field(..., description="Canonical source URL.")
    content: Optional[str] = Field(default=None, description="Section markdown body text.")
    summary_text: Optional[str] = Field(
        default=None, description="Summary or narrative text for this section."
    )
    citations: List[Citation] = Field(
        default_factory=list, description="Citations supporting statements in this section."
    )

    @model_validator(mode="after")
    def sync_section_fields(self) -> "GroundedSection":
        if not self.document_name:
            self.document_name = self.document_title
        elif not self.document_title:
            self.document_title = self.document_name
        if not self.content and self.summary_text:
            self.content = self.summary_text
        elif not self.summary_text and self.content:
            self.summary_text = self.content
        return self


# ==============================================================================
# 4. Chat & Guardrail Request / Response Data Contracts
# ==============================================================================

class ChatRequest(BaseModel):
    """User inquiry payload for REST and SSE chat endpoints."""
    query: str = Field(..., min_length=1, max_length=1000, description="User question or inquiry.")
    filter_document_id: Optional[str] = Field(
        default=None, description="Optional document ID to scope retrieval to a single publication."
    )
    filter_category: Optional[Literal["nutrition", "food_safety"]] = Field(
        default=None, description="Optional category filter ('nutrition' or 'food_safety')."
    )
    top_k: Optional[int] = Field(
        default=None, description="Optional number of top candidate chunks to retrieve."
    )
    threshold: Optional[float] = Field(
        default=None, description="Optional similarity threshold cutoff override."
    )


class ChatResponse(BaseModel):
    """Synchronous REST response contract for /v1/chat."""
    status: Literal["SUCCESS", "REFUSAL_NOT_IN_CORPUS", "REFUSAL_OUT_OF_SCOPE"] = Field(
        ..., description="Execution outcome status."
    )
    query: str = Field(..., description="Original user prompt.")
    response_text: str = Field(..., description="Markdown response text.")
    sections: List[GroundedSection] = Field(
        default_factory=list, description="Per-document segregated synthesis sections."
    )
    citations: List[Citation] = Field(
        default_factory=list, description="Deduplicated list of citations."
    )
    searched_documents: List[str] = Field(
        default_factory=list, description="List of document titles or IDs included in search."
    )
    latency_ms: Optional[int] = Field(
        default=None, description="End-to-end processing latency in milliseconds."
    )


class RefusalResponse(BaseModel):
    """Deterministic refusal response contract."""
    status: Literal["REFUSAL_NOT_IN_CORPUS", "REFUSAL_OUT_OF_SCOPE"] = Field(
        ..., description="Refusal status identifier."
    )
    type: Optional[Literal["NOT_IN_CORPUS", "OUT_OF_SCOPE_BY_DESIGN"]] = Field(
        default=None, description="Granular refusal reason code."
    )
    message: str = Field(..., description="Authoritative refusal message.")
    searched_documents: List[str] = Field(
        default_factory=list, description="Enumeration of queried publications (Refusal 1)."
    )
    suggested_action: Optional[str] = Field(
        default=None, description="Recommended next action or guidance disclaimer."
    )

    @model_validator(mode="after")
    def sync_type_status(self) -> "RefusalResponse":
        if self.type is None:
            if self.status == "REFUSAL_NOT_IN_CORPUS":
                self.type = "NOT_IN_CORPUS"
            elif self.status == "REFUSAL_OUT_OF_SCOPE":
                self.type = "OUT_OF_SCOPE_BY_DESIGN"
        return self


# ==============================================================================
# 5. Server-Sent Events (SSE) Streaming Contracts
# ==============================================================================

class SSEStatusData(BaseModel):
    """Payload for SSE status events: event: status."""
    stage: Literal["safety_check", "retrieving", "synthesizing"] = Field(
        ..., description="Active pipeline stage."
    )


class SSETokenData(BaseModel):
    """Payload for SSE token delta events: event: token."""
    delta: str = Field(..., description="Incremental text token delta.")


class SSECitationsData(BaseModel):
    """Payload for SSE citations events: event: citations."""
    citations: List[Citation] = Field(
        default_factory=list, description="Retrieved citations list."
    )
    sections: List[GroundedSection] = Field(
        default_factory=list, description="Segregated multi-document sections."
    )


class SSERefusalData(BaseModel):
    """Payload for SSE refusal events: event: refusal."""
    status: Literal["REFUSAL_NOT_IN_CORPUS", "REFUSAL_OUT_OF_SCOPE"] = Field(
        ..., description="Refusal status code."
    )
    type: Literal["NOT_IN_CORPUS", "OUT_OF_SCOPE_BY_DESIGN"] = Field(
        ..., description="Refusal category."
    )
    message: str = Field(..., description="Refusal narrative message.")
    searched_documents: List[str] = Field(
        default_factory=list, description="Queried document titles."
    )
    suggested_action: Optional[str] = Field(
        default=None, description="Suggested next steps or medical disclaimer."
    )


class SSEDoneData(BaseModel):
    """Payload for SSE completion events: event: done."""
    latency_ms: int = Field(..., ge=0, description="Total pipeline latency in ms.")
    chunks_retrieved: int = Field(default=0, ge=0, description="Total relevant chunks retrieved.")


class SSEErrorData(BaseModel):
    """Payload for SSE error events: event: error."""
    message: str = Field(..., description="Error message description.")
    code: Optional[str] = Field(default=None, description="Machine-readable error code.")


# ==============================================================================
# 6. Diagnostic & Explorer Contracts
# ==============================================================================

class RetrievalDebugRequest(BaseModel):
    """Payload for testing similarity and threshold cutoff in diagnostic explorer."""
    query: str = Field(..., min_length=1, description="Query string to evaluate.")
    filter_document_id: Optional[str] = Field(default=None, description="Optional document filter.")
    filter_category: Optional[Literal["nutrition", "food_safety"]] = Field(
        default=None, description="Optional category filter."
    )
    top_k: int = Field(default=6, ge=1, le=20, description="Candidate chunks count.")
    threshold: float = Field(default=0.53, ge=0.0, le=1.0, description="Similarity threshold cutoff.")


class RetrievalDebugResponse(BaseModel):
    """Response payload for diagnostic retrieval evaluation."""
    query: str = Field(..., description="Query evaluated.")
    max_similarity: float = Field(..., description="Peak cosine similarity observed.")
    threshold: float = Field(..., description="Cutoff threshold used.")
    is_corpus_gap: bool = Field(..., description="Whether peak similarity was below threshold.")
    meets_threshold: bool = Field(..., description="Whether top result meets threshold.")
    chunks: List[Chunk] = Field(default_factory=list, description="Top candidate chunks.")


class GuardrailCheckRequest(BaseModel):
    """Payload for live regex guardrail pattern testing."""
    query: str = Field(..., min_length=1, description="Query to test against safety patterns.")


class GuardrailCheckResponse(BaseModel):
    """Response payload for guardrail pattern matcher."""
    query: str = Field(..., description="Tested query.")
    violated: bool = Field(..., description="Whether safety guardrail was triggered.")
    category: Optional[str] = Field(default=None, description="Category of violation.")
    pattern_matched: Optional[str] = Field(default=None, description="Specific substring matched by regex.")
    message: str = Field(..., description="Policy response explanation.")

