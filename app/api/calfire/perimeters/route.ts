import { NextResponse } from "next/server";
import { getArcGisPerimeters, getPerimetersGeoJSON } from "@/lib/arcgis-perimeters";

export const runtime = "nodejs";

/**
 * GET /api/calfire/perimeters?format=geojson|json&activeOnly=true&minAcres=10
 *
 * Fetches fire perimeters from the ArcGIS FIRIS/WFIGS combo layer
 * (same source that powers the CAL FIRE public map).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const activeOnly = searchParams.get("activeOnly") === "true";
    const minAcresParam = searchParams.get("minAcres");
    const minAcres = minAcresParam ? parseFloat(minAcresParam) : 0;

    if (format === "geojson") {
      const geojson = await getPerimetersGeoJSON({ activeOnly, minAcres });
      return NextResponse.json(geojson);
    }

    // Default: normalized JSON
    const results = await getArcGisPerimeters({ activeOnly, minAcres });

    return NextResponse.json({
      count: results.length,
      perimeters: results.map((r) => ({
        incident: r.incident,
        arcgis: {
          objectId: r.attributes.OBJECTID,
          acres: r.attributes.area_acres,
          displayStatus: r.attributes.displayStatus,
          source: r.attributes.source,
          incidentNumber: r.attributes.incident_number,
          type: r.attributes.type,
          updatedAt: r.attributes.poly_DateCurrent
            ? new Date(r.attributes.poly_DateCurrent).toISOString()
            : r.attributes.EditDate
              ? new Date(r.attributes.EditDate).toISOString()
              : null,
        },
        hasPerimeterGeometry: !!r.geojsonGeometry,
      })),
    });
  } catch (err) {
    console.error("[API /calfire/perimeters] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch ArcGIS perimeters" },
      { status: 502 }
    );
  }
}
