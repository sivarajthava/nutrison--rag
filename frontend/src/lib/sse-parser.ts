import { SSEEvent } from "@/types/chat";

/**
 * Parses a W3C-compliant Server-Sent Events (SSE) readable stream into typed events.
 * Handles network chunking, partial lines, and message delimiter buffering.
 * 
 * Wire format expected:
 *   event: <event_name>\n
 *   data: <json_string>\n\n
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are delimited by double newlines (\n\n or \r\n\r\n)
      const parts = buffer.split(/\r?\n\r?\n/);
      // The last element is either empty or an incomplete message chunk
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;

        let eventType = "message";
        let dataStr = "";

        const lines = part.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const val = line.slice(5).trim();
            dataStr = dataStr ? `${dataStr}\n${val}` : val;
          }
        }

        if (!dataStr) continue;

        try {
          const parsedData = JSON.parse(dataStr);
          const sseEvent = mapToTypedEvent(eventType, parsedData);
          if (sseEvent) {
            onEvent(sseEvent);
          }
        } catch {
          // If JSON parse fails, emit raw error event
          onEvent({
            type: "error",
            message: `Failed to parse SSE event data: ${dataStr}`,
          });
        }
      }
    }

    // Flush any remaining buffer if complete message exists
    if (buffer.trim()) {
      const lines = buffer.split(/\r?\n/);
      let eventType = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const val = line.slice(5).trim();
          dataStr = dataStr ? `${dataStr}\n${val}` : val;
        }
      }
      if (dataStr) {
        try {
          const parsedData = JSON.parse(dataStr);
          const sseEvent = mapToTypedEvent(eventType, parsedData);
          if (sseEvent) onEvent(sseEvent);
        } catch {
          // ignore flush error
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function mapToTypedEvent(eventType: string, data: any): SSEEvent | null {
  switch (eventType) {
    case "status":
      return {
        type: "status",
        stage: data.stage,
      };
    case "token":
      return {
        type: "token",
        delta: data.delta ?? "",
      };
    case "citations":
      return {
        type: "citations",
        citations: data.citations ?? [],
        sections: data.sections ?? [],
      };
    case "refusal":
      return {
        type: "refusal",
        status: data.status,
        refusalType: data.type || (data.status === "REFUSAL_OUT_OF_SCOPE" ? "OUT_OF_SCOPE_BY_DESIGN" : "NOT_IN_CORPUS"),
        message: data.message,
        searched_documents: data.searched_documents ?? [],
        suggested_action: data.suggested_action,
      };

    case "done":
      return {
        type: "done",
        latency_ms: data.latency_ms ?? 0,
        chunks_retrieved: data.chunks_retrieved ?? 0,
      };
    case "error":
      return {
        type: "error",
        message: data.message ?? "An unexpected error occurred",
        code: data.code,
      };
    default:
      return null;
  }
}
