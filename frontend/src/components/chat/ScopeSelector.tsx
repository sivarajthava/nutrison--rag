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
          className="text-xs font-medium text-slate-400 flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
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
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                selectedCategory === null
                  ? "bg-slate-800 text-slate-200 font-semibold"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              All Topics
            </button>
            <span className="text-slate-700" aria-hidden="true">&bull;</span>
            <button
              type="button"
              onClick={() => onSelectCategory("food_safety")}
              aria-pressed={selectedCategory === "food_safety"}
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                selectedCategory === "food_safety"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Food Safety
            </button>
            <span className="text-slate-700" aria-hidden="true">&bull;</span>
            <button
              type="button"
              onClick={() => onSelectCategory("nutrition")}
              aria-pressed={selectedCategory === "nutrition"}
              className={`px-2 py-0.5 rounded transition focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                selectedCategory === "nutrition"
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold"
                  : "text-slate-500 hover:text-slate-300"
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
          className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
            selectedDocId === null
              ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
              : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850 hover:text-slate-200"
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>All 7 Publications (Global)</span>
        </button>

        {documents.map((doc) => {
          const isSelected = selectedDocId === doc.document_id;
          const publisherShort = doc.publisher.includes("WHO")
            ? "WHO"
            : doc.publisher.includes("FDA")
            ? "FDA"
            : doc.publisher.includes("USDA")
            ? "USDA"
            : doc.publisher.includes("UK")
            ? "UK FSA / PHE"
            : doc.publisher;

          return (
            <button
              key={doc.document_id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(isSelected ? null : doc.document_id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-slate-100"
              }`}
            >
              <span>{doc.title.split(":")[0].slice(0, 24)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isSelected
                    ? "bg-indigo-800 text-indigo-100"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {publisherShort} &apos;{String(doc.year).slice(-2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Select Dropdown */}
      <div className="sm:hidden">
        <select
          value={selectedDocId || "global"}
          onChange={(e) => onSelect(e.target.value === "global" ? null : e.target.value)}
          aria-label="Select authoritative publication scope"
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="global">All 7 Publications (Global Evidence)</option>
          {documents.map((doc) => (
            <option key={doc.document_id} value={doc.document_id}>
              {doc.title} ({doc.publisher.split("/")[0].trim()})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
