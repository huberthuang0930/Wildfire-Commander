"use client";

import { Incident, Weather } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IncidentPanelProps {
  incident: Incident | null;
  weather: Weather | null;
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

export default function IncidentPanel({ incident, weather }: IncidentPanelProps) {
  if (!incident) {
    return (
      <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-zinc-400 text-sm">Select a scenario to begin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-xl">🔥</span>
          <CardTitle className="text-base font-bold">{incident.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-600 text-orange-400">
              {incident.fuelProxy}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Perimeter</span>
            <span className="text-zinc-200">{incident.perimeter.radiusMeters}m radius</span>
          </div>
        </div>

        {/* Notes */}
        {incident.notes && (
          <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-2">
            {incident.notes}
          </p>
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
                <span className="text-zinc-200">{weather.windGustMps.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Temp</span>
                <span className="text-zinc-200">{weather.temperatureC.toFixed(0)}°C</span>
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
