"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCorpusRegistry } from "@/hooks/useCorpusRegistry";
import { BlockExplorer } from "@/components/explorer/BlockExplorer";
import { ChunkInspector } from "@/components/explorer/ChunkInspector";
import { RetrievalDebugger } from "@/components/explorer/RetrievalDebugger";
import { GuardrailDebugger } from "@/components/explorer/GuardrailDebugger";
import {
  Layers,
  Database,
  Sliders,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  BookOpen,
} from "lucide-react";

type ExplorerTab = "blocks" | "chunks" | "retrieval" | "guardrails";

export default function DiagnosticExplorerPage() {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("blocks");
  const { documents, isLoading: isRegistryLoading } = useCorpusRegistry();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Chat
            </Link>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-100">
                  Diagnostic & Corpus Explorer
                </h1>
                <p className="text-[11px] text-slate-400 font-mono">
                  1,001 Canonical Blocks &bull; 160 Calibrated Chunks &bull; 7 Authoritative Publications
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 text-slate-300">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              {isRegistryLoading ? "Loading..." : `${documents.length} Publications`}
            </span>
            <span className="bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-800 text-[11px] font-semibold">
              FastAPI Gateway: Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-800 space-x-1 sm:space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("blocks")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-t border-x ${
              activeTab === "blocks"
                ? "bg-slate-900 border-slate-700 text-indigo-400 border-b-transparent"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Block Explorer</span>
            <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              1,001
            </span>
          </button>

          <button
            onClick={() => setActiveTab("chunks")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-t border-x ${
              activeTab === "chunks"
                ? "bg-slate-900 border-slate-700 text-indigo-400 border-b-transparent"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>2. Chunk Inspector</span>
            <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              160
            </span>
          </button>

          <button
            onClick={() => setActiveTab("retrieval")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-t border-x ${
              activeTab === "retrieval"
                ? "bg-slate-900 border-slate-700 text-indigo-400 border-b-transparent"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>3. Retrieval & Similarity Debugger</span>
            <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded">
              &tau; = 0.53
            </span>
          </button>

          <button
            onClick={() => setActiveTab("guardrails")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-t border-x ${
              activeTab === "guardrails"
                ? "bg-slate-900 border-slate-700 text-indigo-400 border-b-transparent"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>4. Guardrail Debugger</span>
            <span className="text-[10px] font-mono bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded">
              Refusal 2
            </span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="pt-2">
          {activeTab === "blocks" && <BlockExplorer documents={documents} />}
          {activeTab === "chunks" && <ChunkInspector documents={documents} />}
          {activeTab === "retrieval" && <RetrievalDebugger documents={documents} />}
          {activeTab === "guardrails" && <GuardrailDebugger />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        Dietary Guidance RAG &bull; Phase 6 Diagnostic Workspace &bull; Zero Streamlit Dependency
      </footer>
    </div>
  );
}
