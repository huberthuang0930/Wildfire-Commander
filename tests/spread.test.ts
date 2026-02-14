import { describe, it, expect } from "vitest";
import { computeSpreadRate, computeSpreadEnvelopes } from "../lib/spread";
import type { Incident, Weather, WindShift } from "../lib/types";

const mockWeather: Weather = {
  windSpeedMps: 8.2,
  windGustMps: 12.7,
  windDirDeg: 245,
  temperatureC: 29,
  humidityPct: 18,
};

const mockIncident: Incident = {
  id: "test_001",
  name: "Test Fire",
  lat: 37.42,
  lon: -122.17,
  startTimeISO: "2026-02-13T18:30:00Z",
  perimeter: { type: "Point", radiusMeters: 120 },
  fuelProxy: "mixed",
  notes: "Test",
};

describe("computeSpreadRate", () => {
  it("should compute rate with wind and humidity factors", () => {
    const result = computeSpreadRate(mockWeather, "mixed");
    // baseRate=0.6, windFactor=1+8.2/10=1.82, humidityFactor=1.4 (18%<20%), fuelFactor=1.0
    expect(result.windFactor).toBeCloseTo(1.82, 1);
    expect(result.humidityFactor).toBe(1.4);
    expect(result.fuelFactor).toBe(1.0);
    expect(result.rate).toBeCloseTo(0.6 * 1.82 * 1.4 * 1.0, 1);
  });

  it("should apply grass fuel factor", () => {
    const result = computeSpreadRate(mockWeather, "grass");
    expect(result.fuelFactor).toBe(1.3);
    expect(result.rate).toBeGreaterThan(computeSpreadRate(mockWeather, "mixed").rate);
  });

  it("should apply chaparral fuel factor", () => {
    const result = computeSpreadRate(mockWeather, "chaparral");
    expect(result.fuelFactor).toBe(1.2);
  });

  it("should use lower humidity factor for 25% humidity", () => {
    const weather25 = { ...mockWeather, humidityPct: 25 };
    const result = computeSpreadRate(weather25, "mixed");
    expect(result.humidityFactor).toBe(1.2);
  });

  it("should use base humidity factor for 40% humidity", () => {
    const weather40 = { ...mockWeather, humidityPct: 40 };
    const result = computeSpreadRate(weather40, "mixed");
    expect(result.humidityFactor).toBe(1.0);
  });
});

describe("computeSpreadEnvelopes", () => {
  it("should return 3 envelopes for default 3-hour horizon", () => {
    const result = computeSpreadEnvelopes(mockIncident, mockWeather);
    expect(result.envelopes).toHaveLength(3);
    expect(result.envelopes[0].tHours).toBe(1);
    expect(result.envelopes[1].tHours).toBe(2);
    expect(result.envelopes[2].tHours).toBe(3);
  });

  it("should return valid polygons with coordinates", () => {
    const result = computeSpreadEnvelopes(mockIncident, mockWeather);
    for (const env of result.envelopes) {
      expect(env.polygon.type).toBe("Polygon");
      expect(env.polygon.coordinates).toHaveLength(1); // outer ring
      expect(env.polygon.coordinates[0].length).toBeGreaterThan(3); // multiple vertices
      // First and last point should be the same (closed polygon)
      const ring = env.polygon.coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it("should produce larger envelopes at later hours", () => {
    const result = computeSpreadEnvelopes(mockIncident, mockWeather);
    // Check that 3h envelope has coordinates further from origin than 1h
    const ring1 = result.envelopes[0].polygon.coordinates[0];
    const ring3 = result.envelopes[2].polygon.coordinates[0];

    // Max distance from origin for each ring
    const maxDist = (ring: number[][]) =>
      Math.max(
        ...ring.map(
          ([lon, lat]) =>
            Math.sqrt(
              Math.pow(lon - mockIncident.lon, 2) +
                Math.pow(lat - mockIncident.lat, 2)
            )
        )
      );

    expect(maxDist(ring3)).toBeGreaterThan(maxDist(ring1));
  });

  it("should include model explanation notes", () => {
    const result = computeSpreadEnvelopes(mockIncident, mockWeather);
    expect(result.explain.model).toBe("wind-cone-v1");
    expect(result.explain.rateKmH).toBeGreaterThan(0);
    expect(result.explain.notes.length).toBeGreaterThan(0);
  });

  it("should handle wind shift", () => {
    const windShift: WindShift = {
      enabled: true,
      atMinutes: 90,
      newDirDeg: 290,
    };
    const result = computeSpreadEnvelopes(mockIncident, mockWeather, 3, windShift);
    expect(result.envelopes).toHaveLength(3);
    // Should mention wind shift in notes
    const hasShiftNote = result.explain.notes.some((n) =>
      n.includes("shift")
    );
    expect(hasShiftNote).toBe(true);
  });
});
