"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Square, AlertCircle, CornerDownLeft } from "lucide-react";

interface ChatInputAreaProps {
  onSend: (query: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isSubmitting: boolean;
  disabled?: boolean;
}

const MAX_QUERY_LENGTH = 500;

export function ChatInputArea({
  onSend,
  onStop,
  isStreaming,
  isSubmitting,
  disabled = false,
}: ChatInputAreaProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isStreaming || isSubmitting || disabled) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isOverLimit = text.length > MAX_QUERY_LENGTH;

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-4 sm:p-5">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
        <div className="relative bg-slate-950 border border-slate-800 rounded-2xl shadow-inner focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSubmitting}
            placeholder={
              isStreaming
                ? "Streaming response..."
                : "Ask about safe refrigeration, cooking temperatures, dietary sugars..."
            }
            aria-label="Dietary guidance and food safety inquiry input"
            className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none max-h-40 min-h-[50px] leading-relaxed"
          />

          {/* Action button inside input */}
          <div className="p-2 shrink-0">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop streaming and conserve tokens"
                className="bg-rose-600 hover:bg-rose-500 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                title="Stop streaming (Conserve Groq tokens)"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim() || isOverLimit || isSubmitting || disabled}
                aria-label="Send inquiry"
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow-sm disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title="Send query (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom hints & counter */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3 text-slate-600" /> Enter to send, Shift + Enter for newline
            </span>
          </div>

          <span
            className={
              isOverLimit
                ? "text-rose-400 font-bold"
                : text.length > MAX_QUERY_LENGTH * 0.8
                ? "text-amber-400"
                : "text-slate-500"
            }
          >
            {text.length}/{MAX_QUERY_LENGTH}
          </span>
        </div>
      </form>
    </div>
  );
}
