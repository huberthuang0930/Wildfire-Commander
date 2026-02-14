"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type {
  Scenario,
  Incident,
  Weather,
  Resources,
  Asset,
  SpreadEnvelope,
  SpreadResult,
  ActionCard,
  RiskScore,
  Brief,
  WindShift,
  AIInsight,
} from "@/lib/types";
import IncidentPanel from "@/components/IncidentPanel";
import ActionCards from "@/components/ActionCards";
import ExplainPanel from "@/components/ExplainPanel";
import AIInsightsPanel from "@/components/AIInsightsPanel";
import ControlsBar from "@/components/ControlsBar";
import BriefModal from "@/components/BriefModal";

// Dynamically import MapView to avoid SSR issues with mapbox-gl
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Loading map...</div>
    </div>
  ),
});

const POLL_INTERVAL_MS = 30000; // 30 seconds

export default function Home() {
  // Data state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [resources, setResources] = useState<Resources | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [envelopes, setEnvelopes] = useState<SpreadEnvelope[]>([]);
  const [spreadExplain, setSpreadExplain] = useState<SpreadResult["explain"] | null>(null);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);

  // AI insights state
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAILoading] = useState(false);

  // UI state
  const [windShiftEnabled, setWindShiftEnabled] = useState(false);
  const [aiEnabled, setAIEnabled] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [changesBanner, setChangesBanner] = useState<string | null>(null);

  // Track previous values for change detection
  const prevRiskRef = useRef<number | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load scenarios on mount
  useEffect(() => {
    async function loadScenarios() {
      try {
        const res = await fetch("/api/scenarios");
        const data = await res.json();
        setScenarios(data.scenarios || []);

        // Auto-select first scenario
        if (data.scenarios?.length > 0) {
          const first = data.scenarios[0];
          setSelectedScenarioId(first.id);
          setIncident(first.incident);
          setResources(first.resources);
          setAssets(first.assets);
          if (first.defaultWindShift) {
            setWindShiftEnabled(first.defaultWindShift.enabled);
          }
        }
      } catch (err) {
        console.error("Failed to load scenarios:", err);
      }
    }
    loadScenarios();
  }, []);

  // Select scenario handler
  const handleSelectScenario = useCallback(
    (id: string) => {
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) return;

      setSelectedScenarioId(id);
      setIncident(scenario.incident);
      setResources(scenario.resources);
      setAssets(scenario.assets);
      setWindShiftEnabled(scenario.defaultWindShift?.enabled ?? false);

      // Clear stale data
      setEnvelopes([]);
      setCards([]);
      setRiskScore(null);
      setBrief(null);
      setSpreadExplain(null);
      setWeather(null);
      setChangesBanner(null);
      prevRiskRef.current = null;
    },
    [scenarios]
  );

  // Fetch weather + spread + recommendations
  const refreshData = useCallback(async () => {
    if (!incident || !resources) return;

    try {
      // 1. Fetch weather
      const weatherRes = await fetch(
        `/api/weather?lat=${incident.lat}&lon=${incident.lon}`
      );
      const weatherData: Weather = await weatherRes.json();
      setWeather(weatherData);

      // 2. Get current scenario for wind shift
      const currentScenario = scenarios.find((s) => s.id === selectedScenarioId);
      const windShift: WindShift | undefined =
        windShiftEnabled && currentScenario?.defaultWindShift
          ? currentScenario.defaultWindShift
          : undefined;

      // 3. Compute spread
      const spreadRes = await fetch("/api/spread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident,
          weather: weatherData,
          horizonHours: 3,
          windShift,
        }),
      });
      const spreadData: SpreadResult = await spreadRes.json();
      setEnvelopes(spreadData.envelopes);
      setSpreadExplain(spreadData.explain);

      // 4. Get recommendations
      const recsRes = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident,
          weather: weatherData,
          envelopes: spreadData.envelopes,
          assets,
          resources,
          spreadRateKmH: spreadData.explain.rateKmH,
          windShift,
        }),
      });
      const recsData = await recsRes.json();
      setCards(recsData.cards || []);
      setRiskScore(recsData.riskScore || null);
      setBrief(recsData.brief || null);

      // Change detection
      if (
        prevRiskRef.current !== null &&
        recsData.riskScore &&
        Math.abs(recsData.riskScore.total - prevRiskRef.current) > 5
      ) {
        const delta = recsData.riskScore.total - prevRiskRef.current;
        setChangesBanner(
          `Risk score ${delta > 0 ? "increased" : "decreased"} to ${recsData.riskScore.total}/100 (was ${prevRiskRef.current})`
        );
        // Auto-clear after 8 seconds
        setTimeout(() => setChangesBanner(null), 8000);
      }
      if (recsData.riskScore) {
        prevRiskRef.current = recsData.riskScore.total;
      }

      // 5. Fetch AI insights (only if AI is enabled)
      if (aiEnabled && recsData.riskScore) {
        setAILoading(true);
        try {
          const aiRes = await fetch("/api/ai-insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              incident,
              weather: weatherData,
              riskScore: recsData.riskScore,
              spreadRate: spreadData.explain.rateKmH,
              cards: recsData.cards || [],
            }),
          });
          const aiData = await aiRes.json();
          setAIInsights(aiData.insights || []);
        } catch (err) {
          console.error("AI insights error:", err);
          setAIInsights([]);
        } finally {
          setAILoading(false);
        }
      } else if (!aiEnabled) {
        // Clear insights when AI is disabled
        setAIInsights([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  }, [incident, resources, assets, scenarios, selectedScenarioId, windShiftEnabled, aiEnabled]);

  // Initial data load when incident changes
  useEffect(() => {
    if (incident) {
      refreshData();
    }
  }, [incident?.id, refreshData]);

  // Polling every 30 seconds
  useEffect(() => {
    if (!incident) return;

    pollTimerRef.current = setInterval(() => {
      refreshData();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [incident?.id, refreshData]);

  // Open brief modal
  const handleOpenBrief = useCallback(async () => {
    if (!incident || !cards.length || !riskScore || !spreadExplain || !brief) {
      setBriefOpen(true);
      return;
    }

    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentName: incident.name,
          oneLiner: brief.oneLiner,
          keyTriggers: brief.keyTriggers,
          cards,
          riskScore,
          spreadExplain,
        }),
      });
      const data = await res.json();
      setBriefMarkdown(data.markdown || null);
    } catch (err) {
      console.error("Error generating brief:", err);
      setBriefMarkdown("Error generating brief.");
    }

    setBriefOpen(true);
  }, [incident, cards, riskScore, spreadExplain, brief]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 flex flex-col">
      {/* Top controls bar */}
      <ControlsBar
        scenarios={scenarios}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={handleSelectScenario}
        windShiftEnabled={windShiftEnabled}
        onToggleWindShift={() => setWindShiftEnabled((prev) => !prev)}
        aiEnabled={aiEnabled}
        onToggleAI={() => setAIEnabled((prev) => !prev)}
        onRefresh={refreshData}
        onOpenBrief={handleOpenBrief}
        lastUpdated={lastUpdated}
        changesBanner={changesBanner}
      />

      {/* Main content: map + overlays */}
      <div className="flex-1 relative">
        {/* Map */}
        <MapView
          incident={incident}
          envelopes={envelopes}
          assets={assets}
        />

        {/* Left panel: Incident + Explain + AI Insights */}
        <div className="absolute top-4 left-4 z-10 w-72 space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          <IncidentPanel incident={incident} weather={weather} />
          <ExplainPanel riskScore={riskScore} spreadExplain={spreadExplain} />
          <AIInsightsPanel insights={aiInsights} isLoading={aiLoading} />
        </div>

        {/* Right panel: Action Cards */}
        <div className="absolute top-4 right-4 z-10 w-80 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          <ActionCards cards={cards} />
        </div>

        {/* Bottom center: Brief summary */}
        {brief && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-xl">
            <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-4 py-2">
              <p className="text-xs text-zinc-300 text-center">
                {brief.oneLiner}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Brief Modal */}
      <BriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        briefMarkdown={briefMarkdown}
        incidentName={incident?.name || ""}
      />
    </div>
  );
}
