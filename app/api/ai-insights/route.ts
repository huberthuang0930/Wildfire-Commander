import { NextRequest, NextResponse } from "next/server";
import { generateAIInsights } from "@/lib/ai-service";
import { findSimilarIncidents } from "@/lib/historical-data";
import type { Incident, Weather, RiskScore, ActionCard } from "@/lib/types";

interface AIInsightsRequestBody {
  incident: Incident;
  weather: Weather;
  riskScore: RiskScore;
  spreadRate: number;
  cards: ActionCard[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body: AIInsightsRequestBody = await request.json();
    const { incident, weather, riskScore, spreadRate, cards } = body;

    // Validate required fields
    if (!incident || !weather || !riskScore || !spreadRate || !cards) {
      return NextResponse.json(
        { error: "Missing required fields", insights: [] },
        { status: 400 }
      );
    }

    // 2. Check feature flag
    if (process.env.AI_INSIGHTS_ENABLED !== "true") {
      console.log("AI insights disabled via feature flag");
      return NextResponse.json({ insights: [] });
    }

    // 3. Find similar historical incidents
    const historical = findSimilarIncidents(incident, weather);
    console.log(`Found ${historical.length} similar incidents for ${incident.name}`);

    // 4. Call AI service to generate insights
    const insights = await generateAIInsights({
      incident,
      weather,
      riskScore,
      spreadRate,
      cards,
      historicalContext: historical,
    });

    console.log(`Generated ${insights.length} AI insights`);

    // 5. Return insights
    return NextResponse.json({
      insights,
      historicalMatches: historical.length,
    });
  } catch (error) {
    console.error("AI insights API error:", error);

    // Graceful degradation: return empty insights on error
    return NextResponse.json({
      insights: [],
      error: "AI insights temporarily unavailable",
    });
  }
}

// Optional: GET endpoint to check AI status
export async function GET() {
  const enabled = process.env.AI_INSIGHTS_ENABLED === "true";
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== "your_anthropic_api_key_here";

  return NextResponse.json({
    enabled,
    configured: hasApiKey,
    model: process.env.AI_MODEL || "claude-sonnet-4-5",
  });
}
