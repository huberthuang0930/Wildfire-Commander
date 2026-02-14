import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequestBody, ChatMessage, AssistantStructured } from "@/lib/chat/types";
import { getClaudeToolDefinitions, isOperationalQuestion, runTool } from "@/lib/chat/tools";
import type { Incident, Resources, Asset, SpreadResult, RecommendationsResult, Weather } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_RESOURCES: Resources = {
  enginesAvailable: 2,
  dozersAvailable: 1,
  airSupportAvailable: true,
  etaMinutesEngine: 20,
  etaMinutesAir: 45,
};

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildIncidentStub(active: ChatRequestBody["active"]): Incident {
  return {
    id: active.incidentId,
    name: active.name,
    lat: active.lat,
    lon: active.lon,
    startTimeISO: new Date().toISOString(),
    perimeter: { type: "Point", radiusMeters: 200 },
    fuelProxy: "mixed",
    notes: active.mode === "live" ? "Live signal (satellite/official sources may lag)." : "Scenario incident.",
  };
}

function safeParseStructured(text: string): AssistantStructured | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Partial<AssistantStructured>;
    if (typeof obj.decision !== "string") return null;

    const coerceStringList = (xs: unknown): string[] => {
      if (!Array.isArray(xs)) return [];
      return xs
        .map((x) => {
          if (typeof x === "string") return x;
          if (x && typeof x === "object") {
            const anyX = x as any;
            // Common pattern: { timing, action, rationale }
            if (anyX.action) {
              const timing = anyX.timing ? String(anyX.timing) : "";
              const action = String(anyX.action);
              const rationale = anyX.rationale ? String(anyX.rationale) : "";
              return [timing && `[${timing}]`, action, rationale && `— ${rationale}`]
                .filter(Boolean)
                .join(" ");
            }
            return JSON.stringify(x);
          }
          return String(x);
        })
        .filter((s) => s.trim().length > 0);
    };

    const normalizedEvidence = (Array.isArray(obj.evidence) ? (obj.evidence as any[]) : []).map((e) => {
      if (typeof e === "string") {
        const m = e.match(/^\s*(\[[^\]]+\])\s*(.*)$/);
        return { label: m?.[2] || e, cite: m?.[1] || "" };
      }
      if (e && typeof e === "object") {
        return {
          label: (e as any).label ?? (e as any).text ?? "",
          cite: (e as any).cite ?? "",
          details: (e as any).details,
        };
      }
      return { label: String(e), cite: "" };
    });
    return {
      decision: obj.decision,
      evidence: normalizedEvidence as any,
      actions_0_3h: coerceStringList(obj.actions_0_3h) as any,
      uncertainties: coerceStringList(obj.uncertainties) as any,
    };
  } catch {
    return null;
  }
}

function extractToolName(cite: string): string | null {
  const m = String(cite || "").match(/\[tool:([^\]]+)\]/i);
  return m?.[1]?.trim() || null;
}

function hasWindShiftNote(spread: any): boolean {
  const notes: unknown = spread?.explain?.notes;
  if (!Array.isArray(notes)) return false;
  return notes.some((n) => String(n).toLowerCase().includes("wind shift"));
}

