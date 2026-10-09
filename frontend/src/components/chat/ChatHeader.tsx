"use client";

import React, { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { DocumentMetadata } from "@/types/chat";
import {
  Sparkles,
  Sliders,
  RotateCcw,
  BookOpen,
  X,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface ChatHeaderProps {
  documents: DocumentMetadata[];
  onClearMessages: () => void;
  hasMessages: boolean;
}

export function ChatHeader({
  documents,
  onClearMessages,
  hasMessages,
}: ChatHeaderProps) {
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <span className="bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white p-2 rounded-xl shadow-md">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Dietary Guidance Assistant
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded RAG
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans hidden sm:block">
                Authoritative Public Health &bull; WHO &bull; FAO &bull; FDA &bull; USDA &bull; UK FSA
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Corpus Registry Button */}
            <button
              onClick={() => setIsRegistryOpen(true)}
              className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="View the 7 registered authoritative publications"
              aria-label="View the 7 authoritative publications in corpus registry"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">7 Sources</span>
            </button>

            {/* Diagnostic Explorer Link */}
            <Link
              href="/explorer"
              className="text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/60 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Open Developer & Corpus Diagnostic Explorer"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explorer</span>
            </Link>

            {/* Clear Chat History */}
            {hasMessages && (
              <button
                onClick={onClearMessages}
                className="text-xs text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700/80 hover:border-rose-800/60 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
                title="Reset Conversation"
                aria-label="Reset conversation history"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Radix UI Corpus Registry Dialog */}
      <Dialog.Root open={isRegistryOpen} onOpenChange={setIsRegistryOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 outline-none">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <div>
                    <Dialog.Title className="text-base font-bold text-slate-100">
                      Authoritative Corpus Registry
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-slate-400 font-mono">
                      7 canonical public health publications &bull; 1,001 structural blocks
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Close corpus registry modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-3 divide-y divide-slate-800/60 flex-1">
                {documents.map((doc) => (
                  <div key={doc.document_id} className="pt-3 first:pt-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className="text-sm font-semibold text-slate-100">
                        {doc.title}
                      </h4>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap ${
                          doc.category === "food_safety"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                            : "bg-indigo-950 text-indigo-300 border-indigo-800/60"
                        }`}
                      >
                        {doc.category === "food_safety" ? "Food Safety" : "Nutrition"}
                      </span>
                    </div>

                    <p className="text-xs text-indigo-300 font-mono mb-1.5">
                      {doc.publisher} &bull; {doc.year}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      {doc.description}
                    </p>

                    <a
                      href={doc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition focus:outline-none focus:underline"
                    >
                      <span>Canonical Publication URL</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-850 flex justify-end">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
