"use client";

import React, { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { DocumentMetadata } from "@/types/chat";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sparkles,
  Sliders,
  RotateCcw,
  BookOpen,
  X,
  ExternalLink,
  ShieldCheck,
  Menu,
} from "lucide-react";

interface ChatHeaderProps {
  documents: DocumentMetadata[];
  onClearMessages: () => void;
  hasMessages: boolean;
  onToggleSidebar?: () => void;
  sessionTitle?: string;
}

export function ChatHeader({
  documents,
  onClearMessages,
  hasMessages,
  onToggleSidebar,
  sessionTitle,
}: ChatHeaderProps) {
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 shadow-xs transition-colors duration-200 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Mobile Menu & Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
                aria-label="Toggle chat sessions sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
                  AI Nutrition Assistant
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold tracking-wide border border-emerald-200 dark:border-emerald-800/80 shrink-0">
                  Grounded RAG
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans hidden sm:block truncate">
                {sessionTitle && sessionTitle !== "New Chat"
                  ? sessionTitle
                  : "Authoritative Public Health \u2022 WHO \u2022 FAO \u2022 FDA \u2022 USDA \u2022 UK FSA"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live Connection Pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              title="Authoritative Corpus Vector Engine Connected"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Connected</span>
            </div>

            {/* View Corpus Registry Button */}
            <button
              onClick={() => setIsRegistryOpen(true)}
              className="text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="View the 7 registered authoritative publications"
              aria-label="View the 7 authoritative publications in corpus registry"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden md:inline">7 Sources</span>
            </button>

            {/* Diagnostic Explorer Link */}
            <Link
              href="/explorer"
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Open Developer & Corpus Diagnostic Explorer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Explorer</span>
            </Link>

            {/* Clear Chat History */}
            {hasMessages && (
              <button
                onClick={onClearMessages}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-900/60 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
                title="Reset Conversation"
                aria-label="Reset conversation history"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Accessible Radix UI Corpus Registry Dialog */}
      <Dialog.Root open={isRegistryOpen} onOpenChange={setIsRegistryOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 outline-none text-slate-900 dark:text-slate-100">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div>
                    <Dialog.Title className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Authoritative Corpus Registry
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400">
                      7 canonical guidance documents pre-indexed for zero extrapolation
                    </Dialog.Description>
                  </div>
                </div>

                <Dialog.Close asChild>
                  <button
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Modal Body - Publications List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                {documents.map((doc, idx) => (
                  <div key={doc.document_id} className="pt-3.5 first:pt-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {idx + 1}. {doc.title}
                      </h4>
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 shrink-0 group focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded"
                      >
                        <span className="hidden sm:inline">Official Source</span>
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{doc.publisher}</span>
                      <span>&bull;</span>
                      <span>{doc.year}</span>
                      <span>&bull;</span>
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {doc.category.replace("_", " ")}
                      </span>
                    </div>

                    {doc.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                        {doc.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Deterministic Grounding Registry
                </span>
                <Dialog.Close asChild>
                  <button className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition">
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
