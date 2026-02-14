import {
  Incident,
  Weather,
  SpreadEnvelope,
  Asset,
  Resources,
  ActionCard,
  Brief,
  RecommendationsResult,
  WindShift,
  Confidence,
} from "./types";
import { distanceKm, pointInPolygon, minDistToPolygon } from "./geo";
import { computeRiskScore } from "./risk";

const ASSET_BUFFER_KM = 1.0; // Buffer zone around assets

/**
 * Find assets at risk within envelope buffers.
 * Returns assets sorted by proximity (closest first).
 */
function findAssetsAtRisk(
  assets: Asset[],
  envelopes: SpreadEnvelope[]
): { asset: Asset; withinEnvelopeHour: number; distKm: number }[] {
  const results: { asset: Asset; withinEnvelopeHour: number; distKm: number }[] =
    [];

  for (const asset of assets) {
    for (const env of envelopes) {
      const inPolygon = pointInPolygon(
        asset.lat,
        asset.lon,
        env.polygon.coordinates
      );
      const dist = minDistToPolygon(
        asset.lat,
        asset.lon,
        env.polygon.coordinates
      );

      if (inPolygon || dist < ASSET_BUFFER_KM) {
        results.push({
          asset,
          withinEnvelopeHour: env.tHours,
          distKm: dist,
        });
        break; // count asset only once (earliest envelope)
      }
    }
  }

  return results.sort((a, b) => a.distKm - b.distKm);
}

/**
 * Estimate time to impact for the nearest asset.
 */
function estimateTimeToImpact(
  incident: Incident,
  asset: Asset,
  spreadRateKmH: number
): number {
  const dist = distanceKm(incident.lat, incident.lon, asset.lat, asset.lon);
  return Math.round((dist / spreadRateKmH) * 60); // minutes
}

/**
 * Generate the Evacuation action card.
 */
function generateEvacuationCard(
  incident: Incident,
  weather: Weather,
  assetsAtRisk: { asset: Asset; withinEnvelopeHour: number; distKm: number }[],
  spreadRateKmH: number,
  windShift?: WindShift
): ActionCard {
  const nearestAsset = assetsAtRisk[0];
  const timeToImpact = nearestAsset
    ? estimateTimeToImpact(incident, nearestAsset.asset, spreadRateKmH)
    : null;

  let confidence: Confidence = "medium";
  let title = "Monitor Communities — No Immediate Evacuation Needed";
  let timing = "Re-evaluate in 30 minutes";
  const why: string[] = [];
  const actions: string[] = [];

  if (nearestAsset) {
    const assetName = nearestAsset.asset.name;

    if (nearestAsset.withinEnvelopeHour <= 2) {
      confidence = "high";
      title = `Issue Evacuation Warning for ${assetName}`;
      timing = `Likely impact in ~${timeToImpact} minutes`;
    } else {
      confidence = "medium";
      title = `Prepare Evacuation Advisory for ${assetName}`;
      timing = `Potential impact in ~${timeToImpact} minutes`;
    }

    why.push(
      `${nearestAsset.withinEnvelopeHour}h envelope ${nearestAsset.distKm < ASSET_BUFFER_KM ? "intersects" : "approaches"} ${assetName}`
    );

    if (windShift?.enabled) {
      why.push(
        `Wind shift at +${windShift.atMinutes}m points spread toward ${assetName}`
      );
    }

    if (weather.humidityPct < 20) {
      why.push("Humidity < 20% increases spread risk");
    } else if (weather.humidityPct < 30) {
      why.push("Humidity < 30% moderately increases spread");
    }

    actions.push("Open evacuation warning template");
    actions.push("Notify law enforcement liaison");
    if (assetsAtRisk.length > 1) {
      actions.push(
        `Also monitor: ${assetsAtRisk
          .slice(1)
          .map((a) => a.asset.name)
          .join(", ")}`
      );
    }
  } else {
    why.push("No communities currently within 3h spread envelope + 1km buffer");
    why.push("Conditions may change with wind or humidity shifts");
    why.push("Continue monitoring asset proximity");
    actions.push("Set trigger alerts for asset intersection");
    actions.push("Pre-stage evacuation messaging");
  }

  return { type: "evacuation", title, timing, confidence, why, actions };
}

/**
 * Generate the Resources action card.
 */
