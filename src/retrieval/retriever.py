"""Dual-Mode Retriever Engine for Dietary Guidance RAG Chatbot.

Supports:
- Mode 1: Global multi-document nearest neighbor retrieval.
- Mode 2: Document-scoped retrieval (filter_document_id).
- Mode 3: Category-scoped retrieval (filter_category).
- Calibrated similarity threshold cutoff (tau_relevance = 0.68) for Refusal 1 (Corpus Gap).
"""

from pathlib import Path
from typing import List, Optional, Tuple, Union, Dict, Any

from config.settings import settings
from src.models.schemas import Chunk
from src.retrieval.vector_store import (
    VectorStoreManager,
    DEFAULT_COLLECTION_NAME,
    DEFAULT_BLOCKS_COLLECTION_NAME,
    get_vector_store,
    get_blocks_vector_store,
)


class Retriever:
    """Retrieval engine executing similarity searches and metadata-filtered queries."""

    def __init__(
        self,
        persist_dir: Optional[Union[Path, str]] = None,
        collection_name: str = DEFAULT_COLLECTION_NAME,
        vector_store: Optional[VectorStoreManager] = None,
    ):
        self.vector_store = vector_store or get_vector_store(
            persist_dir=persist_dir,
            collection_name=collection_name,
        )
        self.collection_name = collection_name

    def retrieve_chunks(
        self,
        query: str,
        filter_document_id: Optional[str] = None,
        filter_category: Optional[str] = None,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None,
    ) -> Tuple[List[Chunk], float, bool]:
        """Retrieve relevant chunks evaluating document filters and similarity threshold.
        
        Args:
            query: User search query string.
            filter_document_id: Optional canonical document_id restriction.
            filter_category: Optional category restriction ('food_safety' or 'nutrition').
            top_k: Number of candidate chunks to retrieve. Defaults to settings.RETRIEVAL_TOP_K.
            threshold: Cosine similarity cutoff. Defaults to settings.SIMILARITY_THRESHOLD (0.68).
            
        Returns:
            Tuple[List[Chunk], float, bool]:
                - retrieved_chunks: Filtered chunks meeting the similarity threshold.
                - max_similarity: Maximum observed cosine similarity score across candidates.
                - is_corpus_gap: True if max_similarity < threshold or no matches found (Refusal 1).
        """
        k = top_k if top_k is not None else settings.RETRIEVAL_TOP_K
        thresh = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

        # Construct ChromaDB metadata filter
        where_clause: Optional[Dict[str, Any]] = None
        if filter_document_id and filter_category:
            where_clause = {
                "$and": [
                    {"document_id": filter_document_id},
                    {"category": filter_category},
                ]
            }
        elif filter_document_id:
            where_clause = {"document_id": filter_document_id}
        elif filter_category:
            where_clause = {"category": filter_category}

        collection = self.vector_store.get_or_create_collection()
        total_items = collection.count()
        if total_items == 0:
            return ([], 0.0, True)

        # Cap k by total available items in collection
        query_k = min(k, total_items)

        query_kwargs: Dict[str, Any] = {
            "query_texts": [query],
            "n_results": query_k,
        }
        if where_clause:
            query_kwargs["where"] = where_clause

        results = collection.query(**query_kwargs)

        ids_list = results.get("ids", [[]])[0]
        if not ids_list:
            return ([], 0.0, True)

        documents_list = results.get("documents", [[]])[0]
        metadatas_list = results.get("metadatas", [[]])[0]
        distances_list = results.get("distances", [[]])[0]

        # Convert ChromaDB cosine distance (d in [0, 2]) to similarity (s = 1.0 - d)
        candidates: List[Tuple[Chunk, float]] = []
        max_similarity = -1.0

        for doc_text, meta, dist in zip(documents_list, metadatas_list, distances_list):
            similarity = round(max(-1.0, min(1.0, 1.0 - float(dist))), 4)
            if similarity > max_similarity:
                max_similarity = similarity

            chunk_obj = Chunk.from_chroma_metadata(
                metadata=meta,
                document=doc_text,
                similarity_score=similarity,
            )
            candidates.append((chunk_obj, similarity))

        # Check similarity cutoff threshold (Refusal 1: Corpus Gap)
        if max_similarity < thresh:
            return ([], max_similarity, True)

        # Retain only chunks meeting the similarity threshold
        filtered_chunks = [
            chunk for chunk, sim in candidates
            if sim >= thresh
        ]

        # Sort descending by similarity score
        filtered_chunks.sort(key=lambda c: c.similarity_score or 0.0, reverse=True)

        return (filtered_chunks, max_similarity, False)

    def retrieve_blocks(
        self,
        query: str,
        filter_document_id: Optional[str] = None,
        filter_category: Optional[str] = None,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None,
    ) -> Tuple[List[Dict[str, Any]], float, bool]:
        """Retrieve relevant individual blocks from dietary_guidance_blocks collection.
        
        Args:
            query: User search query string.
            filter_document_id: Optional canonical document_id restriction.
            filter_category: Optional category restriction ('food_safety' or 'nutrition').
            top_k: Number of candidate blocks to retrieve.
            threshold: Cosine similarity cutoff.
            
        Returns:
            Tuple[List[Dict[str, Any]], float, bool]:
                - retrieved_blocks: Filtered block dicts meeting similarity threshold.
                - max_similarity: Maximum observed cosine similarity score.
                - is_corpus_gap: True if max_similarity < threshold or no matches found.
        """
        k = top_k if top_k is not None else settings.RETRIEVAL_TOP_K
        thresh = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

        where_clause: Optional[Dict[str, Any]] = None
        if filter_document_id and filter_category:
            where_clause = {
                "$and": [
                    {"document_id": filter_document_id},
                    {"category": filter_category},
                ]
            }
        elif filter_document_id:
            where_clause = {"document_id": filter_document_id}
        elif filter_category:
            where_clause = {"category": filter_category}

        blocks_store = get_blocks_vector_store(persist_dir=self.vector_store.persist_dir)
        collection = blocks_store.get_or_create_collection()
        total_items = collection.count()
        if total_items == 0:
            return ([], 0.0, True)

        query_k = min(k, total_items)
        query_kwargs: Dict[str, Any] = {
            "query_texts": [query],
            "n_results": query_k,
        }
        if where_clause:
            query_kwargs["where"] = where_clause

        results = collection.query(**query_kwargs)

        ids_list = results.get("ids", [[]])[0]
        if not ids_list:
            return ([], 0.0, True)

        documents_list = results.get("documents", [[]])[0]
        metadatas_list = results.get("metadatas", [[]])[0]
        distances_list = results.get("distances", [[]])[0]

        candidates: List[Tuple[Dict[str, Any], float]] = []
        max_similarity = -1.0

        for b_id, doc_text, meta, dist in zip(ids_list, documents_list, metadatas_list, distances_list):
            similarity = round(max(-1.0, min(1.0, 1.0 - float(dist))), 4)
            if similarity > max_similarity:
                max_similarity = similarity

            block_dict = {
                "block_id": b_id,
                "content": doc_text,
                "document_id": meta.get("document_id", ""),
                "document_title": meta.get("document_title", ""),
                "publisher": meta.get("publisher", ""),
                "year": meta.get("year", 0),
                "category": meta.get("category", ""),
                "source_url": meta.get("source_url", ""),
                "section_heading": meta.get("section_heading", ""),
                "ordinal": meta.get("ordinal", 0),
                "block_type": meta.get("block_type", ""),
                "page": meta.get("page", -1),
                "similarity_score": similarity,
            }
            candidates.append((block_dict, similarity))

        if max_similarity < thresh:
            return ([], max_similarity, True)

        filtered_blocks = [b for b, sim in candidates if sim >= thresh]
        filtered_blocks.sort(key=lambda b: b.get("similarity_score", 0.0), reverse=True)

        return (filtered_blocks, max_similarity, False)


