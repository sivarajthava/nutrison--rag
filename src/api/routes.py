"""FastAPI REST and Server-Sent Events (SSE) Route Endpoints.

Implements:
- GET /v1/health: Vector store diagnostics and service health.
- GET /v1/documents: Authoritative corpus registry catalog.
- GET /v1/documents/{document_id}: Single document metadata lookup.
- POST /v1/chat: Synchronous REST endpoint executing guardrails, retrieval, and synthesis.
- POST /v1/chat/stream: Asynchronous SSE streaming protocol.
"""

import time
import json
import asyncio
from typing import List, Dict, Any, Optional, AsyncIterator
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config.settings import settings, get_corpus_registry
from src.models.schemas import (
    BlockRecord,
    Chunk,
    DocumentMetadata,
    ChatRequest,
    ChatResponse,
    RefusalResponse,
    SSEStatusData,
    SSETokenData,
    SSECitationsData,
    SSERefusalData,
    SSEDoneData,
    SSEErrorData,
    RetrievalDebugRequest,
    RetrievalDebugResponse,
    GuardrailCheckRequest,
    GuardrailCheckResponse,
)
from src.ingestion.block_reader import read_blocks
from src.ingestion.block_chunker import HierarchyChunker
from src.guardrails.safety_filter import check_safety_guardrail
from src.guardrails.refusal_handlers import (
    build_out_of_scope_refusal,
    get_out_of_scope_refusal_payload,
    build_not_in_corpus_refusal,
    get_not_in_corpus_refusal_payload,
)
from src.retrieval.retriever import retrieve_chunks, get_retriever
from src.retrieval.vector_store import get_vector_store
from src.generation.synthesizer import get_synthesizer

router = APIRouter(tags=["Chatbot & Guidance API"])

_cached_blocks: Optional[List[BlockRecord]] = None
_cached_chunks: Optional[List[Chunk]] = None


def get_cached_blocks() -> List[BlockRecord]:
    global _cached_blocks
    if _cached_blocks is None:
        _cached_blocks = list(read_blocks())
    return _cached_blocks


def get_cached_chunks() -> List[Chunk]:
    global _cached_chunks
    if _cached_chunks is None:
        chunker = HierarchyChunker()
        _cached_chunks = chunker.assemble_chunks(get_cached_blocks())
    return _cached_chunks



def format_sse(event: str, data: Any) -> str:
    """Format SSE event wire format: event: <type>\\ndata: <json>\\n\\n."""
    if isinstance(data, BaseModel):
        data_str = data.model_dump_json()
    elif isinstance(data, dict):
        data_str = json.dumps(data)
    else:
        data_str = str(data)
    return f"event: {event}\ndata: {data_str}\n\n"


@router.get("/health", summary="Health Check & Vector Store Telemetry")
def get_health() -> Dict[str, Any]:
    """Return runtime service health and ChromaDB vector store statistics."""
    try:
        vs = get_vector_store()
        total_chunks = vs.count()
    except Exception as exc:
        total_chunks = -1

    registry = get_corpus_registry()

    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "vector_store": {
            "collection_name": vs.collection_name if 'vs' in locals() else "unknown",
            "total_chunks": total_chunks,
        },
        "corpus_documents_count": len(registry),
    }


@router.get("/documents", response_model=List[DocumentMetadata], summary="Get Authoritative Corpus Catalog")
def get_documents() -> List[DocumentMetadata]:
    """Enumerate the 7 authoritative public health publications in the corpus registry."""
    registry = get_corpus_registry()
    return list(registry.values())


@router.get("/documents/{document_id}", response_model=DocumentMetadata, summary="Get Single Document Metadata")
def get_document(document_id: str) -> DocumentMetadata:
    """Lookup authoritative metadata for a specific document_id."""
    registry = get_corpus_registry()
    if document_id not in registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found in corpus registry.",
        )
    return registry[document_id]


