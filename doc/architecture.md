# System Architecture: Dietary Guidance RAG Chatbot

## 1. Executive Summary & Design Philosophy

The **Dietary Guidance RAG Chatbot** is a specialized, evidence-grounded conversational service designed to translate dense, authoritative public health and food safety publications into accessible, factual answers for everyday users.

### 1.1 Core Architectural Principles
1. **Local Pre-Parsed Blocks as Canonical Ground Truth**: The system operates directly on `data/blocks.jsonl`—a curated, locally stored dataset of 1,001 canonical structural blocks (headings, paragraphs, list items, and tables) across 7 recognized guidance publications. No live external web scraping or PDF parsing is performed.
2. **Deterministic Guardrails First**: Safety-critical boundaries (refusing medical advice, calorie prescriptions, and weight targets) are enforced programmatically *before* vector search or LLM generation.
3. **Strict Provenance & Zero Hallucination**: The generation layer operates purely as a deterministic synthesizer of retrieved chunks. If evidence is absent, the system refuses rather than extrapolates.
4. **Isolated Multi-Source Synthesis**: In cross-document inquiries, evidence is segmented and presented per authority. Blending disparate agency guidelines into generic consensus claims is strictly forbidden.
5. **Transparent Information Gaps**: When the corpus lacks relevant guidance, the system explicitly declares the absence and enumerates the specific documents queried.
6. **Block-Aware Structural Preservation**: Chunking groups blocks by document hierarchy (`heading_path`) while preserving `table` blocks in their entirety without destructive mid-cell or mid-row truncation.

---

## 2. End-to-End System Architecture

```mermaid
flowchart TB
    subgraph StorageLayer["Data & Indexing Layer"]
        RawBlocks[("data/blocks.jsonl<br/>(1,001 Structural Blocks)")]
        CorpusRegistry[("Corpus Metadata Registry<br/>(config/corpus_registry.yaml)")]
        BlockChunker["Block-to-Chunk Assembly Engine<br/>(Hierarchy & Table Preserving)"]
        VectorStore[("Vector Store (ChromaDB)<br/>Chunk Embeddings & Metadata")]
    end

    subgraph ClientLayer["Presentation & Application Layer"]
        NextWebClient["Next.js Web Frontend (Chatbot UI & Diagnostic Explorer)<br/>(App Router, React 19, Tailwind CSS)"]
        NextBFF["Next.js Route Handlers / BFF<br/>(app/api/chat, app/api/documents)"]
        CLIClient["CLI Interface (Interactive / Batch)"]
        APIGateway["FastAPI Gateway<br/>(/v1/chat, /v1/chat/stream, /v1/documents)"]
    end

    subgraph GuardrailLayer["Safety & Guardrail Layer"]
        SafetyFilter["Deterministic Safety Filter (Regex + Intent Classifier)"]
        RefusalMedical["Refusal 2 Handler (Out of Scope by Design)"]
    end

    subgraph QueryLayer["Query Processing & Routing Layer"]
        QueryParser["Query & Filter Parser (Scope Detector)"]
        RetrievalRouter["Retrieval Router (Global vs. document_id Scoped)"]
    end

    subgraph RetrievalLayer["Retrieval & Filtering Layer"]
        DenseRetriever["Dense Vector Search"]
        MetaFilter["Metadata Filter Engine (document_id)"]
        ThresholdEvaluator{"Similarity Threshold Check (tau_relevance)"}
        RefusalCorpus["Refusal 1 Handler (Not in Corpus)"]
    end

    subgraph SynthesisLayer["Grounded Synthesis & Attribution Layer"]
        ContextOrganizer["Context Segregator (Group by document_id)"]
        GroundedSynthesizer["Grounded LLM Synthesizer (Strict System Prompt)"]
        CitationEngine["Citation & Provenance Formatter"]
        FaithfulnessAuditor["Post-Generation Grounding Validator"]
    end

    %% Ingestion Flow
    RawBlocks --> BlockChunker
    CorpusRegistry --> BlockChunker
    BlockChunker --> VectorStore

    %% User Flow
    NextWebClient --> NextBFF
    NextBFF -- "HTTP / SSE Stream" --> APIGateway
    CLIClient --> APIGateway
    APIGateway --> SafetyFilter

    SafetyFilter -- "Violation (Medical/Weight/Calorie)" --> RefusalMedical
    RefusalMedical --> APIGateway

    SafetyFilter -- "Safe Query" --> QueryParser
    QueryParser --> RetrievalRouter

    RetrievalRouter -- "Global Query" --> DenseRetriever
    RetrievalRouter -- "Scoped Query" --> MetaFilter
    MetaFilter --> DenseRetriever

    DenseRetriever <--> VectorStore
    DenseRetriever --> ThresholdEvaluator

    ThresholdEvaluator -- "Below Threshold / Empty" --> RefusalCorpus
    RefusalCorpus --> APIGateway

    ThresholdEvaluator -- "Above Threshold" --> ContextOrganizer
    ContextOrganizer --> GroundedSynthesizer
    GroundedSynthesizer --> CitationEngine
    CitationEngine --> FaithfulnessAuditor
    FaithfulnessAuditor --> APIGateway
```

---

## 3. Data Ingestion & Preprocessing Pipeline (Offline Phase)

Unlike systems that rely on unpredictable live scraping or fragile raw PDF parsing, this architecture ingests a curated, pre-parsed blocks dataset located at `data/blocks.jsonl`.

```mermaid
flowchart LR
    BlocksJSONL["data/blocks.jsonl<br/>(1,001 JSONL Records)"] --> StreamParser["Block Stream Reader"]
    Registry["config/corpus_registry.yaml<br/>(Document Provenance)"] --> Enricher["Metadata Enricher"]
    StreamParser --> Assembler["Hierarchy-Aware Chunk Assembler"]
    Enricher --> Assembler
    Assembler --> Embedder["Dense Embedding Generator"]
    Embedder --> VectorDB[("ChromaDB Vector Store")]
```

### 3.1 Corpus Document Registry
The dataset in `data/blocks.jsonl` contains blocks from **7 official publications**. The companion registry (`config/corpus_registry.yaml`) provides authoritative provenance for citations:

```yaml
documents:
  cold-food-storage:
    title: "Cold Food Storage Chart"
    publisher: "U.S. Food and Drug Administration / FoodSafety.gov"
    year: 2021
    category: "food_safety"
    source_url: "https://www.foodsafety.gov/keep-food-safe/cold-food-storage-chart"
    description: "Refrigerator and freezer storage duration limits for meats, poultry, seafood, eggs, and leftovers at 40°F (4°C) or below."

  who-healthy-diet:
    title: "Healthy Diet Fact Sheet N°394"
    publisher: "World Health Organization (WHO)"
    year: 2020
    category: "nutrition"
    source_url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet"
    description: "Core global principles of healthy diets for adults and infants, addressing fat limits, sugar, salt, fruits, and vegetables."

  fao-who-healthy-diets:
    title: "Sustainable Healthy Diets: Guiding Principles"
    publisher: "Food and Agriculture Organization (FAO) & World Health Organization (WHO)"
    year: 2019
    category: "nutrition"
    source_url: "https://www.fao.org/documents/card/en/c/ca6640en/"
    description: "Guiding principles combining nutritional adequacy and environmental sustainability in dietary habits."

  who-five-keys:
    title: "Five Keys to Safer Food Manual"
    publisher: "World Health Organization (WHO)"
    year: 2006
    category: "food_safety"
    source_url: "https://www.who.int/publications/i/item/9789241594639"
    description: "Core food hygiene manual: Keep clean, separate raw and cooked, cook thoroughly, keep food at safe temperatures, use safe water and raw materials."

  eatwell-guide:
    title: "The Eatwell Guide: Helping you eat a healthy, balanced diet"
    publisher: "Public Health England / NHS / UK Food Standards Agency"
    year: 2018
    category: "nutrition"
    source_url: "https://www.gov.uk/government/publications/the-eatwell-guide"
    description: "UK national food guide outlining dietary proportions across five main food groups, hydration, and nutritional labeling."

  fsa-chill:
    title: "Chilling Food Correctly"
    publisher: "UK Food Standards Agency (FSA)"
    year: 2020
    category: "food_safety"
    source_url: "https://www.food.gov.uk/safety-hygiene/chilling"
    description: "Guidance on refrigerator temperatures (below 5°C), chilling cooked food, freezing, and safe defrosting."

  kitchen-companion:
    title: "Kitchen Companion: Your Safe Food Handbook"
    publisher: "USDA Food Safety and Inspection Service (FSIS)"
    year: 2008
    category: "food_safety"
    source_url: "https://www.fsis.usda.gov/shared/data/Kitchen_Companion.pdf"
    description: "Comprehensive consumer safe food handling handbook covering bacteria, shopping, cooking internal temperatures, and leftovers."
```

### 3.2 Block Schema Specification (`data/blocks.jsonl`)
Every line in `data/blocks.jsonl` is a self-contained JSON record conforming to the following schema:

```json
{
  "document_id": "cold-food-storage",
  "ordinal": 2,
  "type": "table",
  "text": "| Food | Type | Refrigerator [40°F (4°C) or below] | Freezer [0°F (-18°C) or below] |\n| --- | --- | --- | --- |\n| Salad | Egg, chicken, ham, tuna, and macaroni salads | 3 to 4 days | Does not freeze well |\n| Fresh poultry | Chicken or turkey, whole | 1 to 2 days | 1 year |",
  "heading_path": ["Cold Food Storage Chart"],
  "header": ["Food", "Type", "Refrigerator [40°F (4°C) or below]", "Freezer [0°F (-18°C) or below]"],
  "rows": [
    ["Salad", "Egg, chicken, ham, tuna, and macaroni salads", "3 to 4 days", "Does not freeze well"],
    ["Fresh poultry", "Chicken or turkey, whole", "1 to 2 days", "1 year"]
  ],
  "page": 1,
  "level": 1
}
```

