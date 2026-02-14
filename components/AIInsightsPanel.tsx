"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AIInsight } from "@/lib/types";

interface AIInsightsPanelProps {
  insights: AIInsight[];
  isLoading: boolean;
  hasRun: boolean;
  onRunAI: () => void;
  aiEnabled: boolean;
  canRun: boolean;
}

function InsightCard({ insight, index }: { insight: AIInsight; index: number }) {
  const [showReasoning, setShowReasoning] = useState(false);

  const icon =
    insight.type === "warning"
      ? "⚠️"
      : insight.type === "recommendation"
        ? "💡"
        : "📊";

  const confidenceColor =
    insight.confidence === "high"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : insight.confidence === "medium"
        ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
        : "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div className="border-t border-zinc-700 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-xs font-medium text-zinc-200 leading-snug">
              {insight.message}
            </p>
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${confidenceColor}`}
            >
              {insight.confidence}
            </Badge>
          </div>

          {/* Reasoning (expandable) */}
          {insight.reasoning && insight.reasoning.length > 0 && (
            <div className="mt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReasoning(!showReasoning)}
                className="text-[10px] text-zinc-400 hover:text-white h-5 px-1.5 -ml-1.5"
              >
                {showReasoning ? "Hide" : "Why?"} →
              </Button>

              {showReasoning && (
                <div className="mt-1 space-y-0.5 pl-1 border-l-2 border-zinc-700">
                  {insight.reasoning.map((reason, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-zinc-400 flex items-start gap-1.5 pl-2"
                    >
                      <span className="shrink-0 text-zinc-600">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          {insight.sources && insight.sources.length > 0 && showReasoning && (
            <div className="mt-1 text-[9px] text-zinc-500 pl-1">
              Based on {insight.sources.length} similar incident
              {insight.sources.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIInsightsPanel({
  insights,
  isLoading,
  hasRun,
  onRunAI,
  aiEnabled,
  canRun,
}: AIInsightsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              AI Advisor
            </h3>
            <Badge
              variant="outline"
              className="text-[8px] px-1 py-0 h-3.5 bg-blue-500/10 text-blue-300 border-blue-500/30"
            >
              BETA
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-zinc-400 hover:text-white h-6 px-2"
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>

        {!collapsed && (
          <>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-12 bg-zinc-800/50 rounded animate-pulse" />
                <div className="h-12 bg-zinc-800/50 rounded animate-pulse" />
              </div>
            ) : insights.length > 0 ? (
              <>
                <div className="space-y-2.5">
                  {insights.map((insight, index) => (
                    <InsightCard key={index} insight={insight} index={index} />
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-700 flex items-center justify-between">
                  <p className="text-[9px] text-zinc-500 italic">
                    AI insights supplement, not replace, IC judgment. Verify with
                    local knowledge and protocols.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRunAI}
                    disabled={!canRun || !aiEnabled || isLoading}
                    className="text-[10px] text-blue-400 hover:text-blue-300 h-5 px-2"
                  >
                    Re-analyze
                  </Button>
                </div>
              </>
            ) : !hasRun ? (
              <div className="text-center py-4">
                {!aiEnabled ? (
                  <p className="text-xs text-zinc-500 mb-2">
                    AI insights are disabled
                  </p>
                ) : !canRun ? (
                  <p className="text-xs text-zinc-500 mb-2">
                    Select a fire and wait for data to load
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-zinc-400 mb-3">
                      Click below to analyze this fire using real NASA FIRMS satellite data
                    </p>
                    <Button
                      onClick={onRunAI}
                      disabled={!canRun || !aiEnabled || isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 h-8"
                    >
                      🔥 Analyze Fire
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-zinc-500 mb-3">
                  No insights generated
                </p>
                <Button
                  variant="ghost"
                  onClick={onRunAI}
                  disabled={!canRun || !aiEnabled || isLoading}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Try again
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
