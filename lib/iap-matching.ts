import type { Incident, Weather, CardType, IAPData, IAPInsight, IAPSection, TerrainMetrics } from "./types";
import { readFileSync } from "fs";
import { join } from "path";
import { calculateTerrainSimilarity } from "./terrain";

// Fuel compatibility map (reuse from historical-data.ts pattern)
const FUEL_COMPATIBILITY_MAP: Record<string, string[]> = {
  grass: ["grass", "mixed"],
  brush: ["brush", "chaparral", "mixed"],
  mixed: ["mixed", "grass", "brush"],
  chaparral: ["chaparral", "brush"],
};

// Relevant sections for each card type
const RELEVANT_SECTIONS: Record<CardType, string[]> = {
  tactics: ["ICS-202", "ICS-204", "ICS-220"],
  resources: ["ICS-203", "ICS-204"],
  evacuation: ["ICS-202"],
};

/**
 * Load IAP data from JSON file (cached in memory)
 */
let cachedIAPData: IAPData[] | undefined;

function loadIAPData(): IAPData[] {
  if (cachedIAPData) return cachedIAPData;

  try {
    const dataPath = join(process.cwd(), "data", "iap", "iap-data.json");
    const rawData = readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(rawData);
    const iaps: IAPData[] = Array.isArray(parsed?.iaps) ? parsed.iaps : [];
    cachedIAPData = iaps;
    return iaps;
  } catch (error) {
    console.warn("Failed to load IAP data:", error);
    // Cache empty to avoid repeated FS reads/log spam in production
    cachedIAPData = [];
    return cachedIAPData;
  }
}

/**
 * Calculate similarity score between current incident and an IAP
 * Returns score 0-100
 * Optional terrain parameter adds terrain-based scoring for tactics cards
 */
function calculateIAPSimilarity(
  incident: Incident,
  weather: Weather,
  cardType: CardType,
  iap: IAPData,
  terrain?: TerrainMetrics
): number {
  let score = 0;

  // 1. Fuel Type Match (25 points)
  if (iap.conditions.fuel) {
    if (iap.conditions.fuel === incident.fuelProxy) {
      score += 25;
    } else if (FUEL_COMPATIBILITY_MAP[incident.fuelProxy]?.includes(iap.conditions.fuel)) {
      score += 12;
    }
  }

  // 2. Weather Similarity (25 points total: 15 for wind, 10 for humidity)
  if (iap.conditions.weather) {
    // Wind speed similarity (15 points max)
    if (iap.conditions.weather.windSpeedMps !== undefined) {
      const windDiff = Math.abs(weather.windSpeedMps - iap.conditions.weather.windSpeedMps);
      if (windDiff <= 3) {
        score += 15;
      } else if (windDiff <= 7) {
        score += 8;
      } else if (windDiff <= 12) {
        score += 3;
      }
    }

    // Humidity similarity (10 points max)
    if (iap.conditions.weather.humidityPct !== undefined) {
      const humidityDiff = Math.abs(weather.humidityPct - iap.conditions.weather.humidityPct);
      if (humidityDiff <= 10) {
        score += 10;
      } else if (humidityDiff <= 20) {
        score += 5;
      } else if (humidityDiff <= 30) {
        score += 2;
      }
    }
  }

  // 3. Incident Scale (15 points)
  if (iap.conditions.acres) {
    // Estimate current incident acres from radius
    const radiusKm = incident.perimeter.radiusMeters / 1000;
    const estimatedAcres = (Math.PI * radiusKm * radiusKm * 247.105); // km² to acres

    const sizeRatio = Math.min(estimatedAcres, iap.conditions.acres) /
                      Math.max(estimatedAcres, iap.conditions.acres);

    score += sizeRatio * 15;
  } else {
    // No size data, give half points
    score += 7;
  }

  // 4. Relevant Section Availability (25 points - reduced from 35 to make room for terrain)
  const relevantSectionTypes = RELEVANT_SECTIONS[cardType];
  const hasRelevantSections = iap.sections.some(s =>
    relevantSectionTypes.includes(s.type)
  );

  if (hasRelevantSections) {
    score += 25;
  } else if (iap.sections.length > 0) {
    // Has some sections, just not the most relevant ones
    score += 10;
  }

  // 5. Terrain Similarity (20 points max - for tactics cards only)
  if (cardType === "tactics" && terrain && iap.rawText) {
    const terrainScore = calculateTerrainSimilarity(terrain, iap.rawText);
    score += (terrainScore / 100) * 20; // Scale to 20 points max
  }

  return Math.round(score);
}

