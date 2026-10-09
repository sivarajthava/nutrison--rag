"use client";

import { useState, useEffect, useCallback } from "react";
import { DocumentMetadata } from "@/types/chat";

export function useCorpusRegistry() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistry = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        throw new Error(`Failed to fetch documents: ${res.statusText}`);
      }
      const data: DocumentMetadata[] = await res.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load corpus documents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const getDocument = useCallback(
    (id: string): DocumentMetadata | undefined => {
      return documents.find((doc) => doc.document_id === id);
    },
    [documents]
  );

  return {
    documents,
    isLoading,
    error,
    refetch: fetchRegistry,
    getDocument,
  };
}
