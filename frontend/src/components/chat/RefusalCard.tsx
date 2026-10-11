"use client";

import React from "react";
import { RefusalPayload } from "@/types/chat";
import {
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  ExternalLink,
  Info,
} from "lucide-react";

interface RefusalCardProps {
  refusal: RefusalPayload;
}

const CORPUS_FALLBACK_LINKS: Record<
  string,
  { title: string; publisher: string; url: string }
> = {
  "cold-food-storage": {
    title: "Cold Food Storage Chart",
    publisher: "U.S. FDA / FoodSafety.gov",
    url: "https://www.foodsafety.gov/keep-food-safe/cold-food-storage-chart",
  },
  "who-healthy-diet": {
    title: "Healthy Diet Fact Sheet N°394",
    publisher: "World Health Organization (WHO)",
    url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  "fao-who-healthy-diets": {
    title: "Sustainable Healthy Diets: Guiding Principles",
    publisher: "FAO & WHO",
    url: "https://www.fao.org/documents/card/en/c/ca6640en/",
  },
  "who-five-keys": {
    title: "Five Keys to Safer Food Manual",
    publisher: "World Health Organization (WHO)",
    url: "https://www.who.int/publications/i/item/9789241594639",
  },
  "eatwell-guide": {
    title: "The Eatwell Guide: Helping you eat a balanced diet",
    publisher: "Public Health England / NHS / UK FSA",
    url: "https://www.gov.uk/government/publications/the-eatwell-guide",
  },
  "fsa-chill": {
    title: "Chilling Food Correctly",
    publisher: "UK Food Standards Agency (FSA)",
    url: "https://www.food.gov.uk/safety-hygiene/chilling",
  },
  "kitchen-companion": {
    title: "Kitchen Companion: Your Safe Food Handbook",
    publisher: "USDA FSIS",
    url: "https://www.fsis.usda.gov/shared/data/Kitchen_Companion.pdf",
  },
};

export function RefusalCard({ refusal }: RefusalCardProps) {
  const isOutOfScope =
    refusal.status === "REFUSAL_OUT_OF_SCOPE" ||
    refusal.type === "OUT_OF_SCOPE_BY_DESIGN";

  if (isOutOfScope) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 rounded-2xl p-5 text-rose-950 dark:text-rose-100 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="bg-rose-100 dark:bg-rose-900/60 p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-300 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-tight text-rose-800 dark:text-rose-200">
                Out of Scope by Design &bull; Safety Policy
              </h3>
              <span className="text-[10px] font-mono font-semibold bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                REFUSAL_OUT_OF_SCOPE
              </span>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-200/90 mt-1 leading-relaxed">
              {refusal.message}
            </p>
          </div>
        </div>

        <div className="p-3 bg-white/80 dark:bg-slate-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-1 text-xs">
          <div className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
            <span>Clinical Healthcare Referral:</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            {refusal.suggested_action ||
              "For personalized caloric deficits, therapeutic meal planning, or clinical disease treatments (e.g. diabetes, cardiovascular illnesses, cancer), please consult a Registered Dietitian (RD) or licensed healthcare provider."}
          </p>
        </div>

        <div className="text-[11px] text-rose-600/70 dark:text-rose-300/60 flex items-center gap-1.5 font-mono pt-1">
          <Info className="w-3.5 h-3.5" />
          <span>Deterministic Pre-Retrieval Interception &bull; 0 Parametric Tokens Consumed</span>
        </div>
      </div>
    );
  }

  // Refusal 1: Corpus Gap
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-5 text-amber-950 dark:text-amber-100 shadow-xs space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-amber-100 dark:bg-amber-900/60 p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300 shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-tight text-amber-800 dark:text-amber-200">
              Official Guidance Information Gap
            </h3>
            <span className="text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
              REFUSAL_NOT_IN_CORPUS (&tau; &lt; 0.53)
            </span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-1 leading-relaxed">
            {refusal.message}
          </p>
        </div>
      </div>

      {/* Searched Publications Grid */}
      <div className="bg-white/80 dark:bg-slate-950/70 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Searched Authoritative Publications (7 Queried Documents):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {Object.entries(CORPUS_FALLBACK_LINKS).map(([key, item]) => (
            <a
              key={key}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 hover:bg-amber-50/50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-700/60 transition flex items-start justify-between gap-2 group focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              <div>
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-200 transition">
                  {item.title}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {item.publisher}
                </div>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-300 shrink-0 mt-0.5" />
            </a>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-amber-700/70 dark:text-amber-300/60 flex items-center gap-1.5 font-mono pt-1">
        <Info className="w-3.5 h-3.5" />
        <span>Calibrated similarity threshold (&tau; = 0.53) strictly enforces zero extrapolation.</span>
      </div>
    </div>
  );
}