@router.get("/blocks", response_model=List[BlockRecord], summary="List Corpus Raw Structural Blocks")
def get_blocks(
    document_id: Optional[str] = None,
    block_type: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
) -> List[BlockRecord]:
    """Retrieve raw structural blocks from data/blocks.jsonl with optional filtering."""
    blocks = get_cached_blocks()
    if document_id:
        blocks = [b for b in blocks if b.document_id == document_id]
    if block_type:
        blocks = [b for b in blocks if b.type == block_type]
    if offset > 0:
        blocks = blocks[offset:]
    if limit is not None:
        blocks = blocks[:limit]
    return blocks


@router.get("/chunks", response_model=List[Chunk], summary="List Assembled Corpus Chunks")
def get_chunks(
    document_id: Optional[str] = None,
    chunk_type: Optional[str] = None,
    has_table: Optional[bool] = None,
    limit: Optional[int] = None,
    offset: int = 0,
) -> List[Chunk]:
    """Retrieve assembled chunks across the 7 authoritative publications."""
    chunks = get_cached_chunks()
    if document_id:
        chunks = [c for c in chunks if c.document_id == document_id]
    if chunk_type:
        chunks = [c for c in chunks if c.chunk_type == chunk_type]
    if has_table is not None:
        chunks = [c for c in chunks if c.has_table == has_table]
    if offset > 0:
        chunks = chunks[offset:]
    if limit is not None:
        chunks = chunks[:limit]
    return chunks


@router.post("/retrieval/debug", response_model=RetrievalDebugResponse, summary="Debug Vector Retrieval & Similarity")
def debug_retrieval(req: RetrievalDebugRequest) -> RetrievalDebugResponse:
    """Evaluate query cosine similarity and threshold cutoff for diagnostic analysis."""
    retriever = get_retriever()
    chunks, max_sim, _ = retriever.retrieve_chunks(
        query=req.query,
        filter_document_id=req.filter_document_id,
        filter_category=req.filter_category,
        top_k=req.top_k,
        threshold=0.0,
    )
    is_corpus_gap = max_sim < req.threshold or len(chunks) == 0
    meets_threshold = max_sim >= req.threshold and len(chunks) > 0
    return RetrievalDebugResponse(
        query=req.query,
        max_similarity=max_sim,
        threshold=req.threshold,
        is_corpus_gap=is_corpus_gap,
        meets_threshold=meets_threshold,
        chunks=chunks,
    )


@router.post("/guardrails/check", response_model=GuardrailCheckResponse, summary="Test Pre-Retrieval Safety Guardrails")
def check_guardrails_endpoint(req: GuardrailCheckRequest) -> GuardrailCheckResponse:
    """Test user prompt against pre-retrieval deterministic regex rules."""
    violation = check_safety_guardrail(req.query)
    if violation:
        return GuardrailCheckResponse(
            query=req.query,
            violated=True,
            category=violation.category,
            pattern_matched=violation.pattern_matched,
            message=violation.message,
        )
    return GuardrailCheckResponse(
        query=req.query,
        violated=False,
        category=None,
        pattern_matched=None,
        message="Query complies with safety guardrail policy (proceeds to retrieval).",
    )


@router.post("/chat", response_model=ChatResponse, summary="Synchronous Grounded Chat")
def chat(request: ChatRequest) -> ChatResponse:
    """Execute end-to-end grounded RAG chat pipeline synchronously.
    
    1. Evaluates pre-retrieval deterministic safety guardrail (Refusal 2).
    2. Executes dual-mode vector retrieval with similarity threshold (Refusal 1).
    3. Performs grounded multi-source segregated synthesis.
    """
    start_time = time.perf_counter()

    # 1. Deterministic Safety Guardrail Check
    violation = check_safety_guardrail(request.query)
    if violation:
        refusal_res = build_out_of_scope_refusal(request.query, violation=violation)
        refusal_res.latency_ms = int((time.perf_counter() - start_time) * 1000)
        return refusal_res

    # 2. Dual-Mode Vector Retrieval
    chunks, max_sim, is_corpus_gap = retrieve_chunks(
        query=request.query,
        filter_document_id=request.filter_document_id,
        filter_category=request.filter_category,
        top_k=request.top_k,
        threshold=request.threshold,
    )

    if is_corpus_gap or not chunks:
        refusal_res = build_not_in_corpus_refusal(request.query)
        refusal_res.latency_ms = int((time.perf_counter() - start_time) * 1000)
        return refusal_res

    # 3. Grounded Synthesis
    synthesizer = get_synthesizer()
    response = synthesizer.generate_grounded_answer(query=request.query, chunks=chunks)
    response.latency_ms = int((time.perf_counter() - start_time) * 1000)
    return response