#### Field Definitions:
- `document_id` (str): Identifier matching one of the 7 registered documents.
- `ordinal` (int): Sequential zero-indexed position of the block within the document.
- `type` (enum): Block structural category:
  - `"heading"`: Section header, accompanied by `level` (int) and `heading_path` (list).
  - `"paragraph"`: Narrative prose block.
  - `"list_item"`: Bulleted recommendation or guideline item.
  - `"table"`: Tabular data with markdown `text`, column `header` list, and 2D `rows` array.
- `heading_path` (List[str]): Breadcrumb list representing document section hierarchy (e.g., `["Healthy diet", "KEY FACTS"]`).
- `page` (Optional[int]): Page number in original publication (if applicable).
- `level` (Optional[int]): Heading level depth (1 through 4) for `heading` blocks.
- `text` (str): Raw formatted text content of the block (markdown table format for tables).

### 3.3 Data-Calibrated Block-to-Chunk Assembly Engine

Rather than naive fixed-token slicing or generic text splitting, the system deploys a **Data-Calibrated Hierarchy & Table Assembly Engine** directly informed by the structural profile of the 1,001 canonical blocks in `data/blocks.jsonl`.

#### 3.3.1 Empirical Corpus Distribution (`data/blocks.jsonl`)
Structural audit of `data/blocks.jsonl` demonstrates marked variations across the 7 authoritative publications:

| Document ID | Total Blocks | Headings | Paragraphs | List Items | Tables | Architectural Implications |
|---|---|---|---|---|---|---|
| `kitchen-companion` | 469 | 96 | 126 | 239 | 8 | Highly granular hierarchy (depth up to 4); 95 section transitions; 8 atomic tables. |
| `who-five-keys` | 174 | 34 | 38 | 102 | 0 | 102 bullet points in structured hygiene key lists; requires list-intro binding. |
| `eatwell-guide` | 120 | 18 | 59 | 40 | 3 | 2 atomic tables + 1 mega-table (ordinal 105: 6 rows, 5,081 chars). |
| `fao-who-healthy-diets` | 98 | 12 | 72 | 14 | 0 | Dense narrative principles with clear heading hierarchy. |
| `who-healthy-diet` | 92 | 12 | 45 | 35 | 0 | Fact sheet with key bulleted dietary thresholds (sugar, salt, fats). |
| `fsa-chill` | 45 | 4 | 41 | 0 | 0 | Continuous narrative food refrigeration guidelines. |
| `cold-food-storage` | 3 | 1 | 1 | 0 | 1 | 1 heading, 1 lead paragraph, and 1 mega-table (ordinal 2: 53 rows, 4,557 chars). |
| **Corpus Total** | **1,001** | **176** | **383** | **430** | **12** | **43% list items, 12 tables, 170 unique heading paths.** |

- **Structural Block Characteristics**:
  - `heading` (176 blocks): Average length 24.4 chars. Act as hierarchy anchors and are never emitted as standalone chunks.
  - `paragraph` (383 blocks): Average length 215.2 chars (range 7–1,107 chars).
  - `list_item` (430 blocks): Average length 142.1 chars across 108 runs. Account for 43% of the dataset; must remain bound to parent lead-in paragraphs.
  - `table` (12 blocks): Average length 1,607.0 chars (range 246–5,081 chars).

#### 3.3.2 Chunk Assembly Flowchart

```mermaid
flowchart TD
    BlockStream["Incoming Blocks (data/blocks.jsonl)"] --> TypeSwitch{"Block Structural Type"}

    %% Table Routing
    TypeSwitch -- "type == 'table'" --> TableSizeCheck{"Table Token Budget<br/>(tokens > 400?)"}
    TableSizeCheck -- "No (<= 400 tok)" --> AtomicTable["Emit Atomic Table Chunk<br/>(100% Intact Unit)"]
    TableSizeCheck -- "Yes (> 400 tok)" --> MegaTable["Row-Clustered Sub-Tables<br/>- Replicate Complete 4-Col Header<br/>- cold-food-storage (3 sub-tables)<br/>- eatwell-guide ord 105 (4 sub-tables)"]

    %% Non-Table Routing
    TypeSwitch -- "type == 'heading'" --> AnchorHeading["Update Heading Path Breadcrumb<br/>(Do Not Emit Standalone Chunk)"]
    TypeSwitch -- "type in ['paragraph', 'list_item']" --> Accumulator["Block Accumulator"]

    AnchorHeading --> Accumulator
    Accumulator --> ListCheck{"Follows Lead-In Sentence?"}
    ListCheck -- "Yes" --> BindList["Bind Introductory Prose + Bullets Together"]
    ListCheck -- "No" --> SectionMerge{"Sibling Micro-Section?<br/>(< 300 tok)"}
    
    BindList --> BudgetCheck{"Accumulated Tokens<br/>>= 300 - 350?"}
    SectionMerge -- "Yes" --> Coalesce["Coalesce Sibling Sections"] --> BudgetCheck
    SectionMerge -- "No" --> BudgetCheck

    BudgetCheck -- "Yes / Section Boundary" --> EmitProse["Emit Enriched Prose Chunk<br/>Prepend [Document: X | Section: Y]"]
    BudgetCheck -- "No" --> Accumulator
```

#### 3.3.3 Core Assembly & Preservation Rules:

1. **Embedding Window Calibration (`all-MiniLM-L6-v2` & Gemini Compatibility)**:
   - Embedding models like `all-MiniLM-L6-v2` possess an effective sequence limit of **256 WordPiece tokens** (truncated at 512). Chunks exceeding 500 tokens suffer silent tail truncation during embedding generation, dropping critical information.
   - Calibrated target parameters:
     - `target_chunk_tokens`: **300 – 350 tokens** (~1,100 – 1,350 characters).
     - `max_chunk_tokens`: **450 tokens** (hard ceiling 500 tokens).
     - `overlap_blocks`: **1 block** (~30–50 tokens) between consecutive narrative chunks.
2. **Empirical Table Chunking & Preservation Protocol (The 12 Real Tables)**:
   - **Category A: Atomic Tables ($\le 400$ tokens, 10 of 12 tables)**:
     - Kept 100% intact as standalone single-block table chunks without row or cell splitting:
       - `kitchen-companion`: ordinals 92 (17 rows, ~390 tok), 178 (6 rows, ~132 tok), 214 (8 rows, ~380 tok), 216 (11 rows, ~641 tok - split into 2 row chunks), 232 (4 rows, ~113 tok), 252 (7 rows, ~181 tok), 254 (5 rows, ~318 tok), 285 (15 rows, ~358 tok).
       - `eatwell-guide`: ordinals 71 (3 rows, ~70 tok), 81 (11 rows, ~170 tok).
   - **Category B: Segmented Mega-Tables ($> 1,000$ tokens, 2 of 12 tables)**:
     - `cold-food-storage` ordinal 2 (53 rows, 4,557 chars, ~1,300 tokens):
       - If emitted as 1 chunk, queries for "fresh poultry", "eggs", or "leftovers" suffer vector truncation and semantic dilution.
       - **Strategy**: Segmented into 3 logical row clusters (~16–20 rows each, ~370–460 tokens), replicating the complete 4-column header:
         `| Food | Type | Refrigerator [40°F (4°C) or below] | Freezer [0°F (-18°C) or below] |`
         `| --- | --- | --- | --- |`
         across all 3 chunks:
         - *Segment 1 (rows 0–19)*: Salads, Hot dogs, Luncheon meat, Bacon, Sausages, Hamburger, Steaks, Chops, Roasts.
         - *Segment 2 (rows 20–36)*: Ham varieties, Fresh poultry (whole/pieces), Fin fish (fatty/lean).
         - *Segment 3 (rows 37–52)*: Shellfish, Eggs (raw/cooked), Soups, Stews, Leftovers (poultry/pizza).
     - `eatwell-guide` ordinal 105 (6 rows, 5,081 chars, ~1,450 tokens):
       - Each row contains an entire multi-paragraph food group description inside `What’s included?` and `Tips`.
       - **Strategy**: Segmented into 4 chunks (1–2 food groups per chunk, ~270–410 tokens), replicating the complete 4-column header:
         `| Food group | What’s included? | How much? | Tips |`
     - **Structural Invariant**: Slicing **never** bisects a table cell or splits midway through a row. All resulting sub-table chunks preserve 100% of table columns and valid markdown syntax.
3. **List Item & Lead-In Paragraph Binding (430 List Items)**:
   - 430 list items across 108 runs account for 43% of all blocks.
   - Lead-in sentences (e.g., ordinal 14 in `who-healthy-diet`: *"A healthy diet includes the following:"*) must **never** be severed from their subsequent bullet points into an isolated chunk.
   - The chunker groups lead-in sentences and their associated list items into cohesive chunks. If a bulleted list exceeds 450 tokens, it splits strictly at list item boundaries, carrying forward the parent heading path as context.
   - Headings (avg 24 chars) are metadata anchors and are never emitted as standalone chunks.
