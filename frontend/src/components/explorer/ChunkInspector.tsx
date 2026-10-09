"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChunkItem, DocumentMetadata } from "@/types/chat";
import { Search, Database, Table, Layers, FileCode, CheckCircle, Split } from "lucide-react";

interface ChunkInspectorProps {
  documents: DocumentMetadata[];
}

export function ChunkInspector({ documents }: ChunkInspectorProps) {
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [onlyTables, setOnlyTables] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChunks() {
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL("/api/chunks", window.location.origin);
        if (selectedDocId !== "all") url.searchParams.set("document_id", selectedDocId);
        if (selectedType !== "all") url.searchParams.set("chunk_type", selectedType);
        if (onlyTables) url.searchParams.set("has_table", "true");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to load assembled chunks");
        const data = await res.json();
        setChunks(data);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch chunks");
      } finally {
        setIsLoading(false);
      }
    }

    fetchChunks();
  }, [selectedDocId, selectedType, onlyTables]);

  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return chunks;
    const q = searchQuery.toLowerCase();
    return chunks.filter(
      (c) =>
        c.chunk_id.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.section_heading.toLowerCase().includes(q) ||
        (c.sub_label && c.sub_label.toLowerCase().includes(q))
    );
  }, [chunks, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Document Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Document</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Documents</option>
              {documents.map((doc) => (
                <option key={doc.document_id} value={doc.document_id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>

          {/* Chunk Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Chunk Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="table">Table Chunks</option>
              <option value="prose">Prose Chunks</option>
              <option value="list">List Chunks</option>
            </select>
          </div>

          {/* Table Only Checkbox */}
          <div className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              id="onlyTablesCheckbox"
              checked={onlyTables}
              onChange={(e) => setOnlyTables(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="onlyTablesCheckbox" className="text-xs text-slate-300 cursor-pointer">
              Preserved Tables Only
            </label>
          </div>

          {/* Search Query */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Search Chunks</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search chunk ID, content, section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Counter telemetry */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            {filteredChunks.length} Chunks Loaded
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-transparent mr-3" />
          Loading assembled retrieval chunks...
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load chunks: {error}
        </div>
      )}

      {/* Chunks List */}
      {!isLoading && !error && (
        <div className="space-y-4">
          {filteredChunks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              No chunks found matching current filter parameters.
            </div>
          ) : (
            filteredChunks.map((chunk) => {
              const isExpanded = expandedChunkId === chunk.chunk_id;
              const estTokens = Math.floor(chunk.content.split(/\s+/).length * 1.3);
              const isSegmentedTable = chunk.chunk_id.includes("_seg");

              return (
                <div
                  key={chunk.chunk_id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700">
                        {chunk.chunk_id}
                      </span>

                      {/* Structural Tag */}
                      {chunk.has_table ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium border flex items-center gap-1 ${
                            isSegmentedTable
                              ? "bg-purple-950 text-purple-300 border-purple-800/60"
                              : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                          }`}
                        >
                          {isSegmentedTable ? (
                            <>
                              <Split className="w-3 h-3 text-purple-400" /> Segmented Sub-Table
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-400" /> Atomic Intact Table
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-medium">
                          {chunk.chunk_type.toUpperCase()}
                        </span>
                      )}

                      {/* Ordinal range */}
                      <span className="text-xs font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                        Blocks: #{chunk.min_ordinal} &ndash; #{chunk.max_ordinal} ({chunk.block_ordinals.length} block{chunk.block_ordinals.length > 1 ? "s" : ""})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      {/* Estimated Tokens */}
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          estTokens > 450
                            ? "bg-rose-950 text-rose-300 border-rose-800"
                            : estTokens < 150
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                        }`}
                      >
                        ~{estTokens} tokens
                      </span>

                      {/* Page range */}
                      {chunk.page_start !== null && chunk.page_start !== undefined && chunk.page_start > 0 ? (
                        <span className="text-slate-400">
                          Page {chunk.page_start === chunk.page_end ? chunk.page_start : `${chunk.page_start}-${chunk.page_end}`}
                        </span>
                      ) : (
                        <span className="text-slate-500">Web</span>
                      )}

                      <button
                        onClick={() => setExpandedChunkId(isExpanded ? null : chunk.chunk_id)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium ml-2 underline"
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>

                  {/* Section Breadcrumbs */}
                  <div className="text-xs text-indigo-300 font-mono mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{chunk.section_heading}</span>
                    {chunk.sub_label && (
                      <span className="text-purple-300 font-semibold ml-2">
                        &bull; Sub-Label: {chunk.sub_label}
                      </span>
                    )}
                  </div>

                  {/* Content Preview / Full Content */}
                  <div
                    className={`text-xs text-slate-300 font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap ${
                      isExpanded ? "max-h-none" : "max-h-28 overflow-hidden relative"
                    }`}
                  >
                    {chunk.content}
                    {!isExpanded && (
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