@router.post("/chat/stream", summary="Real-Time Server-Sent Events (SSE) Stream")
async def chat_stream(request: ChatRequest, raw_request: Request = None) -> StreamingResponse:
    """Stream response tokens and lifecycle events via W3C compliant Server-Sent Events."""
    
    async def event_generator() -> AsyncIterator[str]:
        start_time = time.perf_counter()
        try:
            if raw_request is not None and await raw_request.is_disconnected():
                return

            # Stage 1: Safety Guardrails
            yield format_sse("status", SSEStatusData(stage="safety_check"))
            await asyncio.sleep(0)

            violation = check_safety_guardrail(request.query)
            if violation:
                refusal_payload = get_out_of_scope_refusal_payload(request.query, violation=violation)
                yield format_sse(
                    "refusal",
                    SSERefusalData(
                        status=refusal_payload.status,
                        type=refusal_payload.type or "OUT_OF_SCOPE_BY_DESIGN",
                        message=refusal_payload.message,
                        searched_documents=refusal_payload.searched_documents,
                        suggested_action=refusal_payload.suggested_action,
                    ),
                )
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                yield format_sse("done", SSEDoneData(latency_ms=latency_ms, chunks_retrieved=0))
                return

            # Stage 2: Retrieval
            yield format_sse("status", SSEStatusData(stage="retrieving"))
            await asyncio.sleep(0)

            if raw_request is not None and await raw_request.is_disconnected():
                return

            loop = asyncio.get_running_loop()
            chunks, max_sim, is_corpus_gap = await loop.run_in_executor(
                None,
                lambda: retrieve_chunks(
                    query=request.query,
                    filter_document_id=request.filter_document_id,
                    filter_category=request.filter_category,
                    top_k=request.top_k,
                    threshold=request.threshold,
                )
            )

            if is_corpus_gap or not chunks:
                refusal_payload = get_not_in_corpus_refusal_payload(request.query)
                yield format_sse(
                    "refusal",
                    SSERefusalData(
                        status=refusal_payload.status,
                        type=refusal_payload.type or "NOT_IN_CORPUS",
                        message=refusal_payload.message,
                        searched_documents=refusal_payload.searched_documents,
                        suggested_action=refusal_payload.suggested_action,
                    ),
                )
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                yield format_sse("done", SSEDoneData(latency_ms=latency_ms, chunks_retrieved=0))
                return

            # Stage 3: Synthesizing
            if raw_request is not None and await raw_request.is_disconnected():
                return

            yield format_sse("status", SSEStatusData(stage="synthesizing"))
            await asyncio.sleep(0)

            synthesizer = get_synthesizer()
            async for event in synthesizer.stream_grounded_answer(request.query, chunks):
                if raw_request is not None and await raw_request.is_disconnected():
                    return
                event_type = event.get("type")
                if event_type == "token":
                    yield format_sse("token", SSETokenData(delta=event["delta"]))
                elif event_type == "citations":
                    yield format_sse(
                        "citations",
                        SSECitationsData(
                            citations=event.get("citations", []),
                            sections=event.get("sections", []),
                        ),
                    )

            latency_ms = int((time.perf_counter() - start_time) * 1000)
            yield format_sse("done", SSEDoneData(latency_ms=latency_ms, chunks_retrieved=len(chunks)))

        except (asyncio.CancelledError, GeneratorExit):
            # Client disconnected or cancelled stream; exit cleanly to conserve resources
            return
        except Exception as exc:
            yield format_sse("error", SSEErrorData(message=str(exc), code="INTERNAL_STREAM_ERROR"))
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            yield format_sse("done", SSEDoneData(latency_ms=latency_ms, chunks_retrieved=0))

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream; charset=utf-8", headers=headers)
