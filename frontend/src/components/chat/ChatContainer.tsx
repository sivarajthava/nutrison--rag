"use client";

import React, { useState } from "react";
import { DocumentMetadata, CitationItem } from "@/types/chat";
import { useChatbot } from "@/hooks/useChatbot";
import { ChatHeader } from "./ChatHeader";
import { ScopeSelector } from "./ScopeSelector";
import { MessageList } from "./MessageList";
import { ChatInputArea } from "./ChatInputArea";
import { CitationDrawer } from "./CitationDrawer";
import { ChatSidebar } from "./ChatSidebar";

interface ChatContainerProps {
  initialDocuments?: DocumentMetadata[];
}

export function ChatContainer({ initialDocuments = [] }: ChatContainerProps) {
  const {
    sessions,
    activeSessionId,
    activeSession,
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
    createNewSession,
    selectSession,
    deleteSession,
    renameSession,
    editMessage,
    deleteMessage,
  } = useChatbot();

  // Mobile sidebar drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Multi-session History Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Conversation Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header with hamburger toggle and active title */}
        <ChatHeader
          documents={initialDocuments}
          onClearMessages={clearMessages}
          hasMessages={messages.length > 0}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          sessionTitle={activeSession?.title}
        />

        {/* Scope Selector Sub-Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur px-4 sm:px-6 py-2 shrink-0">
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
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
          />
        </main>

        {/* Input Dock */}
        <div className="shrink-0">
          <ChatInputArea
            onSend={(query) => sendMessage(query)}
            onStop={stopStreaming}
            isStreaming={status === "STREAMING"}
            isSubmitting={status === "SUBMITTING" || status === "RETRIEVING"}
          />
        </div>
      </div>

      {/* Slide-Over Provenance Drawer */}
      <CitationDrawer
        citation={activeCitation}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
