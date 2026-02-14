export type KBChunk = {
  docId: string;
  title: string;
  sourcePath: string;
  chunkId: string; // "docId#n"
  text: string;
};

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 50);
}

export function scoreChunk(tokens: string[], text: string): number {
  const hay = ` ${text.toLowerCase()} `;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(` ${t} `)) hits += 1;
    else if (hay.includes(t)) hits += 0.5;
  }
  const norm = Math.max(1, Math.sqrt(text.length / 500));
  return hits / norm;
}

export function makeSnippet(text: string, tokens: string[]): string {
  const lower = text.toLowerCase();
  const idx = tokens
    .map((t) => lower.indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (idx == null) return text.slice(0, 180);
  const start = Math.max(0, idx - 80);
  return text.slice(start, start + 220);
}

export function searchKbIndex(chunks: KBChunk[], query: string, k = 5) {
  const tokens = tokenize(query);
  const scored = chunks
    .map((c) => ({ c, s: scoreChunk(tokens, c.text) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, Math.min(10, k)));

  return scored.map(({ c }) => ({
    cite: `KB:${c.chunkId}`,
    title: c.title,
    sourcePath: c.sourcePath,
    snippet: makeSnippet(c.text, tokens),
    text: c.text,
  }));
}

