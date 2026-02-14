import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTool } from "@/lib/chat/tools";

describe("chat tool runner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls same-origin /api/weather for get_weather", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ windSpeedMps: 1 }), { status: 200 }) as any);

    const r = await runTool(
      "http://localhost:3000/api/chat",
      "get_weather",
      { lat: 1, lon: 2 },
      { active: { mode: "scenario", incidentId: "x", name: "n", lat: 1, lon: 2 } as any }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = (fetchMock.mock.calls[0] as any[])[0] as string;
    expect(calledUrl).toContain("http://localhost:3000/api/weather?lat=1&lon=2");
    expect((r.output as any).windSpeedMps).toBe(1);
    expect(r.trace.tool).toBe("get_weather");
  });
});