/**
 * Extract focused snippet from IAP section based on card type and focus
 * Returns 2-3 sentences containing relevant information
 */
function extractTacticalSnippet(
  section: IAPSection,
  cardType: CardType,
  iap: IAPData
): string {
  const content = section.content;
  const rawText = iap.rawText || content;

  // Define focus keywords based on card type
  let focusKeywords: string[] = [];

  if (cardType === "evacuation") {
    // Weather-focused: wind, humidity, rapid spread, weather-driven events
    focusKeywords = [
      'wind',
      'gust',
      'humidity',
      'weather',
      'rapid spread',
      'extreme fire behavior',
      'red flag',
      'wind shift',
      'wind-driven'
    ];
  } else if (cardType === "resources") {
    // Previous fires: outcomes, containment success/failure, resource effectiveness
    focusKeywords = [
      'contained',
      'containment',
      'escaped',
      'successful',
      'effective',
      'additional resources',
      'resource',
      'personnel',
      'equipment',
      'initial attack'
    ];
  } else if (cardType === "tactics") {
    // Terrain-focused: slopes, ridges, natural barriers, topography
    focusKeywords = [
      'terrain',
      'slope',
      'ridge',
      'topography',
      'uphill',
      'downhill',
      'canyon',
      'valley',
      'elevation',
      'natural barrier',
      'road',
      'highway'
    ];
  }

  // Find sentences with focus keywords
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  let relevantSentences = sentences.filter(s =>
    focusKeywords.some(keyword => s.toLowerCase().includes(keyword))
  );

  // If no matches in section, search tactical lessons
  if (relevantSentences.length === 0 && iap.tacticalLessons.length > 0) {
    relevantSentences = iap.tacticalLessons.filter(lesson =>
      focusKeywords.some(keyword => lesson.toLowerCase().includes(keyword))
    );
  }

  // If still no matches, search raw text
  if (relevantSentences.length === 0 && rawText) {
    const rawSentences = rawText.match(/[^.!?]+[.!?]+/g) || [];
    relevantSentences = rawSentences.filter(s =>
      focusKeywords.some(keyword => s.toLowerCase().includes(keyword))
    ).slice(0, 3);
  }

  if (relevantSentences.length > 0) {
    // Return first 2-3 relevant sentences
    const snippet = relevantSentences.slice(0, 2).join(' ').trim();
    return snippet.length > 300 ? snippet.substring(0, 297) + '...' : snippet;
  }

  // Fallback: return first 2 sentences from section
  const fallbackSnippet = sentences.slice(0, 2).join(' ').trim();
  return fallbackSnippet.length > 300 ? fallbackSnippet.substring(0, 297) + '...' : fallbackSnippet;
}

/**
 * Generate reasoning bullets explaining why this IAP is relevant
 */
