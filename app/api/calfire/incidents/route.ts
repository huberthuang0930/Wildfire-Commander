import { NextResponse } from "next/server";
import { getCalFireIncidents } from "@/lib/calfire";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const inactiveParam = searchParams.get("inactive");

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const inactive = inactiveParam !== "false"; // default true to show all recent incidents

    const results = await getCalFireIncidents({ year, inactive });

    return NextResponse.json({
      count: results.length,
      incidents: results.map((r) => ({
        ...r.incident,
        _calfire: {
          acres: r.raw.AcresBurned,
          containmentPct: r.raw.PercentContained,
          county: r.raw.County,
          isActive: r.raw.IsActive,
          url: r.raw.Url,
          updatedAt: r.raw.Updated,
        },
      })),
    });
  } catch (err) {
    console.error("[API /calfire/incidents] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch CAL FIRE incidents" },
      { status: 502 }
    );
  }
}
