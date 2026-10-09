import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max execution timeout (seconds) for SSE streaming on Vercel

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, filterDocumentId, filterCategory, topK, threshold } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Query is required and must be non-empty." },
        { status: 400 }
      );
    }

    const payload = {
      query: query.trim(),
      filter_document_id: filterDocumentId || null,
      filter_category: filterCategory || null,
      top_k: topK || null,
      threshold: threshold || null,
    };

    // Forward request to FastAPI with abort signal forwarding
    const response = await fetch(`${BACKEND_URL}/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "No response body received from upstream gateway." },
        { status: 502 }
      );
    }

    // Stream the SSE body back to client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return new Response(null, { status: 499 }); // Client Closed Request
    }
    console.error("BFF /api/chat error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend guidance service.", details: error?.message },
      { status: 500 }
    );
  }
}
