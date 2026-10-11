"use client";

import React from "react";
import { DocumentMetadata } from "@/types/chat";
import { Globe, Filter } from "lucide-react";

interface ScopeSelectorProps {
  documents: DocumentMetadata[];
  selectedDocId: string | null;
  onSelect: (docId: string | null) => void;
  selectedCategory?: "nutrition" | "food_safety" | null;
  onSelectCategory?: (category: "nutrition" | "food_safety" | null) => void;
}

export function ScopeSelector({
  documents,
  selectedDocId,
  onSelect,
  selectedCategory,
  onSelectCategory,
}: ScopeSelectorProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label
          id="evidence-scope-label"
          className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Evidence Scope:</span>
        </label>

        {/* Category Pills (Optional Nutrition / Food Safety filter) */}
        {onSelectCategory && (
          <div
            role="group"
            aria-label="Filter evidence by topic category"
            className="flex items-center gap-1 text-[11px]"
          >
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              aria-pressed={selectedCategory === null}
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                selectedCategory === null
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              All Topics
            </button>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
            <button
              type="button"
              onClick={() => onSelectCategory("food_safety")}
              aria-pressed={selectedCategory === "food_safety"}
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                selectedCategory === "food_safety"
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Food Safety
            </button>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
            <button
              type="button"
              onClick={() => onSelectCategory("nutrition")}
              aria-pressed={selectedCategory === "nutrition"}
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                selectedCategory === "nutrition"
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Nutrition
            </button>
          </div>
        )}
      </div>

      {/* Desktop Horizontal Pill Bar */}
      <div
        role="radiogroup"
        aria-labelledby="evidence-scope-label"
        className="hidden sm:flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          role="radio"
          aria-checked={selectedDocId === null}
          onClick={() => onSelect(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            selectedDocId === null
              ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-300"
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>All 7 Publications (Global)</span>
        </button>

        {documents.map((doc) => {
          const isSelected = selectedDocId === doc.document_id;
          const shortTitle = doc.title.length > 28 ? `${doc.title.slice(0, 26)}...` : doc.title;

          return (
            <button
              key={doc.document_id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(isSelected ? null : doc.document_id)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isSelected
                  ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-xs font-semibold"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-300"
              }`}
              title={`${doc.title} (${doc.publisher}, ${doc.year})`}
            >
              <span>{shortTitle}</span>
              <span className="opacity-60 text-[10px] ml-1 font-mono">({doc.year})</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Dropdown Select */}
      <div className="sm:hidden">
        <select
          value={selectedDocId || ""}
          onChange={(e) => onSelect(e.target.value ? e.target.value : null)}
          aria-label="Filter evidence scope by authoritative publication"
          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        >
          <option value="">All 7 Publications (Global Evidence Scope)</option>
          {documents.map((doc) => (
            <option key={doc.document_id} value={doc.document_id}>
              {doc.title} ({doc.year})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
