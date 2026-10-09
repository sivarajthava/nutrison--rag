import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("document_id");
  const chunkType = searchParams.get("chunk_type");
  const hasTable = searchParams.get("has_table");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  try {
    const upstreamUrl = new URL(`${BACKEND_URL}/v1/chunks`);
    if (documentId) upstreamUrl.searchParams.set("document_id", documentId);
    if (chunkType) upstreamUrl.searchParams.set("chunk_type", chunkType);
    if (hasTable !== null) upstreamUrl.searchParams.set("has_table", hasTable);
    if (limitParam) upstreamUrl.searchParams.set("limit", limitParam);
    if (offsetParam) upstreamUrl.searchParams.set("offset", offsetParam);

    const res = await fetch(upstreamUrl.toString(), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("BFF /api/chunks error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve chunks from backend", details: error?.message },
      { status: 502 }
    );
  }
}
