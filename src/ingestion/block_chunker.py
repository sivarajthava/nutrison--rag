"""Hierarchy-Aware Chunk Assembly Engine for Dietary Guidance RAG Chatbot.

Implements the 5 data-calibrated chunking rules:
1. Embedding window calibration (target 250-350 tokens, ceiling <= 450 tokens).
2. Empirical table preservation: 9 atomic tables intact, 3 segmented mega-tables across 9 sub-tables.
3. List item and lead-in paragraph binding.
4. Hierarchical breadcrumb and caption context injection.
5. Micro-section coalescing for deep hierarchies (kitchen-companion).
"""

import math
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Union, Tuple, Any
from collections import defaultdict

from config.settings import settings, get_corpus_registry
from src.models.schemas import BlockRecord, Chunk, DocumentMetadata
from src.ingestion.block_reader import read_blocks


def estimate_tokens(text: str) -> int:
    """Calculate token estimate calibrated to dense embedding tokenizers.
    
    Formula: floor(len(text.split()) * 1.3)
    """
    if not text:
        return 0
    return math.floor(len(text.split()) * 1.3)


class HierarchyChunker:
    """Assembles BlockRecord instances into retrieval-optimized Chunk instances."""

    def __init__(
        self,
        target_chunk_tokens: int = 300,
        max_chunk_tokens: int = 450,
        overlap_blocks: int = 1,
        registry: Optional[Dict[str, DocumentMetadata]] = None,
    ):
        self.target_chunk_tokens = target_chunk_tokens
        self.max_chunk_tokens = max_chunk_tokens
        self.overlap_blocks = overlap_blocks
        self.registry = registry if registry is not None else get_corpus_registry()

    def format_table_markdown(self, header: List[str], rows: List[List[str]]) -> str:
        """Format 2D table cells into standard markdown table text."""
        lines = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * len(header)) + " |",
        ]
        for row in rows:
            lines.append("| " + " | ".join(row) + " |")
        return "\n".join(lines)

    def chunk_table(self, block: BlockRecord) -> List[Chunk]:
        """Process a table block into atomic or segmented table chunks."""
        doc_id = block.document_id
        ord_val = block.ordinal
        header = block.header or []
        rows = block.rows or []
        doc_meta = self.registry[doc_id]
        heading_path = block.heading_path or []
        heading_str = " > ".join(heading_path)
        caption = block.caption

        chunks: List[Chunk] = []
        table_tokens = estimate_tokens(block.text)

        # Check if table tokens > max_chunk_tokens (identifying Category B tables > 450 tokens)
        if table_tokens > self.max_chunk_tokens:
            if doc_id == "cold-food-storage" and ord_val == 2:
                segments_cfs: List[Tuple[int, int, str]] = [
                    (0, 15, "Salads, Hot Dogs, Luncheon Meat, Bacon, Sausage, Ground Meats, Fresh Steaks/Chops/Roasts"),
                    (15, 25, "Ham varieties (Fresh uncured/cooked, Cured cook-before-eating, Fully-cooked vacuum-sealed, Canned, Prosciutto)"),
                    (25, 37, "Fresh Poultry (whole/pieces), Fin Fish (fatty/lean), and Shellfish (crab, lobster, clams, mussels, shrimp, squid)"),
                    (37, 53, "Eggs, Soups & Stews, and Leftovers"),
                ]
                for idx, (r_start, r_end, sub_label) in enumerate(segments_cfs, start=1):
                    sub_rows = rows[r_start:r_end]
                    md = self.format_table_markdown(header, sub_rows)
                    content = f"[Document: {doc_meta.title} | Section: {heading_str} | Table: {sub_label}]\n\n{md}"
                    chunks.append(
                        Chunk(
                            chunk_id=f"{doc_id}_table_{ord_val}_seg{idx}",
                            document_id=doc_id,
                            document_title=doc_meta.title,
                            publisher=doc_meta.publisher,
                            year=doc_meta.year,
                            category=doc_meta.category,
                            source_url=doc_meta.source_url,
                            content=content,
                            section_heading=heading_str,
                            block_ordinals=[ord_val],
                            min_ordinal=ord_val,
                            max_ordinal=ord_val,
                            page_start=block.page,
                            page_end=block.page,
                            page_numbers=[block.page] if block.page is not None else [],
                            chunk_type="table",
                            has_table=True,
                            table_caption="Cold Food Storage Chart",
                            sub_label=sub_label,
                        )
                    )
                return chunks

            elif doc_id == "eatwell-guide" and ord_val == 105:
                segments_ew = [
                    (0, 2, "Fruit & vegetables + Potatoes, bread, rice, pasta and other starchy carbohydrates"),
                    (2, 4, "Dairy & dairy alternatives + Beans, pulses, fish, eggs, meat and other proteins"),
                    (4, 6, "Oils & spreads + Foods to eat less often and in small amounts (high in fat/salt/sugar)"),
                ]
                for idx, (r_start, r_end, sub_label) in enumerate(segments_ew, start=1):
                    sub_rows = rows[r_start:r_end]
                    md = self.format_table_markdown(header, sub_rows)
                    content = f"[Document: {doc_meta.title} | Section: {heading_str} | Table: {sub_label}]\n\n{md}"
                    chunks.append(
                        Chunk(
                            chunk_id=f"{doc_id}_table_{ord_val}_seg{idx}",
                            document_id=doc_id,
                            document_title=doc_meta.title,
                            publisher=doc_meta.publisher,
                            year=doc_meta.year,
                            category=doc_meta.category,
                            source_url=doc_meta.source_url,
                            content=content,
                            section_heading=heading_str,
                            block_ordinals=[ord_val],
                            min_ordinal=ord_val,
                            max_ordinal=ord_val,
                            page_start=block.page,
                            page_end=block.page,
                            page_numbers=[block.page] if block.page is not None else [],
                            chunk_type="table",
                            has_table=True,
                            table_caption=caption,
                            sub_label=sub_label,
                        )
                    )
                return chunks

            elif doc_id == "kitchen-companion" and ord_val == 216:
                segments_kc = [
                    (0, 7, "Fresh Chicken & Fresh Pork"),
                    (7, 11, "Smoked Ham"),
                ]
                for idx, (r_start, r_end, sub_label) in enumerate(segments_kc, start=1):
                    sub_rows = rows[r_start:r_end]
                    md = self.format_table_markdown(header, sub_rows)
                    content = f"[Document: {doc_meta.title} | Section: {heading_str} | Table: {sub_label}]\n\n{md}"
                    chunks.append(
                        Chunk(
                            chunk_id=f"{doc_id}_table_{ord_val}_seg{idx}",
                            document_id=doc_id,
                            document_title=doc_meta.title,
                            publisher=doc_meta.publisher,
                            year=doc_meta.year,
                            category=doc_meta.category,
                            source_url=doc_meta.source_url,
                            content=content,
                            section_heading=heading_str,
                            block_ordinals=[ord_val],
                            min_ordinal=ord_val,
                            max_ordinal=ord_val,
                            page_start=block.page,
                            page_end=block.page,
                            page_numbers=[block.page] if block.page is not None else [],
                            chunk_type="table",
                            has_table=True,
                            table_caption=caption,
                            sub_label=sub_label,
                        )
                    )
                return chunks


        # Category A: Atomic Tables (<= 450 tokens, 9 tables)
        if caption:
            header_str = f"[Document: {doc_meta.title} | Section: {heading_str} | Table: {caption}]"
        else:
            header_str = f"[Document: {doc_meta.title} | Section: {heading_str}]"

        content = f"{header_str}\n\n{block.text}"
        chunks.append(
            Chunk(
                chunk_id=f"{doc_id}_table_{ord_val}",
                document_id=doc_id,
                document_title=doc_meta.title,
                publisher=doc_meta.publisher,
                year=doc_meta.year,
                category=doc_meta.category,
                source_url=doc_meta.source_url,
                content=content,
                section_heading=heading_str,
                block_ordinals=[ord_val],
                min_ordinal=ord_val,
                max_ordinal=ord_val,
                page_start=block.page,
                page_end=block.page,
                page_numbers=[block.page] if block.page is not None else [],
                chunk_type="table",
                has_table=True,
                table_caption=caption,
                sub_label=None,
            )
        )
        return chunks

    def make_prose_chunk(
        self,
        doc_id: str,
        blocks: List[BlockRecord],
        heading_path: List[str],
        intro_context: Optional[str] = None,
    ) -> Chunk:
        """Create a Chunk instance from a sequence of prose/list blocks."""
        doc_meta = self.registry[doc_id]
        min_ord = min(b.ordinal for b in blocks)
        max_ord = max(b.ordinal for b in blocks)
        chunk_id = f"{doc_id}_{min_ord}_{max_ord}"

        heading_str = " > ".join(heading_path)
        body_text = "\n\n".join(b.text for b in blocks)
        if intro_context and not any(intro_context.strip() in b.text for b in blocks):
            content = f"[Document: {doc_meta.title} | Section: {heading_str}]\n\n{intro_context}\n\n{body_text}"
        else:
            content = f"[Document: {doc_meta.title} | Section: {heading_str}]\n\n{body_text}"

        pages = [b.page for b in blocks if b.page is not None]
        unique_pages = sorted(list(set(pages)))
        page_start = unique_pages[0] if unique_pages else None
        page_end = unique_pages[-1] if unique_pages else None

        has_list = any(b.type == "list_item" for b in blocks)
        chunk_type = "list" if has_list else "prose"

        return Chunk(
            chunk_id=chunk_id,
            document_id=doc_id,
            document_title=doc_meta.title,
            publisher=doc_meta.publisher,
            year=doc_meta.year,
            category=doc_meta.category,
            source_url=doc_meta.source_url,
            content=content,
            section_heading=heading_str,
            block_ordinals=[b.ordinal for b in blocks],
            min_ordinal=min_ord,
            max_ordinal=max_ord,
            page_start=page_start,
            page_end=page_end,
            page_numbers=unique_pages,
            chunk_type=chunk_type,
            has_table=False,
            table_caption=None,
            sub_label=None,
        )

    def assemble_chunks(self, blocks: Sequence[BlockRecord]) -> List[Chunk]:
        """Assemble a sequence of BlockRecord instances into chunks."""
        doc_blocks: Dict[str, List[BlockRecord]] = defaultdict(list)
        for b in blocks:
            doc_blocks[b.document_id].append(b)

        all_chunks: List[Chunk] = []
        for doc_id, b_list in doc_blocks.items():
            doc_chunks = self._chunk_document(doc_id, b_list)
            all_chunks.extend(doc_chunks)

        return all_chunks

    def assemble_corpus(self, file_path: Optional[Union[Path, str]] = None) -> List[Chunk]:
        """Convenience method: read all blocks from file and assemble chunks."""
        blocks = list(read_blocks(file_path))
        return self.assemble_chunks(blocks)

    def _chunk_document(self, doc_id: str, blocks: List[BlockRecord]) -> List[Chunk]:
        doc_chunks: List[Chunk] = []

        # Step 1: Extract structural items preserving order:
        # Each item is either:
        # - ("table", heading_path, [table_block])
        # - ("section", heading_path, [content_blocks])
        items: List[Tuple[str, List[str], List[BlockRecord]]] = []
        current_section: List[BlockRecord] = []
        current_path: List[str] = []

        for b in blocks:
            b_type = b.type
            if b_type == "heading":
                if any(x.type != "heading" for x in current_section):
                    items.append(("section", current_path, current_section))
                    current_section = []
                current_path = b.heading_path or []
                current_section.append(b)
            elif b_type == "table":
                if any(x.type != "heading" for x in current_section):
                    items.append(("section", current_path, current_section))
                    current_section = []
                items.append(("table", b.heading_path or [], [b]))
            else:
                if not current_path:
                    current_path = b.heading_path or []
                current_section.append(b)

        if current_section:
            items.append(("section", current_path, current_section))

        # Step 2: Coalesce adjacent sections sharing common root hierarchy
        # Rule 5: When consecutive sections share a common root hierarchy (heading_path[0] or heading_path[:2])
        # and total tokens are < 200, coalesce into a single cohesive chunk up to target_chunk_tokens
        coalesced_items: List[Tuple[str, List[str], List[BlockRecord]]] = []
        acc_path: Optional[List[str]] = None
        acc_blocks: List[BlockRecord] = []

        for item_type, path, item_blocks in items:
            if item_type == "table":
                if acc_blocks:
                    coalesced_items.append(("section", acc_path or [], acc_blocks))
                    acc_blocks = []
                    acc_path = None
                coalesced_items.append(("table", path, item_blocks))
            else:
                if not acc_blocks:
                    acc_blocks = list(item_blocks)
                    acc_path = path
                else:
                    curr_tok = sum(estimate_tokens(b.text) for b in acc_blocks)
                    add_tok = sum(estimate_tokens(b.text) for b in item_blocks)

                    same_root = bool(acc_path and path and acc_path[0] == path[0])

                    can_coalesce = same_root and (curr_tok < 200 or curr_tok + add_tok <= self.target_chunk_tokens)
                    if same_root and (curr_tok < 120 or add_tok < 60) and (curr_tok + add_tok <= 350):
                        can_coalesce = True

                    if can_coalesce and (curr_tok + add_tok <= 360):
                        acc_blocks.extend(item_blocks)
                    else:
                        coalesced_items.append(("section", acc_path or [], acc_blocks))
                        acc_blocks = list(item_blocks)
                        acc_path = path

        if acc_blocks:
            coalesced_items.append(("section", acc_path or [], acc_blocks))

        # Step 3: Avoid micro-chunks (< 50 tokens) by merging with adjacent non-table sections
        final_items: List[Tuple[str, List[str], List[BlockRecord]]] = []
        for itype, ipath, iblocks in coalesced_items:
            if itype == "section":
                itoks = sum(estimate_tokens(b.text) for b in iblocks)
                if itoks < 50:
                    merged = False
                    for j in range(len(final_items) - 1, -1, -1):
                        if final_items[j][0] == "section":
                            p_type, p_path, p_blocks = final_items[j]
                            p_toks = sum(estimate_tokens(b.text) for b in p_blocks)
                            if p_toks + itoks <= 360:
                                final_items[j] = (p_type, p_path, p_blocks + iblocks)
                                merged = True
                            break
                    if merged:
                        continue
            final_items.append((itype, ipath, iblocks))

        # Step 4: Emit chunks (tables intact/segmented, sections split if exceeding ceiling)
        for itype, ipath, iblocks in final_items:
            if itype == "table":
                doc_chunks.extend(self.chunk_table(iblocks[0]))
            else:
                chunks = self._split_section_blocks(doc_id, iblocks, ipath)
                doc_chunks.extend(chunks)

        return doc_chunks

    def _split_section_blocks(
        self,
        doc_id: str,
        blocks: List[BlockRecord],
        heading_path: List[str],
    ) -> List[Chunk]:
        """Split a sequence of blocks into chunks respecting target and ceiling token bounds.
        
        Implements Rule 1 (target 250-350 tok, max 450 tok, overlap 1 block) and
        Rule 3 (lead-in sentence binding and carry-over when lists split across chunks).
        """
        doc_meta = self.registry[doc_id]
        header_len = estimate_tokens(f"[Document: {doc_meta.title} | Section: {' > '.join(heading_path)}]\n\n")

        budget_limit = self.max_chunk_tokens - header_len - 10
        target_limit = max(150, self.target_chunk_tokens - header_len)

        total_tokens = sum(estimate_tokens(b.text) for b in blocks)
        if total_tokens <= budget_limit:
            return [self.make_prose_chunk(doc_id, blocks, heading_path)]

        # Map lead-in paragraphs to list items to implement Rule 3 context carry-over
        lead_in_map: Dict[int, str] = {}
        curr_lead: Optional[str] = None
        for idx, b in enumerate(blocks):
            if b.type == "paragraph" and idx + 1 < len(blocks) and blocks[idx + 1].type == "list_item":
                curr_lead = b.text
            elif b.type == "list_item" and curr_lead:
                lead_in_map[idx] = curr_lead
            elif b.type == "paragraph":
                curr_lead = None

        chunks: List[Chunk] = []
        i = 0
        n = len(blocks)
        while i < n:
            curr_blocks: List[BlockRecord] = []
            curr_tok = 0

            # If chunk starts with a list item, carry forward its lead-in context
            intro_context = lead_in_map.get(i)
            intro_tok = estimate_tokens(intro_context) if intro_context else 0
            effective_budget = budget_limit - intro_tok

            j = i
            while j < n:
                b = blocks[j]
                b_tok = estimate_tokens(b.text)

                # Rule 3: If b is a lead-in paragraph, ensure it is NOT severed from its child list items
                if b.type == "paragraph" and j + 1 < n and blocks[j + 1].type == "list_item":
                    next_tok = estimate_tokens(blocks[j + 1].text)
                    if curr_blocks and (curr_tok + b_tok + next_tok > effective_budget):
                        # Cannot fit both lead-in and at least one child list item; stop here
                        break

                if curr_blocks and (curr_tok + b_tok > effective_budget):
                    break

                curr_blocks.append(b)
                curr_tok += b_tok
                j += 1

                if curr_tok >= target_limit:
                    # If current block is paragraph and next is list item, bind at least one list item if space allows
                    if j < n and blocks[j].type == "list_item" and b.type == "paragraph":
                        next_tok = estimate_tokens(blocks[j].text)
                        if curr_tok + next_tok <= effective_budget:
                            curr_blocks.append(blocks[j])
                            curr_tok += next_tok
                            j += 1
                    break

            if not curr_blocks:
                curr_blocks = [blocks[j]]
                j += 1

            chunks.append(self.make_prose_chunk(doc_id, curr_blocks, heading_path, intro_context=intro_context))
            if j >= n:
                break
            if self.overlap_blocks > 0 and len(curr_blocks) > self.overlap_blocks:
                next_i = j - self.overlap_blocks
                if next_i > i:
                    i = next_i
                else:
                    i = j
            else:
                i = j

        return chunks


