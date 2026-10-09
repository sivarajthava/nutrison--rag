"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BlockRecord, DocumentMetadata, BlockType } from "@/types/chat";
import { Search, FileText, Table as TableIcon, Hash, BookOpen, Layers } from "lucide-react";

interface BlockExplorerProps {
  documents: DocumentMetadata[];
}

export function BlockExplorer({ documents }: BlockExplorerProps) {
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const [activeModalBlock, setActiveModalBlock] = useState<BlockRecord | null>(null);

  useEffect(() => {
    async function fetchBlocks() {
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL("/api/blocks", window.location.origin);
        if (selectedDocId !== "all") url.searchParams.set("document_id", selectedDocId);
        if (selectedType !== "all") url.searchParams.set("block_type", selectedType);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to load blocks");
        const data = await res.json();
        setBlocks(data);
        setPage(1);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch blocks");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBlocks();
  }, [selectedDocId, selectedType]);

  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return blocks;
    const q = searchQuery.toLowerCase();
    return blocks.filter(
      (b) =>
        b.text.toLowerCase().includes(q) ||
        b.heading_path?.some((h) => h.toLowerCase().includes(q)) ||
        b.caption?.toLowerCase().includes(q)
    );
  }, [blocks, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBlocks.length / pageSize));
  const displayedBlocks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBlocks.slice(start, start + pageSize);
  }, [filteredBlocks, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Document Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Document</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All 7 Documents</option>
              {documents.map((doc) => (
                <option key={doc.document_id} value={doc.document_id}>
                  {doc.title} ({doc.publisher.split("/")[0].trim()})
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Block Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="heading">Heading (level 1-6)</option>
              <option value="paragraph">Paragraph</option>
              <option value="list_item">List Item</option>
              <option value="table">Table (intact 2D)</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Search Text</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter blocks content..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 self-end md:self-center">
          <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 font-mono">
            {filteredBlocks.length.toLocaleString()} matching blocks
          </span>
        </div>
      </div>

      {/* Loading or Error states */}
      {isLoading && (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-transparent mr-3" />
          Loading canonical blocks...
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load blocks: {error}
        </div>
      )}

      {/* Blocks Grid / List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {displayedBlocks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              No blocks found matching current filter parameters.
            </div>
          ) : (
            displayedBlocks.map((block) => (
              <div
                key={`${block.document_id}-${block.ordinal}`}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 hover:bg-slate-850"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded">
                      #{block.ordinal}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium border ${
                        block.type === "table"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                          : block.type === "heading"
                          ? "bg-amber-950 text-amber-300 border-amber-800/60"
                          : block.type === "list_item"
                          ? "bg-cyan-950 text-cyan-300 border-cyan-800/60"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {block.type.toUpperCase()}
                      {block.level ? ` (L${block.level})` : ""}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {block.document_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    {block.page !== null && block.page !== undefined ? (
                      <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        <BookOpen className="w-3 h-3 text-slate-400" /> Page {block.page}
                      </span>
                    ) : (
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-slate-500">
                        Web Source
                      </span>
                    )}

                    {block.type === "table" && (
                      <button
                        onClick={() => setActiveModalBlock(block)}
                        className="bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/80 px-2.5 py-0.5 rounded text-xs transition"
                      >
                        Inspect Table Structure
                      </button>
                    )}
                  </div>
                </div>

                {/* Breadcrumbs */}
                {block.heading_path && block.heading_path.length > 0 && (
                  <div className="text-xs text-indigo-300/80 font-mono mb-2 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>{block.heading_path.join(" > ")}</span>
                  </div>
                )}

                {/* Caption if available */}
                {block.caption && (
                  <div className="text-xs font-semibold text-emerald-400 mb-2">
                    Table Caption: {block.caption}
                  </div>
                )}

                {/* Text Content */}
                <div className="text-sm text-slate-300 font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap max-h-48">
                  {block.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400 font-mono">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal for Table Inspection */}
      {activeModalBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  Table Block Inspector (#{activeModalBlock.ordinal} &mdash; {activeModalBlock.document_id})
                </h3>
              </div>
              <button
                onClick={() => setActiveModalBlock(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold px-2 py-1 rounded bg-slate-800"
              >
                Close (ESC)
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {activeModalBlock.caption && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs">
                  <strong>Caption:</strong> {activeModalBlock.caption}
                </div>
              )}

              {/* 2D Table rendering */}
              {activeModalBlock.header && activeModalBlock.rows ? (
                <div className="overflow-x-auto border border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-slate-200 uppercase font-mono border-b border-slate-700">
                      <tr>
                        {activeModalBlock.header.map((col, idx) => (
                          <th key={idx} className="p-3 border-r border-slate-700 last:border-r-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {activeModalBlock.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/40">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-3 border-r border-slate-800 last:border-r-0">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap">
                  {activeModalBlock.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
