"use client";

import React, { useRef, useEffect } from "react";
import { ChatMessage, CitationItem, ChatState } from "@/types/chat";
import { MessageItem } from "./MessageItem";
import { BookOpen, Sparkles, ShieldCheck, HeartHandshake } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  status: ChatState;
  activeStage: string | null;
  onSelectCitation: (citation: CitationItem) => void;
  onSelectPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  {
    category: "Food Safety",
    text: "How long can chicken stay in the fridge?",
  },
  {
    category: "Hygiene",
    text: "What are the 5 keys to safer food?",
  },
  {
    category: "Nutrition",
    text: "What are WHO recommendations on free sugars?",
  },
  {
    category: "Cooking",
    text: "How long to thaw turkey in cold water versus refrigerator?",
  },
  {
    category: "Dietary",
    text: "What does the Eatwell Guide say about beans and pulses?",
  },
  {
    category: "Temperatures",
    text: "What temperature should the refrigerator be kept at?",
  },
];

export function MessageList({
  messages,
  status,
  activeStage,
  onSelectCitation,
  onSelectPrompt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new tokens / messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 space-y-6">
        <div className="bg-gradient-to-tr from-indigo-900/60 to-indigo-800/40 p-4 rounded-3xl border border-indigo-700/60 text-indigo-300 shadow-xl">
          <BookOpen className="w-10 h-10" />
        </div>

        <div className="space-y-2 max-w-lg">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Authoritative Dietary &amp; Food Safety Assistant
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Grounded strictly in 1,001 structural blocks across 7 public health publications.
            Every claim is verifiable with click-to-view provenance citations.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 max-w-md text-[11px] font-mono text-slate-400">
          <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Zero Hallucinations
          </span>
          <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Isolated Attribution
          </span>
          <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5 text-rose-400" /> Clinical Safety Guardrails
          </span>
        </div>

        {/* Starter Prompts Grid */}
        <div className="w-full max-w-2xl pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Suggested Authoritative Inquiries
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(prompt.text)}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-600/60 transition text-left text-xs text-slate-300 hover:text-white flex flex-col justify-between group shadow-sm"
              >
                <span className="text-[10px] font-mono text-indigo-400 font-semibold mb-1">
                  {prompt.category}
                </span>
                <span className="group-hover:translate-x-0.5 transition-transform duration-150">
                  &ldquo;{prompt.text}&rdquo;
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
    >
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onSelectCitation={onSelectCitation}
        />
      ))}

      {/* Real-time status badge */}
      {(status === "SUBMITTING" || status === "RETRIEVING" || status === "STREAMING") && (
        <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-slate-900/90 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-sm w-fit animate-pulse">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-indigo-500 border-r-transparent shrink-0" />
          <span className="font-mono">
            {activeStage === "safety_check"
              ? "Phase 1: Evaluating deterministic safety guardrails..."
              : activeStage === "retrieving"
              ? "Phase 2: Executing dual-mode vector retrieval across 7 documents..."
              : "Phase 3: Synthesizing grounded response via Groq LPU..."}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
