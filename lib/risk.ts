import { Weather, RiskScore, RiskBreakdown } from "./types";

/**
 * Compute a risk score from 0–100.
 *
 * Breakdown:
 *   35% wind severity
 *   35% humidity severity
 *   30% time-to-impact severity
 *
 * Each component is normalized to 0–100.
 */
export function computeRiskScore(
  weather: Weather,
  timeToImpactMinutes: number | null
): RiskScore {
  // Wind severity: 0 at 0 m/s, 100 at 20+ m/s
  const windSeverity = Math.min(100, (weather.windSpeedMps / 20) * 100);

  // Humidity severity: 100 at 0%, 0 at 60%+
  const humiditySeverity = Math.max(
    0,
    Math.min(100, ((60 - weather.humidityPct) / 60) * 100)
  );

  // Time-to-impact severity: 100 if < 30 min, 0 if > 180 min (or no impact)
  let timeToImpactSeverity: number;
  if (timeToImpactMinutes === null || timeToImpactMinutes > 180) {
    timeToImpactSeverity = 10; // baseline even if no imminent threat
  } else if (timeToImpactMinutes <= 30) {
    timeToImpactSeverity = 100;
  } else {
    // Linear interpolation: 30 min -> 100, 180 min -> 10
    timeToImpactSeverity =
      100 - ((timeToImpactMinutes - 30) / 150) * 90;
  }

  const breakdown: RiskBreakdown = {
    windSeverity: Math.round(windSeverity),
    humiditySeverity: Math.round(humiditySeverity),
    timeToImpactSeverity: Math.round(timeToImpactSeverity),
  };

  const total = Math.round(
    0.35 * windSeverity +
      0.35 * humiditySeverity +
      0.30 * timeToImpactSeverity
  );

  let label: RiskScore["label"];
  if (total >= 75) label = "extreme";
  else if (total >= 50) label = "high";
  else if (total >= 30) label = "moderate";
  else label = "low";

  return { total, breakdown, label };
}
