import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import TurndownService from "turndown";

type SourceType = "pdf" | "html";

type RagSource = {
  id: string;
  title: string;
  url: string;
  type: SourceType;
  priority?: number;
  chunking?: string;
  note?: string;
};

type RagConfig = { sources: RagSource[] };

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "rag_sources.yaml");
const RAW_DIR = path.join(ROOT, "kb_sources", "raw");
const OUT_DIR = path.join(ROOT, "kb_sources", "ingested");

const UA =
  process.env.RAG_USER_AGENT ??
  "InitialAttack-IC-Assist/0.1 (TreeHacks; doctrine-ingest; contact: demo@example.com)";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function readConfig(): RagConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = YAML.parse(raw) as RagConfig;
  if (!parsed?.sources?.length) return { sources: [] };
  return parsed;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const ids: string[] = [];
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") force = true;
    if (a === "--ids") {
      const v = args[i + 1] || "";
      v.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((x) => ids.push(x));
      i++;
    }
  }
  return { force, ids };
}

async function downloadToFile(url: string, filePath: string, force: boolean) {
  if (!force && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Download failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
}

function frontMatter(src: RagSource) {
  return [
    "---",
    `id: ${src.id}`,
    `title: ${JSON.stringify(src.title)}`,
    `url: ${JSON.stringify(src.url)}`,
    `type: ${src.type}`,
    `priority: ${src.priority ?? 9}`,
    src.chunking ? `chunking: ${JSON.stringify(src.chunking)}` : null,
    src.note ? `note: ${JSON.stringify(src.note)}` : null,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeText(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfToMarkdown(pdfPath: string): Promise<string> {
  // Lazy import to keep normal app bundle slim
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;

  let out = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings = (textContent.items || [])
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    if (strings.trim()) {
      out += `\n\n## Page ${pageNum}\n\n${strings}\n`;
    }
  }

  const text = normalizeText(out);
  return text ? `\n\n${text}\n` : "\n\n(Empty PDF text extraction)\n";
}

function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  // Remove scripts/styles quickly
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const md = turndown.turndown(cleaned);
  return normalizeText(md);
}

async function extractHtmlToMarkdown(htmlPath: string): Promise<string> {
  const html = fs.readFileSync(htmlPath, "utf8");
  return `\n\n${htmlToMarkdown(html)}\n`;
}

async function processSource(src: RagSource, force: boolean) {
  ensureDir(RAW_DIR);
  ensureDir(OUT_DIR);

  const rawExt = src.type === "pdf" ? "pdf" : "html";
  const rawPath = path.join(RAW_DIR, `${src.id}.${rawExt}`);
  const outPath = path.join(OUT_DIR, `${src.id}.md`);

  await downloadToFile(src.url, rawPath, force);

  let body = "";
  if (src.type === "pdf") body = await extractPdfToMarkdown(rawPath);
  else body = await extractHtmlToMarkdown(rawPath);

  const header = `# ${src.title}\n\nSource: ${src.url}\n`;
  const doc = `${frontMatter(src)}${header}${body}`;
  fs.writeFileSync(outPath, doc, "utf8");
}

async function main() {
  const { force, ids } = parseArgs();
  const cfg = readConfig();

  const selected = ids.length
    ? cfg.sources.filter((s) => ids.includes(s.id))
    : cfg.sources;

  if (selected.length === 0) {
    console.log("[rag_sync] No sources selected.");
    process.exit(0);
  }

  console.log(`[rag_sync] Syncing ${selected.length} sources...`);
  for (const src of selected) {
    const key = sha1(src.url);
    console.log(`[rag_sync] ${src.id} (${src.type}) ${key}`);
    try {
      await processSource(src, force);
      console.log(`[rag_sync] ✓ ${src.id}`);
    } catch (err) {
      console.error(`[rag_sync] ✗ ${src.id}:`, err);
    }
  }

  console.log("[rag_sync] Done. Next: npm run ingest-kb");
}

main();

