import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type KBChunk = {
  docId: string;
  title: string;
  sourcePath: string;
  chunkId: string;
  text: string;
};

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, "kb_sources");
const OUT_FILE = path.join(ROOT, "data", "kb_index.json");

function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function guessTitle(filePath: string, content: string): string {
  const base = path.basename(filePath);
  const m = content.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim() || base;
}

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ \u00A0]+/g, " ").trim();
}

function splitIntoChunks(content: string): string[] {
  const text = normalizeText(content);
  if (!text) return [];

  // Prefer splitting on headings/blank lines, then pack into ~300-800 char chunks.
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of parts) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length <= 800) {
      buf = candidate;
      continue;
    }
    if (buf) chunks.push(buf);
    if (p.length <= 800) {
      buf = p;
    } else {
      // Hard wrap long paragraphs
      for (let i = 0; i < p.length; i += 700) {
        chunks.push(p.slice(i, i + 700));
      }
      buf = "";
    }
  }
  if (buf) chunks.push(buf);

  // Filter out tiny chunks (noise)
  return chunks.filter((c) => c.length >= 120);
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function isTextLike(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".markdown", ".txt"].includes(ext);
}

function rel(p: string): string {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function main() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
    console.log(`[ingest_kb] Created ${rel(SOURCES_DIR)} (drop .md/.txt files here)`);
  }

  const files = walkFiles(SOURCES_DIR)
    .filter(isTextLike)
    .filter((p) => path.basename(p).toLowerCase() !== "readme.md");
  const all: KBChunk[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const title = guessTitle(filePath, content);
    const docId = sha1(rel(filePath));
    const chunks = splitIntoChunks(content);
    chunks.forEach((text, i) => {
      all.push({
        docId,
        title,
        sourcePath: rel(filePath),
        chunkId: `${docId}#${i + 1}`,
        text,
      });
    });
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ chunks: all }, null, 2), "utf8");
  console.log(`[ingest_kb] Wrote ${all.length} chunks to ${rel(OUT_FILE)}`);
}

main();

