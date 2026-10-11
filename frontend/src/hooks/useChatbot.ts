"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ChatMessage, ChatState, SSEEvent, RefusalPayload, ChatSession } from "@/types/chat";
import { parseSSEStream } from "@/lib/sse-parser";

const SESSIONS_STORAGE_KEY = "nutrition_chatbot_sessions";
const ACTIVE_SESSION_ID_KEY = "nutrition_chatbot_active_session_id";

export interface UseChatbotOptions {
  initialDocumentFilter?: string | null;
  initialCategoryFilter?: "nutrition" | "food_safety" | null;
}

function createDefaultSession(): ChatSession {
  return {
    id: `session-${Date.now()}`,
    title: "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadInitialSessions(): { sessions: ChatSession[]; activeId: string } {
  if (typeof window === "undefined") {
    const def = createDefaultSession();
    return { sessions: [def], activeId: def.id };
  }
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (saved) {
      const parsed: ChatSession[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const active = localStorage.getItem(ACTIVE_SESSION_ID_KEY) || parsed[0].id;
        const validActive = parsed.some((s) => s.id === active) ? active : parsed[0].id;
        return { sessions: parsed, activeId: validActive };
      }
    }
  } catch (e) {
    console.warn("Failed to load sessions from localStorage:", e);
  }
  const def = createDefaultSession();
  return { sessions: [def], activeId: def.id };
}

export function useChatbot(options: UseChatbotOptions = {}) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const init = loadInitialSessions();
    return init.sessions;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const init = loadInitialSessions();
    return init.activeId;
  });

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

  // Sync sessions with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, activeSessionId);
    } catch (e) {
      console.warn("Failed to save sessions to localStorage:", e);
    }
  }, [sessions, activeSessionId]);

  // Current active session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession();
  }, [sessions, activeSessionId]);

  const messages = activeSession.messages;

  // Helper to update current session messages
  const setMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === activeSessionId) {
            const nextMessages = updater(session.messages);
            return {
              ...session,
              messages: nextMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );
    },
    [activeSessionId]
  );

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
    setMessages(() => []);
    setStatus("IDLE");
    setError(null);
  }, [stopStreaming, setMessages]);

  // Session management functions
  const createNewSession = useCallback(() => {
    stopStreaming();
    const newSession = createDefaultSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setStatus("IDLE");
    setError(null);
  }, [stopStreaming]);

  const selectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      stopStreaming();
      setActiveSessionId(sessionId);
      setStatus("IDLE");
      setError(null);
    },
    [activeSessionId, stopStreaming]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      stopStreaming();
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (remaining.length === 0) {
          const fresh = createDefaultSession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
        if (sessionId === activeSessionId) {
          setActiveSessionId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeSessionId, stopStreaming]
  );

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s))
    );
  }, []);

  // Delete specific message
  const deleteMessage = useCallback(
    (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [setMessages]
  );

  // Send message streaming pipeline
  const sendMessage = useCallback(
    async (
      query: string,
      overrideFilterDocId?: string | null,
      overrideCategory?: "nutrition" | "food_safety" | null,
      existingHistoryPrefix?: ChatMessage[]
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

      // Auto-set session title from the first prompt
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === activeSessionId) {
            const historyBase = existingHistoryPrefix !== undefined ? existingHistoryPrefix : session.messages;
            const updatedMessages = [...historyBase, userMsg, assistantMsg];
            const shouldRename = session.title === "New Chat" || session.messages.length === 0;
            const nextTitle = shouldRename
              ? trimmedQuery.length > 30
                ? `${trimmedQuery.slice(0, 28)}...`
                : trimmedQuery
              : session.title;

            return {
              ...session,
              title: nextTitle,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }
          return session;
        })
      );

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
    [activeSessionId, documentFilter, categoryFilter, stopStreaming, setMessages]
  );

  // Edit message & re-submit
  const editMessage = useCallback(
    (messageId: string, newContent: string) => {
      const msgIdx = messages.findIndex((m) => m.id === messageId);
      if (msgIdx === -1) return;

      const targetMsg = messages[msgIdx];
      if (targetMsg.role === "user") {
        // Keep all messages before this user message and re-run with new query
        const preceding = messages.slice(0, msgIdx);
        sendMessage(newContent, undefined, undefined, preceding);
      } else {
        // Edit assistant message text directly
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: newContent } : m))
        );
      }
    },
    [messages, sendMessage, setMessages]
  );

  return {
    sessions,
    activeSessionId,
    activeSession,
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
    createNewSession,
    selectSession,
    deleteSession,
    renameSession,
    editMessage,
    deleteMessage,
  };
}
