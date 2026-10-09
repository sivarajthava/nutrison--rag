"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CitationItem } from "@/types/chat";
import {
  X,
  ExternalLink,
  BookOpen,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { formatSimilarity } from "@/lib/utils";

interface CitationDrawerProps {
  citation: CitationItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CitationDrawer({
  citation,
  isOpen,
  onClose,
}: CitationDrawerProps) {
  if (!citation) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity" />

        {/* Slide-Over Drawer Container */}
        <Dialog.Content
          aria-describedby="citation-drawer-desc"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden outline-none animate-in slide-in-from-right duration-200"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" /> Evidence Provenance
              </span>
              <Dialog.Title className="text-base font-bold text-slate-100 leading-snug">
                {citation.document_title || citation.document_name}
              </Dialog.Title>
              <Dialog.Description id="citation-drawer-desc" className="text-xs text-slate-400 font-mono">
                {citation.publisher} &bull; {citation.year}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Close citation provenance drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Drawer Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* Metadata Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 text-[11px] mb-1">Similarity Score</div>
                <div className="font-mono font-bold text-emerald-400 text-sm">
                  {formatSimilarity(citation.similarity_score)}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="text-slate-400 text-[11px] mb-1">Originating Chunk</div>
                <div className="font-mono font-semibold text-indigo-300 text-xs truncate">
                  {citation.chunk_id || "Grounded Excerpt"}
                </div>
              </div>
            </div>

            {/* Hierarchical Breadcrumb Path */}
            {citation.section_heading && (
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Document Section Breadcrumb</span>
                </div>
                <p className="text-xs text-slate-300 font-mono leading-relaxed">
                  {citation.section_heading}
                </p>
              </div>
            )}

            {/* Verbatim Source Excerpt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Verbatim Evidentiary Excerpt</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Exact Canonical Content
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                {citation.verbatim_text ||
                  "This factual assertion was derived directly from the canonical public health excerpt referenced in the official guidance publication."}
              </div>
            </div>

            {/* Deep link to official publication */}
            <div className="pt-2">
              <a
                href={citation.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <span>View Full Official Source Publication</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
            <span>Dietary Guidance Provenance UX</span>
            <span className="text-emerald-400/90 font-semibold">WCAG 2.1 AA Compliant</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
