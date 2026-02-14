import { describe, it, expect } from "vitest";
import { searchKbIndex, type KBChunk } from "@/lib/kb";

describe("KB search", () => {
  it("ranks relevant chunks higher and returns KB citations", () => {
    const chunks: KBChunk[] = [
      {
        docId: "d1",
        title: "Evac triggers",
        sourcePath: "kb_sources/evac.md",
        chunkId: "d1#1",
        text: "Evacuation trigger points include wind shift toward populated areas and time-to-impact under 2 hours.",
      },
      {
        docId: "d2",
        title: "Radio comms",
        sourcePath: "kb_sources/comms.md",
        chunkId: "d2#1",
        text: "Use clear text. Establish command and tactical frequencies. Maintain accountability.",
      },
    ];

    const results = searchKbIndex(chunks, "wind shift evacuation triggers", 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].cite).toBe("KB:d1#1");
    expect(results[0].title).toBe("Evac triggers");
  });
});