if __name__ == "__main__":
    from collections import Counter
    print("=" * 70)
    print("Dietary Guidance RAG Chatbot - Hierarchy-Aware Chunk Assembly")
    print("=" * 70)
    chunker = HierarchyChunker()
    chunks = chunker.assemble_corpus()
    table_chunks = [c for c in chunks if c.has_table]
    atomic_tables = [c for c in table_chunks if "_seg" not in c.chunk_id]
    segmented_tables = [c for c in table_chunks if "_seg" in c.chunk_id]
    prose_chunks = [c for c in chunks if not c.has_table]
    toks = [estimate_tokens(c.content) for c in chunks]

    print(f"Total Chunks Assembled: {len(chunks)}")
    print(f"  * Table Chunks: {len(table_chunks)} (Atomic: {len(atomic_tables)}, Segmented: {len(segmented_tables)})")
    print(f"  * Prose/List Chunks: {len(prose_chunks)}")
    print(f"Token Statistics: Min={min(toks)}, Max={max(toks)}, Avg={sum(toks)/len(toks):.1f}")

    print("\nPer-Document Chunk Distribution:")
    doc_counter = Counter(c.document_id for c in chunks)
    for doc_id, count in sorted(doc_counter.items(), key=lambda x: x[1], reverse=True):
        doc_tables = len([c for c in chunks if c.document_id == doc_id and c.has_table])
        doc_prose = count - doc_tables
        print(f"  * {doc_id:<22} | {count:>3} chunks (prose/list: {doc_prose:>2}, tables: {doc_tables:>2})")
    print("=" * 70)

