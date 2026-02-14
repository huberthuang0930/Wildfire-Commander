"use client";

import { ActionCard as ActionCardType } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  evacuation: {
    icon: "🚨",
    color: "text-red-400",
    bgColor: "border-l-red-500",
  },
  resources: {
    icon: "🚒",
    color: "text-blue-400",
    bgColor: "border-l-blue-500",
  },
  tactics: {
    icon: "🎯",
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
  const config = TYPE_CONFIG[card.type] || TYPE_CONFIG.tactics;
  const confidenceBadge = CONFIDENCE_BADGE[card.confidence] || CONFIDENCE_BADGE.medium;

  return (
    <Card
      className={`bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm border-l-4 ${config.bgColor} transition-all hover:bg-zinc-800/90`}
    >
      <CardHeader className="pb-1 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{config.icon}</span>
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
      </CardContent>
    </Card>
  );
}