4. **Hierarchical Breadcrumb Context Injection**:
   - To ensure dense vectors capture hierarchical provenance, the indexed content string is formatted as:
     ```text
     [Document: {document_name} | Section: {' > '.join(heading_path)}]

     {chunk_content}
     ```
   - This ensures isolated bullet points (e.g., *"Less than 10% of total energy intake from free sugars"*) carry the semantic representation of `Healthy diet > FOR ADULTS`.
5. **Micro-Section Coalescing for Deep Hierarchies (`kitchen-companion`)**:
   - `kitchen-companion` contains 95 section transitions with heading depths up to 4. Several sub-sections contain only 1–2 short paragraphs (< 80 tokens).
   - Rather than generating fragmented micro-chunks that produce high cosine variance, the chunker coalesces adjacent sibling sections sharing the same parent hierarchy until reaching `target_chunk_tokens` (~350 tokens).
6. **Metadata Inheritance**:
   - Every generated chunk inherits:
     - `document_id`: Canonical document identifier.
     - `document_name`: Authoritative title from registry.
     - `publisher`: Responsible agency/organization.
     - `year`: Publication year.
     - `section_heading`: Joined `heading_path` breadcrumb string.
     - `source_url`: Verifiable deep URL.
     - `ordinal_range`: `[min_ordinal, max_ordinal]` of source blocks included.
     - `page_range`: `[min_page, max_page]` where available.

---

## 4. Online Execution Pipeline & Runtime Components

### 4.1 Step 1: Deterministic Safety Guardrail (Refusal 2)
Before generating embeddings or querying the vector store, all queries pass through the **Safety Guardrail Engine**.

