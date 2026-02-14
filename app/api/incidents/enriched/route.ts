import { NextResponse } from "next/server";
import { getCalFireIncidents } from "@/lib/calfire";
import { getArcGisPerimeters } from "@/lib/arcgis-perimeters";
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
 * GET /api/incidents/enriched?limit=15&nwsEnrich=5
 *
 * Merges two data sources:
 *   1. ArcGIS FIRIS/WFIGS perimeters (polygons, powers the CAL FIRE public map)
 *   2. CAL FIRE Incident API (point data, richer metadata)
 *
 * Deduplicates by incident name similarity, then enriches top N with NWS data.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const nwsEnrichParam = searchParams.get("nwsEnrich");

    const limit = limitParam ? parseInt(limitParam, 10) : 15;
    const nwsEnrichCount = nwsEnrichParam ? parseInt(nwsEnrichParam, 10) : 5;

    // 1. Fetch both sources in parallel
    const [arcgisResults, calFireResults] = await Promise.all([
      getArcGisPerimeters().catch((err) => {
        console.error("[Enriched] ArcGIS fetch failed:", err);
        return [];
      }),
      getCalFireIncidents().catch((err) => {
        console.error("[Enriched] CAL FIRE fetch failed:", err);
        return [];
      }),
    ]);

    console.log(
      `[Enriched] ArcGIS: ${arcgisResults.length} perimeters, CAL FIRE: ${calFireResults.length} incidents`
    );

    // 2. Build enriched incidents from ArcGIS perimeters (these have geometry)
    const enrichedMap = new Map<string, EnrichedIncident>();

    for (const arcgis of arcgisResults) {
      const key = arcgis.incident.name.toLowerCase().trim();
      enrichedMap.set(key, {
        incident: arcgis.incident,
        source: "arcgis",
        calfire: null,
        perimeter: {
          geometry: arcgis.geojsonGeometry as EnrichedIncident["perimeter"] extends null ? never : NonNullable<EnrichedIncident["perimeter"]>["geometry"],
          acres: arcgis.attributes.area_acres,
          displayStatus: arcgis.attributes.displayStatus,
          source: arcgis.attributes.source,
          incidentNumber: arcgis.attributes.incident_number,
        },
        firms: null,
        nws: null,
        resources: DEFAULT_LIVE_RESOURCES,
        assets: [] as Asset[],
      });
    }

    // 3. Add CAL FIRE incidents, merging with ArcGIS where names match
    for (const { incident, raw } of calFireResults) {
      const key = incident.name.toLowerCase().trim();

      if (enrichedMap.has(key)) {
        // Merge: enrich existing ArcGIS entry with CAL FIRE metadata
        const existing = enrichedMap.get(key)!;
        existing.source = "merged";
        existing.calfire = {
          acres: raw.AcresBurned,
          containmentPct: raw.PercentContained,
          county: raw.County,
          isActive: raw.IsActive,
          url: raw.Url,
          updatedAt: raw.Updated,
        };
        // Keep ArcGIS perimeter geometry but use CAL FIRE's richer metadata
        if (raw.AcresBurned && raw.AcresBurned > 0) {
          existing.incident.notes = incident.notes;
        }
      } else {
        // New incident from CAL FIRE only
        enrichedMap.set(key, {
          incident,
          source: "calfire",
          calfire: {
            acres: raw.AcresBurned,
            containmentPct: raw.PercentContained,
            county: raw.County,
            isActive: raw.IsActive,
            url: raw.Url,
            updatedAt: raw.Updated,
          },
          perimeter: null,
          firms: null,
          nws: null,
          resources: DEFAULT_LIVE_RESOURCES,
          assets: [] as Asset[],
        });
      }
    }

    // 4. Sort: active perimeters first, then by most recent update
    const allEnriched = Array.from(enrichedMap.values()).sort((a, b) => {
      // Prioritize entries with perimeter geometry
      const aHasPerimeter = a.perimeter?.geometry ? 1 : 0;
      const bHasPerimeter = b.perimeter?.geometry ? 1 : 0;
      if (bHasPerimeter !== aHasPerimeter) return bHasPerimeter - aHasPerimeter;

      // Prioritize active perimeters
      const aActive = a.perimeter?.displayStatus === "Active" ? 1 : 0;
      const bActive = b.perimeter?.displayStatus === "Active" ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;

      // Prioritize CAL FIRE active
      const aCalActive = a.calfire?.isActive ? 1 : 0;
      const bCalActive = b.calfire?.isActive ? 1 : 0;
      if (bCalActive !== aCalActive) return bCalActive - aCalActive;

      // Sort by most recent update
      const aDate = a.calfire?.updatedAt
        ? new Date(a.calfire.updatedAt).getTime()
        : 0;
      const bDate = b.calfire?.updatedAt
        ? new Date(b.calfire.updatedAt).getTime()
        : 0;
      return bDate - aDate;
    });

    const topIncidents = allEnriched.slice(0, limit);

    // 5. Enrich top N with NWS data (in parallel, with error tolerance)
    const nwsTargets = topIncidents.slice(0, nwsEnrichCount);
    await Promise.all(
      nwsTargets.map(async (enriched) => {
        try {
          enriched.nws = await getNwsEnrichment(
            enriched.incident.lat,
            enriched.incident.lon
          );
        } catch (err) {
          console.error(
            `[Enriched] NWS enrichment failed for ${enriched.incident.name}:`,
            err
          );
        }
      })
    );

    return NextResponse.json({
      count: topIncidents.length,
      totalArcGis: arcgisResults.length,
      totalCalFire: calFireResults.length,
      incidents: topIncidents,
    });
  } catch (err) {
    console.error("[API /incidents/enriched] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch enriched incidents" },
      { status: 502 }
    );
  }
}
