"""ChromaDB Vector Store Manager and Embedding Provider Abstraction.

Implements persistent local storage in data/vectordb/ using cosine distance space,
supporting dual embedding providers:
- Provider A (Default Local Offline): sentence-transformers/all-MiniLM-L6-v2 (dim 384)
- Provider B (Cloud Precision): Google Gemini text-embedding-004 (dim 768)
"""

import os
from pathlib import Path
from typing import List, Optional, Union, Any, Dict
import chromadb
from chromadb.api import ClientAPI
from chromadb.api.models.Collection import Collection
from chromadb.api.types import Documents, Embeddings, EmbeddingFunction
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from config.settings import settings

DEFAULT_COLLECTION_NAME = "dietary_guidance_chunks"
DEFAULT_BLOCKS_COLLECTION_NAME = "dietary_guidance_blocks"


class GeminiEmbeddingFunction(EmbeddingFunction[Documents]):
    """ChromaDB-compatible embedding function for Google Gemini API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "text-embedding-004",
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name
        self._client = None

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def __call__(self, input: Documents) -> Embeddings:
        """Generate dense embeddings for a batch of input documents."""
        if not input:
            return []
        client = self._get_client()
        # Call Gemini embed_content
        response = client.models.embed_content(
            model=self.model_name,
            contents=list(input),
        )
        # response.embeddings is a list of ContentEmbedding objects with .values
        embeddings = [list(e.values) for e in response.embeddings]
        return embeddings


def get_embedding_function(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
) -> EmbeddingFunction[Documents]:
    """Factory creating configured ChromaDB embedding function.
    
    Args:
        provider: 'local' or 'gemini'. Defaults to settings.EMBEDDING_PROVIDER.
        model_name: Model name identifier. Defaults to settings.EMBEDDING_MODEL_NAME.
        
    Returns:
        Configured EmbeddingFunction instance.
    """
    prov = (provider or settings.EMBEDDING_PROVIDER).lower()
    m_name = model_name or settings.EMBEDDING_MODEL_NAME

    if prov == "gemini":
        return GeminiEmbeddingFunction(
            api_key=settings.GEMINI_API_KEY,
            model_name=m_name if "text-embedding" in m_name else "text-embedding-004",
        )
    else:
        # Default local SentenceTransformers - use local cache to avoid SSL retry delays
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        return SentenceTransformerEmbeddingFunction(
            model_name=m_name if m_name != "text-embedding-004" else "all-MiniLM-L6-v2"
        )


class VectorStoreManager:
    """Manages persistent ChromaDB vector store initialization, collections, and lifecycle."""

    def __init__(
        self,
        persist_dir: Optional[Union[Path, str]] = None,
        collection_name: str = DEFAULT_COLLECTION_NAME,
        embedding_function: Optional[EmbeddingFunction[Documents]] = None,
    ):
        self.persist_dir = Path(persist_dir) if persist_dir is not None else settings.get_chroma_persist_dir()
        self.collection_name = collection_name
        self.embedding_function = embedding_function or get_embedding_function()
        self._client: Optional[ClientAPI] = None

    @property
    def client(self) -> ClientAPI:
        """Lazily initialize persistent ChromaDB client."""
        if self._client is None:
            self.persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self.persist_dir))
        return self._client

    def get_or_create_collection(self) -> Collection:
        """Retrieve existing or initialize new collection with cosine distance metric."""
        return self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
            embedding_function=self.embedding_function,
        )

    def reset_collection(self) -> Collection:
        """Delete existing collection if present and re-create clean collection."""
        try:
            self.client.delete_collection(name=self.collection_name)
        except Exception:
            pass
        return self.get_or_create_collection()

    def count(self) -> int:
        """Return total document count in collection."""
        return self.get_or_create_collection().count()


def get_vector_store(
    persist_dir: Optional[Union[Path, str]] = None,
    collection_name: str = DEFAULT_COLLECTION_NAME,
    embedding_function: Optional[EmbeddingFunction[Documents]] = None,
) -> VectorStoreManager:
    """Convenience factory returning initialized VectorStoreManager."""
    return VectorStoreManager(
        persist_dir=persist_dir,
        collection_name=collection_name,
        embedding_function=embedding_function,
    )


def get_collection(
    persist_dir: Optional[Union[Path, str]] = None,
    collection_name: str = DEFAULT_COLLECTION_NAME,
    embedding_function: Optional[EmbeddingFunction[Documents]] = None,
) -> Collection:
    """Convenience factory returning active ChromaDB Collection."""
    return get_vector_store(
        persist_dir=persist_dir,
        collection_name=collection_name,
        embedding_function=embedding_function,
    ).get_or_create_collection()


def get_blocks_vector_store(
    persist_dir: Optional[Union[Path, str]] = None,
    embedding_function: Optional[EmbeddingFunction[Documents]] = None,
) -> VectorStoreManager:
    """Convenience factory returning initialized VectorStoreManager for raw blocks collection."""
    return VectorStoreManager(
        persist_dir=persist_dir,
        collection_name=DEFAULT_BLOCKS_COLLECTION_NAME,
        embedding_function=embedding_function,
    )


def get_blocks_collection(
    persist_dir: Optional[Union[Path, str]] = None,
    embedding_function: Optional[EmbeddingFunction[Documents]] = None,
) -> Collection:
    """Convenience factory returning active ChromaDB Collection for raw blocks."""
    return get_blocks_vector_store(
        persist_dir=persist_dir,
        embedding_function=embedding_function,
    ).get_or_create_collection()
