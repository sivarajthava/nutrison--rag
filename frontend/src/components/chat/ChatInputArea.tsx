"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Square, CornerDownLeft } from "lucide-react";

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
    <div className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 shrink-0 transition-colors duration-200">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-1.5">
        <div className="relative bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all flex items-end">
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
            className="w-full bg-transparent px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none max-h-40 min-h-[48px] leading-relaxed"
          />

          {/* Action button inside input */}
          <div className="p-2 shrink-0">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop streaming and conserve tokens"
                className="bg-rose-600 hover:bg-rose-700 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                title="Stop streaming (Conserve Groq tokens)"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim() || isOverLimit || isSubmitting || disabled}
                aria-label="Send inquiry"
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow-xs disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="Send query (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Character count and helper note */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono px-1">
          <div className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
          </div>

          <span className={isOverLimit ? "text-rose-500 font-semibold" : ""}>
            {text.length}/{MAX_QUERY_LENGTH}
          </span>
        </div>
      </form>
    </div>
  );
}