#### Policy Boundaries:
1. **Medical Diagnosis & Disease Treatment**: Requests on managing medical conditions (e.g., diabetes diets, hypertension management, Crohn's disease diets).
2. **Personalized Caloric Targets**: Queries requesting specific daily calorie targets (e.g., *"How many calories should I eat to lose 10 pounds?"*).
3. **Target Body Weight & BMI Prescriptions**: Questions asking what the user should weigh or how to reach a target weight.

#### Implementation:
- **Enforcement Mechanism**: Deterministic rule matcher combining keyword regex patterns with a lightweight zero-shot classifier.
- **Execution**: If triggered, execution halts immediately with `RefusalResponse(type="OUT_OF_SCOPE_BY_DESIGN")`.

```python
# Conceptual Safety Guardrail Logic
MEDICAL_WEIGHT_PATTERNS = [
    r"\b(lose|drop|burn)\s+\d+\s*(kg|lbs?|pounds?|kilos?)\b",
    r"\bhow\s+many\s+calories\s+(should|can)\s+i\s+(eat|consume)\b",
    r"\bwhat\s+should\s+i\s+weigh\b",
    r"\b(cure|treat|reverse|manage)\s+(diabetes|cancer|hypertension|crohn|celiac)\b",
    r"\bmy\s+bmi\s+is\b",
]

def evaluate_safety_guardrail(query: str) -> Optional[ChatResponse]:
    for pattern in MEDICAL_WEIGHT_PATTERNS:
        if re.search(pattern, query, re.IGNORECASE):
            return ChatResponse(
                status="REFUSAL_OUT_OF_SCOPE",
                query=query,
                response_text=(
                    "I cannot provide medical advice, specific calorie targets, "
                    "or body weight recommendations. For personalized clinical or "
                    "weight-related guidance, please consult a registered dietitian "
                    "or qualified healthcare professional."
                )
            )
    return None
```

### 4.2 Step 2: Query Parsing & Filter Routing
The query router inspects the user query or explicit parameters for document scoping:
- **Explicit Scoping**: If the user specifies a document filter (e.g., via dropdown or parameter `filter_document_id="kitchen-companion"`), the retriever applies a metadata pre-filter:
  `filter_condition = {"document_id": {"$eq": filter_document_id}}`
- **Global Inquiries**: If no filter is specified, search executes across the entire vector index.

### 4.3 Step 3: Dual-Mode Vector Retrieval & Threshold Evaluation (Refusal 1)
- **Dense Embedding Model**: Fast semantic embedding model (e.g., `all-MiniLM-L6-v2` or `text-embedding-3-small`).
- **Retrieval Parameters**: `top_k = 6`, similarity threshold $\tau_{relevance} = 0.68$.
- **Corpus Gap Detection (Refusal 1)**:
  - If no chunks meet the threshold ($\max(\text{scores}) < \tau_{relevance}$), the query is flagged as unanswerable from the guidance documents.
  - The system enumerates all registered guidance documents searched and returns `RefusalResponse(type="NOT_IN_CORPUS")`.

```python
# Conceptual Retrieval Threshold Evaluation
if not retrieved_chunks or max_similarity < RELEVANCE_THRESHOLD:
    searched_docs = [
        f"{meta['title']} ({meta['publisher']}, {meta['year']})"
        for meta in corpus_registry.values()
    ]
    return ChatResponse(
        status="REFUSAL_NOT_IN_CORPUS",
        query=query,
        response_text=(
            "The official guidance documents in our corpus do not address this question. "
            "Searched sources:\n- " + "\n- ".join(searched_docs)
        ),
        searched_documents=list(corpus_registry.keys())
    )
```

### 4.4 Step 4: Cross-Document Segregation & Context Isolation
When retrieved chunks originate from multiple documents (e.g., cooking oils or food storage temperatures):
- **Chunks are segregated by `document_id`** before prompting the LLM.
- Chunks from different publishers are never aggregated into an unlabelled monolithic text block.

```markdown
[SOURCE 1: Healthy Diet Fact Sheet N°394 | WHO, 2020 | https://www.who.int/...]
<Chunks from WHO regarding fat intake: total fat <30%, saturated fat <10%>

[SOURCE 2: The Eatwell Guide | Public Health England / NHS, 2018 | https://www.gov.uk/...]
<Chunks from Eatwell Guide regarding choosing unsaturated oils and spreads in small amounts>
```

### 4.5 Step 5: Grounded Synthesis & Citation Attribution Engine (Groq LPU Orchestration)
The LLM synthesis layer leverages **Groq API** acceleration (LPU inference engine) orchestrating open models:
- **Primary Production Model**: `openai/gpt-oss-120b` (robust reasoning, strict adherence to negative constraints, high zero-shot grounding).
- **High-Efficiency Alternative**: `qwen/qwen3.6-27b` (ultra-fast sub-30ms TTFT, strong multi-lingual and structured tabular parsing).
- **Secondary / Fallback Model**: Google Gemini API (`gemini-2.5-flash`).

The LLM synthesizer generates the final response subject to strict negative constraints:

#### System Prompt Template:
```text
You are an authoritative Dietary and Food Safety Guidance Assistant.
Your answers are STRICTLY grounded in the provided context excerpts.

RULES:
1. Grounding: Answer ONLY based on the provided context chunks. NEVER use external or parametric knowledge.
2. Citation Requirement: Every recommendation or factual claim MUST include an exact inline citation:
   [Document Title | Publisher, Year | Source URL]
3. Multi-Document Structure: If multiple sources are provided, structure your answer into separate sections per source. NEVER combine statements from different publishers into a blended claim like "The guidelines recommend...".
4. Negative Constraint: Do not give personalized medical advice, calorie targets, or weight management goals.
5. Missing Details: If the context only partially covers the question, state clearly what is known and what is missing.
```

### 4.6 Step 6: Real-Time Token Streaming & Server-Sent Events (SSE)
To minimize time-to-first-token (TTFT) and provide a responsive conversational experience, the system implements an asynchronous Server-Sent Events (SSE) protocol on `/v1/chat/stream`:

1. **Protocol Transport**: Textual event stream (`Content-Type: text/event-stream; charset=utf-8`) conforming to the W3C EventSource standard.
2. **Event Types**:
   - `event: status`: Pipeline lifecycle updates (`{"stage": "safety_check" | "retrieving" | "synthesizing"}`).
   - `event: token`: Incremental synthesis token delta (`{"delta": str}`).
   - `event: citations`: Complete structured citation list emitted immediately upon synthesis completion (`{"citations": List[Citation], "sections": List[GroundedSection]}`).
   - `event: refusal`: Structured refusal payload emitted if guardrails or similarity thresholds trip (`{"status": "REFUSAL_NOT_IN_CORPUS" | "REFUSAL_OUT_OF_SCOPE", "message": str, "searched_documents": List[str]}`).
   - `event: done`: Execution telemetry including generation latency and chunk count (`{"latency_ms": int, "chunks_retrieved": int}`).
   - `event: error`: Unhandled runtime exceptions formatted for safe client consumption.

---

## 5. Front-End Chatbot Architecture & Next.js Model

The front-end is designed as a modern, accessible, evidence-transparent conversational application built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**. Its primary design imperative is **Verifiable Provenance**: claims, citations, and guidance boundaries are given first-class interactive visual prominence rather than buried in raw prose.

```mermaid
flowchart TB
    subgraph BrowserClient["Browser Client (React 19 / Client Components)"]
        ChatContainer["ChatContainer (Layout & Context Provider)"]
        ScopeSelector["ScopeSelector (Global vs. document_id Filter)"]
        MessageList["MessageList (Accessible Virtualized Stream)"]
        GroundedAnswer["GroundedAnswerView (Markdown + Citation Pills)"]
        MultiSourceView["MultiSourceComparisonView (Tabbed / Split View)"]
        CitationDrawer["CitationDrawer (Provenance & Chunk Inspector)"]
        RefusalView["RefusalCard (Corpus Gap vs. Safety Guardrail)"]
        ChatInput["ChatInputArea (Auto-expand, Shortcuts & Starter Pills)"]
    end

    subgraph NextServer["Next.js Server (BFF Layer)"]
        RSCPage["app/page.tsx (React Server Component Bootstrap)"]
        APIChatRoute["app/api/chat/route.ts (Streaming SSE Proxy)"]
        APIDocsRoute["app/api/documents/route.ts (Registry Cache & Fetch)"]
    end

    subgraph FastAPICore["Python FastAPI Backend"]
        FastAPIStream["POST /v1/chat/stream"]
        FastAPIDocs["GET /v1/documents"]
    end

    RSCPage -->|Pre-renders Layout & Corpus Metadata| BrowserClient
    ChatContainer --> ScopeSelector
    ChatContainer --> MessageList
    ChatContainer --> ChatInput
    MessageList --> GroundedAnswer
    MessageList --> MultiSourceView
    MessageList --> RefusalView
    GroundedAnswer -.->|User clicks citation pill| CitationDrawer

    ChatInput -->|POST Chat Payload| APIChatRoute
    APIDocsRoute -->|Cached GET| FastAPIDocs
    APIChatRoute -->|Upstream SSE Stream| FastAPIStream
    FastAPIStream -->|SSE Events| APIChatRoute
    APIChatRoute -->|Forwarded SSE Events| MessageList
```

### 5.1 Next.js App Router Architecture & BFF Pattern
The application leverages the Next.js App Router (`frontend/src/app`) to separate server-side data fetching from rich client interactions:

1. **React Server Components (RSC) for Bootstrap**:
   - `app/layout.tsx` and `app/page.tsx` execute server-side to fetch authoritative corpus metadata from `/v1/documents`.
   - The initial HTML payload includes pre-rendered corpus registries, system descriptions, SEO metadata, and accessibility headers, ensuring near-instant Initial Server Response (TTFB).
2. **Backend-for-Frontend (BFF) Route Handlers**:
   - `app/api/chat/route.ts` acts as a secure, edge-compatible intermediary between the client browser and the FastAPI backend.
   - **Responsibilities**:
     - Strips and validates user inputs using Zod schemas.
     - Eliminates client-side Cross-Origin Resource Sharing (CORS) complications.
     - Proxies the `POST /v1/chat/stream` response as a streaming `ReadableStream`, handling backpressure and propagating upstream network disconnects.
     - Protects internal network topologies and API keys.

### 5.2 Client-Side Chatbot State Machine & Hook Lifecycle
The conversation lifecycle is governed by an explicit Finite State Machine (FSM) implemented in the `useChatbot` custom hook.

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Submitting : User submits query
    Submitting --> SafetyEvaluation : Dispatched to BFF /api/chat
    SafetyEvaluation --> RefusalOutOfScope : Guardrail Refusal 2 Triggered (Medical/Calorie/Weight)
    SafetyEvaluation --> Retrieving : Safe inquiry (PASS)
    Retrieving --> RefusalNotInCorpus : Guardrail Refusal 1 (Below 0.68 Similarity / Empty)
    Retrieving --> StreamingSynthesis : Chunks retrieved above threshold
    StreamingSynthesis --> GroundedComplete : Stream finished + Citations received
    StreamingSynthesis --> ErrorState : Network or upstream failure
    RefusalOutOfScope --> Idle : New query submitted
    RefusalNotInCorpus --> Idle : New query submitted
    GroundedComplete --> Idle : Ready for next turn
    ErrorState --> Idle : User clicks Retry
```

#### State Definitions & UI Behaviors:
- **`Idle`**: Input field enabled. Starter query suggestions visible when message history is empty. Scope selector interactive.
- **`Submitting`**: Optimistic user message added to thread. Input temporarily locked. Abort controller initialized.
- **`SafetyEvaluation` / `Retrieving`**: Visual skeleton pulsing indicator with phase status badge (*"Evaluating official safety parameters..."* or *"Searching 7 guidance publications..."*).
- **`StreamingSynthesis`**: Incremental token appending via React 19 concurrent transitions. Inline markdown renderer parses headers, lists, and markdown tables with a smooth streaming cursor. Stop button enabled.
- **`GroundedComplete`**: Stream finalized. Inline citation badges highlighted and interactive. Provenance drawer synchronized.
- **`RefusalNotInCorpus`**: Amber alert card rendered with an itemized, interactive list of all 7 queried guidance publications.
- **`RefusalOutOfScope`**: Crimson policy card rendered with clinical disclaimer and explicit recommendation to consult healthcare professionals.
- **`ErrorState`**: Toast alert and inline message error card with one-click retry trigger.

### 5.3 UI Component Model & Visual Hierarchy

#### 1. ScopeSelector Component (`ScopeSelector.tsx`)
- Allows the user to toggle between aggregate corpus retrieval (**"All 7 Guidance Documents"**) and single-document filtered inquiries (**"Cold Food Storage Chart"**, **"WHO Healthy Diet"**, etc.).
- Renders as a modern horizontal pill bar on desktop and an accessible dropdown menu on mobile.
- Shows publisher badges (e.g., `FDA`, `WHO`, `USDA`, `UK FSA`) and publication years.

#### 2. MessageList & MessageItem Components
- Virtualized message stream ensuring frictionless 60 FPS scrolling during heavy token streaming.
- Markdown rendering powered by `react-markdown` with `remark-gfm` for tables and lists.
- Integrated clipboard copy for answers and citation references.

#### 3. GroundedAnswerView & Inline Citation Badges
- Replaces raw citation text with interactive inline citation pills:
  `[Cold Food Storage Chart | FDA/FoodSafety.gov, 2021]`
- Hovering displays a tooltip preview with the publication title and publisher.
- Clicking dispatches an event to the global UI context to slide open the **CitationDrawer** focused on that specific source.

#### 4. MultiSourceComparisonView
- When an inquiry retrieves evidence from multiple publishers (e.g., WHO guidelines vs. UK Eatwell Guide on fat or oil intake), synthesis is presented in a **segmented multi-card layout** or **tabbed side-by-side view**.
- Strictly prevents cognitive blending of distinct agency recommendations. Each card displays its own publisher emblem, publication date, and section breadcrumbs.

#### 5. CitationDrawer Component (`CitationDrawer.tsx`)
- A slide-over flyout panel (or bottom sheet on mobile) displaying complete provenance for every retrieved chunk:
  - **Publication Title & Publisher**: Official badge and logo.
  - **Publication Year & Category**: Tagged as `Food Safety` or `Dietary Nutrition`.
  - **Hierarchy Breadcrumb**: `heading_path` list (e.g., `Cold Food Storage Chart > Fresh poultry`).
  - **Verbatim Excerpt**: Exact chunk content extracted from `data/blocks.jsonl`.
  - **Relevance Metrics**: Cosine similarity score ($\ge 0.68$) and source block ordinal index.
  - **Official Verification Link**: Deep link to canonical external URL (e.g., `https://www.foodsafety.gov/...`).

#### 6. RefusalCard Component (`RefusalCard.tsx`)
- Dedicated visual treatments to avoid confusing system failures with intentional guardrail enforcement:
  - **Type 1 (Information Gap / Not in Corpus)**:
    - Ambient theme: Amber border and soft yellow background.
    - Message: *"The official dietary and food safety documents in our corpus do not contain verified guidance on this topic."*
    - Interactive Pill Grid: Displays all 7 searched documents with click-to-view metadata.
  - **Type 2 (Policy / Safety Boundary)**:
    - Ambient theme: Rose/crimson border with safety shield icon.
    - Message: *"I cannot provide personalized calorie targets, medical nutrition advice, or body weight prescriptions."*
    - Educational Callout: Clear explanation of safety boundaries with guidance to consult a registered dietitian (RD) or primary care physician.

#### 7. ChatInputArea Component (`ChatInputArea.tsx`)
- Auto-expanding textarea with keyboard shortcuts (`Enter` to submit, `Shift + Enter` for line breaks).
- Character counter and maximum length validator (500 characters).
- Suggestion chips for representative starter prompts:
  - *"How long can cooked chicken stay in the fridge?"*
  - *"What are the WHO daily free sugar recommendations?"*
  - *"What temperature should leftovers be reheated to?"*
  - *"What are the Five Keys to Safer Food?"*

### 5.4 Real-Time Streaming SSE Protocol (Client-Side)
The Next.js client consumes SSE streams via the native Web Fetch API and `ReadableStreamDefaultReader`:

```typescript
// Conceptual SSE Consumer in useChatbot Hook
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, filterDocumentId: activeFilter }),
  signal: abortController.signal
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  // Parse SSE format: event: <type>\ndata: <json>\n\n
  processSSEChunk(chunk);
}
```

### 5.5 Accessibility (a11y) & Usability Standards
1. **Screen Reader Announcements**: Streaming assistant output is wrapped in an `aria-live="polite"` container, ensuring real-time accessibility without interrupting active speech synthesizers.
2. **Keyboard Navigation & Focus Management**:
   - Citation pills are focusable buttons (`tabindex="0"`) with clear focus rings.
   - The Citation Drawer implements an accessible focus trap with `Escape` key close handlers (via Radix UI Dialog / Sheet).
3. **WCAG 2.1 AA Color Contrast**: All amber and rose refusal cards maintain a minimum 4.5:1 text-to-background contrast ratio in both Light and Dark display modes.

### 5.6 Developer Diagnostic & Corpus Explorer Architecture (`/explorer`)
To completely eliminate duplicate Python UI frameworks (such as Streamlit) and maintain a single unified TypeScript/React codebase, the Next.js frontend integrates a dedicated internal diagnostic workspace mounted at `app/explorer/page.tsx`:

```mermaid
flowchart TD
    subgraph ExplorerApp["React 19 Diagnostic Explorer (/explorer)"]
        TabSelector["Multi-Tab Navigation Bar"]
        Tab1["BlockExplorer.tsx<br/>Browse 1,001 raw blocks by doc & type"]
        Tab2["ChunkInspector.tsx<br/>Inspect assembled chunks, hierarchy & tables"]
        Tab3["RetrievalDebugger.tsx<br/>Test query similarity & threshold (tau=0.53)"]
        Tab4["GuardrailDebugger.tsx<br/>Test regex pattern matching & safety filters"]
    end

    TabSelector --> Tab1
    TabSelector --> Tab2
    TabSelector --> Tab3
    TabSelector --> Tab4

    Tab1 --> FastAPIDocs["BFF /api/documents & /v1/documents"]
    Tab3 --> FastAPIChat["BFF /api/chat & /v1/chat"]
```

1. **Block Explorer (`BlockExplorer.tsx`)**:
   - Interactive document selection across all 7 corpus publications.
   - Filterable table displaying raw records from `data/blocks.jsonl` by `type` (`table`, `heading`, `paragraph`, `list_item`).
   - Table block modal preview verifying zero cell truncation and clean Markdown representation.
2. **Chunk Inspector (`ChunkInspector.tsx`)**:
   - Displays chunk boundaries, exact token counts, and parent `heading_path` breadcrumb hierarchies.
   - Visual badges for atomic intact tables and sub-table split groups.
3. **Retrieval & Similarity Debugger (`RetrievalDebugger.tsx`)**:
   - Real-time search query sandbox allowing selection between Global and Scoped retrieval.
   - Interactive visual indicator comparing query cosine similarity scores against calibrated threshold ($\tau = 0.53$).
   - Displays top-$K$ candidate chunks, rank ordering, and document provenance badges.
4. **Guardrail Sandbox (`GuardrailDebugger.tsx`)**:
   - Live regex matcher evaluating user prompts against medical diagnosis, calorie counting, and weight loss restriction patterns.
   - Highlights triggering substring tokens with instant explanation of refusal policy.

---

## 6. Sequence Workflows

### 6.1 Next.js Real-Time Streaming Chat Flow (SSE)
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Next.js Client (React 19)
    participant BFF as Next.js BFF (/api/chat)
    participant Gateway as FastAPI Gateway (/v1/chat/stream)
    participant Guardrail as Safety Guardrail
    participant Router as Query Router
    participant VectorDB as ChromaDB Vector Store
    participant Synthesizer as LLM Synthesizer (Streaming)

    User->>Browser: Types prompt & clicks Send
    Browser->>Browser: Set state to SUBMITTING (Optimistic User Bubble)
    Browser->>BFF: POST /api/chat {"query": "...", "filter_document_id": null}
    BFF->>Gateway: POST /v1/chat/stream
    Gateway->>Guardrail: check_safety(query)
    
    alt Medical / Calorie / Weight Violation (Refusal 2)
        Guardrail-->>Gateway: OUT_OF_SCOPE_BY_DESIGN
        Gateway-->>BFF: SSE event: refusal {"status": "REFUSAL_OUT_OF_SCOPE", ...}
        BFF-->>Browser: Forward SSE event: refusal
        Browser->>Browser: Transition to REFUSAL_OUT_OF_SCOPE (Render Crimson Card)
    else Safe Inquiry
        Guardrail-->>Gateway: PASS
        Gateway-->>BFF: SSE event: status {"stage": "retrieving"}
        BFF-->>Browser: Forward SSE event: status
        Gateway->>Router: parse_and_route(query)
        Router->>VectorDB: search(query_vector, top_k=6, threshold=0.68)
        
        alt Below Similarity Threshold / Empty (Refusal 1)
            VectorDB-->>Gateway: Chunks below 0.68
            Gateway-->>BFF: SSE event: refusal {"status": "REFUSAL_NOT_IN_CORPUS", ...}
            BFF-->>Browser: Forward SSE event: refusal
            Browser->>Browser: Transition to REFUSAL_NOT_IN_CORPUS (Render Amber Card)
        else Relevant Chunks Identified
            VectorDB-->>Gateway: Return top-k chunks with metadata
            Gateway->>Synthesizer: stream_synthesis(segregated_chunks, query)
            Gateway-->>BFF: SSE event: status {"stage": "synthesizing"}
            BFF-->>Browser: Forward SSE event: status
            
            loop Token Generation Loop
                Synthesizer-->>Gateway: emit token delta
                Gateway-->>BFF: SSE event: token {"delta": "..."}
                BFF-->>Browser: Forward SSE event: token
                Browser->>Browser: Append token delta to streaming message bubble
            end
            
            Synthesizer-->>Gateway: complete synthesis
            Gateway-->>BFF: SSE event: citations {"citations": [...], "sections": [...]}
            BFF-->>Browser: Forward SSE event: citations
            Gateway-->>BFF: SSE event: done {"latency_ms": 780}
            BFF-->>Browser: Forward SSE event: done
            Browser->>Browser: Transition to GROUNDED_COMPLETE & activate Citation Drawer
        end
    end
```

### 6.2 Standard Grounded Query (Happy Path REST)
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Gateway as API Gateway
    participant Guardrail as Safety Guardrail
    participant Router as Query Router
    participant VectorDB as ChromaDB Vector Store
    participant Synthesizer as LLM Synthesizer
    participant Formatter as Citation Engine

    User->>Gateway: POST /v1/chat {"query": "How long can fresh chicken stay in the fridge?"}
    Gateway->>Guardrail: check_safety(query)
    Guardrail-->>Gateway: PASS (Safe inquiry)
    Gateway->>Router: parse_and_route(query)
    Router->>VectorDB: search(query_vector, top_k=6)
    VectorDB-->>Router: return [chunks with similarity >= 0.68 from cold-food-storage]
    Router->>Synthesizer: generate_grounded_answer(segregated_chunks, query)
    Synthesizer->>Formatter: format_with_citations(llm_output, chunks)
    Formatter-->>Gateway: structured_response
    Gateway-->>User: 200 OK (Grounded answer citing Cold Food Storage Chart)
```

### 6.3 Document-Filtered Query
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Gateway as API Gateway
    participant Router as Query Router
    participant VectorDB as ChromaDB Vector Store

    User->>Gateway: POST /v1/chat {"query": "What are the 5 keys?", "filter_document_id": "who-five-keys"}
    Gateway->>Router: parse_and_route(query, filter="who-five-keys")
    Router->>VectorDB: search(query_vector, where={"document_id": "who-five-keys"})
    VectorDB-->>Router: return [chunks exclusively from who-five-keys]
    Router-->>Gateway: Grounded synthesis & citations from who-five-keys
    Gateway-->>User: 200 OK
```

### 6.4 Refusal Flow 1: Information Gap (Not in Corpus)
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Gateway as API Gateway
    participant VectorDB as ChromaDB Vector Store
    participant RefusalHandler as Corpus Refusal Handler

    User->>Gateway: POST /v1/chat {"query": "How long can raw camel milk be stored at room temperature?"}
    Gateway->>VectorDB: search(query_vector)
    VectorDB-->>Gateway: return [] (All scores < 0.68 threshold)
    Gateway->>RefusalHandler: format_not_in_corpus(searched_documents)
    RefusalHandler-->>Gateway: RefusalResponse(type="NOT_IN_CORPUS")
    Gateway-->>User: 200 OK ("The guidance does not cover this topic. Searched: [Cold Food Storage, WHO Healthy Diet...]")
```

### 6.5 Refusal Flow 2: Medical / Calorie Guardrail (Out of Scope by Design)
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Gateway as API Gateway
    participant Guardrail as Safety Guardrail
    participant RefusalHandler as Policy Refusal Handler

    User->>Gateway: POST /v1/chat {"query": "I weigh 95kg. How many calories should I eat to drop to 80kg?"}
    Gateway->>Guardrail: check_safety(query)
    Guardrail-->>Gateway: TRIGGERED (Rule: Calorie/Weight Target Violation)
    Gateway->>RefusalHandler: format_out_of_scope()
    Note over Gateway,RefusalHandler: Vector Store & LLM synthesis completely bypassed
    RefusalHandler-->>Gateway: RefusalResponse(type="OUT_OF_SCOPE_BY_DESIGN")
    Gateway-->>User: 200 OK ("I cannot provide calorie targets or weight loss recommendations. Consult a professional.")
```

---

## 7. Detailed Module & Data Contracts

### 7.1 Python Backend Schemas (`src/models/schemas.py`)

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Tuple, Any

class BlockRecord(BaseModel):
    """Schema matching records in data/blocks.jsonl"""
    document_id: str
    ordinal: int
    type: Literal["heading", "paragraph", "list_item", "table"]
    text: str
    heading_path: List[str]
    page: Optional[int] = None
    level: Optional[int] = None
    header: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None
    caption: Optional[str] = None

class DocumentMetadata(BaseModel):
    document_id: str
    title: str
    publisher: str
    year: int
    category: Literal["nutrition", "food_safety"]
    source_url: str
    description: str

class Chunk(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    publisher: str
    year: int
    section_heading: str
    source_url: str
    content: str
    block_ordinals: List[int]
    page_numbers: List[int]
    similarity_score: Optional[float] = None

class ChatRequest(BaseModel):
    query: str
    filter_document_id: Optional[str] = None

class Citation(BaseModel):
    document_name: str
    publisher: str
    year: int
    source_url: str
    section_heading: str
    chunk_id: Optional[str] = None
    verbatim_text: Optional[str] = None
    similarity_score: Optional[float] = None

class GroundedSection(BaseModel):
    document_name: str
    publisher: str
    year: int
    source_url: str
    summary_text: str
    citations: List[Citation] = []

class ChatResponse(BaseModel):
    status: Literal["SUCCESS", "REFUSAL_NOT_IN_CORPUS", "REFUSAL_OUT_OF_SCOPE"]
    query: str
    response_text: str
    sections: List[GroundedSection] = []
    citations: List[Citation] = []
    searched_documents: List[str] = []
    latency_ms: Optional[int] = None
```

### 7.2 TypeScript Frontend Data Contracts (`frontend/src/types/chat.ts`)

```typescript
/**
 * Frontend TypeScript Data Models matching FastAPI and SSE Stream specifications
 */

export type DocumentCategory = 'nutrition' | 'food_safety';

export interface CorpusDocument {
  documentId: string;
  title: string;
  publisher: string;
  year: number;
  category: DocumentCategory;
  sourceUrl: string;
  description: string;
}

export interface CitationItem {
  citationId: string;
  documentName: string;
  publisher: string;
  year: number;
  sourceUrl: string;
  sectionHeading: string;
  chunkId?: string;
  verbatimText?: string;
  similarityScore?: number;
}

export interface GroundedSectionItem {
  documentName: string;
  publisher: string;
  year: number;
  sourceUrl: string;
  summaryText: string;
  citations: CitationItem[];
}

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatTurnStatus =
  | 'IDLE'
  | 'SUBMITTING'
  | 'EVALUATING_SAFETY'
  | 'RETRIEVING'
  | 'STREAMING'
  | 'SUCCESS'
  | 'REFUSAL_NOT_IN_CORPUS'
  | 'REFUSAL_OUT_OF_SCOPE'
  | 'ERROR';

export interface RefusalPayload {
  type: 'NOT_IN_CORPUS' | 'OUT_OF_SCOPE_BY_DESIGN';
  message: string;
  searchedDocuments?: string[];
  suggestedAction?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: ChatTurnStatus;
  timestamp: number;
  filterDocumentId?: string | null;
  sections?: GroundedSectionItem[];
  citations?: CitationItem[];
  refusal?: RefusalPayload;
  latencyMs?: number;
}

export interface ChatRequestPayload {
  query: string;
  filterDocumentId?: string | null;
}

// SSE Protocol Event Shapes
export type SSEEvent =
  | { event: 'status'; data: { stage: 'safety_check' | 'retrieving' | 'synthesizing' } }
  | { event: 'token'; data: { delta: string } }
  | { event: 'citations'; data: { citations: CitationItem[]; sections: GroundedSectionItem[] } }
  | { event: 'refusal'; data: RefusalPayload }
  | { event: 'done'; data: { latencyMs: number; chunksRetrieved: number } }
  | { event: 'error'; data: { message: string; code?: string } };
```

### 7.3 Next.js BFF Route Handler (`frontend/src/app/api/chat/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // or 'edge'
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, filterDocumentId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const backendUrl = process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8000';
    const upstreamRes = await fetch(`${backendUrl}/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.trim(),
        filter_document_id: filterDocumentId || null,
      }),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream error: ${errorText}` },
        { status: upstreamRes.status }
      );
    }

    // Stream the SSE body directly to the client browser
    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal BFF Gateway Error' },
      { status: 500 }
    );
  }
}
```

---

## 8. Technology Stack & Component Selection

| Component | Selected Technology | Alternative Considered | Rationale |
|---|---|---|---|
| **Data Source** | Local `data/blocks.jsonl` | Web scraping, live PDF parsing | Eliminates network latency, parsing flakiness, and legal/scraping rate limits. Guaranteed reproducibility with 1,001 canonical pre-parsed blocks. |
| **Vector Database** | `ChromaDB` (Embedded) | `FAISS`, `Qdrant` | Lightweight, native metadata filtering on `document_id`, local persistent storage, zero Docker setup required. |
| **Embedding Model** | `all-MiniLM-L6-v2` or `text-embedding-3-small` | `bge-large-en` | Fast local inference, robust semantic alignment with public health prose. |
| **LLM Synthesis & Orchestration** | **Groq API** (`openai/gpt-oss-120b` / `qwen/qwen3.6-27b`) | Google Gemini (`gemini-2.5-flash`), Claude 3.5 Sonnet, GPT-4o | Sub-30ms TTFT via Groq LPUs, open weights transparency, outstanding instruction following for negative constraints, real-time token streaming, and strict citation formatting. *(Gemini retained as secondary/legacy fallback)*. |
| **API Framework** | `FastAPI` + `Pydantic v2` | Flask | Asynchronous, typed endpoints with automatic OpenAPI documentation and native SSE streaming. |
| **User Interface** | **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS** | Streamlit *(Rejected)* | Production-grade web architecture, sub-second TTFB with React Server Components, real-time SSE streaming, accessible interactive citation flyout drawers, multi-document tabbed comparisons, and responsive desktop/mobile layouts. Replaces Streamlit entirely for both user-facing conversational chat (`/`) and developer-facing corpus & vector diagnostic inspection (`/explorer`), eliminating duplicate Python UI runtimes and ensuring a single unified React codebase. |
| **UI Primitives & Icons** | `Radix UI` / `shadcn/ui` + `Lucide React` | Material UI, AntD | Unstyled, fully accessible (WCAG 2.1 AA) primitives with minimal bundle footprint and full design customization. |
| **Markdown & Syntax** | `react-markdown` + `remark-gfm` | Draft.js | Lightweight parsing of LLM markdown outputs, tables, and custom inline citation pill tokens. |
| **Frontend Hosting & Edge CDN** | **Vercel** | AWS Amplify, Netlify | Native Next.js 15 App Router optimization, Global Edge CDN, automated PR preview deployments, zero-config SSR & streaming. |
| **Backend Hosting & Containerization** | **Railway** | Render, Fly.io, AWS ECS | Long-lived containerized Python 3.11 runtime, native support for heavy dependencies (`torch`, `sentence-transformers`, `chromadb`), persistent/baked vector store, zero cold-start latency, auto-restart health probes. |
| **CI/CD Automation** | **GitHub Actions** + Railway & Vercel Integrations | Jenkins, CircleCI | Unified automated test gate (pytest + Next.js build), automated preview deployments on PRs, atomic production releases on merge. |
| **Testing & Evaluation** | `pytest` + `Ragas` (Backend) / `Vitest` + `Playwright` (Frontend) | TruLens / Cypress | Comprehensive verification across guardrail regexes, chunking integrity, SSE streaming robustness, and WCAG accessibility. |

---

## 9. Repository Directory Layout

```
rag-nutrison/
├── .github/
│   └── workflows/
│       └── ci-cd.yml                       # Unified GitHub Actions pipeline (Lint, Test, Deploy)
├── Dockerfile                              # Multi-stage production backend container for Railway
├── .dockerignore                           # Build context exclusions
├── railway.json                            # Railway deployment configuration & health probe
├── Procfile                                # Web process definition for Railway
├── frontend/                               # Next.js 15 Web Application
│   ├── vercel.json                         # Vercel deployment headers & streaming configuration
│   ├── package.json                        # Frontend dependencies (Next.js 15, React 19, Tailwind)
│   ├── tsconfig.json                       # Strict TypeScript configuration
│   ├── tailwind.config.ts                  # Design tokens, color schemes, animations
│   ├── next.config.mjs                     # Next.js configuration & environment bindings
│   ├── public/                             # Static assets, agency emblems, favicons
│   └── src/
│       ├── app/
│       │   ├── layout.tsx                  # Root layout: font provider, theme, accessible meta
│       │   ├── page.tsx                    # Main chat interface (RSC bootstrap + corpus fetch)
│       │   ├── explorer/
│       │   │   └── page.tsx                # Interactive Diagnostic & Corpus Explorer (React/Next.js)
│       │   ├── globals.css                 # Tailwind directives and CSS variables
│       │   └── api/
│       │       ├── chat/
│       │       │   └── route.ts            # BFF SSE streaming proxy to FastAPI /v1/chat/stream
│       │       ├── documents/
│       │       │   └── route.ts            # Corpus registry metadata proxy & cache
│       │       ├── blocks/
│       │       │   └── route.ts            # Diagnostic raw block reader proxy
│       │       ├── chunks/
│       │       │   └── route.ts            # Diagnostic assembled chunk inspector proxy
│       │       ├── retrieval/debug/
│       │       │   └── route.ts            # Diagnostic similarity debugger proxy
│       │       └── guardrails/check/
│       │           └── route.ts            # Diagnostic guardrail tester proxy
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatContainer.tsx       # Main chat orchestrator & conversation context
│       │   │   ├── ChatHeader.tsx          # Top bar, corpus freshness badge, source registry modal
│       │   │   ├── ScopeSelector.tsx       # Interactive document filter pill-bar / select menu
│       │   │   ├── MessageList.tsx         # Accessible virtualized message thread
│       │   │   ├── MessageItem.tsx         # User bubble and Assistant bubble wrappers
│       │   │   ├── GroundedAnswerView.tsx  # Markdown renderer with clickable inline citation pills
│       │   │   ├── MultiSourceView.tsx     # Tabbed / side-by-side view for multi-agency answers
│       │   │   ├── CitationDrawer.tsx      # Slide-over flyout panel for chunk excerpts & links
│       │   │   ├── RefusalCard.tsx         # Distinct amber (gap) & crimson (safety) refusal cards
│       │   │   └── ChatInputArea.tsx       # Textarea, starter suggestion chips, submit/stop controls
│       │   ├── explorer/
│       │   │   ├── BlockExplorer.tsx       # Browse 1,001 raw blocks by doc & type
│       │   │   ├── ChunkInspector.tsx      # Inspect assembled chunks, hierarchy & tables
│       │   │   ├── RetrievalDebugger.tsx   # Interactive query similarity tester (tau=0.53)
│       │   │   └── GuardrailDebugger.tsx   # Live regex pattern matching sandbox
│       │   └── ui/                         # shadcn/ui primitives (button, badge, sheet, tooltip, tabs)
│       ├── hooks/
│       │   ├── useChatbot.ts               # Core conversational state machine & SSE stream reader
│       │   └── useCorpusRegistry.ts        # Hook fetching and caching the 7 corpus publications
│       ├── lib/
│       │   ├── sse-parser.ts               # EventSource text stream decoder
│       │   └── utils.ts                    # Utility class mergers (clsx, tailwind-merge)
│       └── types/
│           └── chat.ts                     # TypeScript data contracts, message states & SSE types
├── config/
│   ├── corpus_registry.yaml                # Provenance metadata for the 7 documents in blocks.jsonl
│   └── settings.py                         # Environment settings, thresholds, model paths
├── data/
│   ├── blocks.jsonl                        # Canonical source: 1,001 pre-parsed blocks
│   └── vectordb/                           # Local ChromaDB persistent vector storage
├── doc/
│   ├── problemStatement.txt                # Original brief
│   ├── problemStatement.md                 # Detailed functional specification
│   ├── architecture.md                     # Detailed System Architecture
│   ├── implemenation-phase.md              # Multi-phase engineering roadmap
│   └── evaluation-and-edge-cases.md        # Quality metrics & edge case benchmark
├── scripts/
│   ├── eval_benchmark.py                   # Automated Ragas & latency benchmark suite
│   ├── retriever.py                        # Standalone retrieval benchmark utility
│   ├── verify_phase6.py                    # Phase 6 diagnostic explorer test runner
│   ├── verify_phase7.py                    # Phase 7 conversational UI test runner
│   └── verify_deployment.py                # Post-deployment live smoke verification script
├── src/                                    # Python Backend & RAG Pipeline
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                          # FastAPI gateway application
│   │   └── routes.py                       # /v1/chat, /v1/chat/stream, /v1/documents endpoints
│   ├── guardrails/
│   │   ├── __init__.py
│   │   ├── safety_filter.py                # Medical, calorie & weight loss deterministic block
│   │   └── refusal_handlers.py             # Refusal 1 and Refusal 2 response formatters
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── block_reader.py                 # Reader for data/blocks.jsonl
│   │   └── block_chunker.py                # Hierarchy and table preserving chunk assembler
│   ├── retrieval/
│   │   ├── __init__.py
│   │   ├── vector_store.py                 # ChromaDB client and index builder
│   │   └── retriever.py                    # Global & document_id filtered dense retrieval
│   ├── generation/
│   │   ├── __init__.py
│   │   ├── prompt_templates.py             # Strict grounding & citation prompts
│   │   ├── synthesizer.py                  # LLM synthesizer with multi-document segregation
│   │   └── citation_formatter.py           # Citation verification and syntax formatter
│   └── models/
│       ├── __init__.py
│       └── schemas.py                      # Pydantic data schemas (BlockRecord, Chunk, etc.)
├── tests/
│   ├── test_guardrails.py                  # Tests for Refusal 2 (medical/weight/calorie)
│   ├── test_chunking.py                    # Tests for table preservation & heading continuity
│   ├── test_retrieval.py                   # Tests for global vs. filtered retrieval
│   ├── test_synthesis.py                   # Tests for citation formatting & Refusal 1
│   ├── test_streaming.py                   # Tests for FastAPI SSE stream outputs
│   ├── test_api.py                         # End-to-end FastAPI endpoint tests
│   ├── test_edge_cases.py                  # Table integrity & query edge cases
│   └── test_evaluation.py                  # Quantitative retrieval & citation benchmarks
├── requirements.txt                         # Backend Python dependencies
└── README.md                                # Documentation, chunking trade-offs & startup guide
```

---

## 10. Production Deployment Architecture & CI/CD Pipeline

The Dietary Guidance RAG Chatbot employs a **Multi-Cloud Hybrid Deployment Model** pairing **Vercel** for the high-performance Next.js 15 frontend with **Railway** for the containerized Python/FastAPI backend and local vector database.

```mermaid
flowchart TB
    subgraph Users["End Users & Browsers"]
        Browser["User Web Browser<br/>(Desktop / Mobile)"]
    end

    subgraph VercelCloud["Vercel Cloud Platform (Frontend)"]
        VercelCDN["Vercel Global Edge Network<br/>(Anycast CDN, SSL Termination)"]
        NextApp["Next.js 15 App Router<br/>(React Server Components & SSR)"]
        NextBFF["Next.js Route Handlers / BFF Gateway<br/>(/api/chat, /api/documents)<br/>(Streaming SSE Proxy, maxDuration: 60s)"]
        VercelCDN --> NextApp --> NextBFF
    end

    subgraph RailwayCloud["Railway Cloud Platform (Backend)"]
        RailwayLB["Railway Ingress & Load Balancer<br/>(Automatic HTTPS, Dynamic $PORT)"]
        FastAPIService["FastAPI Gateway Container<br/>(Python 3.11, Uvicorn, 2 Workers)<br/>(CORS: *.vercel.app + Custom Domain)"]
        
        subgraph ContainerRuntime["Baked Container Image Filesystem"]
            ChromaStore[("ChromaDB Persistent Store<br/>(data/vectordb - Baked)")]
            BlocksCorpus[("Canonical Corpus Data<br/>(data/blocks.jsonl - 1,001 Blocks)")]
            EmbeddingModel["Local SentenceTransformers<br/>(all-MiniLM-L6-v2, Offline Mode)"]
        end
        
        RailwayLB --> FastAPIService
        FastAPIService --> ChromaStore
        FastAPIService --> BlocksCorpus
        FastAPIService --> EmbeddingModel
    end

    subgraph ExternalLLM["External Inference Cloud"]
        GroqCloud["Groq Cloud LPU Platform<br/>(openai/gpt-oss-120b)<br/>(Sub-30ms TTFT Streaming)"]
    end

    %% Network Flows
    Browser -- "1. HTTPS Requests / SSE Connection" --> VercelCDN
    NextBFF -- "2. Upstream HTTPS REST & SSE Stream (/v1/chat/stream)" --> RailwayLB
    FastAPIService -- "3. Dense Semantic Search" --> ChromaStore
    FastAPIService -- "4. Fast Low-Latency Generation" --> GroqCloud
    GroqCloud -- "5. Token Chunks" --> FastAPIService
    FastAPIService -- "6. SSE Wire Events" --> NextBFF
    NextBFF -- "7. Chunked SSE Stream (keep-alive)" --> Browser
