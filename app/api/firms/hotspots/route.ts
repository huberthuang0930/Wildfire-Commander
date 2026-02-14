import { NextResponse } from "next/server";
import { fetchFirmsHotspots, FIRMS_SOURCES, type FirmsSource } from "@/lib/firms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/firms/hotspots?bbox=-124.5,32.5,-114.1,42.1&days=1&sources=VIIRS_SNPP_NRT
 *
 * Returns raw NASA FIRMS satellite hotspot detections.
 * Useful for debugging and raw data access.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bbox = searchParams.get("bbox") || undefined;
    const daysParam = searchParams.get("days");
    const sourcesParam = searchParams.get("sources");

    const days = daysParam ? parseInt(daysParam, 10) : 1;

    let sources: FirmsSource[] | undefined;
    if (sourcesParam) {
      sources = sourcesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is FirmsSource =>
          FIRMS_SOURCES.includes(s as FirmsSource)
        );
    }

    const hotspots = await fetchFirmsHotspots({ bbox, days, sources });

    return NextResponse.json({
      count: hotspots.length,
      bbox: bbox || "-124.5,32.5,-114.1,42.1",
      days,
      sources: sources || ["VIIRS_SNPP_NRT"],
      hotspots,
    });
  } catch (err) {
    console.error("[API /firms/hotspots] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch FIRMS hotspots",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
