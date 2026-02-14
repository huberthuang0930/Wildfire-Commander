"use client";

import { useState } from "react";
import { RiskScore, SpreadResult } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ExplainPanelProps {
  riskScore: RiskScore | null;
  spreadExplain: SpreadResult["explain"] | null;
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{value}/100</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ExplainPanel({ riskScore, spreadExplain }: ExplainPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!riskScore) return null;

  const riskColor =
    riskScore.label === "extreme"
      ? "text-red-400"
      : riskScore.label === "high"
        ? "text-orange-400"
        : riskScore.label === "moderate"
          ? "text-yellow-400"
          : "text-green-400";

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Risk Assessment
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-zinc-400 hover:text-white h-6 px-2"
          >
            {expanded ? "Collapse" : "Details"}
          </Button>
        </div>

        {/* Risk score gauge */}
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#27272a"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={
                  riskScore.label === "extreme"
                    ? "#f87171"
                    : riskScore.label === "high"
                      ? "#fb923c"
                      : riskScore.label === "moderate"
                        ? "#facc15"
                        : "#4ade80"
                }
                strokeWidth="3"
                strokeDasharray={`${riskScore.total}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${riskColor}`}>
                {riskScore.total}
              </span>
            </div>
          </div>
          <div>
            <div className={`text-sm font-bold uppercase ${riskColor}`}>
              {riskScore.label}
            </div>
            <div className="text-[10px] text-zinc-500">Risk Score (0–100)</div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-1.5">
          <RiskBar
            label="Wind Severity"
            value={riskScore.breakdown.windSeverity}
            color="bg-blue-500"
          />
          <RiskBar
            label="Humidity Severity"
            value={riskScore.breakdown.humiditySeverity}
            color="bg-orange-500"
          />
          <RiskBar
            label="Time-to-Impact"
            value={riskScore.breakdown.timeToImpactSeverity}
            color="bg-red-500"
          />
        </div>

        {/* Expanded model notes */}
        {expanded && spreadExplain && (
          <div className="mt-3 pt-2 border-t border-zinc-700 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
              Model: {spreadExplain.model}
            </div>
            <div className="text-xs text-zinc-400">
              Spread Rate: {spreadExplain.rateKmH.toFixed(2)} km/h
            </div>
            {spreadExplain.notes.map((note, i) => (
              <div key={i} className="text-xs text-zinc-500 flex items-start gap-1">
                <span className="shrink-0">•</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