```

### 10.1 Multi-Cloud Hybrid Deployment Model

| Layer | Provider | Technical Rationale | Operational SLA / Capabilities |
|---|---|---|---|
| **Frontend & BFF** | **Vercel** | • Native optimization for Next.js 15 App Router, React 19, and Server Components.<br/>• Global Anycast Edge CDN guarantees $< 50$ ms TTFB for static UI assets and cached document catalogs.<br/>• Automated preview branch deployments for every pull request.<br/>• Built-in Web Vitals telemetry, zero server maintenance, and atomic zero-downtime rollouts. | 99.99% Edge SLA, HTTP/3 & TLS 1.3, Serverless Function execution with streaming `Response(body)` pass-through. |
| **Backend & RAG Pipeline** | **Railway** | • Non-ephemeral, long-lived containerized Python 3.11 execution environment.<br/>• Supports heavy PyTorch and `sentence-transformers` dependencies without cold-start memory or package-size penalties.<br/>• Bakes the persistent ChromaDB database (`data/vectordb`) directly into the container image, ensuring zero runtime download latency.<br/>• Native support for dynamic `$PORT` environment variable binding and automated `/v1/health` container restarts. | 99.95% Compute SLA, dedicated memory (1-2 GB RAM), automatic HTTPS endpoint (`*.up.railway.app`), integrated build logs. |

### 10.2 Architectural Topology & Network Flow

1. **Client to Vercel**: The user accesses the web application over secure HTTPS (`https://dietary-guidance.vercel.app`). Static assets and pre-rendered shells are served directly from Vercel Edge caches.
2. **BFF Streaming Relay (`/api/chat` -> `/v1/chat/stream`)**:
   - When the user sends a query, the client calls the Next.js Route Handler `/api/chat`.
   - The BFF forwards the request payload to the Railway backend URL specified in `BACKEND_URL` (`https://<service>.up.railway.app/v1/chat/stream`).
   - The response stream is returned with explicit streaming headers:
     ```http
     Content-Type: text/event-stream; charset=utf-8
     Cache-Control: no-cache, no-transform
     Connection: keep-alive
     X-Accel-Buffering: no
     ```
   - Buffering proxies (such as Nginx or CDN caches) are instructed by `X-Accel-Buffering: no` and `no-transform` to stream each token delta to the browser immediately without accumulating bytes.
