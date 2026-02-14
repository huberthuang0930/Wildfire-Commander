"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EnrichedIncident } from "@/lib/types";

interface IncidentListProps {
  incidents: EnrichedIncident[];
  selectedId: string | null;
  onSelect: (incident: EnrichedIncident) => void;
  loading?: boolean;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function IncidentList({
  incidents,
  selectedId,
  onSelect,
  loading,
}: IncidentListProps) {
  if (loading) {
    return (
      <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span className="animate-pulse">Loading satellite fire detections...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (incidents.length === 0) {
    return (
      <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-zinc-400 text-sm">
            No active fire detections found. Satellite data updates every ~3 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span className="text-red-500 animate-pulse">&#9679;</span> Live Fire Detections
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-purple-600 text-purple-400"
          >
            {incidents.length} clusters
          </Badge>
        </div>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          NASA FIRMS satellite hotspots (VIIRS)
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-2 space-y-1 max-h-[50vh] overflow-y-auto scrollbar-thin">
        {incidents.map((enriched) => {
          const { incident, calfire, nws, perimeter, firms, source } = enriched;
          const isSelected = selectedId === incident.id;
          const acres = calfire?.acres ?? perimeter?.acres ?? null;
          const county = calfire?.county ?? null;
          const updatedAt = calfire?.updatedAt ?? firms?.lastSeen ?? null;

          return (
            <button
              key={incident.id}
              onClick={() => onSelect(enriched)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                isSelected
                  ? "bg-orange-900/50 border border-orange-600/50"
                  : "hover:bg-zinc-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">
                      {incident.name}
                    </span>
                    {source === "firms" && (
                      <Badge className="bg-purple-700 text-[9px] px-1 py-0 shrink-0">
                        SAT
                      </Badge>
                    )}
                    {perimeter?.geometry && (
                      <Badge className="bg-green-800 text-[9px] px-1 py-0 shrink-0">
                        PERIM
                      </Badge>
                    )}
                    {perimeter?.displayStatus === "Active" && (
                      <Badge className="bg-red-700 text-[9px] px-1 py-0 shrink-0">
                        ACTIVE
                      </Badge>
                    )}
                    {nws?.hasRedFlagWarning && (
                      <Badge className="bg-red-700 text-[9px] px-1 py-0 shrink-0">
                        RED FLAG
                      </Badge>
                    )}
                    {nws?.hasWindAdvisory && (
                      <Badge className="bg-amber-700 text-[9px] px-1 py-0 shrink-0">
                        WIND
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {firms && (
                      <>
                        <span className="text-[10px] text-purple-300">
                          {firms.pointCount} det.
                        </span>
                        <span className="text-[10px] text-orange-400">
                          {firms.maxFrp.toFixed(0)} MW
                        </span>
                      </>
                    )}
                    {!firms && acres != null && (
                      <span className="text-[10px] text-zinc-400">
                        {acres.toLocaleString()} ac
                      </span>
                    )}
                    {calfire?.containmentPct != null && (
                      <span className="text-[10px] text-zinc-400">
                        {calfire.containmentPct}% cont.
                      </span>
                    )}
                    {county && (
                      <span className="text-[10px] text-zinc-500">
                        {county}
                      </span>
                    )}
                  </div>
                </div>
                {updatedAt && (
                  <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5">
                    {formatTimeAgo(updatedAt)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
