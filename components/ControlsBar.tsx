"use client";

import { Scenario } from "@/lib/types";
import ScenarioPicker from "./ScenarioPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ControlsBarProps {
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  onSelectScenario: (id: string) => void;
  windShiftEnabled: boolean;
  onToggleWindShift: () => void;
  onRefresh: () => void;
  onOpenBrief: () => void;
  lastUpdated: Date | null;
  changesBanner: string | null;
}

export default function ControlsBar({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  windShiftEnabled,
  onToggleWindShift,
  onRefresh,
  onOpenBrief,
  lastUpdated,
  changesBanner,
}: ControlsBarProps) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2">
        {/* Logo / Title */}
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xl">🔥</span>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">
              InitialAttack
            </h1>
            <span className="text-[10px] text-zinc-500">IC Assist</span>
          </div>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {/* Scenario Picker */}
        <ScenarioPicker
          scenarios={scenarios}
          selectedId={selectedScenarioId}
          onSelect={onSelectScenario}
        />

        <div className="w-px h-6 bg-zinc-700" />

        {/* Wind Shift Toggle */}
        <Button
          variant={windShiftEnabled ? "default" : "outline"}
          size="sm"
          onClick={onToggleWindShift}
          className={`text-xs h-8 ${
            windShiftEnabled
              ? "bg-orange-600 hover:bg-orange-700 text-white"
              : "border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          💨 Wind Shift {windShiftEnabled ? "ON" : "OFF"}
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
          📋 Brief
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
