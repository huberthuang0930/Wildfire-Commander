import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "@/lib/openmeteo";
import type { Weather } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latRaw = searchParams.get("lat");
    const lonRaw = searchParams.get("lon");

    const lat = latRaw != null ? Number(latRaw) : NaN;
    const lon = lonRaw != null ? Number(lonRaw) : NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { error: "Missing or invalid lat/lon query params" },
        { status: 400 }
      );
    }

    const weather: Weather = await fetchWeather(lat, lon);
    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/weather failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}

