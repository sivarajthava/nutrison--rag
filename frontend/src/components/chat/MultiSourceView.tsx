"use client";

import React, { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { GroundedSectionItem, CitationItem } from "@/types/chat";
import { GroundedAnswerView } from "./GroundedAnswerView";
import {
  Building2,
  ExternalLink,
  Columns,
  ListFilter,
  ShieldCheck,
} from "lucide-react";

interface MultiSourceViewProps {
  sections: GroundedSectionItem[];
  onSelectCitation: (citation: CitationItem) => void;
}

export function MultiSourceView({
  sections,
  onSelectCitation,
}: MultiSourceViewProps) {
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<"stacked" | "tabs">("stacked");

  if (!sections || sections.length === 0) {
    return null;
  }

  // If only 1 section, render single card
  if (sections.length === 1) {
    const sec = sections[0];
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {sec.publisher}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">&bull; {sec.document_title}</span>
          </div>

          <a
            href={sec.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 font-mono focus:outline-none focus:underline"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <GroundedAnswerView
          content={sec.content || sec.summary_text || ""}
          citations={sec.citations}
          onSelectCitation={onSelectCitation}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Multi-Source Header & Layout Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Cross-Agency Evidence Segregation ({sections.length} Authorities)</span>
        </div>

        <div
          role="radiogroup"
          aria-label="Evidence comparison presentation mode"
          className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-xs"
        >
          <button
            role="radio"
            aria-checked={layoutMode === "stacked"}
            onClick={() => setLayoutMode("stacked")}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              layoutMode === "stacked"
                ? "bg-emerald-600 text-white font-medium shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ListFilter className="w-3 h-3" />
            <span>Stacked</span>
          </button>
          <button
            role="radio"
            aria-checked={layoutMode === "tabs"}
            onClick={() => setLayoutMode("tabs")}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              layoutMode === "tabs"
                ? "bg-emerald-600 text-white font-medium shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>Side-by-Side Tabs</span>
          </button>
        </div>
      </div>

      {layoutMode === "tabs" ? (
        /* Accessible Radix UI Tabs for Side-by-Side Comparison */
        <Tabs.Root
          value={String(activeTabIdx)}
          onValueChange={(val) => setActiveTabIdx(Number(val))}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
        >
          {/* Tab buttons */}
          <Tabs.List
            aria-label="Authoritative source perspectives"
            className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 overflow-x-auto"
          >
            {sections.map((sec, idx) => (
              <Tabs.Trigger
                key={idx}
                value={String(idx)}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap transition border-b-2 flex items-center gap-2 outline-none data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{sec.publisher}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Tab Content Panels */}
          {sections.map((sec, idx) => (
            <Tabs.Content
              key={idx}
              value={String(idx)}
              className="p-5 space-y-3 outline-none"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono pb-2 border-b border-slate-200 dark:border-slate-800/60">
                <span>{sec.document_title}</span>
                <a
                  href={sec.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 focus:outline-none focus:underline"
                >
                  <span>Canonical Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <GroundedAnswerView
                content={sec.content || sec.summary_text || ""}
                citations={sec.citations}
                onSelectCitation={onSelectCitation}
              />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      ) : (
        /* Stacked Per-Authority Segmented Cards */
        <div className="space-y-4">
          {sections.map((sec, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {sec.publisher}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {sec.document_title}
                    </p>
                  </div>
                </div>

                <a
                  href={sec.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 font-mono transition focus:outline-none focus:underline"
                >
                  <span>Canonical Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <GroundedAnswerView
                content={sec.content || sec.summary_text || ""}
                citations={sec.citations}
                onSelectCitation={onSelectCitation}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