function generateReasoning(
  incident: Incident,
  weather: Weather,
  iap: IAPData,
  score: number,
  cardType: CardType
): string[] {
  const reasoning: string[] = [];

  // Add focus-specific reasoning first
  if (cardType === "evacuation") {
    // Weather-focused reasoning
    if (iap.conditions.weather) {
      if (iap.conditions.weather.windSpeedMps !== undefined) {
        const windDiff = Math.abs(weather.windSpeedMps - iap.conditions.weather.windSpeedMps);
        if (windDiff <= 5) {
          reasoning.push(`Similar wind conditions: ${iap.conditions.weather.windSpeedMps.toFixed(1)} m/s affected containment`);
        }
      }
      if (iap.conditions.weather.humidityPct !== undefined && iap.conditions.weather.humidityPct < 25) {
        reasoning.push(`Low humidity (${iap.conditions.weather.humidityPct}%) drove rapid spread`);
      }
    }
  } else if (cardType === "resources") {
    // Previous fire outcomes reasoning
    if (iap.conditions.acres) {
      reasoning.push(`${iap.conditions.acres.toLocaleString()} acre fire - resource patterns applicable`);
    }
    if (iap.sections.some(s => s.type === "ICS-203" || s.type === "ICS-204")) {
      reasoning.push(`Documented resource assignments and effectiveness`);
    }
  } else if (cardType === "tactics") {
    // Terrain-focused reasoning
    if (iap.location.county) {
      reasoning.push(`Similar California terrain in ${iap.location.county} County`);
    }
    if (iap.sections.some(s => s.type === "ICS-204")) {
      reasoning.push(`Terrain-based tactical assignments documented`);
    }
    // Check for terrain similarity mentions
    if (iap.rawText) {
      const hasTerrainRefs = /steep|slope|ridge|terrain|uphill|downhill/i.test(iap.rawText);
      if (hasTerrainRefs) {
        reasoning.push(`IAP describes similar terrain features`);
      }
    }
  }

  // Fuel match (always relevant)
  if (iap.conditions.fuel === incident.fuelProxy) {
    reasoning.push(`Exact fuel type match: ${iap.conditions.fuel}`);
  } else if (iap.conditions.fuel && FUEL_COMPATIBILITY_MAP[incident.fuelProxy]?.includes(iap.conditions.fuel)) {
    reasoning.push(`Compatible fuel: ${iap.conditions.fuel}`);
  }

  // Ensure at least 2 reasoning items
  if (reasoning.length < 2) {
    reasoning.push(`Overall relevance: ${score}%`);
  }

  return reasoning.slice(0, 3); // Limit to 3 items
}

/**
 * Find relevant IAPs for current incident and generate insights
 * Returns up to 3 IAP insights, sorted by relevance score
 * Optional terrain parameter enhances scoring for tactics cards
 */
export function findRelevantIAPs(
  incident: Incident,
  weather: Weather,
  cardType: CardType,
  terrain?: TerrainMetrics
): IAPInsight[] {
  const iapData = loadIAPData();

  if (iapData.length === 0) {
    return [];
  }

  // Score all IAPs (pass terrain for enhanced tactics scoring)
  const scored = iapData.map(iap => ({
    iap,
    score: calculateIAPSimilarity(incident, weather, cardType, iap, terrain)
  }));

  // Filter by minimum score threshold (60) and sort by score descending
  const filtered = scored
    .filter(s => s.score >= 60)
    .sort((a, b) => b.score - a.score);

  // Generate insights for top 3 matches
  const insights: IAPInsight[] = [];

  for (const { iap, score } of filtered.slice(0, 3)) {
    // Find the most relevant section
    const relevantSectionTypes = RELEVANT_SECTIONS[cardType];
    const relevantSection = iap.sections.find(s =>
      relevantSectionTypes.includes(s.type)
    ) || iap.sections[0];

    if (!relevantSection) {
      continue;
    }

    const tacticalSnippet = extractTacticalSnippet(relevantSection, cardType, iap);
    const reasoning = generateReasoning(incident, weather, iap, score, cardType);

    insights.push({
      iapId: iap.id,
      iapName: iap.incidentName,
      relevanceScore: score,
      tacticalSnippet,
      sectionType: relevantSection.type,
      reasoning
    });
  }

  return insights;
}
