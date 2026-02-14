import { NextResponse } from "next/server";
import { getCalFireIncidents } from "@/lib/calfire";
import { getNwsEnrichment } from "@/lib/nws";
import type { EnrichedIncident, Resources, Asset } from "@/lib/types";

export const runtime = "nodejs";

/** Default resources estimate for live incidents */
const DEFAULT_LIVE_RESOURCES: Resources = {
  enginesAvailable: 2,
  dozersAvailable: 0,
  airSupportAvailable: false,
  etaMinutesEngine: 25,
  etaMinutesAir: 60,
};

/**
 * GET /api/incidents/enriched?limit=10&inactive=false
 *
 * Returns CAL FIRE incidents enriched with NWS forecast + alerts.
 * Enriches the top N incidents (by most recently updated) to avoid
 * hammering the NWS API.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const inactiveParam = searchParams.get("inactive");

    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const inactive = inactiveParam !== "false"; // default true to include all recent incidents

    // 1. Fetch CAL FIRE incidents (already sorted by update time)
    const calFireResults = await getCalFireIncidents({ inactive });
    const topIncidents = calFireResults.slice(0, limit);

    // 2. Enrich top N with NWS data (in parallel, with error tolerance)
    const enrichedPromises = topIncidents.map(
      async ({ incident, raw }): Promise<EnrichedIncident> => {
        let nws = null;
        try {
          nws = await getNwsEnrichment(incident.lat, incident.lon);
        } catch (err) {
          console.error(
            `[Enriched] NWS enrichment failed for ${incident.name}:`,
            err
          );
        }

        return {
          incident,
          calfire: {
            acres: raw.AcresBurned,
            containmentPct: raw.PercentContained,
            county: raw.County,
            isActive: raw.IsActive,
            url: raw.Url,
            updatedAt: raw.Updated,
          },
          nws,
          resources: DEFAULT_LIVE_RESOURCES,
          assets: [] as Asset[],
        };
      }
    );

    const enriched = await Promise.all(enrichedPromises);

    return NextResponse.json({
      count: enriched.length,
      totalCalFire: calFireResults.length,
      incidents: enriched,
    });
  } catch (err) {
    console.error("[API /incidents/enriched] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch enriched incidents" },
      { status: 502 }
    );
  }
}
