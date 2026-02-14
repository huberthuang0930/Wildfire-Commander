import { NextResponse } from "next/server";
import { fetchCalFireGeoJSON } from "@/lib/calfire";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const inactiveParam = searchParams.get("inactive");

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const inactive = inactiveParam !== "false"; // default true to show all recent incidents

    const geojson = await fetchCalFireGeoJSON({ year, inactive });

    return NextResponse.json(geojson);
  } catch (err) {
    console.error("[API /calfire/geojson] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch CAL FIRE GeoJSON" },
      { status: 502 }
    );
  }
}
