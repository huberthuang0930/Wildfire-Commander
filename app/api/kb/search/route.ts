import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { searchKbIndex, type KBChunk } from "@/lib/kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type KBIndex = { chunks: KBChunk[] };

let cachedIndex: KBIndex | null = null;
let cachedMtimeMs: number | null = null;

function loadIndex(): KBIndex {
  const filePath = path.join(process.cwd(), "data", "kb_index.json");
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

  if (!stat) return { chunks: [] };
  if (cachedIndex && cachedMtimeMs === stat.mtimeMs) return cachedIndex;

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as KBIndex;
  cachedIndex = parsed;
  cachedMtimeMs = stat.mtimeMs;
  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: string; k?: number };
    const query = (body.query || "").trim();
    const k = Math.max(1, Math.min(10, body.k ?? 5));

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const index = loadIndex();
    const results = searchKbIndex(index.chunks, query, k);

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[API /kb/search] Error:", err);
    return NextResponse.json({ error: "KB search failed", results: [] }, { status: 500 });
  }
}

