import Anthropic from "@anthropic-ai/sdk";
import type {
  Incident,
  Weather,
  RiskScore,
  ActionCard,
} from "./types";

// AI Insight types (will be added to types.ts)
export interface HistoricalIncident {
  id: string;
  name: string;
  date: string;
  location: string;
  fuel: "grass" | "brush" | "mixed" | "chaparral";
  weather: {
    windSpeedMps: number;
    humidityPct: number;
    temperatureC: number;
  };
  outcome: "contained" | "escaped" | "partial";
  containmentTimeHours: number;
  finalAcres: number;
  resources: {
    engines: number;
    dozers: number;
    airSupport: boolean;
  };
  keyLesson: string;
}

export interface AIInsight {
  type: "warning" | "recommendation" | "context";
  message: string;
  confidence: "high" | "medium" | "low";
  reasoning: string[];
  sources?: string[];
}

export interface AIInsightRequest {
  incident: Incident;
  weather: Weather;
  riskScore: RiskScore;
  spreadRate: number;
  cards: ActionCard[];
  historicalContext: HistoricalIncident[];
}

// Simple in-memory cache with 5-minute TTL
interface CacheEntry {
  insights: AIInsight[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Rate limiting
let requestCount = 0;
let rateLimitWindow = Date.now();
const MAX_REQUESTS_PER_MINUTE = 10;

function getCacheKey(request: AIInsightRequest): string {
  return `${request.incident.id}-${request.riskScore.total}-${request.weather.windSpeedMps}-${request.weather.humidityPct}`;
}

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimitWindow > 60000) {
    requestCount = 0;
    rateLimitWindow = now;
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn("AI service rate limit exceeded");
    return false;
  }

  requestCount++;
  return true;
}

function buildPrompt(request: AIInsightRequest): string {
  const { incident, weather, riskScore, spreadRate, historicalContext } = request;

  const evacuationCard = request.cards.find(c => c.type === "evacuation");
  const assetsAtRisk = evacuationCard?.why
    .filter(w => w.includes("envelope"))
    .join("; ") || "No immediate asset threats";

  const historicalSummary = historicalContext.length > 0
    ? historicalContext.map(h =>
        `- ${h.name} (${h.date}): ${h.fuel} fire, wind ${h.weather.windSpeedMps} m/s, humidity ${h.weather.humidityPct}%, ${h.outcome} in ${h.containmentTimeHours}h, ${h.finalAcres} acres. Lesson: ${h.keyLesson}`
      ).join("\n")
    : "No similar historical incidents found";

  return `You are a wildfire behavior analyst assisting an incident commander during initial attack (0-3 hours). Your role is to translate technical data into actionable, time-sensitive insights.

CURRENT SITUATION:
- Incident: ${incident.name}
- Location: ${incident.lat.toFixed(2)}, ${incident.lon.toFixed(2)}
- Fuel Type: ${incident.fuelProxy}
- Weather: Wind ${weather.windSpeedMps} m/s from ${weather.windDirDeg}°, Humidity ${weather.humidityPct}%, Temp ${weather.temperatureC}°C
- Risk Score: ${riskScore.total}/100 (Wind severity: ${riskScore.breakdown.windSeverity}, Humidity severity: ${riskScore.breakdown.humiditySeverity}, Time-to-impact: ${riskScore.breakdown.timeToImpactSeverity})
- Spread Rate: ${spreadRate.toFixed(1)} km/h
- Assets at Risk: ${assetsAtRisk}

HISTORICAL CONTEXT (${historicalContext.length} similar incidents):
${historicalSummary}

TASK: Generate 2-3 natural language insights for the incident commander:
1. Time-critical threats ("In X hours/minutes, Y will happen" - use specific timing)
2. Historical patterns ("In similar conditions, Z% of fires..." - use statistics from historical data)
3. Resource recommendations with context ("Air support reduces escape by X%" - backed by historical outcomes)

REQUIREMENTS:
- Each insight message: 15-25 words, direct, actionable
- Confidence levels:
  * High: 5+ similar historical incidents with consistent patterns (>80% agreement)
  * Medium: 3-4 similar incidents or 50-80% pattern agreement
  * Low: 1-2 similar incidents or <50% pattern agreement
- Provide 2-4 reasoning bullets per insight explaining WHY
- Reference specific incident IDs in sources array when applicable
- Use firefighter-friendly language (no jargon)
- Focus on what matters NOW in the 0-3 hour window

FORMAT: Return valid JSON only (no markdown, no explanations):
{
  "insights": [
    {
      "type": "warning" | "recommendation" | "context",
      "message": "15-25 word actionable insight",
      "confidence": "high" | "medium" | "low",
      "reasoning": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "sources": ["incident_id_1", "incident_id_2"]
    }
  ]
}`;
}

/**
 * Generate AI insights using Anthropic Claude API
 */
export async function generateAIInsights(
  request: AIInsightRequest
): Promise<AIInsight[]> {
  // Check feature flag
  if (process.env.AI_INSIGHTS_ENABLED !== "true") {
    return [];
  }

  // Check cache
  const cacheKey = getCacheKey(request);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.insights;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    return cached?.insights || [];
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      console.warn("Anthropic API key not configured");
      return [];
    }

    const client = new Anthropic({
      apiKey: apiKey,
    });

    const prompt = buildPrompt(request);
    const modelName = process.env.AI_MODEL || "claude-sonnet-4-5";

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI service timeout")), REQUEST_TIMEOUT_MS);
    });

    // Race between API call and timeout
    const response = await Promise.race([
      client.messages.create({
        model: modelName,
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
      timeoutPromise
    ]);

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Strip markdown code fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      // Remove opening fence (```json or ```)
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "");
      // Remove closing fence
      jsonText = jsonText.replace(/\n?```$/, "");
      jsonText = jsonText.trim();
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      throw new Error("Invalid response format");
    }

    const insights: AIInsight[] = parsed.insights;

    // Filter out low-confidence insights (<40%)
    const filteredInsights = insights.filter(insight => {
      const confScore = insight.confidence === "high" ? 100 : insight.confidence === "medium" ? 70 : 40;
      return confScore >= 40;
    });

    // Limit to 3 insights max
    const limitedInsights = filteredInsights.slice(0, 3);

    // Cache the result
    cache.set(cacheKey, {
      insights: limitedInsights,
      timestamp: Date.now()
    });

    return limitedInsights;

  } catch (error) {
    console.error("AI insights generation error:", error);

    // Return stale cache if available
    if (cached) {
      return cached.insights;
    }

    // Graceful degradation: return empty array
    return [];
  }
}

/**
 * Clear expired cache entries (call periodically)
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}
