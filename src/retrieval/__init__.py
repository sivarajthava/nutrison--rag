"""Vector retrieval and persistent store module for Dietary Guidance RAG Chatbot."""

from src.retrieval.vector_store import (
    VectorStoreManager,
    get_vector_store,
    get_collection,
    get_embedding_function,
    GeminiEmbeddingFunction,
    DEFAULT_COLLECTION_NAME,
)
from src.retrieval.retriever import (
    Retriever,
    get_retriever,
    retrieve_chunks,
)

__all__ = [
    "VectorStoreManager",
    "get_vector_store",
    "get_collection",
    "get_embedding_function",
    "GeminiEmbeddingFunction",
    "DEFAULT_COLLECTION_NAME",
    "Retriever",
    "get_retriever",
    "retrieve_chunks",
]

