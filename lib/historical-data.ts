import type { Incident, Weather } from "./types";
import type { HistoricalIncident } from "./ai-service";
import incidents from "@/data/historical/incidents.json";

interface ScoredIncident {
  incident: HistoricalIncident;
  score: number;
}

const FUEL_COMPATIBILITY_MAP: Record<string, string[]> = {
  grass: ["grass", "mixed"],
  brush: ["brush", "chaparral", "mixed"],
  mixed: ["mixed", "grass", "brush"],
  chaparral: ["chaparral", "brush"],
};

/**
 * Calculate similarity score between current conditions and a historical incident
 * Returns score 0-100
 */
function calculateSimilarityScore(
  current: Incident,
  currentWeather: Weather,
  historical: HistoricalIncident
): number {
  let score = 0;

  // 1. Fuel Type Match (30 points max)
  if (current.fuelProxy === historical.fuel) {
    score += 30;
  } else if (FUEL_COMPATIBILITY_MAP[current.fuelProxy]?.includes(historical.fuel)) {
    score += 15; // Compatible fuel types
  }

  // 2. Wind Speed Similarity (25 points max)
  const windDiff = Math.abs(currentWeather.windSpeedMps - historical.weather.windSpeedMps);
  if (windDiff <= 2) {
    score += 25;
  } else if (windDiff <= 5) {
    score += 15;
  } else if (windDiff <= 10) {
    score += 5;
  }

  // 3. Humidity Similarity (25 points max)
  const humidityDiff = Math.abs(currentWeather.humidityPct - historical.weather.humidityPct);
  if (humidityDiff <= 5) {
    score += 25;
  } else if (humidityDiff <= 10) {
    score += 15;
  } else if (humidityDiff <= 20) {
    score += 5;
  }

  // 4. Geographic Proximity (20 points max)
  // For now, all incidents are California, so give full points
  // Future: compare regions (Northern/Southern CA, climate zones)
  if (historical.location.includes("California")) {
    score += 20;
  }

  return score;
}

/**
 * Find similar historical incidents based on current conditions
 * Returns up to 5 most similar incidents with score >= 40
 */
export function findSimilarIncidents(
  current: Incident,
  weather: Weather
): HistoricalIncident[] {
  const historicalIncidents = incidents.incidents as HistoricalIncident[];

  if (!historicalIncidents || historicalIncidents.length === 0) {
    console.warn("No historical incidents data available");
    return [];
  }

  // Score all incidents
  const scored: ScoredIncident[] = historicalIncidents.map(historical => ({
    incident: historical,
    score: calculateSimilarityScore(current, weather, historical)
  }));

  // Filter by minimum score threshold (40) and sort by score descending
  const filtered = scored
    .filter(s => s.score >= 40)
    .sort((a, b) => b.score - a.score);

  // Return top 5
  return filtered.slice(0, 5).map(s => s.incident);
}

/**
 * Calculate statistics from similar historical incidents
 */
export function calculateHistoricalStatistics(
  similarIncidents: HistoricalIncident[]
): {
  escapedPercentage: number;
  containedPercentage: number;
  avgContainmentTime: number;
  airSupportUsagePercentage: number;
} {
  if (similarIncidents.length === 0) {
    return {
      escapedPercentage: 0,
      containedPercentage: 0,
      avgContainmentTime: 0,
      airSupportUsagePercentage: 0,
    };
  }

  const escaped = similarIncidents.filter(i => i.outcome === "escaped").length;
  const contained = similarIncidents.filter(i => i.outcome === "contained").length;
  const withAirSupport = similarIncidents.filter(i => i.resources.airSupport).length;

  const containedIncidents = similarIncidents.filter(i => i.outcome === "contained");
  const avgContainmentTime = containedIncidents.length > 0
    ? containedIncidents.reduce((sum, i) => sum + i.containmentTimeHours, 0) / containedIncidents.length
    : 0;

  return {
    escapedPercentage: (escaped / similarIncidents.length) * 100,
    containedPercentage: (contained / similarIncidents.length) * 100,
    avgContainmentTime,
    airSupportUsagePercentage: (withAirSupport / similarIncidents.length) * 100,
  };
}

/**
 * Get formatted summary of historical patterns
 */
export function getHistoricalSummary(
  similarIncidents: HistoricalIncident[]
): string[] {
  if (similarIncidents.length === 0) {
    return ["No similar historical incidents found for comparison"];
  }

  const stats = calculateHistoricalStatistics(similarIncidents);
  const summary: string[] = [];

  summary.push(
    `Found ${similarIncidents.length} similar incident${similarIncidents.length > 1 ? "s" : ""} for comparison`
  );

  if (stats.escapedPercentage > 0) {
    summary.push(
      `${stats.escapedPercentage.toFixed(0)}% of similar fires escaped initial attack`
    );
  }

  if (stats.containedPercentage > 0) {
    summary.push(
      `${stats.containedPercentage.toFixed(0)}% contained (avg ${stats.avgContainmentTime.toFixed(1)} hours)`
    );
  }

  if (stats.airSupportUsagePercentage > 50) {
    summary.push(
      `${stats.airSupportUsagePercentage.toFixed(0)}% required air support`
    );
  }

  return summary;
}
