import { NextResponse } from "next/server";
import { fetchFirmsHotspots, type FirmsSource } from "@/lib/firms";
import { clusterHotspots, clusterToEnrichedIncident } from "@/lib/cluster";
import { getNwsEnrichment } from "@/lib/nws";
import type { FirmsHotspot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/fires/live?days=1&sources=VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT&limit=20&nwsEnrich=5&bbox=...
 *
 * Returns clustered FIRMS hotspots as EnrichedIncident[] — the same shape
 * used by the existing live mode, so the UI plugs in directly.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bbox = searchParams.get("bbox") || undefined;
    const daysParam = searchParams.get("days");
    const sourcesParam = searchParams.get("sources");
    const limitParam = searchParams.get("limit");
    const nwsEnrichParam = searchParams.get("nwsEnrich");

    const days = daysParam ? parseInt(daysParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const nwsEnrichCount = nwsEnrichParam ? parseInt(nwsEnrichParam, 10) : 3;

    let sources: FirmsSource[] | undefined;
    if (sourcesParam) {
      sources = sourcesParam
        .split(",")
        .map((s) => s.trim()) as FirmsSource[];
    }

    // 1. Fetch FIRMS hotspots
    const hotspots = await fetchFirmsHotspots({ bbox, days, sources });

    // 2. Cluster into fire events
    const clusters = clusterHotspots(hotspots);
    const topClusters = clusters.slice(0, limit);

    // 3. Convert to EnrichedIncident[]
    const enriched = topClusters.map((cluster, idx) =>
      clusterToEnrichedIncident(cluster, idx)
    );

    // 4. Enrich top N with NWS data (parallel, error-tolerant)
    const nwsTargets = enriched.slice(0, nwsEnrichCount);
    await Promise.all(
      nwsTargets.map(async (item) => {
        try {
          item.nws = await getNwsEnrichment(
            item.incident.lat,
            item.incident.lon
          );
        } catch (err) {
          console.error(
            `[Live] NWS enrichment failed for ${item.incident.name}:`,
            err
          );
        }
      })
    );

    // 5. Also return raw hotspot coordinates for map heat layer
    const hotspotPoints: { lat: number; lon: number; frp: number }[] =
      hotspots.map((hs: FirmsHotspot) => ({
        lat: hs.latitude,
        lon: hs.longitude,
        frp: hs.frp,
      }));

    return NextResponse.json({
      count: enriched.length,
      totalHotspots: hotspots.length,
      totalClusters: clusters.length,
      incidents: enriched,
      hotspotPoints,
    });
  } catch (err) {
    console.error("[API /fires/live] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch live fires",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