# Module-level singleton
_default_retriever: Optional[Retriever] = None


def get_retriever() -> Retriever:
    """Retrieve or initialize default singleton Retriever instance."""
    global _default_retriever
    if _default_retriever is None:
        _default_retriever = Retriever()
    return _default_retriever


def retrieve_chunks(
    query: str,
    filter_document_id: Optional[str] = None,
    filter_category: Optional[str] = None,
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
) -> Tuple[List[Chunk], float, bool]:
    """Module-level convenience function for dual-mode chunk retrieval.
    
    Args:
        query: User search query string.
        filter_document_id: Optional canonical document_id restriction.
        filter_category: Optional category restriction ('food_safety' or 'nutrition').
        top_k: Number of candidate chunks to retrieve.
        threshold: Cosine similarity cutoff (default 0.68).
        
    Returns:
        Tuple[List[Chunk], float, bool]: (retrieved_chunks, max_similarity, is_corpus_gap).
    """
    return get_retriever().retrieve_chunks(
        query=query,
        filter_document_id=filter_document_id,
        filter_category=filter_category,
        top_k=top_k,
        threshold=threshold,
    )


def retrieve_blocks(
    query: str,
    filter_document_id: Optional[str] = None,
    filter_category: Optional[str] = None,
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
) -> Tuple[List[Dict[str, Any]], float, bool]:
    """Module-level convenience function for granular raw block retrieval.
    
    Args:
        query: User search query string.
        filter_document_id: Optional canonical document_id restriction.
        filter_category: Optional category restriction ('food_safety' or 'nutrition').
        top_k: Number of candidate blocks to retrieve.
        threshold: Cosine similarity cutoff (default 0.68).
        
    Returns:
        Tuple[List[Dict[str, Any]], float, bool]: (retrieved_blocks, max_similarity, is_corpus_gap).
    """
    return get_retriever().retrieve_blocks(
        query=query,
        filter_document_id=filter_document_id,
        filter_category=filter_category,
        top_k=top_k,
        threshold=threshold,
    )
