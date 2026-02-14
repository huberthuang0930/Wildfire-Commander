import { NextRequest, NextResponse } from "next/server";
import { computeSpreadEnvelopes } from "@/lib/spread";
import { Incident, Weather, WindShift } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      incident,
      weather,
      horizonHours = 3,
      windShift,
    }: {
      incident: Incident;
      weather: Weather;
      horizonHours?: number;
      windShift?: WindShift;
    } = body;

    if (!incident || !weather) {
      return NextResponse.json(
        { error: "Missing incident or weather data" },
        { status: 400 }
      );
    }

    const result = computeSpreadEnvelopes(
      incident,
      weather,
      horizonHours,
      windShift
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error computing spread:", error);
    return NextResponse.json(
      { error: "Failed to compute spread" },
      { status: 500 }
    );
  }
}
