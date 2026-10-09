"use client";

import React, { useState } from "react";
import { DocumentMetadata, CitationItem } from "@/types/chat";
import { useChatbot } from "@/hooks/useChatbot";
import { ChatHeader } from "./ChatHeader";
import { ScopeSelector } from "./ScopeSelector";
import { MessageList } from "./MessageList";
import { ChatInputArea } from "./ChatInputArea";
import { CitationDrawer } from "./CitationDrawer";

interface ChatContainerProps {
  initialDocuments?: DocumentMetadata[];
}

export function ChatContainer({ initialDocuments = [] }: ChatContainerProps) {
  const {
    messages,
    status,
    activeStage,
    documentFilter,
    categoryFilter,
    setDocumentFilter,
    setCategoryFilter,
    sendMessage,
    stopStreaming,
    clearMessages,
  } = useChatbot();

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectCitation = (citation: CitationItem) => {
    setActiveCitation(citation);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <ChatHeader
        documents={initialDocuments}
        onClearMessages={clearMessages}
        hasMessages={messages.length > 0}
      />

      {/* Scope Selector Sub-Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-4 sm:px-6 py-2.5">
        <div className="max-w-4xl mx-auto">
          <ScopeSelector
            documents={initialDocuments}
            selectedDocId={documentFilter}
            onSelect={setDocumentFilter}
            selectedCategory={categoryFilter}
            onSelectCategory={setCategoryFilter}
          />
        </div>
      </div>

      {/* Main Conversation Stream */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto overflow-hidden">
        <MessageList
          messages={messages}
          status={status}
          activeStage={activeStage}
          onSelectCitation={handleSelectCitation}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
        />
      </main>

      {/* Input Dock */}
      <ChatInputArea
        onSend={(query) => sendMessage(query)}
        onStop={stopStreaming}
        isStreaming={status === "STREAMING"}
        isSubmitting={status === "SUBMITTING" || status === "RETRIEVING"}
      />

      {/* Slide-Over Provenance Drawer */}
      <CitationDrawer
        citation={activeCitation}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
