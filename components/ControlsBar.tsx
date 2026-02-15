"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Legend from "./Legend";

interface ControlsBarProps {
  onRefresh: () => void;
  lastUpdated: Date | null;
  changesBanner: string | null;
  liveIncidentCount: number;
}

export default function ControlsBar({
  onRefresh,
  lastUpdated,
  changesBanner,
  liveIncidentCount,
}: ControlsBarProps) {
  return (
    <div className="relative z-[9999]">
      <div className="flex items-center gap-3 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-2">
        {/* Logo / Title */}
        <div className="flex items-center gap-2.5 mr-2">
          {/* Flashpoint Icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            {/* Outer glow ring */}
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="url(#glowGradient)"
              strokeWidth="0.5"
              opacity="0.6"
            />

            {/* Main flame/spark burst */}
            <path
              d="M12 3 L13.5 8 L18 7 L14 11 L16 15 L12 13 L8 15 L10 11 L6 7 L10.5 8 Z"
              fill="url(#flameGradient)"
              className="drop-shadow-lg"
            />

            {/* Central hotspot */}
            <circle
              cx="12"
              cy="11"
              r="2.5"
              fill="url(#hotspotGradient)"
            />

            {/* Energy lines */}
            <line x1="12" y1="2" x2="12" y2="5" stroke="#FF8C00" strokeWidth="1" opacity="0.8" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="#FF6B00" strokeWidth="1" opacity="0.6" strokeLinecap="round"/>
            <line x1="2" y1="12" x2="5" y2="12" stroke="#FF8C00" strokeWidth="1" opacity="0.8" strokeLinecap="round"/>
            <line x1="19" y1="12" x2="22" y2="12" stroke="#FF6B00" strokeWidth="1" opacity="0.6" strokeLinecap="round"/>

            {/* Gradients */}
            <defs>
              <linearGradient id="flameGradient" x1="12" y1="3" x2="12" y2="15">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="#FF8C00" />
                <stop offset="100%" stopColor="#FF4500" />
              </linearGradient>

              <radialGradient id="hotspotGradient" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#FFD700" />
                <stop offset="100%" stopColor="#FF8C00" />
              </radialGradient>

              <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF6B00" />
                <stop offset="100%" stopColor="#FF4500" />
              </linearGradient>
            </defs>
          </svg>

          <div>
            <h1 className="text-base font-bold text-white leading-none tracking-tight">
              Flashpoint
            </h1>
            <span className="text-[9px] text-orange-400/80 font-medium tracking-wide">
              AI COMMAND
            </span>
          </div>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {/* Incident Count */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{liveIncidentCount}</span>
          <span>incidents tracked</span>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="text-xs h-8 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          ↻ Refresh
        </Button>

        {/* Legend */}
        <Legend />

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
