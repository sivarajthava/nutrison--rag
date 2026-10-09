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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">
              {sec.publisher}
            </h3>
            <span className="text-xs text-slate-400">&bull; {sec.document_title}</span>
          </div>

          <a
            href={sec.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono focus:outline-none focus:underline"
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
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Cross-Agency Evidence Segregation ({sections.length} Authorities)</span>
        </div>

        <div
          role="radiogroup"
          aria-label="Evidence comparison presentation mode"
          className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs"
        >
          <button
            role="radio"
            aria-checked={layoutMode === "stacked"}
            onClick={() => setLayoutMode("stacked")}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
              layoutMode === "stacked"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ListFilter className="w-3 h-3" />
            <span>Stacked</span>
          </button>
          <button
            role="radio"
            aria-checked={layoutMode === "tabs"}
            onClick={() => setLayoutMode("tabs")}
            className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
              layoutMode === "tabs"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
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
          className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
        >
          {/* Tab buttons */}
          <Tabs.List
            aria-label="Authoritative source perspectives"
            className="flex border-b border-slate-800 bg-slate-850 overflow-x-auto"
          >
            {sections.map((sec, idx) => (
              <Tabs.Trigger
                key={idx}
                value={String(idx)}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap transition border-b-2 flex items-center gap-2 outline-none data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-400 data-[state=active]:bg-slate-900 data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 focus-visible:ring-2 focus-visible:ring-indigo-500"
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
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800/60">
                <span>{sec.document_title}</span>
                <a
                  href={sec.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus:outline-none focus:underline"
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
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {sec.publisher}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {sec.document_title}
                    </p>
                  </div>
                </div>

                <a
                  href={sec.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition focus:outline-none focus:underline"
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