function validateAndHardenStructured(args: {
  structured: AssistantStructured;
  computed: { weather: any; spread: any; recs: any };
  traces: any[];
  active: any;
}): AssistantStructured {
  const { structured, computed, traces, active } = args;
  const ran = new Set((traces || []).map((t) => String(t?.tool || "")));

  const supportedByContext = (tool: string) => {
    if (tool === "get_weather") return !!computed.weather || ran.has("get_weather");
    if (tool === "compute_spread") return !!computed.spread || ran.has("compute_spread");
    if (tool === "get_action_cards") return !!computed.recs || ran.has("get_action_cards");
    if (tool === "kb_search") return ran.has("kb_search");
    if (tool === "get_historical_analogs") return ran.has("get_historical_analogs");
    if (tool === "generate_brief") return ran.has("generate_brief");
    return ran.has(tool);
  };

  const windShiftAllowed =
    !!active?.windShiftEnabled && !!active?.windShift ? true : hasWindShiftNote(computed.spread);

  const hardened: AssistantStructured = {
    decision: structured.decision,
    evidence: [],
    actions_0_3h: structured.actions_0_3h || [],
    uncertainties: [...(structured.uncertainties || [])],
  };

  const sanitizeText = (s: string) => {
    // Try to fix common mojibake sequences seen on some Windows setups / console encodings
    return String(s || "")
      .replaceAll("�??", "->")
      .replaceAll("A�", "deg")
      .replaceAll("A?", "*")
      .replaceAll("�", "");
  };

  for (const e of structured.evidence || []) {
    let cite = String((e as any)?.cite || "");
    const tool = extractToolName(cite);

    if (tool) {
      if (!supportedByContext(tool)) {
        hardened.uncertainties.push(
          `Dropped unsupported evidence (tool not run / context missing): ${e.label} ${cite}`
        );
        continue;
      }
      const label = sanitizeText(String((e as any)?.label || ""));
      const details = sanitizeText(String((e as any)?.details || ""));

      // If the evidence is clearly "weather", prefer citing get_weather when available.
      if (
        tool === "compute_spread" &&
        computed.weather &&
        (/(gust|humidity|temperature|temp)\b/i.test(label) ||
          (/\bwind\b/i.test(label) && !/shift/i.test(label)))
      ) {
        cite = "[tool:get_weather]";
      }

      if (!windShiftAllowed && details.toLowerCase().includes("shift")) {
        hardened.uncertainties.push(
          `Dropped wind-shift claim not supported by context: ${label} ${cite}`
        );
        continue;
      }
      hardened.evidence.push({
        label,
        cite,
        details: details || undefined,
      });
      continue;
    }

    const kbOk = cite.includes("KB:") || /\[KB:[^\]]+\]/i.test(cite);
    if (!kbOk && cite.trim()) {
      hardened.uncertainties.push(`Unrecognized citation format: ${cite}`);
    }
    hardened.evidence.push({
      label: sanitizeText(String((e as any)?.label || "")),
      cite: sanitizeText(cite),
      details: (e as any)?.details ? sanitizeText(String((e as any)?.details)) : undefined,
    });
  }

  hardened.decision = sanitizeText(hardened.decision);
  hardened.actions_0_3h = (hardened.actions_0_3h || []).map((a) => sanitizeText(String(a)));
  hardened.uncertainties = (hardened.uncertainties || []).map((u) => sanitizeText(String(u)));

  if (/\border\b.*\bevacu/i.test(hardened.decision)) {
    hardened.uncertainties.push(
      "Language check: avoid phrasing as an official evacuation order; treat as decision-support triggers."
    );
  }

  return hardened;
}

function systemPrompt() {
  return [
    "You are InitialAttack IC Assist, an incident commander decision support assistant for the first 0-3 hours.",
    "You must ground all operational claims in tool outputs or KB snippets. If you lack data, say so.",
    "Never issue real-world evacuation orders; provide decision support phrased as recommendations and triggers.",
    "Output JSON ONLY with keys: decision, evidence[], actions_0_3h[], uncertainties[].",
    "evidence[] MUST be an array of objects: { label: string, cite: string, details?: string }.",
    "actions_0_3h MUST be an array of strings (no objects).",
    "uncertainties MUST be an array of strings.",
    "Formatting: Use ASCII-only. Write degrees as 'deg' (not °). Write arrows as '->' (not →).",
    "GROUNDING RULES (strict):",
    "- Do NOT invent wind shifts, trigger times, degrees, ETAs, distances, or rates.",
    "- You may only cite a tool (e.g. [tool:compute_spread]) if that tool was actually run OR the computed object is present in ACTIVE_INCIDENT_CONTEXT.computed.",
    "- Any numeric value you mention MUST be copied from ACTIVE_INCIDENT_CONTEXT.computed.{weather|spread|recs} or from tool_result outputs.",
    "- Do not mention a wind shift unless ACTIVE_INCIDENT_CONTEXT.active.windShiftEnabled is true AND active.windShift is provided, OR spread explain notes explicitly mention a wind shift.",
    "Citations:",
    '- For computed facts: cite \"[tool:TOOL_NAME]\".',
    '- For KB doctrine: cite \"[KB:doc#chunk]\" (from kb_search results cite field).',
    '- For analog fires: cite \"[H###]\" or IDs returned by get_historical_analogs.',
  ].join("\n");
}

