"use client";

import { useState, useRef, useCallback } from "react";
import { ChatMessage, ChatState, SSEEvent, RefusalPayload } from "@/types/chat";
import { parseSSEStream } from "@/lib/sse-parser";

export interface UseChatbotOptions {
  initialDocumentFilter?: string | null;
  initialCategoryFilter?: "nutrition" | "food_safety" | null;
}

export function useChatbot(options: UseChatbotOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatState>("IDLE");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<string | null>(
    options.initialDocumentFilter ?? null
  );
  const [categoryFilter, setCategoryFilter] = useState<"nutrition" | "food_safety" | null>(
    options.initialCategoryFilter ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus("IDLE");
      setActiveStage(null);
    }
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setStatus("IDLE");
    setError(null);
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (
      query: string,
      overrideFilterDocId?: string | null,
      overrideCategory?: "nutrition" | "food_safety" | null
    ) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      // Abort any active prior streaming
      stopStreaming();

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmedQuery,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "SUBMITTING",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus("SUBMITTING");
      setActiveStage("safety_check");
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const activeDocId = overrideFilterDocId !== undefined ? overrideFilterDocId : documentFilter;
      const activeCat = overrideCategory !== undefined ? overrideCategory : categoryFilter;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmedQuery,
            filterDocumentId: activeDocId,
            filterCategory: activeCat,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Server returned ${response.status}: ${errText}`);
        }

        if (!response.body) {
          throw new Error("Empty response body from chat stream");
        }

        let accumulatedContent = "";

        await parseSSEStream(
          response.body,
          (event: SSEEvent) => {
            switch (event.type) {
              case "status": {
                setActiveStage(event.stage);
                if (event.stage === "safety_check") {
                  setStatus("SUBMITTING");
                } else if (event.stage === "retrieving") {
                  setStatus("RETRIEVING");
                } else if (event.stage === "synthesizing") {
                  setStatus("STREAMING");
                }
                break;
              }

              case "token": {
                setStatus("STREAMING");
                accumulatedContent += event.delta;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: accumulatedContent,
                          status: "STREAMING",
                        }
                      : msg
                  )
                );
                break;
              }

              case "citations": {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          citations: event.citations,
                          sections: event.sections,
                        }
                      : msg
                  )
                );
                break;
              }

              case "refusal": {
                const refusalPayload: RefusalPayload = {
                  status:
                    event.status === "REFUSAL_OUT_OF_SCOPE"
                      ? "REFUSAL_OUT_OF_SCOPE"
                      : "REFUSAL_NOT_IN_CORPUS",
                  type:
                    event.refusalType === "OUT_OF_SCOPE_BY_DESIGN" || event.status === "REFUSAL_OUT_OF_SCOPE"
                      ? "OUT_OF_SCOPE_BY_DESIGN"
                      : "NOT_IN_CORPUS",
                  message: event.message,
                  searched_documents: event.searched_documents,
                  suggested_action: event.suggested_action,
                };

                const nextStatus: ChatState =
                  event.status === "REFUSAL_OUT_OF_SCOPE"
                    ? "REFUSAL_OUT_OF_SCOPE"
                    : "REFUSAL_NOT_IN_CORPUS";

                setStatus(nextStatus);
                setActiveStage(null);

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: event.message,
                          refusal: refusalPayload,
                          status: nextStatus,
                          searched_documents: event.searched_documents,
                        }
                      : msg
                  )
                );
                break;
              }

              case "done": {
                setActiveStage(null);
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMsgId) {
                      const finalStatus: ChatState =
                        msg.status === "REFUSAL_NOT_IN_CORPUS" ||
                        msg.status === "REFUSAL_OUT_OF_SCOPE"
                          ? msg.status
                          : "SUCCESS";
                      return {
                        ...msg,
                        status: finalStatus,
                        latency_ms: event.latency_ms,
                      };
                    }
                    return msg;
                  })
                );
                setStatus((current) =>
                  current === "REFUSAL_NOT_IN_CORPUS" || current === "REFUSAL_OUT_OF_SCOPE"
                    ? current
                    : "SUCCESS"
                );
                break;
              }

              case "error": {
                setError(event.message);
                setStatus("ERROR");
                setActiveStage(null);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          error: event.message,
                          status: "ERROR",
                        }
                      : msg
                  )
                );
                break;
              }
            }
          },
          controller.signal
        );
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Intentional user cancellation
          return;
        }
        const errMsg = err?.message || "Failed to communicate with chat service";
        setError(errMsg);
        setStatus("ERROR");
        setActiveStage(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  error: errMsg,
                  status: "ERROR",
                }
              : msg
          )
        );
      } finally {
        abortControllerRef.current = null;
      }
    },
    [documentFilter, categoryFilter, stopStreaming]
  );

  return {
    messages,
    status,
    activeStage,
    error,
    documentFilter,
    categoryFilter,
    setDocumentFilter,
    setCategoryFilter,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
