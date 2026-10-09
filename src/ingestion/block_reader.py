"""Block Stream Reader for Dietary Guidance RAG Chatbot.

Ingests and validates the 1,001 canonical structural blocks from data/blocks.jsonl
into strongly-typed BlockRecord schemas across the 7 authoritative publications.
Operates with zero external network requests or dynamic scraping.
"""

import json
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Any, Union
from collections import defaultdict

from config.settings import settings
from src.models.schemas import BlockRecord


def read_blocks(file_path: Optional[Union[Path, str]] = None) -> Iterator[BlockRecord]:
    """Stream and validate structural blocks line-by-line from blocks.jsonl.
    
    Args:
        file_path: Optional path to blocks.jsonl. Defaults to configured path.
        
    Yields:
        Validated BlockRecord instances.
        
    Raises:
        FileNotFoundError: If blocks.jsonl does not exist.
        ValidationError: If any block record fails Pydantic schema validation.
    """
    path = Path(file_path) if file_path is not None else settings.get_data_blocks_path()
    if not path.exists():
        raise FileNotFoundError(f"Corpus blocks file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            data = json.loads(line_str)
            yield BlockRecord.model_validate(data)


def load_corpus_summary(file_path: Optional[Union[Path, str]] = None) -> Dict[str, Any]:
    """Generate structural summary telemetry of the corpus blocks.
    
    Reports total blocks, per-document structural types, page ranges,
    captions, and table inventories across the 7 authoritative publications.
    """
    total_blocks = 0
    type_totals: Dict[str, int] = defaultdict(int)
    doc_summaries: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "total_blocks": 0,
        "type_counts": {"heading": 0, "paragraph": 0, "list_item": 0, "table": 0},
        "pages": set(),
        "captions": [],
        "tables": [],
        "heading_paths": set(),
    })

    for block in read_blocks(file_path):
        total_blocks += 1
        doc_id = block.document_id
        b_type = block.type
        
        type_totals[b_type] += 1
        summary = doc_summaries[doc_id]
        summary["total_blocks"] += 1
        summary["type_counts"][b_type] += 1
        
        if block.page is not None:
            summary["pages"].add(block.page)
        if block.caption is not None:
            summary["captions"].append(block.caption)
        if b_type == "table":
            summary["tables"].append({
                "ordinal": block.ordinal,
                "rows_count": len(block.rows) if block.rows else 0,
                "cols_count": len(block.header) if block.header else 0,
                "caption": block.caption,
            })
        if block.heading_path:
            summary["heading_paths"].add(tuple(block.heading_path))

    # Format into serializable dictionary
    formatted_docs = {}
    for doc_id, summary in doc_summaries.items():
        pages_list = sorted(list(summary["pages"]))
        formatted_docs[doc_id] = {
            "total_blocks": summary["total_blocks"],
            "type_counts": summary["type_counts"],
            "page_start": pages_list[0] if pages_list else None,
            "page_end": pages_list[-1] if pages_list else None,
            "total_pages": len(pages_list),
            "captions": summary["captions"],
            "tables": summary["tables"],
            "unique_heading_paths": len(summary["heading_paths"]),
        }

    if file_path is None or str(file_path) == str(settings.get_data_blocks_path()):
        assert total_blocks == 1001, f"Corpus block count mismatch: expected 1,001, found {total_blocks}"

    return {
        "total_blocks": total_blocks,
        "type_totals": dict(type_totals),
        "total_documents": len(formatted_docs),
        "documents": formatted_docs,
    }


def validate_corpus(file_path: Optional[Union[Path, str]] = None) -> int:
    """Validate that the canonical corpus yields exactly 1,001 valid BlockRecord instances.
    
    Args:
        file_path: Optional path to blocks.jsonl. Defaults to configured path.
        
    Returns:
        Total number of valid blocks parsed (1,001).
        
    Raises:
        AssertionError: If total parsed blocks != 1,001.
    """
    count = sum(1 for _ in read_blocks(file_path))
    if file_path is None or str(file_path) == str(settings.get_data_blocks_path()):
        assert count == 1001, f"Expected exactly 1,001 blocks in corpus, found {count}"
    return count



if __name__ == "__main__":
    import pprint
    print("=" * 70)
    print("Dietary Guidance RAG Chatbot - Block Stream Reader Summary")
    print("=" * 70)
    summary = load_corpus_summary()
    print(f"Total Blocks Parsed: {summary['total_blocks']}")
    print(f"Total Documents: {summary['total_documents']}")
    print(f"Structural Types: {summary['type_totals']}")
    print("\nPer-Document Telemetry:")
    for doc_id, doc_info in summary["documents"].items():
        pages_str = f"pages {doc_info['page_start']}-{doc_info['page_end']}" if doc_info['page_start'] is not None else "web source (no pages)"
        print(
            f"  * {doc_id:<22} | {doc_info['total_blocks']:>3} blocks | "
            f"{pages_str:<18} | {len(doc_info['tables']):>2} tables | "
            f"{len(doc_info['captions']):>2} captions | "
            f"{doc_info['unique_heading_paths']:>2} sections"
        )
    print("=" * 70)