3. **CORS Protocol**:
   - The FastAPI backend configures `CORSMiddleware` with `allow_origin_regex=r"https:\/\/.*\.vercel\.app"`.
   - This automatically authorizes production domains, preview PR URLs generated by Vercel, and local developer hosts (`localhost:3000`) with full credential and header support (`Content-Type`, `Authorization`).

### 10.3 Front-End Deployment Architecture on Vercel

#### 10.3.1 Configuration & Build Parameters
- **Repository Root**: Monorepo root with Vercel **Root Directory** configured to `frontend`.
- **Framework Preset**: `Next.js`.
- **Build Command**: `npm run build` (executes `next build` with TypeScript and ESLint validation).
- **Output Directory**: `.next`.
- **Node.js Runtime**: `20.x`.
- **Vercel Configuration (`frontend/vercel.json`)**:
  - Enforces `Cache-Control: no-cache, no-transform` on `/api/chat` to guarantee immediate Server-Sent Events dispatch.
  - Applies essential HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`).

#### 10.3.2 Vercel Environment Variables Matrix
| Variable Name | Environment | Purpose | Example Value |
|---|---|---|---|
| `BACKEND_URL` | Production & Preview | Resolves the upstream Railway FastAPI backend gateway | `https://nutrison-rag.up.railway.app` |
| `NODE_ENV` | Production | Enforces React 19 production builds and optimizations | `production` |

