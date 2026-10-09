"use client";

import React, { useState } from "react";
import { ChatMessage, CitationItem } from "@/types/chat";
import { GroundedAnswerView } from "./GroundedAnswerView";
import { MultiSourceView } from "./MultiSourceView";
import { RefusalCard } from "./RefusalCard";
import {
  Sparkles,
  User,
  Copy,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";

interface MessageItemProps {
  message: ChatMessage;
  onSelectCitation: (citation: CitationItem) => void;
}

export function MessageItem({ message, onSelectCitation }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 items-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 bg-indigo-600 text-white text-sm shadow-sm rounded-br-none leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="flex justify-start gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm mt-1">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex-1 max-w-[95%] sm:max-w-[85%] space-y-2">
        <div className="rounded-2xl p-4 sm:p-5 bg-slate-850 border border-slate-800 text-slate-200 text-sm shadow-sm rounded-bl-none leading-relaxed">
          {/* Refusal Response */}
          {message.refusal ? (
            <RefusalCard refusal={message.refusal} />
          ) : message.sections && message.sections.length > 1 ? (
            /* Multi-Source Isolated Presentation */
            <MultiSourceView
              sections={message.sections}
              onSelectCitation={onSelectCitation}
            />
          ) : (
            /* Grounded Answer with Interactive Citation Badges */
            <div>
              <GroundedAnswerView
                content={message.content}
                citations={message.citations}
                onSelectCitation={onSelectCitation}
              />
              {/* Streaming Cursor */}
              {message.status === "STREAMING" && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
              )}
            </div>
          )}

          {/* Error notice if any */}
          {message.error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        {/* Action & Metric Bar below message */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono px-1">
          <div className="flex items-center gap-3">
            {message.latency_ms !== null && message.latency_ms !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-600" />
                <span>{message.latency_ms}ms TTFT/synthesis</span>
              </span>
            )}
            {message.citations && message.citations.length > 0 && (
              <span className="text-indigo-400/80">
                {message.citations.length} cited source{message.citations.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="text-slate-500 hover:text-slate-300 flex items-center gap-1 transition px-1.5 py-0.5 rounded hover:bg-slate-800"
            title="Copy answer markdown"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
