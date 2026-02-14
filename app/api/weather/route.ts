import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "@/lib/openmeteo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lon = parseFloat(searchParams.get("lon") || "0");

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Missing lat/lon parameters" },
        { status: 400 }
      );
    }

    const weather = await fetchWeather(lat, lon);
    return NextResponse.json(weather);
  } catch (error) {
    console.error("Error fetching weather:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
