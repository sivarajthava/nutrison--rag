"use client";

import React, { useState } from "react";
import { DocumentMetadata, RetrievalDebugResult, ChunkItem } from "@/types/chat";
import { Search, Sparkles, AlertCircle, CheckCircle, Sliders, ExternalLink, ShieldAlert } from "lucide-react";
import { formatSimilarity } from "@/lib/utils";

interface RetrievalDebuggerProps {
  documents: DocumentMetadata[];
}

const PRESET_QUERIES = [
  { label: "Chicken Storage (Safe/In-Corpus)", query: "How long can chicken stay in the fridge?" },
  { label: "5 Keys (who-five-keys Scoped)", query: "What are the 5 keys to safer food?", doc: "who-five-keys" },
  { label: "Turkey Thawing Table", query: "How long to thaw turkey in cold water versus refrigerator?" },
  { label: "Free Sugars Guidelines", query: "What are the recommended limits for free sugars?" },
  { label: "Camel Milk (Corpus Gap Test)", query: "Can I store raw camel milk at 25°C for a week?" },
];

export function RetrievalDebugger({ documents }: RetrievalDebuggerProps) {
  const [query, setQuery] = useState<string>("How long can chicken stay in the fridge?");
  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [threshold, setThreshold] = useState<number>(0.53);
  const [topK, setTopK] = useState<number>(6);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<RetrievalDebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/retrieval/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          filter_document_id: selectedDocId === "all" ? null : selectedDocId,
          threshold: threshold,
          top_k: topK,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      }

      const data: RetrievalDebugResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to execute retrieval debug");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        {/* Presets */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Preset Test Queries</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(preset.query);
                  if (preset.doc) setSelectedDocId(preset.doc);
                  else setSelectedDocId("all");
                }}
                className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Enter query to test dense vector similarity..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white border-r-transparent" />
                  Testing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Run Vector Search
                </>
              )}
            </button>
          </div>

          {/* Controls Bar: Document Scope, Threshold, Top-K */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs">
            {/* Document Scoping */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Retrieval Mode & Scope</label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">Global (All 7 Publications)</option>
                {documents.map((doc) => (
                  <option key={doc.document_id} value={doc.document_id}>
                    Scoped: {doc.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-slate-400 font-medium mb-1">
                <span>Similarity Threshold (&tau;)</span>
                <span className="font-mono text-indigo-400 font-semibold">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0.10 (Permissive)</span>
                <span className="text-indigo-400">&tau; = 0.53 calibrated</span>
                <span>0.90 (Strict)</span>
              </div>
            </div>

            {/* Top-K Selector */}
            <div>
              <label className="block text-slate-400 font-medium mb-1">Top-K Candidates</label>
              <select
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value={3}>Top 3 Chunks</option>
                <option value={6}>Top 6 Chunks (Default)</option>
                <option value={10}>Top 10 Chunks</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-5">
          {/* Diagnostic Evaluation Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
              result.meets_threshold
                ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
                : "bg-amber-950/30 border-amber-800/60 text-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {result.meets_threshold ? (
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-semibold">
                  {result.meets_threshold
                    ? "In-Corpus Guidance Identified (Passes Threshold)"
                    : "Information Gap Detected (Below Threshold &rarr; Refusal 1)"}
                </h4>
                <p className="text-xs opacity-80 mt-0.5">
                  Peak observed cosine similarity:{" "}
                  <strong className="font-mono">
                    {formatSimilarity(result.max_similarity)} ({result.max_similarity.toFixed(4)})
                  </strong>{" "}
                  vs. calibrated cutoff &tau; ={" "}
                  <strong className="font-mono">{result.threshold.toFixed(2)}</strong>.
                </p>
              </div>
            </div>

            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-semibold border ${
                result.meets_threshold
                  ? "bg-emerald-900/60 border-emerald-700 text-emerald-200"
                  : "bg-amber-900/60 border-amber-700 text-amber-200"
              }`}
            >
              {result.meets_threshold ? "RELEVANCE PASS" : "REFUSAL_NOT_IN_CORPUS"}
            </span>
          </div>

          {/* Retrieved Chunks List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Retrieved Candidates (Rank Ordered by Cosine Similarity)
            </h4>

            {result.chunks.map((chunk, index) => {
              const score = chunk.similarity_score ?? 0;
              const passes = score >= result.threshold;

              return (
                <div
                  key={chunk.chunk_id}
                  className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                    passes ? "border-slate-800 hover:border-slate-700" : "border-slate-850 opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-400">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700">
                        {chunk.chunk_id}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        {chunk.document_title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Similarity Meter Badge */}
                      <span
                        className={`text-xs font-mono px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                          passes
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800/80"
                            : "bg-rose-950 text-rose-300 border-rose-800/80"
                        }`}
                      >
                        {formatSimilarity(score)} ({score.toFixed(4)})
                        {passes ? " &ge; &tau;" : " < &tau;"}
                      </span>
                    </div>
                  </div>

                  {/* Breadcrumb section */}
                  <div className="text-xs text-indigo-300/80 font-mono mb-2">
                    {chunk.section_heading}
                  </div>

                  {/* Content snippet */}
                  <div className="text-xs text-slate-300 font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {chunk.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
