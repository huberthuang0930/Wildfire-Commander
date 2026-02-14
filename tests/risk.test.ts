import { describe, it, expect } from "vitest";
import { computeRiskScore } from "../lib/risk";
import type { Weather } from "../lib/types";

const baseWeather: Weather = {
  windSpeedMps: 10,
  windGustMps: 15,
  windDirDeg: 245,
  temperatureC: 30,
  humidityPct: 15,
};

describe("computeRiskScore", () => {
  it("should return score between 0 and 100", () => {
    const result = computeRiskScore(baseWeather, 60);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("should compute correct wind severity", () => {
    // 10 m/s => 10/20 * 100 = 50
    const result = computeRiskScore(baseWeather, 180);
    expect(result.breakdown.windSeverity).toBe(50);
  });

  it("should compute correct humidity severity", () => {
    // 15% humidity => (60-15)/60 * 100 = 75
    const result = computeRiskScore(baseWeather, 180);
    expect(result.breakdown.humiditySeverity).toBe(75);
  });

  it("should give high time-to-impact severity for < 30 min", () => {
    const result = computeRiskScore(baseWeather, 20);
    expect(result.breakdown.timeToImpactSeverity).toBe(100);
  });

  it("should give low time-to-impact severity for > 180 min", () => {
    const result = computeRiskScore(baseWeather, 200);
    expect(result.breakdown.timeToImpactSeverity).toBe(10);
  });

  it("should give baseline when no impact", () => {
    const result = computeRiskScore(baseWeather, null);
    expect(result.breakdown.timeToImpactSeverity).toBe(10);
  });

  it("should label extreme for high total scores", () => {
    const extremeWeather: Weather = {
      ...baseWeather,
      windSpeedMps: 20,
      humidityPct: 5,
    };
    const result = computeRiskScore(extremeWeather, 15);
    expect(result.label).toBe("extreme");
    expect(result.total).toBeGreaterThanOrEqual(75);
  });

  it("should label low for calm conditions", () => {
    const calmWeather: Weather = {
      ...baseWeather,
      windSpeedMps: 2,
      humidityPct: 55,
    };
    const result = computeRiskScore(calmWeather, null);
    expect(result.label).toBe("low");
    expect(result.total).toBeLessThan(30);
  });

  it("should weight factors correctly (35% wind, 35% humidity, 30% impact)", () => {
    // Set all severities to 100
    const maxWeather: Weather = {
      ...baseWeather,
      windSpeedMps: 25, // >20 => capped at 100
      humidityPct: 0,   // => 100
    };
    const result = computeRiskScore(maxWeather, 10); // <30min => 100
    // All 100: total = 0.35*100 + 0.35*100 + 0.30*100 = 100
    expect(result.total).toBe(100);
  });
});
