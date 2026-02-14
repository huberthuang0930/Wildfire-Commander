"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ControlsBarProps {
  aiEnabled: boolean;
  onToggleAI: () => void;
  onRefresh: () => void;
  onOpenBrief: () => void;
  lastUpdated: Date | null;
  changesBanner: string | null;
  liveIncidentCount: number;
}

export default function ControlsBar({
  aiEnabled,
  onToggleAI,
  onRefresh,
  onOpenBrief,
  lastUpdated,
  changesBanner,
  liveIncidentCount,
}: ControlsBarProps) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2">
        {/* Logo / Title */}
        <div className="flex items-center gap-2 mr-2">
          <div>
            <h1 className="text-sm font-bold text-white leading-none">
              InitialAttack
            </h1>
            <span className="text-[10px] text-zinc-500">IC Assist</span>
          </div>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {/* Incident Count */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{liveIncidentCount}</span>
          <span>incidents tracked</span>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {/* AI Insights Toggle */}
        <Button
          variant={aiEnabled ? "default" : "outline"}
          size="sm"
          onClick={onToggleAI}
          className={`text-xs h-8 ${
            aiEnabled
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          AI {aiEnabled ? "ON" : "OFF"}
        </Button>

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="text-xs h-8 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          ↻ Refresh
        </Button>

        {/* Brief Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenBrief}
          className="text-xs h-8 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          Brief
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last updated */}
        {lastUpdated && (
          <span className="text-[10px] text-zinc-500">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* What Changed banner */}
      {changesBanner && (
        <div className="absolute top-full left-0 right-0 z-10 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700 px-4 py-1.5 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-600 text-[10px] px-1.5 py-0">
              UPDATED
            </Badge>
            <span className="text-xs text-amber-200">{changesBanner}</span>
          </div>
        </div>
      )}
    </div>
  );
}
