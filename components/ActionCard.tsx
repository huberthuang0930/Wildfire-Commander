"use client";

import { useState } from "react";
import { ActionCard as ActionCardType } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_CONFIG: Record<
  string,
  { color: string; bgColor: string }
> = {
  evacuation: {
    color: "text-red-400",
    bgColor: "border-l-red-500",
  },
  resources: {
    color: "text-blue-400",
    bgColor: "border-l-blue-500",
  },
  tactics: {
    color: "text-amber-400",
    bgColor: "border-l-amber-500",
  },
};

const CONFIDENCE_BADGE: Record<
  string,
  { className: string }
> = {
  high: { className: "bg-green-900/60 text-green-400 border-green-700" },
  medium: { className: "bg-yellow-900/60 text-yellow-400 border-yellow-700" },
  low: { className: "bg-zinc-800 text-zinc-400 border-zinc-600" },
};

interface ActionCardComponentProps {
  card: ActionCardType;
  index: number;
}

export default function ActionCardComponent({
  card,
  index,
}: ActionCardComponentProps) {
  const [iapExpanded, setIapExpanded] = useState(false);
  const config = TYPE_CONFIG[card.type] || TYPE_CONFIG.tactics;
  const confidenceBadge = CONFIDENCE_BADGE[card.confidence] || CONFIDENCE_BADGE.medium;

  return (
    <Card
      className={`ic-card text-white border-l-4 ${config.bgColor}`}
    >
      <CardHeader className="pb-1 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 uppercase tracking-wider shrink-0 ${config.color} border-current`}
                >
                  {card.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 ${confidenceBadge.className}`}
                >
                  {card.confidence}
                </Badge>
              </div>
              <h3 className="text-sm font-semibold leading-tight">{card.title}</h3>
            </div>
          </div>
          <span className="text-lg font-bold text-zinc-500 shrink-0">#{index + 1}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {/* Timing */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500">⏱</span>
          <span className="text-zinc-300">{card.timing}</span>
        </div>

        {/* Why bullets */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Why
          </span>
          <ul className="space-y-0.5">
            {card.why.map((reason, i) => (
              <li
                key={i}
                className="text-xs text-zinc-300 flex items-start gap-1.5"
              >
                <span className="text-zinc-500 mt-0.5 shrink-0">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Actions
          </span>
          <ul className="space-y-0.5">
            {card.actions.map((action, i) => (
              <li
                key={i}
                className="text-xs text-zinc-400 flex items-start gap-1.5"
              >
                <span className="text-zinc-600 mt-0.5 shrink-0">→</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* IAP Insights - More Details Section */}
        {card.iapInsights && card.iapInsights.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-700">
            <button
              onClick={() => setIapExpanded(!iapExpanded)}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <span className="text-[10px]">{iapExpanded ? "▼" : "▶"}</span>
              <span>
                {card.type === "evacuation" && "Weather Impacts (from similar IAPs)"}
                {card.type === "resources" && "Previous Fire Patterns (from similar IAPs)"}
                {card.type === "tactics" && "Terrain Impacts (from similar IAPs)"}
              </span>
            </button>

            {iapExpanded && (
              <div className={`mt-3 space-y-3 pl-1 border-l-2 ${
                card.type === "evacuation" ? "border-red-700" :
                card.type === "resources" ? "border-blue-700" :
                "border-amber-700"
              }`}>
                {card.iapInsights.map((insight, i) => (
                  <div key={i} className="pl-3 space-y-1">
                    {/* IAP Name and Match Score */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${
                        card.type === "evacuation" ? "text-red-400" :
                        card.type === "resources" ? "text-blue-400" :
                        "text-amber-400"
                      }`}>
                        {insight.iapName}
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        ({insight.relevanceScore}% match)
                      </span>
                    </div>

                    {/* Tactical Snippet */}
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {insight.tacticalSnippet}
                    </p>

                    {/* Reasoning */}
                    <div className="text-[10px] text-zinc-500 space-y-0.5">
                      {insight.reasoning.map((reason, j) => (
                        <div key={j} className="flex items-start gap-1.5">
                          <span className="shrink-0 text-zinc-600">•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Section Source */}
                    <div className="text-[9px] text-zinc-600 italic">
                      Source: {insight.sectionType}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