#### 10.3.3 Serverless Execution Boundaries
- **Route Handler Timeout**: In `frontend/src/app/api/chat/route.ts`, `export const maxDuration = 60;` is declared to provide up to 60 seconds of execution time, accommodating complex multi-source inquiries without dropping connections.
- **Dynamic Rendering**: `export const dynamic = "force-dynamic";` ensures streaming chat requests bypass static pre-rendering.

---

### 10.4 Back-End Deployment Architecture on Railway

#### 10.4.1 Containerization Strategy (`Dockerfile`)
The backend is packaged using a multi-stage production Docker build based on `python:3.11-slim`:
- **Stage 1 (`builder`)**: Installs compiler tools (`build-essential`, `curl`) and builds wheels into `/root/.local`.
- **Stage 2 (`runner`)**: Minimal runtime image copying installed packages from `builder`.
  - Offline environment variables are pre-set: `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.
  - The 1,001 canonical pre-parsed blocks (`data/blocks.jsonl`) and the pre-computed ChromaDB vector index (`data/vectordb`) are copied into the container filesystem at build time.
  - Sub-second cold start: The container launches in $< 1.5$ seconds with zero external model or corpus downloads.

#### 10.4.2 Railway Configuration & Port Binding (`railway.json` / `Procfile`)
- **Dynamic Port Injection**: Railway assigns a random high-port at runtime via the `PORT` environment variable. `config/settings.py` binds to this via Pydantic `AliasChoices("PORT", "FASTAPI_PORT")`.
- **Health Check Probe**: Railway monitors container liveness via `GET /v1/health` with a 60-second initialization grace period.
- **Restart Policy**: `ON_FAILURE` with up to 5 automatic retries.

#### 10.4.3 Railway Environment Variables Matrix
| Variable Name | Required | Default / Value | Description |
|---|---|---|---|
| `PORT` | Auto (Railway) | Assigned dynamically | Runtime HTTP port provided by Railway platform |
| `FASTAPI_HOST` | Yes | `0.0.0.0` | Ingress interface binding |
| `ENVIRONMENT` | Yes | `production` | Runtime mode indicator |
| `LLM_PROVIDER` | Yes | `groq` | Primary LLM synthesis engine |
| `GROQ_API_KEY` | **Yes (Secret)** | `gsk_...` | Groq Cloud API credentials for LPU inference |
| `GROQ_MODEL` | Yes | `openai/gpt-oss-120b` | Production Groq model identifier |
| `EMBEDDING_PROVIDER` | Yes | `local` | Uses local SentenceTransformers |
| `EMBEDDING_MODEL_NAME` | Yes | `all-MiniLM-L6-v2` | Embedding model identifier |
| `SIMILARITY_THRESHOLD` | Yes | `0.53` | Calibrated cosine similarity threshold ($\tau$) |
| `RETRIEVAL_TOP_K` | Yes | `6` | Top-K chunk retrieval limit |
| `HF_HUB_OFFLINE` | Yes | `1` | Disables HuggingFace online telemetry & downloads |
| `TRANSFORMERS_OFFLINE`| Yes | `1` | Forces SentenceTransformers to use local weights |
| `ALLOWED_ORIGINS` | Optional | `https://*.vercel.app` | Custom production domains for CORS whitelisting |

