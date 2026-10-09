"""Configuration and environment settings management for Dietary Guidance RAG Chatbot.

Utilizes Pydantic Settings to load and validate application parameters,
paths, similarity thresholds, embedding providers, and model configs.
"""

from pathlib import Path
from typing import Literal, Optional, Dict, Any
from functools import lru_cache
import yaml
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
from src.models.schemas import DocumentMetadata

# Absolute project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings and environment configuration."""

    # Storage and corpus paths (relative to PROJECT_ROOT by default)
    DATA_BLOCKS_PATH: str = Field(
        default="data/blocks.jsonl",
        description="Path to canonical raw blocks dataset."
    )
    CHROMA_PERSIST_DIR: str = Field(
        default="data/vectordb",
        description="Persistent directory path for ChromaDB vector store."
    )
    CORPUS_REGISTRY_PATH: str = Field(
        default="config/corpus_registry.yaml",
        description="Path to YAML registry containing document provenance metadata."
    )

    # Retrieval and similarity calibration
    SIMILARITY_THRESHOLD: float = Field(
        default=0.53,
        description="Cosine similarity cutoff threshold (tau_relevance) for information gap detection."
    )
    RETRIEVAL_TOP_K: int = Field(
        default=6,
        description="Number of top relevant chunks to retrieve for synthesis."
    )

    # Embedding provider configuration
    EMBEDDING_PROVIDER: Literal["local", "gemini"] = Field(
        default="local",
        description="Embedding model provider: 'local' (SentenceTransformers) or 'gemini' (Google GenAI)."
    )
    EMBEDDING_MODEL_NAME: str = Field(
        default="all-MiniLM-L6-v2",
        description="Embedding model identifier: 'all-MiniLM-L6-v2' (local) or 'text-embedding-004' (gemini)."
    )

    # LLM Provider configuration (Groq by default)
    LLM_PROVIDER: Literal["groq", "gemini"] = Field(
        default="groq",
        description="LLM provider for grounded synthesis ('groq' or 'gemini')."
    )
    GROQ_MODEL: str = Field(
        default="openai/gpt-oss-120b",
        description="Default Groq model identifier ('openai/gpt-oss-120b' or 'qwen/qwen3.6-27b')."
    )
    GROQ_API_KEY: Optional[str] = Field(
        default=None,
        description="API key for Groq Cloud services."
    )

    # Google Gemini LLM configuration (Fallback / Legacy)
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Default Gemini model identifier for grounded synthesis."
    )
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="API key for Google Gemini GenAI services."
    )

    # API Gateway configuration
    FASTAPI_HOST: str = Field(
        default="0.0.0.0",
        description="Host interface for FastAPI gateway server."
    )
    FASTAPI_PORT: int = Field(
        default=8000,
        validation_alias=AliasChoices("PORT", "FASTAPI_PORT"),
        description="Port for FastAPI gateway server (accepts Railway dynamic $PORT or FASTAPI_PORT)."
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Runtime environment: 'development', 'testing', or 'production'."
    )
    DEBUG: bool = Field(
        default=False,
        description="Debug flag for FastAPI diagnostics and verbosity."
    )

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_data_blocks_path(self) -> Path:
        """Resolve absolute path to data/blocks.jsonl."""
        path = Path(self.DATA_BLOCKS_PATH)
        return path if path.is_absolute() else PROJECT_ROOT / path

    def get_chroma_persist_dir(self) -> Path:
        """Resolve absolute path to vector store directory."""
        path = Path(self.CHROMA_PERSIST_DIR)
        return path if path.is_absolute() else PROJECT_ROOT / path

    def get_corpus_registry_path(self) -> Path:
        """Resolve absolute path to config/corpus_registry.yaml."""
        path = Path(self.CORPUS_REGISTRY_PATH)
        return path if path.is_absolute() else PROJECT_ROOT / path


@lru_cache()
def get_settings() -> Settings:
    """Retrieve cached application settings instance."""
    return Settings()


# Singleton instance for direct imports
settings = get_settings()


@lru_cache()
def get_corpus_registry(registry_path: Optional[Path] = None) -> Dict[str, DocumentMetadata]:
    """Load, validate, and return the authoritative document registry.
    
    Args:
        registry_path: Optional custom Path to corpus_registry.yaml.
        
    Returns:
        Dict mapping canonical document_id to DocumentMetadata.
        
    Raises:
        FileNotFoundError: If the registry file does not exist.
        ValueError: If documents are missing or invalid.
    """
    path = registry_path or settings.get_corpus_registry_path()
    if not path.exists():
        raise FileNotFoundError(f"Corpus registry file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    raw_docs = data.get("documents", {}) if isinstance(data, dict) else {}
    if not raw_docs:
        raise ValueError(f"No documents defined in corpus registry at: {path}")

    registry: Dict[str, DocumentMetadata] = {}
    for doc_id, meta in raw_docs.items():
        record = DocumentMetadata(
            document_id=doc_id,
            title=meta["title"],
            publisher=meta["publisher"],
            year=int(meta["year"]),
            category=meta["category"],
            source_url=meta["source_url"],
            description=meta["description"],
        )
        registry[doc_id] = record

    return registry
