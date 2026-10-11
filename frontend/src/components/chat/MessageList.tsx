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
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
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
  onEditMessage,
  onDeleteMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new tokens / messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center text-center">
        {/* Brand Icon Header */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
          <Sparkles className="w-7 h-7" />
        </div>

        <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Nutrition &amp; Food Safety Assistant
        </h2>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          Ask questions about dietary guidelines, nutrient requirements, culinary food storage, and cooking science.
        </p>

        {/* 3 Overview Info Cards matching target app */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl w-full text-left text-xs mb-6">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Authoritative Evidence</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Grounded across 7 canonical public health publications from WHO, FAO, FDA, USDA, and UK FSA.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Safety Guardrails</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Deterministic code-level filters strictly block clinical medical diets, target weights, and calorie deficits.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Factual Food Safety</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Grounded storage durations, refrigeration temperature limits, bacterial safety, and thawing rules.
            </p>
          </div>
        </div>

        {/* Starter Prompts Grid */}
        <div className="w-full max-w-xl text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
            Suggested Inquiries
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(prompt.text)}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex flex-col justify-between group shadow-xs hover:shadow-sm"
              >
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                  {prompt.category}
                </span>
                <span className="leading-snug">{prompt.text}</span>
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
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
        />
      ))}

      {/* Real-time status badge */}
      {(status === "SUBMITTING" || status === "RETRIEVING" || status === "STREAMING") && (
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 bg-white/95 dark:bg-slate-900/95 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-fit animate-pulse">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-emerald-500 border-r-transparent shrink-0" />
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
