import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("document_id");
  const blockType = searchParams.get("block_type");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  try {
    const upstreamUrl = new URL(`${BACKEND_URL}/v1/blocks`);
    if (documentId) upstreamUrl.searchParams.set("document_id", documentId);
    if (blockType) upstreamUrl.searchParams.set("block_type", blockType);
    if (limitParam) upstreamUrl.searchParams.set("limit", limitParam);
    if (offsetParam) upstreamUrl.searchParams.set("offset", offsetParam);

    const res = await fetch(upstreamUrl.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // If backend is not running, fall back to reading local data/blocks.jsonl directly
  }

  try {
    const blocksPath = path.resolve(process.cwd(), "..", "data", "blocks.jsonl");
    if (!fs.existsSync(blocksPath)) {
      return NextResponse.json({ error: "blocks.jsonl file not found" }, { status: 404 });
    }

    const fileContent = fs.readFileSync(blocksPath, "utf-8");
    const lines = fileContent.split("\n");
    let blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const block = JSON.parse(trimmed);
        if (documentId && block.document_id !== documentId) continue;
        if (blockType && block.type !== blockType) continue;
        blocks.push(block);
      } catch {
        // Skip malformed line
      }
    }

    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    if (offset > 0) {
      blocks = blocks.slice(offset);
    }
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      blocks = blocks.slice(0, limit);
    }

    return NextResponse.json(blocks);
  } catch (localErr: any) {
    console.error("Failed to read local blocks fallback:", localErr);
    return NextResponse.json(
      { error: "Failed to retrieve blocks", details: localErr?.message },
      { status: 500 }
    );
  }
}
