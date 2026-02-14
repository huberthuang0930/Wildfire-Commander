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
  EnrichedIncident,
  NwsEnrichment,
  AIInsight,
} from "@/lib/types";
import IncidentPanel from "@/components/IncidentPanel";
import ActionCards from "@/components/ActionCards";
import ExplainPanel from "@/components/ExplainPanel";
import AIInsightsPanel from "@/components/AIInsightsPanel";
import ControlsBar from "@/components/ControlsBar";
import type { AppMode } from "@/components/ControlsBar";
import BriefModal from "@/components/BriefModal";
import IncidentList from "@/components/IncidentList";
import ChatPanel from "@/components/ChatPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatMessage } from "@/lib/chat/types";

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
  // ===== Mode state =====
  const [mode, setMode] = useState<AppMode>("scenario");

  // ===== Scenario mode state =====
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // ===== Live mode state =====
  const [liveIncidents, setLiveIncidents] = useState<EnrichedIncident[]>([]);
  const [selectedLiveIncident, setSelectedLiveIncident] = useState<EnrichedIncident | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // ===== Shared state =====
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
  const [aiHasRun, setAIHasRun] = useState(false);

  // ===== Live-specific display data =====
  const [liveCalfire, setLiveCalfire] = useState<EnrichedIncident["calfire"] | null>(null);
  const [liveNws, setLiveNws] = useState<NwsEnrichment | null>(null);
  const [livePerimeter, setLivePerimeter] = useState<EnrichedIncident["perimeter"] | null>(null);
  const [liveFirms, setLiveFirms] = useState<EnrichedIncident["firms"] | null>(null);
  const [firmsHotspots, setFirmsHotspots] = useState<{ lat: number; lon: number; frp: number }[]>([]);

  // ===== UI state =====
  const [windShiftEnabled, setWindShiftEnabled] = useState(false);
  const [aiEnabled, setAIEnabled] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefMarkdown, setBriefMarkdown] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [changesBanner, setChangesBanner] = useState<string | null>(null);

  // ===== Chat state =====
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Track previous values for change detection
  const prevRiskRef = useRef<number | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ===== Load scenarios on mount =====
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

  // ===== Fetch live incidents (FIRMS satellite data) =====
  const fetchLiveIncidents = useCallback(async () => {
    setLiveLoading(true);
    try {
      console.log('[Live Mode] Fetching NASA FIRMS fire data for California...');
      const res = await fetch("/api/fires/live?days=2&sources=VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT&limit=20&nwsEnrich=3&bbox=-124.5,32.5,-114.1,42.1");
      const data = await res.json();
      const incidents: EnrichedIncident[] = data.incidents || [];
      console.log(`[Live Mode] Loaded ${incidents.length} fire incidents from NASA FIRMS`);
      console.log(`[Live Mode] Total hotspots: ${data.totalHotspots || 0}`);
      if (incidents.length > 0) {
        console.log('[Live Mode] Sample fire:', incidents[0].incident.name,
          `at (${incidents[0].incident.lat}, ${incidents[0].incident.lon})`);
      }
      setLiveIncidents(incidents);

      // Store raw hotspot points for map heat layer
      if (data.hotspotPoints) {
        setFirmsHotspots(data.hotspotPoints);
      }

      // If we have a selected live incident, update it with fresh data
      if (selectedLiveIncident) {
        const updated = incidents.find(
          (i) => i.incident.id === selectedLiveIncident.incident.id
        );
        if (updated) {
          setSelectedLiveIncident(updated);
          setIncident(updated.incident);
          setResources(updated.resources);
          setAssets(updated.assets);
          setLiveCalfire(updated.calfire);
          setLiveNws(updated.nws);
          setLivePerimeter(updated.perimeter);
          setLiveFirms(updated.firms);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live incidents:", err);
    } finally {
      setLiveLoading(false);
    }
  }, [selectedLiveIncident]);

  // ===== Load live incidents when switching to live mode =====
  useEffect(() => {
    if (mode === "live") {
      fetchLiveIncidents();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Mode toggle handler =====
  const handleToggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "scenario" ? "live" : "scenario";

      // Clear computed data when switching
      setEnvelopes([]);
      setCards([]);
      setRiskScore(null);
      setBrief(null);
      setSpreadExplain(null);
      setWeather(null);
      setChangesBanner(null);
      setAIInsights([]);
      setAIHasRun(false);
      prevRiskRef.current = null;

      if (next === "scenario") {
        // Restore scenario state
        setLiveCalfire(null);
        setLiveNws(null);
        setLivePerimeter(null);
        setLiveFirms(null);
        setFirmsHotspots([]);
        setSelectedLiveIncident(null);

        const scenario = scenarios.find((s) => s.id === selectedScenarioId);
        if (scenario) {
          setIncident(scenario.incident);
          setResources(scenario.resources);
          setAssets(scenario.assets);
        }
      } else {
        // Live mode — clear incident until user picks one
        setIncident(null);
        setResources(null);
        setAssets([]);
      }

      return next;
    });
  }, [scenarios, selectedScenarioId]);

  // ===== Select scenario handler =====
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
      setAIInsights([]);
      setAIHasRun(false);
      prevRiskRef.current = null;
    },
    [scenarios]
  );

  // ===== Select live incident handler =====
  const handleSelectLiveIncident = useCallback(
    (enriched: EnrichedIncident) => {
      setSelectedLiveIncident(enriched);
      setIncident(enriched.incident);
      setResources(enriched.resources);
      setAssets(enriched.assets);
      setLiveCalfire(enriched.calfire);
      setLiveNws(enriched.nws);
      setLivePerimeter(enriched.perimeter);
      setLiveFirms(enriched.firms);

      // Clear stale computed data
      setEnvelopes([]);
      setCards([]);
      setRiskScore(null);
      setBrief(null);
      setSpreadExplain(null);
      setWeather(null);
      setChangesBanner(null);
      setAIInsights([]);
      setAIHasRun(false);
      prevRiskRef.current = null;
    },
    []
  );

  // ===== Fetch weather + spread + recommendations =====
  const refreshData = useCallback(async () => {
    if (!incident || !resources) return;

    try {
      // 1. Fetch weather
      const weatherRes = await fetch(
        `/api/weather?lat=${incident.lat}&lon=${incident.lon}`
      );
      const weatherData: Weather = await weatherRes.json();
      setWeather(weatherData);

      // 2. Get current scenario for wind shift (only in scenario mode)
      let windShift: WindShift | undefined;
      if (mode === "scenario") {
        const currentScenario = scenarios.find((s) => s.id === selectedScenarioId);
        windShift =
          windShiftEnabled && currentScenario?.defaultWindShift
            ? currentScenario.defaultWindShift
            : undefined;
      }

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

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  }, [incident, resources, assets, scenarios, selectedScenarioId, windShiftEnabled, mode]);

  // ===== Initial data load when incident changes =====
  useEffect(() => {
    if (incident) {
      refreshData();
    }
  }, [incident?.id, refreshData]);

  // Reset chat thread when switching incidents (keeps chat incident-aware)
  useEffect(() => {
    setChatMessages([]);
  }, [incident?.id]);

  // ===== Polling every 30 seconds =====
  useEffect(() => {
    if (!incident) return;

    pollTimerRef.current = setInterval(() => {
      refreshData();
      // Also refresh live incident list if in live mode
      if (mode === "live") {
        fetchLiveIncidents();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [incident?.id, refreshData, mode, fetchLiveIncidents]);

  // ===== Refresh handler =====
  const handleRefresh = useCallback(() => {
    refreshData();
    if (mode === "live") {
      fetchLiveIncidents();
    }
  }, [refreshData, mode, fetchLiveIncidents]);

  // ===== Manual AI insights trigger =====
  const handleRunAI = useCallback(async () => {
    if (!incident || !weather || !riskScore || !cards.length) {
      console.warn("Cannot run AI: missing required data");
      return;
    }

    if (!aiEnabled) {
      console.warn("AI is disabled");
      return;
    }

    setAILoading(true);
    setAIHasRun(true);

    try {
      const aiRes = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident,
          weather,
          riskScore,
          spreadRate: spreadExplain?.rateKmH || 0,
          cards,
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
  }, [incident, weather, riskScore, cards, spreadExplain, aiEnabled]);

  // ===== Open brief modal =====
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

  const handleSendChat = useCallback(
    async (text: string) => {
      if (!incident) return;
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: "user",
        createdAt: Date.now(),
        content: text,
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatLoading(true);

      try {
        const scenarioWindShift =
          mode === "scenario"
            ? scenarios.find((s) => s.id === selectedScenarioId)?.defaultWindShift
            : undefined;
        const windShift =
          mode === "scenario" && windShiftEnabled && scenarioWindShift
            ? scenarioWindShift
            : null;

        const active = {
          mode,
          incidentId: incident.id,
          name: incident.name,
          lat: incident.lat,
          lon: incident.lon,
          windShiftEnabled: mode === "scenario" ? windShiftEnabled : undefined,
          windShift: mode === "scenario" ? windShift : undefined,
          incident,
          resources,
          assets,
          weather,
          spread: spreadExplain
            ? { envelopes, explain: spreadExplain }
            : null,
          cards:
            cards && cards.length > 0 && riskScore && brief
              ? { cards, riskScore, brief }
              : null,
        };

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...chatMessages, userMsg],
            active,
          }),
        });
        const data = await res.json();
        if (data?.assistant) {
          setChatMessages((prev) => [...prev, data.assistant as ChatMessage]);
        }
      } catch (err) {
        console.error("Chat error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: "assistant",
            createdAt: Date.now(),
            content:
              "{\"decision\":\"Chat unavailable\",\"evidence\":[],\"actions_0_3h\":[],\"uncertainties\":[\"Network or server error\"]}",
          } as ChatMessage,
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [
      incident,
      mode,
      resources,
      assets,
      weather,
      envelopes,
      spreadExplain,
      cards,
      riskScore,
      brief,
      chatMessages,
      scenarios,
      selectedScenarioId,
      windShiftEnabled,
    ]
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 flex flex-col">
      {/* Top controls bar */}
      <ControlsBar
        mode={mode}
        onToggleMode={handleToggleMode}
        scenarios={scenarios}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={handleSelectScenario}
        windShiftEnabled={windShiftEnabled}
        onToggleWindShift={() => setWindShiftEnabled((prev) => !prev)}
        aiEnabled={aiEnabled}
        onToggleAI={() => setAIEnabled((prev) => !prev)}
        onRefresh={handleRefresh}
        onOpenBrief={handleOpenBrief}
        lastUpdated={lastUpdated}
        changesBanner={changesBanner}
        liveIncidentCount={liveIncidents.length}
      />

      {/* Main content: map + overlays */}
      <div className="flex-1 relative">
        {/* Map */}
        <MapView
          incident={incident}
          envelopes={envelopes}
          assets={assets}
          perimeterPolygon={mode === "live" ? livePerimeter?.geometry ?? null : null}
          firmsHotspots={mode === "live" ? firmsHotspots : undefined}
          liveIncidents={mode === "live" ? liveIncidents : undefined}
          selectedIncidentId={mode === "live" ? incident?.id : undefined}
        />

        {/* Left panel + AI Insights */}
        <div className="absolute top-4 left-4 z-10 w-72 space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          {/* In live mode, show incident list */}
          {mode === "live" && (
            <IncidentList
              incidents={liveIncidents}
              selectedId={incident?.id ?? null}
              onSelect={handleSelectLiveIncident}
              loading={liveLoading}
            />
          )}

          {/* Incident details panel */}
          <IncidentPanel
            incident={incident}
            weather={weather}
            calfire={mode === "live" ? liveCalfire : undefined}
            nws={mode === "live" ? liveNws : undefined}
            perimeter={mode === "live" ? livePerimeter : undefined}
            firms={mode === "live" ? liveFirms : undefined}
          />

          {/* Explain panel */}
          <ExplainPanel riskScore={riskScore} spreadExplain={spreadExplain} />
          <AIInsightsPanel
            insights={aiInsights}
            isLoading={aiLoading}
            hasRun={aiHasRun}
            onRunAI={handleRunAI}
            aiEnabled={aiEnabled}
            canRun={!!(incident && weather && riskScore && cards.length)}
          />
        </div>

        {/* Right panel: Action Cards */}
        <div className="absolute top-4 right-4 z-10 w-80 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="w-full bg-zinc-900/90 border border-zinc-700">
              <TabsTrigger value="cards" className="text-xs">
                Action Cards
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                Chat
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cards" className="mt-2">
              <ActionCards cards={cards} />
            </TabsContent>
            <TabsContent value="chat" className="mt-2">
              <ChatPanel
                mode={mode}
                activeIncidentName={incident?.name || ""}
                messages={chatMessages}
                isLoading={chatLoading}
                onSend={handleSendChat}
              />
            </TabsContent>
          </Tabs>
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