function generateResourcesCard(
  incident: Incident,
  weather: Weather,
  resources: Resources,
  riskTotal: number,
  spreadRateKmH: number,
  envelopes: SpreadEnvelope[]
): ActionCard {
  const why: string[] = [];
  const actions: string[] = [];
  let confidence: Confidence = "medium";
  let title = "Current Resources Sufficient — Monitor Conditions";
  let timing = "Re-evaluate in 30 minutes";

  // Estimate flank length at 1h
  const flankLength1h = spreadRateKmH * 0.5; // km (half of spread length)
  const engineCoverage = resources.enginesAvailable * 0.3; // rough: 300m per engine

  const needsAirSupport =
    resources.airSupportAvailable &&
    (riskTotal > 50 || flankLength1h > engineCoverage);

  if (riskTotal > 60) {
    confidence = "high";
    title = "Request Additional Resources Immediately";
    timing = "Within next 30 minutes";
    why.push(
      `Escape risk score ${riskTotal}/100 — high due to wind + low humidity`
    );
  } else if (riskTotal > 40) {
    confidence = "high";
    title = "Request Air Support Within 1 Hour";
    timing = `Air ETA ~${resources.etaMinutesAir} minutes`;
    why.push(`Risk score ${riskTotal}/100 warrants additional support`);
  }

  if (flankLength1h > engineCoverage) {
    why.push(
      `1h flank length (~${flankLength1h.toFixed(1)}km) exceeds engine coverage (~${engineCoverage.toFixed(1)}km)`
    );
  }

  if (needsAirSupport) {
    why.push("Air attack historically reduces escape in similar conditions");
    actions.push("Request tanker/helicopter");
    actions.push(`Stage at nearest waypoint (ETA ~${resources.etaMinutesAir}m)`);
  }

  if (resources.enginesAvailable > 0) {
    actions.push(
      `Deploy ${resources.enginesAvailable} engines (ETA ~${resources.etaMinutesEngine}m)`
    );
  }

  if (resources.dozersAvailable > 0) {
    actions.push(`Assign ${resources.dozersAvailable} dozer(s) to line construction`);
  }

  // Ensure at least 3 why bullets
  if (why.length < 3) {
    why.push(
      `Engines ETA ${resources.etaMinutesEngine}m — verify staging positions`
    );
  }

  return { type: "resources", title, timing, confidence, why, actions };
}

/**
 * Generate the Tactics action card.
 */
function generateTacticsCard(
  incident: Incident,
  weather: Weather,
  resources: Resources,
  spreadRateKmH: number,
  windShift?: WindShift
): ActionCard {
  const spreadDir = (weather.windDirDeg + 180) % 360;
  const rightFlankDir = (spreadDir + 90) % 360;
  const leftFlankDir = (spreadDir - 90 + 360) % 360;

  const why: string[] = [];
  const actions: string[] = [];

  // Determine anchor strategy
  const title = `Anchor and Hold ${rightFlankDir < 180 ? "Right" : "Left"} Flank`;
  const timing = "Execute in next 30 minutes";
  const confidence: Confidence = "medium"; // always medium for tactics

  why.push(
    `Wind from ${weather.windDirDeg}° pushes head toward ${spreadDir}°; flank is containable`
  );

  if (resources.dozersAvailable > 0) {
    why.push("Dozer available — use for line reinforcement on anchor");
    actions.push(`Assign dozer to anchor segment`);
  } else {
    why.push("No dozers — rely on engine crews for hand line");
    actions.push("Deploy engine crews for hand line construction");
  }

  if (windShift?.enabled) {
    why.push(
      `Set trigger points: wind direction change > 30° at +${windShift.atMinutes}m`
    );
    actions.push("Set trigger points for wind shift");
  } else {
    why.push("Monitor for unexpected wind changes — set safety zones");
    actions.push("Establish lookout and safety zones");
  }

  actions.push("Maintain escape routes for all personnel");

  return { type: "tactics", title, timing, confidence, why, actions };
}

/**
 * Generate all 3 action cards + brief + risk score.
 */
export function generateRecommendations(
  incident: Incident,
  weather: Weather,
  envelopes: SpreadEnvelope[],
  assets: Asset[],
  resources: Resources,
  spreadRateKmH: number,
  windShift?: WindShift
): RecommendationsResult {
  // Find assets at risk
  const assetsAtRisk = findAssetsAtRisk(assets, envelopes);

  // Compute time to nearest asset
  const nearestAsset = assetsAtRisk[0];
  const timeToImpactMin = nearestAsset
    ? estimateTimeToImpact(incident, nearestAsset.asset, spreadRateKmH)
    : null;

  // Compute risk score
  const riskScore = computeRiskScore(weather, timeToImpactMin);

  // Generate cards
  const evacuationCard = generateEvacuationCard(
    incident,
    weather,
    assetsAtRisk,
    spreadRateKmH,
    windShift
  );

  const resourcesCard = generateResourcesCard(
    incident,
    weather,
    resources,
    riskScore.total,
    spreadRateKmH,
    envelopes
  );

  const tacticsCard = generateTacticsCard(
    incident,
    weather,
    resources,
    spreadRateKmH,
    windShift
  );

  const cards = [evacuationCard, resourcesCard, tacticsCard];

  // Build brief
  const keyTriggers: string[] = [];
  if (windShift?.enabled) {
    keyTriggers.push(`Wind direction change > 30° at +${windShift.atMinutes}m`);
  }
  if (weather.humidityPct < 20) {
    keyTriggers.push("Humidity < 20%");
  }
  if (assetsAtRisk.length > 0) {
    keyTriggers.push("Envelope intersects asset buffer");
  }
  keyTriggers.push("Spread rate exceeds 1.0 km/h");

  const assetNames = assetsAtRisk.map((a) => a.asset.name).join(", ");
  const brief: Brief = {
    oneLiner: assetsAtRisk.length > 0
      ? `${weather.windSpeedMps > 8 ? "Strong wind" : "Wind"} + ${weather.humidityPct < 20 ? "very low" : "low"} humidity raises escape risk; protect ${assetNames} within 0–3h window.`
      : `Active fire with ${weather.windSpeedMps.toFixed(1)} m/s wind. Monitor spread and maintain containment posture.`,
    keyTriggers,
  };

  return { cards, brief, riskScore };
}