function toolContextBlock(active: ChatRequestBody["active"], ctx: any) {
  return `ACTIVE_INCIDENT_CONTEXT (do not invent):\n${JSON.stringify(
    {
      active,
      computed: ctx,
    },
    null,
    2
  )}`;
}

function deterministicFallback(args: {
  incident: Incident;
  weather?: Weather | null;
  spread?: SpreadResult | null;
  recs?: RecommendationsResult | null;
  error: string;
}): { content: string; structured: AssistantStructured } {
  const { incident, weather, spread, recs, error } = args;

  const top = recs?.cards?.[0];
  const decision = top?.title
    ? `${top.title} (AI unavailable)`
    : `AI unavailable — use deterministic recommendations for ${incident.name}`;

  const actions = top?.actions?.length ? top.actions : ["Review Action Cards", "Confirm wind and access/egress", "Set trigger points"];

  const evidence = [
    { label: "Weather snapshot", cite: "[tool:get_weather]", details: weather ? `Wind ${weather.windSpeedMps} m/s, RH ${weather.humidityPct}%` : "No weather available" },
    { label: "Spread projection", cite: "[tool:compute_spread]", details: spread ? `${spread.envelopes?.length ?? 0} envelopes computed` : "No spread available" },
    { label: "Deterministic action cards", cite: "[tool:get_action_cards]", details: recs ? `${recs.cards?.length ?? 0} cards` : "No cards available" },
  ];

  const structured: AssistantStructured = {
    decision,
    evidence,
    actions_0_3h: actions,
    uncertainties: [
      `AI call failed: ${error}`,
      "This is decision support only; confirm with local SOPs, dispatch, and evacuation authorities.",
    ],
  };

  return { content: JSON.stringify(structured), structured };
}

