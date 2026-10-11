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
  Pencil,
  Trash2,
  X,
} from "lucide-react";

interface MessageItemProps {
  message: ChatMessage;
  onSelectCitation: (citation: CitationItem) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
}

export function MessageItem({
  message,
  onSelectCitation,
  onEditMessage,
  onDeleteMessage,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editText.trim() && editText.trim() !== message.content) {
      onEditMessage?.(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("Delete this message?")) {
      onDeleteMessage?.(message.id);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 items-end group">
        <div className="flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[75%]">
          <div className="w-full rounded-2xl p-4 bg-emerald-600 text-white text-sm shadow-xs rounded-br-none leading-relaxed">
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full bg-emerald-700 text-white rounded-lg p-2 text-xs outline-none resize-none focus:ring-1 focus:ring-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === "Escape") {
                      handleCancelEdit();
                    }
                  }}
                />
                <div className="flex items-center justify-end gap-1.5 text-xs">
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-white text-emerald-800 font-semibold hover:bg-emerald-50 transition flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save &amp; Resubmit</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-2 py-1 rounded bg-emerald-700/80 hover:bg-emerald-700 text-white transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {/* Action buttons below user message */}
          {!isEditing && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-mono pr-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1"
                title="Copy message text"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              {onEditMessage && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1"
                  title="Edit prompt and re-submit"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}

              {onDeleteMessage && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="hover:text-rose-500 transition flex items-center gap-1"
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 shadow-2xs">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="flex justify-start gap-3 items-start group">
      <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex-1 max-w-[95%] sm:max-w-[85%] space-y-2">
        <div className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm shadow-xs rounded-tl-xs leading-relaxed">
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
                <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-500 animate-pulse align-middle" />
              )}
            </div>
          )}

          {/* Error notice if any */}
          {message.error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        {/* Action & Metric Bar below message */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono px-1">
          <div className="flex items-center gap-3">
            {message.latency_ms !== null && message.latency_ms !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                <span>{message.latency_ms}ms TTFT/synthesis</span>
              </span>
            )}
            {message.citations && message.citations.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {message.citations.length} cited source{message.citations.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-slate-700 dark:hover:text-slate-300 transition flex items-center gap-1 focus:outline-none"
                title="Copy message content"
                aria-label="Copy message text to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}

            {onDeleteMessage && (
              <button
                type="button"
                onClick={handleDelete}
                className="hover:text-rose-500 transition flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete this message"
                aria-label="Delete message"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
