import { NwsForecastPeriod, NwsAlert, NwsEnrichment } from "./types";

export const NWS_USER_AGENT =
  process.env.NWS_USER_AGENT ??
  "(Flashpoint, treehacks-demo@stanford.edu)";

// ===== In-memory cache =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const nwsCache: Record<string, CacheEntry<unknown>> = {};
const NWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = nwsCache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > NWS_CACHE_TTL_MS) {
    delete nwsCache[key];
    return null;
  }
  return entry.data as T;
}

function setNwsCache<T>(key: string, data: T): void {
  nwsCache[key] = { data, timestamp: Date.now() };
}

// ===== Core NWS fetch helper =====

async function nwsFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": NWS_USER_AGENT,
      Accept:
        "application/geo+json,application/ld+json;q=0.9,application/json;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`NWS ${res.status} ${url}`);
  }

  return res.json() as Promise<T>;
}

// ===== NWS Points API =====

interface NwsPointProperties {
  forecast: string;
  forecastHourly: string;
  forecastZone: string;
  county: string;
  cwa: string;
  gridId: string;
  gridX: number;
  gridY: number;
}

export async function getNwsPoint(
  lat: number,
  lon: number
): Promise<NwsPointProperties | null> {
  // Round to 4 decimal places for cache key (NWS resolution)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;

  const cacheKey = `nws_point_${roundedLat}_${roundedLon}`;
  const cached = getCached<NwsPointProperties>(cacheKey);
  if (cached) return cached;

  try {
    const data = await nwsFetch<{ properties: NwsPointProperties }>(
      `https://api.weather.gov/points/${roundedLat},${roundedLon}`
    );
    const props = data.properties;
    setNwsCache(cacheKey, props);
    return props;
  } catch (err) {
    console.error(`[NWS] Failed to get point data for ${lat},${lon}:`, err);
    return null;
  }
}

// ===== NWS Forecast =====

export async function getNwsForecast(
  forecastUrl: string
): Promise<NwsForecastPeriod[]> {
  const cacheKey = `nws_forecast_${forecastUrl}`;
  const cached = getCached<NwsForecastPeriod[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await nwsFetch<{
      properties: { periods: NwsForecastPeriod[] };
    }>(forecastUrl);
    const periods = data.properties.periods || [];
    setNwsCache(cacheKey, periods);
    return periods;
  } catch (err) {
    console.error(`[NWS] Failed to get forecast:`, err);
    return [];
  }
}

// ===== NWS Alerts by Point =====

export async function getNwsAlertsByPoint(
  lat: number,
  lon: number
): Promise<NwsAlert[]> {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;

  const cacheKey = `nws_alerts_${roundedLat}_${roundedLon}`;
  const cached = getCached<NwsAlert[]>(cacheKey);
  if (cached) return cached;

  try {
    // Get the forecast zone from points API
    const point = await getNwsPoint(lat, lon);
    if (!point?.forecastZone) return [];

    const zoneId = point.forecastZone.split("/").pop();
    const data = await nwsFetch<{
      features: Array<{ properties: NwsAlert }>;
    }>(`https://api.weather.gov/alerts/active?zone=${zoneId}`);

    const alerts: NwsAlert[] = (data.features || []).map((f) => ({
      id: f.properties.id || "",
      event: f.properties.event || "",
      headline: f.properties.headline || "",
      severity: f.properties.severity || "",
      urgency: f.properties.urgency || "",
      onset: f.properties.onset || "",
      expires: f.properties.expires || "",
      description: f.properties.description || "",
      instruction: f.properties.instruction,
      senderName: f.properties.senderName || "",
    }));

    setNwsCache(cacheKey, alerts);
    return alerts;
  } catch (err) {
    console.error(`[NWS] Failed to get alerts for ${lat},${lon}:`, err);
    return [];
  }
}

// ===== Full NWS enrichment for a single incident =====

/**
 * Get complete NWS enrichment (forecast + alerts) for a lat/lon.
 * Returns null if NWS data is unavailable (e.g., non-US location).
 */
export async function getNwsEnrichment(
  lat: number,
  lon: number
): Promise<NwsEnrichment | null> {
  const cacheKey = `nws_enrichment_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;
  const cached = getCached<NwsEnrichment>(cacheKey);
  if (cached) return cached;

  try {
    // Get point metadata
    const point = await getNwsPoint(lat, lon);
    if (!point) return null;

    // Fetch forecast and alerts in parallel
    const [forecastPeriods, alerts] = await Promise.all([
      getNwsForecast(point.forecast),
      getNwsAlertsByPoint(lat, lon),
    ]);

    // Build summary from next 3 forecast periods (roughly next 3 hours to 36 hours)
    const next3 = forecastPeriods.slice(0, 3);
    const forecastSummary = next3
      .map(
        (p) =>
          `${p.name}: ${p.shortForecast}, ${p.temperature}°${p.temperatureUnit}, wind ${p.windSpeed} ${p.windDirection}`
      )
      .join(" | ");

    // Check for key alert types
    const alertEvents = alerts.map((a) => a.event.toLowerCase());
    const hasRedFlagWarning = alertEvents.some(
      (e) => e.includes("red flag") || e.includes("fire weather")
    );
    const hasWindAdvisory = alertEvents.some(
      (e) =>
        e.includes("wind advisory") ||
        e.includes("high wind") ||
        e.includes("extreme wind")
    );

    const enrichment: NwsEnrichment = {
      forecastPeriods: next3,
      alerts,
      forecastSummary,
      hasRedFlagWarning,
      hasWindAdvisory,
    };

    setNwsCache(cacheKey, enrichment);
    return enrichment;
  } catch (err) {
    console.error(`[NWS] Enrichment failed for ${lat},${lon}:`, err);
    return null;
  }
}
