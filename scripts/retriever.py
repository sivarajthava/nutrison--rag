"""Command-Line Interface for Dietary Guidance Retrieval Engine.

Usage:
    python scripts/retriever.py "What do the guidelines say about cooking oil?"
    python scripts/retriever.py "What are the 5 keys to safer food?" --document-id who-five-keys
    python scripts/retriever.py "What are recommended limits for free sugars?" --category nutrition
    python scripts/retriever.py "What do the guidelines say about cooking oil?" --threshold 0.40
    python scripts/retriever.py "What do the guidelines say about cooking oil?" --raw
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Optional, List

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import settings, get_corpus_registry
from src.retrieval.retriever import Retriever, get_retriever


def run_cli():
    parser = argparse.ArgumentParser(
        description="Search the Dietary Guidance RAG vector database."
    )
    parser.add_argument(
        "query",
        type=str,
        help="Search query string (e.g. 'What do the guidelines say about cooking oil?')"
    )
    parser.add_argument(
        "--document-id", "-d",
        type=str,
        default=None,
        help="Restrict search to a specific document ID (e.g. 'eatwell-guide', 'who-healthy-diet')"
    )
    parser.add_argument(
        "--category", "-c",
        type=str,
        choices=["food_safety", "nutrition"],
        default=None,
        help="Restrict search to a specific category ('food_safety' or 'nutrition')"
    )
    parser.add_argument(
        "--top-k", "-k",
        type=int,
        default=settings.RETRIEVAL_TOP_K,
        help=f"Number of top chunks to retrieve (default: {settings.RETRIEVAL_TOP_K})"
    )
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=None,
        help=f"Cosine similarity threshold cutoff (default: {settings.SIMILARITY_THRESHOLD})"
    )
    parser.add_argument(
        "--raw", "--all",
        action="store_true",
        help="Show top candidates without similarity threshold cutoff"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Display full chunk contents without truncation"
    )

    args = parser.parse_args()

    active_threshold = 0.0 if args.raw else (args.threshold if args.threshold is not None else settings.SIMILARITY_THRESHOLD)

    print("=" * 80)
    print("DIETARY GUIDANCE RAG - VECTOR RETRIEVAL")
    print(f"Query:               \"{args.query}\"")
    if args.document_id:
        print(f"Filter Document:     {args.document_id}")
    if args.category:
        print(f"Filter Category:     {args.category}")
    print(f"Top K:               {args.top_k}")
    print(f"Threshold:           {active_threshold:.4f} " + ("(RAW MODE / NO CUTOFF)" if args.raw else f"(configured: {settings.SIMILARITY_THRESHOLD})"))
    print("=" * 80)

    retriever = get_retriever()
    chunks, max_similarity, is_corpus_gap = retriever.retrieve_chunks(
        query=args.query,
        filter_document_id=args.document_id,
        filter_category=args.category,
        top_k=args.top_k,
        threshold=active_threshold,
    )

    print(f"\n[Retrieval Telemetry]")
    print(f"Max Cosine Similarity: {max_similarity:.4f}")
    print(f"Corpus Gap Triggered:  {is_corpus_gap}")
    print(f"Retrieved Chunks:      {len(chunks)}")

    if is_corpus_gap:
        print("\n" + "!" * 80)
        print("REFUSAL 1: NOT IN AUTHORITATIVE CORPUS (CORPUS GAP)")
        print(f"The maximum observed similarity ({max_similarity:.4f}) is below the calibrated threshold ({active_threshold:.4f}).")
        print("The question cannot be grounded in the following 7 authoritative publications:")
        registry = get_corpus_registry()
        for doc_id, doc in registry.items():
            print(f"  * {doc.title} ({doc.publisher}, {doc.year})")
        print("!" * 80)

        # Inspect raw candidates to show what was close
        print("\n[Closest Candidates Below Threshold]")
        raw_chunks, _, _ = retriever.retrieve_chunks(
            query=args.query,
            filter_document_id=args.document_id,
            filter_category=args.category,
            top_k=args.top_k,
            threshold=-1.0,
        )
        if raw_chunks:
            for idx, c in enumerate(raw_chunks, 1):
                sim_str = f"{c.similarity_score:.4f}" if c.similarity_score is not None else "N/A"
                print(f"\n[{idx}] Candidate Chunk: {c.chunk_id} | Similarity: {sim_str}")
                print(f"    Document:  {c.document_title} ({c.publisher})")
                print(f"    Section:   {c.section_heading}")
                snippet = c.content.strip().replace("\n", " ")
                if len(snippet) > 200 and not args.verbose:
                    snippet = snippet[:200] + "..."
                print(f"    Snippet:   {snippet}")
            print("\nTip: To retrieve these candidates, pass '--threshold 0.40' or '--raw'.")
        return

    print("\n" + "-" * 80)
    print(f"RETRIEVED {len(chunks)} MATCHING CHUNKS:")
    print("-" * 80)

    for idx, chunk in enumerate(chunks, 1):
        sim_str = f"{chunk.similarity_score:.4f}" if chunk.similarity_score is not None else "N/A"
        print(f"\n[{idx}] Chunk ID: {chunk.chunk_id} (Score: {sim_str})")
        print(f"    Document:   {chunk.document_title} ({chunk.publisher}, {chunk.year})")
        print(f"    Category:   {chunk.category} | Type: {chunk.chunk_type} | Has Table: {chunk.has_table}")
        print(f"    Section:    {chunk.section_heading}")
        print(f"    URL:        {chunk.source_url}")
        print(f"    Ordinals:   {chunk.block_ordinals}")
        print("    Content:")
        lines = chunk.content.strip().split("\n")
        if not args.verbose and len(lines) > 20:
            content_preview = "\n".join(lines[:20]) + f"\n    [... {len(lines) - 20} more lines - use --verbose to show all ...]"
        else:
            content_preview = "\n".join(lines)
        for line in content_preview.split("\n"):
            print(f"      {line}")


if __name__ == "__main__":
    run_cli()
