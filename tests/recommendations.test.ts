import { describe, it, expect } from "vitest";
import { generateRecommendations } from "../lib/recommendations";
import type { Incident, Weather, SpreadEnvelope, Asset, Resources } from "../lib/types";
import { computeSpreadEnvelopes } from "../lib/spread";

const mockIncident: Incident = {
  id: "test_001",
  name: "Test Fire",
  lat: 37.42,
  lon: -122.17,
  startTimeISO: "2026-02-13T18:30:00Z",
  perimeter: { type: "Point", radiusMeters: 120 },
  fuelProxy: "mixed",
  notes: "Test fire",
};

const mockWeather: Weather = {
  windSpeedMps: 8.2,
  windGustMps: 12.7,
  windDirDeg: 245,
  temperatureC: 29,
  humidityPct: 18,
};

const mockResources: Resources = {
  enginesAvailable: 3,
  dozersAvailable: 1,
  airSupportAvailable: true,
  etaMinutesEngine: 18,
  etaMinutesAir: 40,
};

const nearbyAsset: Asset = {
  id: "asset_01",
  type: "community",
  name: "Riverside Creek Community",
  lat: 37.428,
  lon: -122.155,
  priority: "high",
};

const farAsset: Asset = {
  id: "asset_02",
  type: "community",
  name: "Distant Town",
  lat: 37.5,
  lon: -122.3,
  priority: "low",
};

describe("generateRecommendations", () => {
  it("should return exactly 3 action cards", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    expect(result.cards).toHaveLength(3);
  });

  it("should return cards of correct types", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    const types = result.cards.map((c) => c.type);
    expect(types).toContain("evacuation");
    expect(types).toContain("resources");
    expect(types).toContain("tactics");
  });

  it("should include why bullets for each card", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    for (const card of result.cards) {
      expect(card.why.length).toBeGreaterThan(0);
    }
  });

  it("should include actions for each card", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    for (const card of result.cards) {
      expect(card.actions.length).toBeGreaterThan(0);
    }
  });

  it("should include a risk score", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    expect(result.riskScore).toBeDefined();
    expect(result.riskScore.total).toBeGreaterThanOrEqual(0);
    expect(result.riskScore.total).toBeLessThanOrEqual(100);
  });

  it("should include a brief", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    expect(result.brief).toBeDefined();
    expect(result.brief.oneLiner).toBeTruthy();
    expect(result.brief.keyTriggers.length).toBeGreaterThan(0);
  });

  it("should have valid confidence values", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH
    );
    for (const card of result.cards) {
      expect(["high", "medium", "low"]).toContain(card.confidence);
    }
  });

  it("should handle wind shift parameter", () => {
    const windShift = { enabled: true, atMinutes: 90, newDirDeg: 290 };
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather, 3, windShift);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [nearbyAsset],
      mockResources,
      spread.explain.rateKmH,
      windShift
    );
    expect(result.cards).toHaveLength(3);
    // Wind shift should appear in triggers
    const hasWindTrigger = result.brief.keyTriggers.some((t) =>
      t.toLowerCase().includes("wind")
    );
    expect(hasWindTrigger).toBe(true);
  });

  it("should handle scenario with no nearby assets", () => {
    const spread = computeSpreadEnvelopes(mockIncident, mockWeather);
    const result = generateRecommendations(
      mockIncident,
      mockWeather,
      spread.envelopes,
      [farAsset],
      mockResources,
      spread.explain.rateKmH
    );
    expect(result.cards).toHaveLength(3);
    // Evacuation card should still exist but with monitoring message
    const evacCard = result.cards.find((c) => c.type === "evacuation");
    expect(evacCard).toBeDefined();
  });
});
