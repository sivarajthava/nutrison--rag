"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CitationItem } from "@/types/chat";
import { BookOpen } from "lucide-react";

interface GroundedAnswerViewProps {
  content: string;
  citations?: CitationItem[];
  onSelectCitation: (citation: CitationItem) => void;
}

// Regex matching authoritative inline citations:
// [Document Title | Publisher, Year | Source URL]
const CITATION_REGEX =
  /\[\s*([^\|\]]+?)\s*\|\s*([^\|,\]]+?)\s*,\s*(\d{4})\s*\|\s*(https?:\/\/[^\s\]]+)\s*\]/g;

export function GroundedAnswerView({
  content,
  citations = [],
  onSelectCitation,
}: GroundedAnswerViewProps) {
  // Map citations by normalized title/url for quick lookup of verbatim text and scores
  const citationMap = useMemo(() => {
    const map = new Map<string, CitationItem>();
    citations.forEach((c) => {
      const title = (c.document_title || c.document_name || "").toLowerCase();
      const url = (c.source_url || "").toLowerCase();
      const key = `${title}-${url}`;
      map.set(key, c);
      if (url) map.set(url, c);
      if (title) map.set(title, c);
    });
    return map;
  }, [citations]);

  const renderContentWithPills = (text: string) => {
    if (!text || typeof text !== "string") return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex state
    CITATION_REGEX.lastIndex = 0;

    while ((match = CITATION_REGEX.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = CITATION_REGEX.lastIndex;

      // Text before citation
      if (matchStart > lastIndex) {
        parts.push(text.slice(lastIndex, matchStart));
      }

      const title = match[1].trim();
      const publisher = match[2].trim();
      const year = parseInt(match[3].trim(), 10) || 0;
      const url = match[4].trim();

      // Find matching citation object from citations prop for rich drawer context
      const key = `${title}-${url}`.toLowerCase();
      const existing =
        citationMap.get(key) ||
        citationMap.get(url.toLowerCase()) ||
        citationMap.get(title.toLowerCase());

      const citationPayload: CitationItem = existing || {
        document_title: title,
        document_name: title,
        publisher: publisher,
        year: year,
        source_url: url,
        section_heading: "Authoritative Reference",
        verbatim_text: null,
        similarity_score: null,
      };

      parts.push(
        <Tooltip.Provider key={`pill-${matchStart}`} delayDuration={150}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCitation(citationPayload);
                }}
                type="button"
                className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 my-0.5 rounded-md text-[11px] font-mono font-medium bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/60 hover:border-indigo-500 transition-all cursor-pointer shadow-sm group focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label={`Citation: ${title} published by ${publisher}, ${year}. Click to inspect source excerpt.`}
              >
                <BookOpen className="w-3 h-3 text-indigo-400 group-hover:text-indigo-200" />
                <span className="font-sans font-semibold truncate max-w-[200px]">{title}</span>
                <span className="opacity-60 text-[10px]">&bull; {publisher.split("/")[0].trim()}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                align="center"
                className="z-50 max-w-xs bg-slate-900 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-100"
              >
                <p className="font-semibold text-white">{title}</p>
                <p className="text-[11px] text-indigo-300 font-mono">
                  {publisher} ({year})
                </p>
                <p className="text-[10px] text-slate-400">
                  Click to inspect verbatim excerpt &amp; relevance score
                </p>
                <Tooltip.Arrow className="fill-slate-900 border-slate-700" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="prose prose-invert prose-indigo max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            if (typeof children === "string") {
              return <p className="mb-3 last:mb-0">{renderContentWithPills(children)}</p>;
            }
            if (Array.isArray(children)) {
              return (
                <p className="mb-3 last:mb-0">
                  {children.map((child, idx) =>
                    typeof child === "string" ? (
                      <React.Fragment key={idx}>{renderContentWithPills(child)}</React.Fragment>
                    ) : (
                      child
                    )
                  )}
                </p>
              );
            }
            return <p className="mb-3 last:mb-0">{children}</p>;
          },
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-slate-100 mt-4 mb-2 border-b border-slate-800 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-slate-100 mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-indigo-300 mt-3 mb-1.5 flex items-center gap-2">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => {
            if (typeof children === "string") {
              return <li>{renderContentWithPills(children)}</li>;
            }
            return <li>{children}</li>;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/90 text-slate-200 uppercase font-mono border-b border-slate-700">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="p-2.5 border-r border-slate-700 last:border-r-0 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2.5 border-b border-r border-slate-800 last:border-r-0 text-slate-300">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-800">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
