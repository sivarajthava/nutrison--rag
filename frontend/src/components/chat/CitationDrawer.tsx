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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm transition-opacity" />

        {/* Slide-Over Drawer Container */}
        <Dialog.Content
          aria-describedby="citation-drawer-desc"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden outline-none animate-in slide-in-from-right duration-200 text-slate-800 dark:text-slate-100"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Evidence Provenance
              </span>
              <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {citation.document_title || citation.document_name}
              </Dialog.Title>
              <Dialog.Description id="citation-drawer-desc" className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {citation.publisher} &bull; {citation.year}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Close citation provenance drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Metadata Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Section Path</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 truncate" title={citation.section_heading || "General Guidance"}>
                  {citation.section_heading || "General Guidance"}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Cosine Similarity (&tau;)</span>
                <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatSimilarity(citation.similarity_score)}
                </p>
              </div>
            </div>

            {/* Verbatim Excerpt */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Verbatim In-Corpus Excerpt</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto shadow-inner">
                {citation.verbatim_text || (
                  <span className="italic text-slate-400 dark:text-slate-500">
                    Full block excerpt referenced by citation identifier. Refer to official publication source.
                  </span>
                )}
              </div>
            </div>

            {/* Hierarchy Path */}
            {citation.hierarchy_path && citation.hierarchy_path.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Document Structural Breadcrumb</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex flex-wrap gap-1 items-center">
                  {citation.hierarchy_path.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <span>{item}</span>
                      {idx < citation.hierarchy_path!.length - 1 && (
                        <span className="text-slate-400 dark:text-slate-600">&gt;</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer - Deep Link */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
            {citation.source_url ? (
              <a
                href={citation.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs group focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <span>View Authoritative Primary Document</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            ) : (
              <button
                disabled
                className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 text-xs py-3 rounded-xl cursor-not-allowed text-center"
              >
                No external URL provided
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
