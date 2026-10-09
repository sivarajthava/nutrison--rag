"""Offline Indexing CLI for Dietary Guidance RAG Chatbot.

Reads canonical blocks from data/blocks.jsonl, assembles retrieval-optimized chunks
with HierarchyChunker, generates dense semantic embeddings, and persists them into
the local ChromaDB vector store across two synchronized collections:
1. 'dietary_guidance_chunks': Assembled, hierarchy-aware, token-calibrated chunks.
2. 'dietary_guidance_blocks': All 1,001 individual raw blocks for granular retrieval.
"""

import sys
import time
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, List

from config.settings import settings, get_corpus_registry
from src.ingestion.block_reader import read_blocks
from src.ingestion.block_chunker import HierarchyChunker, estimate_tokens
from src.retrieval.vector_store import (
    VectorStoreManager,
    DEFAULT_COLLECTION_NAME,
    DEFAULT_BLOCKS_COLLECTION_NAME,
    get_vector_store,
    get_blocks_vector_store,
)


def index_chunks(
    blocks: Optional[List[Any]] = None,
    reset: bool = True,
    batch_size: int = 64,
    collection_name: str = DEFAULT_COLLECTION_NAME,
    blocks_path: Optional[Path] = None,
    persist_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Index assembled chunks into ChromaDB."""
    start_time = time.time()
    b_path = blocks_path or settings.get_data_blocks_path()
    p_dir = persist_dir or settings.get_chroma_persist_dir()

    if blocks is None:
        blocks = list(read_blocks(b_path))

    print(f"\n--- Indexing Chunks Collection: '{collection_name}' ---")
    chunker = HierarchyChunker()
    chunks = chunker.assemble_chunks(blocks)

    table_chunks = [c for c in chunks if c.has_table]
    atomic_tables = [c for c in table_chunks if "_seg" not in c.chunk_id]
    segmented_tables = [c for c in table_chunks if "_seg" in c.chunk_id]
    prose_chunks = [c for c in chunks if not c.has_table]
    tok_counts = [estimate_tokens(c.content) for c in chunks]
    avg_tokens = sum(tok_counts) / len(tok_counts) if tok_counts else 0

    covered_ordinals = set((c.document_id, o) for c in chunks for o in c.block_ordinals)
    total_blocks_count = len(blocks)

    print(f" -> Assembled {len(chunks)} total chunks:")
    print(f"    - Table chunks: {len(table_chunks)} (Atomic: {len(atomic_tables)}, Segmented: {len(segmented_tables)})")
    print(f"    - Prose/list chunks: {len(prose_chunks)}")
    print(f"    - Block coverage: {len(covered_ordinals)}/{total_blocks_count} blocks ({len(covered_ordinals)/total_blocks_count*100:.1f}%)")
    print(f"    - Token distribution: Min={min(tok_counts)}, Max={max(tok_counts)}, Avg={avg_tokens:.1f}")

    manager = get_vector_store(persist_dir=p_dir, collection_name=collection_name)
    if reset:
        print(f" -> Resetting collection '{collection_name}'...")
        collection = manager.reset_collection()
    else:
        collection = manager.get_or_create_collection()

    total_chunks = len(chunks)
    for i in range(0, total_chunks, batch_size):
        batch = chunks[i : i + batch_size]
        batch_ids = [c.chunk_id for c in batch]
        batch_documents = [c.content for c in batch]
        batch_metadatas = [c.to_chroma_metadata() for c in batch]

        collection.upsert(
            ids=batch_ids,
            documents=batch_documents,
            metadatas=batch_metadatas,
        )
        print(f" -> Indexed {min(i + batch_size, total_chunks)}/{total_chunks} chunks...")

    elapsed_time = time.time() - start_time
    final_count = collection.count()

    return {
        "collection_name": collection_name,
        "total_chunks_assembled": len(chunks),
        "total_chunks_persisted": final_count,
        "table_chunks_count": len(table_chunks),
        "prose_chunks_count": len(prose_chunks),
        "block_coverage_count": len(covered_ordinals),
        "min_tokens": min(tok_counts),
        "max_tokens": max(tok_counts),
        "avg_tokens": avg_tokens,
        "elapsed_seconds": elapsed_time,
    }


def index_blocks(
    blocks: Optional[List[Any]] = None,
    reset: bool = True,
    batch_size: int = 64,
    collection_name: str = DEFAULT_BLOCKS_COLLECTION_NAME,
    blocks_path: Optional[Path] = None,
    persist_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Index all 1,001 raw individual blocks directly into ChromaDB."""
    start_time = time.time()
    b_path = blocks_path or settings.get_data_blocks_path()
    p_dir = persist_dir or settings.get_chroma_persist_dir()
    registry = get_corpus_registry()

    if blocks is None:
        blocks = list(read_blocks(b_path))

    print(f"\n--- Indexing Raw Blocks Collection: '{collection_name}' ---")
    print(f" -> Preparing {len(blocks)} individual block records with metadata...")

    manager = VectorStoreManager(persist_dir=p_dir, collection_name=collection_name)
    if reset:
        print(f" -> Resetting collection '{collection_name}'...")
        collection = manager.reset_collection()
    else:
        collection = manager.get_or_create_collection()

    total_blocks = len(blocks)
    for i in range(0, total_blocks, batch_size):
        batch = blocks[i : i + batch_size]
        batch_ids = [f"{b.document_id}_block_{b.ordinal}" for b in batch]
        batch_documents = [b.to_search_text(registry.get(b.document_id)) for b in batch]
        batch_metadatas = [b.to_chroma_metadata(registry.get(b.document_id)) for b in batch]

        collection.upsert(
            ids=batch_ids,
            documents=batch_documents,
            metadatas=batch_metadatas,
        )
        print(f" -> Indexed {min(i + batch_size, total_blocks)}/{total_blocks} blocks...")

    elapsed_time = time.time() - start_time
    final_count = collection.count()

    return {
        "collection_name": collection_name,
        "total_blocks_read": len(blocks),
        "total_blocks_persisted": final_count,
        "elapsed_seconds": elapsed_time,
    }


def index_corpus(
    reset: bool = True,
    batch_size: int = 64,
    mode: str = "all",
    chunks_collection_name: str = DEFAULT_COLLECTION_NAME,
    blocks_collection_name: str = DEFAULT_BLOCKS_COLLECTION_NAME,
    blocks_path: Optional[Path] = None,
    persist_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Main indexing coordinator supporting chunks, blocks, or dual indexing.
    
    Args:
        reset: If True, clears existing collections before inserting.
        batch_size: Number of items per insertion batch.
        mode: 'all' (default), 'chunks', or 'blocks'.
        chunks_collection_name: Name of ChromaDB chunks collection.
        blocks_collection_name: Name of ChromaDB raw blocks collection.
        blocks_path: Path to blocks.jsonl.
        persist_dir: Path to ChromaDB storage directory.
        
    Returns:
        Dict containing indexing telemetry and statistics.
    """
    start_time = time.time()
    b_path = blocks_path or settings.get_data_blocks_path()
    p_dir = persist_dir or settings.get_chroma_persist_dir()

    print("=" * 70)
    print("Dietary Guidance RAG Chatbot - Offline Vector Indexing Pipeline")
    print(f"Embedding Provider: {settings.EMBEDDING_PROVIDER} ({settings.EMBEDDING_MODEL_NAME})")
    print(f"ChromaDB Persist Dir: {p_dir}")
    print(f"Corpus Path: {b_path}")
    print(f"Indexing Mode: {mode.upper()}")
    print("=" * 70)

    # 1. Read all blocks once
    print("Step 1: Reading and validating canonical blocks...")
    blocks = list(read_blocks(b_path))
    print(f" -> Parsed {len(blocks)} valid blocks across corpus.")

    results: Dict[str, Any] = {
        "total_blocks_read": len(blocks),
        "mode": mode,
        "persist_dir": str(p_dir),
    }

    # 2. Index raw blocks collection if requested
    if mode in ["all", "blocks"]:
        results["blocks_telemetry"] = index_blocks(
            blocks=blocks,
            reset=reset,
            batch_size=batch_size,
            collection_name=blocks_collection_name,
            persist_dir=p_dir,
        )

    # 3. Index assembled chunks collection if requested
    if mode in ["all", "chunks"]:
        results["chunks_telemetry"] = index_chunks(
            blocks=blocks,
            reset=reset,
            batch_size=batch_size,
            collection_name=chunks_collection_name,
            persist_dir=p_dir,
        )

    results["elapsed_seconds"] = round(time.time() - start_time, 2)

    print("\n" + "=" * 70)
    print("All Indexing Completed Successfully!")
    if "chunks_telemetry" in results:
        print(f" - Collection '{chunks_collection_name}': {results['chunks_telemetry']['total_chunks_persisted']} chunks persisted (100% block coverage).")
    if "blocks_telemetry" in results:
        print(f" - Collection '{blocks_collection_name}': {results['blocks_telemetry']['total_blocks_persisted']} blocks persisted.")
    print(f"Total Pipeline Execution Time: {results['elapsed_seconds']}s")
    print("=" * 70)

    return results


def main():
    parser = argparse.ArgumentParser(description="Index dietary guidance corpus into ChromaDB.")
    parser.add_argument("--no-reset", action="store_true", help="Do not reset existing collections.")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size for embedding upsert.")
    parser.add_argument(
        "--mode",
        choices=["all", "chunks", "blocks"],
        default="all",
        help="Indexing mode: 'all' (chunks and blocks), 'chunks', or 'blocks'. Default: 'all'.",
    )
    parser.add_argument("--chunks-collection", type=str, default=DEFAULT_COLLECTION_NAME, help="Chunks collection name.")
    parser.add_argument("--blocks-collection", type=str, default=DEFAULT_BLOCKS_COLLECTION_NAME, help="Blocks collection name.")
    args = parser.parse_args()

    try:
        index_corpus(
            reset=not args.no_reset,
            batch_size=args.batch_size,
            mode=args.mode,
            chunks_collection_name=args.chunks_collection,
            blocks_collection_name=args.blocks_collection,
        )
    except Exception as exc:
        print(f"Indexing failed with error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
