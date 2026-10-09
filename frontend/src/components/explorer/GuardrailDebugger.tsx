"use client";

import React, { useState } from "react";
import { GuardrailCheckResult } from "@/types/chat";
import { ShieldAlert, ShieldCheck, Search, AlertTriangle, ArrowRight, Check } from "lucide-react";

const PRESET_QUERIES = [
  { label: "Diet to Cure Cancer (Medical)", query: "Diet to cure cancer naturally" },
  { label: "Calorie & Weight Goal (Calorie/Weight)", query: "I want to cut to 1200 calories to lose 15 pounds in a month." },
  { label: "Ideal Body Weight (Weight)", query: "What should I weigh if I am 5 feet 10 inches?" },
  { label: "Refrigerate Chicken (Safe Query)", query: "How long can cooked chicken stay in the fridge?" },
  { label: "WHO Sugar Guidelines (Safe Query)", query: "What are WHO recommendations on free sugars?" },
];

export function GuardrailDebugger() {
  const [query, setQuery] = useState<string>("Diet to cure cancer naturally");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<GuardrailCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guardrails/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      }

      const data: GuardrailCheckResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Failed to check guardrail");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Test Sandbox Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Preset Policy Test Queries</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(preset.query)}
                className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCheck} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Type query to evaluate against pre-retrieval deterministic regex rules..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white border-r-transparent" />
                  Testing Rules...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" /> Evaluate Guardrails
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          <div
            className={`border rounded-2xl p-6 shadow-md transition-all ${
              result.violated
                ? "bg-rose-950/30 border-rose-800/80 text-rose-100"
                : "bg-emerald-950/30 border-emerald-800/80 text-emerald-100"
            }`}
          >
            <div className="flex items-start gap-4">
              {result.violated ? (
                <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
              )}

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    {result.violated
                      ? "Deterministic Guardrail Triggered (Refusal 2: Out of Scope)"
                      : "Query Compliant (Bypasses Refusals &rarr; Proceeds to Retrieval)"}
                  </h3>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-mono font-semibold border ${
                      result.violated
                        ? "bg-rose-900/60 border-rose-700 text-rose-200"
                        : "bg-emerald-900/60 border-emerald-700 text-emerald-200"
                    }`}
                  >
                    {result.violated ? "BLOCKED BEFORE RETRIEVAL" : "PERMITTED"}
                  </span>
                </div>

                <p className="text-sm opacity-90 leading-relaxed">
                  {result.message}
                </p>

                {result.violated && (
                  <div className="bg-slate-950/80 border border-rose-900/60 rounded-xl p-4 space-y-2 mt-3">
                    <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                      <span className="text-rose-400 font-semibold">Category:</span>
                      <span className="bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800">
                        {result.category}
                      </span>
                    </div>

                    {result.pattern_matched && (
                      <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                        <span className="text-rose-400 font-semibold">Matched Token Substring:</span>
                        <code className="bg-rose-900/40 text-rose-200 px-2.5 py-1 rounded border border-rose-700">
                          &ldquo;{result.pattern_matched}&rdquo;
                        </code>
                      </div>
                    )}

                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-900">
                      <strong>Zero Token Consumption Guarantee:</strong> This query was intercepted programmatically via compiled regex in under 1ms. Vector database search and Groq LPU generation calls are completely bypassed.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
