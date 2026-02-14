import Anthropic from "@anthropic-ai/sdk";
import type {
  Incident,
  Weather,
  RiskScore,
  ActionCard,
} from "./types";
import {
  predictSpreadPattern,
  calculateSpreadStatistics,
  type DirectionalSpread,
} from "./directional-spread";

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
  directionalSpread?: {
    similarFires: DirectionalSpread[];
    prediction: {
      likelyDirection: string;
      expectedRates: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
      confidence: "high" | "medium" | "low";
      reasoning: string[];
    };
  };
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
  const { incident, weather, riskScore, spreadRate, historicalContext, directionalSpread } = request;

  const evacuationCard = request.cards.find(c => c.type === "evacuation");
  const assetsAtRisk = evacuationCard?.why
    .filter(w => w.includes("envelope"))
    .join("; ") || "No immediate asset threats";

  const historicalSummary = historicalContext.length > 0
    ? historicalContext.map(h =>
        `- ${h.name} (${h.date}): ${h.fuel} fire, wind ${h.weather.windSpeedMps} m/s, humidity ${h.weather.humidityPct}%, ${h.outcome} in ${h.containmentTimeHours}h, ${h.finalAcres} acres. Lesson: ${h.keyLesson}`
      ).join("\n")
    : "No similar historical incidents found";

  // Add directional spread analysis
  let directionalSpreadSummary = "No directional spread data available";
  if (directionalSpread && directionalSpread.similarFires.length > 0) {
    const { prediction, similarFires } = directionalSpread;
    const stats = calculateSpreadStatistics(similarFires);

    directionalSpreadSummary = `
DIRECTIONAL SPREAD ANALYSIS (${similarFires.length} similar fires within 100km):
- Dominant historical direction: ${stats.dominantDirection}
- Predicted likely direction: ${prediction.likelyDirection} (confidence: ${prediction.confidence})
- Expected expansion rates: N ${prediction.expectedRates.north.toFixed(2)} km/h, S ${prediction.expectedRates.south.toFixed(2)} km/h, E ${prediction.expectedRates.east.toFixed(2)} km/h, W ${prediction.expectedRates.west.toFixed(2)} km/h
- Average shape elongation: ${stats.avgElongation.toFixed(1)}x (1.0 = circular, >1.0 = elongated)
- Pattern reasoning: ${prediction.reasoning.join("; ")}
- Sample fires: ${similarFires.slice(0, 3).map(f => `${f.fireName} (${f.year}, ${f.acres.toFixed(0)} acres, ${f.shape.dominantDirection} spread)`).join(", ")}`;
  }

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

${directionalSpreadSummary}

TASK: Generate 2-3 tactical briefing points in incident commander style:
1. Time-critical threats with directional specificity - use directional spread data
2. Historical patterns - reference similar fire behavior from directional spread analysis
3. Resource recommendations - backed by historical outcomes

REQUIREMENTS:
- Each insight message: 8-12 words maximum. Use IC brevity. Example: "NORTHEAST expansion 3.2 km/h. Highway 101 threatened in 90 min."
- Confidence levels:
  * High: 5+ similar historical incidents with consistent patterns (>80% agreement)
  * Medium: 3-4 similar incidents or 50-80% pattern agreement
  * Low: 1-2 similar incidents or <50% pattern agreement
- Provide 1-2 concise reasoning points (one sentence each, no fluff)
- Reference specific incident IDs in sources array when applicable
- Use tactical IC language: directional calls (NORTH, SOUTHEAST), time windows, asset names, action verbs
- NO explanatory phrases. NO "based on" or "considering". State facts only.
- Focus on what matters NOW in the 0-3 hour window

FORMAT: Return valid JSON only (no markdown, no explanations):
{
  "insights": [
    {
      "type": "warning" | "recommendation" | "context",
      "message": "8-12 word tactical brief in IC style",
      "confidence": "high" | "medium" | "low",
      "reasoning": ["Concise fact 1", "Concise fact 2 (optional)"],
      "sources": ["incident_id_1", "incident_id_2"]
    }
  ]
}

EXAMPLE OUTPUT:
{
  "insights": [
    {
      "type": "warning",
      "message": "NORTHEAST spread 4.1 km/h. Town boundary threatened 75 minutes.",
      "confidence": "high",
      "reasoning": ["6 similar fires averaged 3.8 km/h NE expansion", "Current wind aligns with historical pattern"],
      "sources": ["fire_2018_001", "fire_2019_045"]
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

    // Selectively retrieve directional spread data if not provided
    if (!request.directionalSpread) {
      try {
        const spreadPattern = predictSpreadPattern(
          request.incident,
          request.weather.windDirDeg
        );
        request.directionalSpread = spreadPattern;
      } catch (error) {
        console.warn("Could not retrieve directional spread data:", error);
        // Continue without directional spread data
      }
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