---

### 10.5 Unified Continuous Integration & Continuous Delivery (CI/CD) Pipeline

Continuous integration and continuous deployment are managed through **GitHub Actions** (`.github/workflows/ci-cd.yml`), orchestrating test execution, container builds, and cloud releases.

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant GitHub as GitHub Repository
    participant Actions as GitHub Actions CI/CD
    participant Railway as Railway Platform (Backend)
    participant Vercel as Vercel Platform (Frontend)
    participant Smoke as Smoke Verification Suite

    Developer->>GitHub: git push origin main (or PR)
    GitHub->>Actions: Trigger CI/CD Workflow (.github/workflows/ci-cd.yml)

    par Parallel CI Verification
        Actions->>Actions: Job 1: Backend CI (Python 3.11, pip install, pytest 23+ tests)
        Actions->>Actions: Job 2: Frontend CI (Node 20, npm ci, eslint, tsc --noEmit, next build)
    end

    alt PR Trigger (Feature Branch)
        Actions->>Vercel: Generate Preview Deployment URL
        Vercel-->>Developer: Comment Preview URL on Pull Request
    else Main Branch Push (Production Release)
        Actions->>Railway: Job 3: Trigger Railway Container Deployment (CLI / Webhook)
        Railway->>Railway: Build Docker image & pre-warm ChromaDB
        Railway->>Railway: Execute healthcheck probe GET /v1/health
        Railway-->>Actions: Backend Healthy (https://nutrison-rag.up.railway.app)

        Actions->>Vercel: Job 4: Trigger Vercel Production Deployment
        Vercel->>Vercel: Build Next.js 15 bundle with BACKEND_URL binding
        Vercel->>Vercel: Atomic CDN swap to Production
        Vercel-->>Actions: Frontend Live (https://dietary-guidance.vercel.app)

        Actions->>Smoke: Job 5: Execute scripts/verify_deployment.py
        Smoke->>Railway: Verify GET /v1/health & GET /v1/documents (7 docs)
        Smoke->>Railway: Verify Refusal 2 Safety Guardrail at /v1/chat
        Smoke->>Vercel: Verify Frontend Availability & BFF SSE Streaming
        Smoke-->>Developer: All Smoke Tests Passed (Green Release)
    end
```

#### 10.5.1 CI Quality Gates
Before any deployment occurs, both backend and frontend suites must complete with exit code 0:
1. **Corpus Integrity Assertion**: Ensures `data/blocks.jsonl` contains exactly 1,001 valid JSON lines without truncation.
2. **Backend Unit & Regression Suite**: Executes `pytest` across all test modules (`test_api.py`, `test_chunking.py`, `test_guardrails.py`, `test_retrieval.py`, `test_synthesis.py`, `test_streaming.py`).
3. **Frontend Lint & Build**: Executes ESLint and `next build` in strict mode to detect syntax errors, dead imports, or type mismatches.

#### 10.5.2 Automated Deployment Triggering
- **Railway Deployment**: Triggered either via the native **Railway GitHub App** (configured to auto-deploy branch `main`) or through the GitHub Actions workflow using `@railway/cli` with repository secret `RAILWAY_TOKEN`.
- **Vercel Deployment**: Triggered via the **Vercel GitHub Integration** or the official Vercel CLI action (`vercel deploy --prod`), which securely pulls project credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).

---

### 10.6 Reliability, Observability & Secret Management

1. **Zero-Downtime Rolling Deploys**:
   - Railway spins up the new container instance, waits for the Docker healthcheck `GET /v1/health` to return HTTP 200, and only then redirects ingress traffic before shutting down the old instance.
   - Vercel performs instant atomic CDN pointer swaps once the Next.js bundle finishes compiling.
2. **Secret Hygiene**:
   - API keys (`GROQ_API_KEY`) and platform tokens (`RAILWAY_TOKEN`, `VERCEL_TOKEN`) are injected exclusively via secure platform secret vaults.
   - Zero credentials or keys are committed to Git. `.gitignore` strictly prevents `.env` and `.env.local` files from tracking.
3. **Automated Post-Deployment Verification (`scripts/verify_deployment.py`)**:
   - The CLI utility executes 5 sequential integration checks against the deployed URLs:
     1. `GET /v1/health`: Verifies vector store is initialized with $> 0$ chunks.
     2. `GET /v1/documents`: Verifies all 7 authoritative documents are registered.
     3. `POST /v1/chat`: Verifies deterministic safety filter returns `REFUSAL_OUT_OF_SCOPE` on medical queries.
     4. `GET /`: Verifies Next.js 15 frontend renders accessible HTML shell.
     5. `POST /api/chat`: Verifies BFF receives Server-Sent Events stream from Railway and yields active token deltas.

