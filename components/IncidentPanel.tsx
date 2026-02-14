"use client";

import { Incident, Weather, NwsEnrichment } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IncidentPanelProps {
  incident: Incident | null;
  weather: Weather | null;
  /** CAL FIRE metadata (only in live mode) */
  calfire?: {
    acres: number | null;
    containmentPct: number | null;
    county: string;
    isActive: boolean;
    url: string;
  } | null;
  /** NWS enrichment (only in live mode) */
  nws?: NwsEnrichment | null;
  /** ArcGIS perimeter info (only in live mode) */
  perimeter?: {
    geometry: { type: "Polygon"; coordinates: number[][][] } | null;
    acres: number | null;
    displayStatus: string;
    source: string;
    incidentNumber: string | null;
  } | null;
  /** NASA FIRMS cluster info (only in live mode) */
  firms?: {
    pointCount: number;
    maxFrp: number;
    totalFrp: number;
    lastSeen: string;
    satellites: string[];
  } | null;
}

function WindArrow({ degrees }: { degrees: number }) {
  // Arrow points in the direction wind blows TO (opposite of meteorological convention)
  const rotation = (degrees + 180) % 360;
  return (
    <span
      className="inline-block text-lg"
      style={{ transform: `rotate(${rotation}deg)` }}
      title={`Wind from ${degrees}°`}
    >
      ↑
    </span>
  );
}

export default function IncidentPanel({
  incident,
  weather,
  calfire,
  nws,
  perimeter,
  firms,
}: IncidentPanelProps) {
  if (!incident) {
    return (
      <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-zinc-400 text-sm">Select a scenario or live incident to begin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-xl">🔥</span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-bold truncate">
              {incident.name}
            </CardTitle>
          </div>
        </div>
        {/* NWS Alert badges */}
        {nws && (nws.hasRedFlagWarning || nws.hasWindAdvisory || nws.alerts.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {nws.hasRedFlagWarning && (
              <Badge className="bg-red-700 text-[10px] px-1.5 py-0">
                RED FLAG WARNING
              </Badge>
            )}
            {nws.hasWindAdvisory && (
              <Badge className="bg-amber-700 text-[10px] px-1.5 py-0">
                WIND ADVISORY
              </Badge>
            )}
            {nws.alerts
              .filter(
                (a) =>
                  !a.event.toLowerCase().includes("red flag") &&
                  !a.event.toLowerCase().includes("wind")
              )
              .slice(0, 2)
              .map((alert) => (
                <Badge
                  key={alert.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-amber-600 text-amber-400"
                >
                  {alert.event}
                </Badge>
              ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* CAL FIRE info (live mode) */}
        {calfire && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {calfire.acres != null && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-400">Acres:</span>
                <span className="text-orange-400 font-semibold">
                  {calfire.acres.toLocaleString()}
                </span>
              </div>
            )}
            {calfire.containmentPct != null && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-400">Contained:</span>
                <span
                  className={`font-semibold ${
                    calfire.containmentPct >= 80
                      ? "text-green-400"
                      : calfire.containmentPct >= 50
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {calfire.containmentPct}%
                </span>
              </div>
            )}
            {calfire.county && (
              <span className="text-zinc-500">{calfire.county} County</span>
            )}
            {calfire.url && (
              <a
                href={calfire.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                CAL FIRE page
              </a>
            )}
          </div>
        )}

        {/* ArcGIS Perimeter info (live mode) */}
        {perimeter && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${
                perimeter.displayStatus === "Active"
                  ? "border-red-500 text-red-400"
                  : "border-zinc-600 text-zinc-400"
              }`}
            >
              {perimeter.displayStatus}
            </Badge>
            {perimeter.acres != null && perimeter.acres > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-400">Perimeter:</span>
                <span className="text-orange-400 font-semibold">
                  {perimeter.acres.toFixed(1)} acres
                </span>
              </div>
            )}
            {perimeter.geometry && (
              <Badge className="bg-green-800 text-[10px] px-1.5 py-0">
                HAS POLYGON
              </Badge>
            )}
            <span className="text-zinc-600 text-[10px]">
              via {perimeter.source}
            </span>
          </div>
        )}

        {/* FIRMS satellite detection info (live mode) */}
        {firms && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Badge className="bg-purple-700 text-[10px] px-1.5 py-0">
              SATELLITE
            </Badge>
            <div className="flex items-center gap-1">
              <span className="text-zinc-400">Detections:</span>
              <span className="text-purple-300 font-semibold">
                {firms.pointCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-zinc-400">Max FRP:</span>
              <span className="text-orange-400 font-semibold">
                {firms.maxFrp.toFixed(1)} MW
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-zinc-400">Last seen:</span>
              <span className="text-zinc-200">
                {new Date(firms.lastSeen).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {firms.satellites.length > 0 && (
              <span className="text-zinc-600 text-[10px]">
                via {firms.satellites.join(", ")}
              </span>
            )}
          </div>
        )}

        {/* Location & Time */}
        <div className="text-xs text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Location</span>
            <span className="text-zinc-200">
              {incident.lat.toFixed(3)}°N, {Math.abs(incident.lon).toFixed(3)}°W
            </span>
          </div>
          <div className="flex justify-between">
            <span>Start</span>
            <span className="text-zinc-200">
              {new Date(incident.startTimeISO).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Fuel</span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-orange-600 text-orange-400"
            >
              {incident.fuelProxy}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Perimeter</span>
            <span className="text-zinc-200">
              {incident.perimeter.radiusMeters}m radius
            </span>
          </div>
        </div>

        {/* Notes */}
        {incident.notes && (
          <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-2">
            {incident.notes}
          </p>
        )}

        {/* NWS Forecast summary */}
        {nws?.forecastSummary && (
          <div className="border-t border-zinc-700 pt-2">
            <div className="text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              <span>📡</span> NWS Forecast
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {nws.forecastSummary}
            </p>
          </div>
        )}

        {/* Weather */}
        {weather && (
          <div className="border-t border-zinc-700 pt-2">
            <div className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
              <span>🌬️</span> Current Weather
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Wind</span>
                <span className="text-zinc-200 flex items-center gap-1">
                  {weather.windSpeedMps.toFixed(1)} m/s
                  <WindArrow degrees={weather.windDirDeg} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Gust</span>
                <span className="text-zinc-200">
                  {weather.windGustMps.toFixed(1)} m/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Temp</span>
                <span className="text-zinc-200">
                  {weather.temperatureC.toFixed(0)}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Humidity</span>
                <span
                  className={`font-medium ${
                    weather.humidityPct < 20
                      ? "text-red-400"
                      : weather.humidityPct < 30
                        ? "text-orange-400"
                        : "text-zinc-200"
                  }`}
                >
                  {weather.humidityPct}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
