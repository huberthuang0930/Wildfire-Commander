import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/recommendations";
import {
  Incident,
  Weather,
  SpreadEnvelope,
  Asset,
  Resources,
  WindShift,
} from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      incident,
      weather,
      envelopes,
      assets,
      resources,
      spreadRateKmH,
      windShift,
    }: {
      incident: Incident;
      weather: Weather;
      envelopes: SpreadEnvelope[];
      assets: Asset[];
      resources: Resources;
      spreadRateKmH: number;
      windShift?: WindShift;
    } = body;

    if (!incident || !weather || !envelopes || !assets || !resources) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = generateRecommendations(
      incident,
      weather,
      envelopes,
      assets,
      resources,
      spreadRateKmH || 1.0,
      windShift
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
