/**
 * TypeScript Data Contracts for Dietary Guidance RAG Chatbot.
 * Matches backend Pydantic schemas in src/models/schemas.py.
 */

export interface DocumentMetadata {
  document_id: string;
  title: string;
  publisher: string;
  year: number;
  category: "nutrition" | "food_safety";
  source_url: string;
  description: string;
}

export type BlockType = "heading" | "paragraph" | "list_item" | "table";

export interface BlockRecord {
  document_id: string;
  ordinal: number;
  type: BlockType;
  text: string;
  heading_path: string[];
  level?: number | null;
  page?: number | null;
  caption?: string | null;
  header?: string[] | null;
  rows?: string[][] | null;
}

export interface ChunkItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_name?: string;
  publisher: string;
  year: number;
  category: "nutrition" | "food_safety";
  source_url: string;
  content: string;
  section_heading: string;
  block_ordinals: number[];
  min_ordinal: number;
  max_ordinal: number;
  page_start?: number | null;
  page_end?: number | null;
  page_numbers: number[];
  chunk_type: "table" | "prose" | "list";
  has_table: boolean;
  table_caption?: string | null;
  sub_label?: string | null;
  similarity_score?: number | null;
}

export interface CitationItem {
  document_title: string;
  document_name?: string;
  publisher: string;
  year: number;
  source_url: string;
  section_heading: string;
  chunk_id?: string | null;
  verbatim_text?: string | null;
  similarity_score?: number | null;
}

export interface GroundedSectionItem {
  publisher: string;
  document_title: string;
  document_name?: string;
  source_url: string;
  content?: string | null;
  summary_text?: string | null;
  citations: CitationItem[];
}

export interface RefusalPayload {
  status: "REFUSAL_NOT_IN_CORPUS" | "REFUSAL_OUT_OF_SCOPE";
  type: "NOT_IN_CORPUS" | "OUT_OF_SCOPE_BY_DESIGN";
  message: string;
  searched_documents: string[];
  suggested_action?: string | null;
}

export interface ChatResponse {
  status: "SUCCESS" | "REFUSAL_NOT_IN_CORPUS" | "REFUSAL_OUT_OF_SCOPE";
  query: string;
  response_text: string;
  sections: GroundedSectionItem[];
  citations: CitationItem[];
  searched_documents: string[];
  latency_ms?: number | null;
}

export type ChatState =
  | "IDLE"
  | "SUBMITTING"
  | "RETRIEVING"
  | "STREAMING"
  | "SUCCESS"
  | "REFUSAL_NOT_IN_CORPUS"
  | "REFUSAL_OUT_OF_SCOPE"
  | "ERROR";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: ChatState;
  sections?: GroundedSectionItem[];
  citations?: CitationItem[];
  refusal?: RefusalPayload;
  latency_ms?: number | null;
  searched_documents?: string[];
  error?: string | null;
}

export type SSEEvent =
  | { type: "status"; stage: "safety_check" | "retrieving" | "synthesizing" }
  | { type: "token"; delta: string }
  | { type: "citations"; citations: CitationItem[]; sections: GroundedSectionItem[] }
  | { type: "refusal"; status: string; refusalType?: string; message: string; searched_documents: string[]; suggested_action?: string }
  | { type: "done"; latency_ms: number; chunks_retrieved: number }
  | { type: "error"; message: string; code?: string };


export interface RetrievalDebugResult {
  query: string;
  max_similarity: number;
  threshold: number;
  is_corpus_gap: boolean;
  meets_threshold: boolean;
  chunks: ChunkItem[];
}

export interface GuardrailCheckResult {
  query: string;
  violated: boolean;
  category?: string | null;
  pattern_matched?: string | null;
  message: string;
}
