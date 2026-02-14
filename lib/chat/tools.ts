import type { ToolTraceItem, ActiveIncidentContext } from "./types";
import type { Incident, Weather } from "@/lib/types";
import { findSimilarIncidents } from "@/lib/historical-data";

export type ToolName =
  | "get_weather"
  | "compute_spread"
  | "get_action_cards"
  | "generate_brief"
  | "get_historical_analogs"
  | "kb_search";

export type ToolCallResult = { output: unknown; trace: ToolTraceItem };

function originFromRequestUrl(requestUrl: string): string {
  const u = new URL(requestUrl);
  return u.origin;
}

async function fetchJson(origin: string, pathname: string, init?: RequestInit) {
  const url = new URL(pathname, origin).toString();
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(`Tool fetch failed: ${res.status} ${pathname}`);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }
  return data;
}

export function getClaudeToolDefinitions() {
  // Anthropic tool schema format: { name, description, input_schema }
  return [
    {
      name: "get_weather",
      description: "Fetch current weather for coordinates (Open-Meteo via /api/weather).",
      input_schema: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lon: { type: "number" },
        },
        required: ["lat", "lon"],
      },
    },
    {
      name: "compute_spread",
      description: "Compute 1/2/3-hour spread envelopes (calls /api/spread).",
      input_schema: {
        type: "object",
        properties: {
          incident: { type: "object" },
          weather: { type: "object" },
          horizonHours: { type: "number" },
          windShift: { type: ["object", "null"] },
        },
        required: ["incident", "weather"],
      },
    },
    {
      name: "get_action_cards",
      description: "Generate ranked initial attack action cards (calls /api/recommendations).",
      input_schema: {
        type: "object",
        properties: {
          incident: { type: "object" },
          weather: { type: "object" },
          envelopes: { type: "array" },
          assets: { type: "array" },
          resources: { type: "object" },
          spreadRateKmH: { type: "number" },
          windShift: { type: ["object", "null"] },
        },
        required: ["incident", "weather", "envelopes", "assets", "resources"],
      },
    },
    {
      name: "generate_brief",
      description: "Generate a printable incident brief (calls /api/brief).",
      input_schema: {
        type: "object",
        properties: {
          incidentName: { type: "string" },
          oneLiner: { type: "string" },
          keyTriggers: { type: "array", items: { type: "string" } },
          cards: { type: "array" },
          riskScore: { type: "object" },
          spreadExplain: { type: "object" },
        },
        required: ["incidentName", "oneLiner", "keyTriggers", "cards", "riskScore", "spreadExplain"],
      },
    },
    {
      name: "get_historical_analogs",
      description: "Find similar historical incidents given incident + current weather.",
      input_schema: {
        type: "object",
        properties: {
          incident: { type: "object" },
          weather: { type: "object" },
        },
        required: ["incident", "weather"],
      },
    },
    {
      name: "kb_search",
      description: "Search doctrine/checklists knowledge base and return top snippets with citations.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          k: { type: "number" },
        },
        required: ["query"],
      },
    },
  ] as const;
}

export async function runTool(
  requestUrl: string,
  name: ToolName,
  input: any,
  ctx: { active: ActiveIncidentContext }
): Promise<ToolCallResult> {
  const started = Date.now();
  const origin = originFromRequestUrl(requestUrl);

  let output: unknown;
  switch (name) {
    case "get_weather": {
      output = await fetchJson(origin, `/api/weather?lat=${input.lat}&lon=${input.lon}`);
      break;
    }
    case "compute_spread": {
      output = await fetchJson(origin, "/api/spread", {
        method: "POST",
        body: JSON.stringify({
          incident: input.incident,
          weather: input.weather,
          horizonHours: input.horizonHours ?? 3,
          windShift: input.windShift ?? undefined,
        }),
      });
      break;
    }
    case "get_action_cards": {
      output = await fetchJson(origin, "/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          incident: input.incident,
          weather: input.weather,
          envelopes: input.envelopes,
          assets: input.assets,
          resources: input.resources,
          spreadRateKmH: input.spreadRateKmH,
          windShift: input.windShift ?? undefined,
        }),
      });
      break;
    }
    case "generate_brief": {
      output = await fetchJson(origin, "/api/brief", {
        method: "POST",
        body: JSON.stringify(input),
      });
      break;
    }
    case "get_historical_analogs": {
      const incident = input.incident as Incident;
      const weather = input.weather as Weather;
      output = {
        analogs: findSimilarIncidents(incident, weather),
      };
      break;
    }
    case "kb_search": {
      output = await fetchJson(origin, "/api/kb/search", {
        method: "POST",
        body: JSON.stringify({ query: input.query, k: input.k ?? 5 }),
      });
      break;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  const trace: ToolTraceItem = {
    tool: name,
    input,
    output,
    ms: Date.now() - started,
  };

  return { output, trace };
}

export function isOperationalQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return [
    "evac",
    "evacuation",
    "trigger",
    "brief",
    "0-3",
    "0–3",
    "spread",
    "wind",
    "resources",
    "tactics",
    "risk",
    "what should we do",
    "next steps",
  ].some((k) => t.includes(k));
}