export async function POST(req: Request) {
  const started = Date.now();
  const traces: any[] = [];

  try {
    const body = (await req.json()) as ChatRequestBody;
    const active = body.active;
    const messages = body.messages || [];

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "";
    const latOk = typeof active?.lat === "number" && Number.isFinite(active.lat);
    const lonOk = typeof active?.lon === "number" && Number.isFinite(active.lon);
    if (!active || !active.incidentId || !active.name || !latOk || !lonOk) {
      return NextResponse.json({ error: "Missing active incident context" }, { status: 400 });
    }
    if (!lastUser) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }

    const incident = (active.incident as Incident) || buildIncidentStub(active);
    const resources = (active.resources as Resources) || DEFAULT_RESOURCES;
    const assets = (active.assets as Asset[]) || [];

    // ===== Preflight: auto-run pipeline if operational question and missing computed state =====
    let weather = (active.weather as Weather) || null;
    let spread = (active.spread as SpreadResult) || null;
    let recs = (active.cards as RecommendationsResult) || null;

    const windShift =
      active?.windShiftEnabled && active?.windShift ? (active.windShift as any) : null;

    if (isOperationalQuestion(lastUser)) {
      if (!weather) {
        const r = await runTool(req.url, "get_weather", { lat: incident.lat, lon: incident.lon }, { active });
        traces.push(r.trace);
        weather = r.output as Weather;
        active.weather = weather;
      }
      if (!spread && weather) {
        const r = await runTool(
          req.url,
          "compute_spread",
          { incident, weather, horizonHours: 3, windShift },
          { active }
        );
        traces.push(r.trace);
        spread = r.output as SpreadResult;
        active.spread = spread;
      }
      if (!recs && weather && spread) {
        const r = await runTool(
          req.url,
          "get_action_cards",
          {
            incident,
            weather,
            envelopes: spread.envelopes,
            assets,
            resources,
            spreadRateKmH: spread.explain?.rateKmH,
            windShift,
          },
          { active }
        );
        traces.push(r.trace);
        recs = r.output as RecommendationsResult;
        active.cards = recs;
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      const fb = deterministicFallback({
        incident,
        weather,
        spread,
        recs,
        error: "ANTHROPIC_API_KEY not configured",
      });
      const assistant: ChatMessage = {
        id: nowId("asst"),
        role: "assistant",
        createdAt: Date.now(),
        content: fb.content,
        structured: fb.structured,
        trace: traces,
      };
      return NextResponse.json({ assistant, active });
    }

    let finalText: string | null = null;
    try {
      const client = new Anthropic({ apiKey });
      const tools = getClaudeToolDefinitions();

      // Build Anthropic messages from chat history
      const anthropicMessages: any[] = [];
      for (const m of messages) {
        anthropicMessages.push({
          role: m.role,
          content: [{ type: "text", text: m.content }],
        });
      }

      // Inject context as the first user message (keeps everything incident-aware + grounded)
      anthropicMessages.unshift({
        role: "user",
        content: [{ type: "text", text: toolContextBlock(active, { weather, spread, recs }) }],
      });

      // Tool-use loop
      for (let iter = 0; iter < 6; iter++) {
        const resp = await client.messages.create({
          model: process.env.AI_MODEL || "claude-sonnet-4-5",
          max_tokens: 1200,
          temperature: 0.2,
          system: systemPrompt(),
          tools: tools as any,
          messages: anthropicMessages,
        });

        anthropicMessages.push({ role: "assistant", content: resp.content });

        const toolUses = resp.content.filter((c: any) => c.type === "tool_use");
        if (!toolUses.length) {
          const textBlocks = resp.content.filter((c: any) => c.type === "text");
          finalText = textBlocks.map((b: any) => b.text).join("\n").trim();
          break;
        }

        const toolResults: any[] = [];
        for (const tu of toolUses) {
          const name = tu.name as any;
          const input = tu.input;
          try {
            const r = await runTool(req.url, name, input, { active });
            traces.push(r.trace);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(r.output),
            });
          } catch (err: any) {
            traces.push({
              tool: name,
              input,
              output: { error: String(err?.message || err), data: err?.data },
              ms: 0,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify({ error: String(err?.message || err), data: err?.data }),
              is_error: true,
            });
          }
        }

        anthropicMessages.push({
          role: "user",
          content: toolResults,
        });
      }

      if (!finalText) {
        throw new Error("Claude did not return a final answer");
      }
    } catch (err: any) {
      // Graceful degradation when Anthropic errors (credits/timeouts/etc.)
      const fb = deterministicFallback({
        incident,
        weather,
        spread,
        recs,
        error: String(err?.message || err),
      });
      const assistant: ChatMessage = {
        id: nowId("asst"),
        role: "assistant",
        createdAt: Date.now(),
        content: fb.content,
        structured: fb.structured,
        trace: traces,
      };
      return NextResponse.json({ assistant, active, ms: Date.now() - started });
    }

    // Enforce JSON-only response; if Claude wraps fences, strip once.
    let jsonText = finalText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const parsed = safeParseStructured(jsonText);
    const structured = parsed
      ? validateAndHardenStructured({
          structured: parsed,
          computed: { weather, spread, recs },
          traces,
          active,
        })
      : null;
    const assistant: ChatMessage = {
      id: nowId("asst"),
      role: "assistant",
      createdAt: Date.now(),
      content: jsonText,
      structured: structured ?? undefined,
      trace: traces,
    };

    return NextResponse.json({
      assistant,
      active,
      ms: Date.now() - started,
    });
  } catch (err: any) {
    console.error("[API /chat] Error:", err);
    return NextResponse.json({ error: "Chat temporarily unavailable" }, { status: 502 });
  }
}

