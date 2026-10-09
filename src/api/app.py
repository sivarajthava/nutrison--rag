"""FastAPI Application Factory and Server Lifecycle Management.

Configures:
- Application lifespan handler (pre-warming vector store and corpus registry).
- CORS middleware for Next.js frontend integration.
- Custom structured exception handlers.
- Route mounting for /v1 and root endpoints.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from config.settings import settings, get_corpus_registry
from src.retrieval.vector_store import get_vector_store
from src.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Pre-warm vector store and validate authoritative corpus registry on startup."""
    # Ensure offline mode for sentence-transformers to avoid SSL retries
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    # 1. Validate corpus registry
    registry = get_corpus_registry()
    print(f"[FastAPI Lifespan] Loaded {len(registry)} authoritative documents from corpus registry.")

    # 2. Check vector store collection
    try:
        vs = get_vector_store()
        count = vs.count()
        print(f"[FastAPI Lifespan] ChromaDB initialized: collection='{vs.collection_name}', total_chunks={count}.")
    except Exception as exc:
        print(f"[FastAPI Lifespan] Vector store warning on startup: {exc}")

    yield

    print("[FastAPI Lifespan] Shutting down application gateway.")


def create_app() -> FastAPI:
    """Create and configure the production FastAPI application instance."""
    application = FastAPI(
        title="Dietary Guidance RAG Gateway",
        description=(
            "Authoritative, zero-hallucination public health nutrition and food safety "
            "RAG gateway service with deterministic guardrails and W3C SSE streaming."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS configuration allowing Next.js 15 frontend on local and Vercel domains
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    custom_origins = os.environ.get("ALLOWED_ORIGINS", "")
    if custom_origins:
        origins.extend([o.strip() for o in custom_origins.split(",") if o.strip()])

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https:\/\/.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Structured Exception Handlers
    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        body = exc.body
        if isinstance(body, (bytes, bytearray)):
            body = body.decode("utf-8", errors="replace")
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation Error",
                "detail": exc.errors(),
                "body": body,
            },
        )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "Bad Request" if exc.status_code == 400 else "HTTP Error",
                "detail": exc.detail,
            },
        )

    @application.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": str(exc),
            },
        )

    # Mount routes on /v1 and root
    application.include_router(router, prefix="/v1")
    application.include_router(router)

    return application


# Global application instance for uvicorn
app = create_app()
