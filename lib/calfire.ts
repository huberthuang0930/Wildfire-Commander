import { CalFireRawIncident, Incident } from "./types";

const CALFIRE_API_BASE =
  "https://incidents.fire.ca.gov/umbraco/api/IncidentApi";

// ===== In-memory cache =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<unknown>> = {};
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete cache[key];
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// ===== Fetch raw incidents from CAL FIRE =====

export async function fetchCalFireIncidents(options?: {
  year?: number;
  inactive?: boolean;
}): Promise<CalFireRawIncident[]> {
  const inactive = options?.inactive ?? true; // default true to include all recent incidents
  const year = options?.year;

  const cacheKey = `calfire_incidents_${year ?? "current"}_${inactive}`;
  const cached = getCached<CalFireRawIncident[]>(cacheKey);
  if (cached) {
    console.log("[CAL FIRE] Returning cached incidents");
    return cached;
  }

  const params = new URLSearchParams();
  params.set("inactive", String(inactive));
  if (year) params.set("year", String(year));

  const url = `${CALFIRE_API_BASE}/List?${params.toString()}`;

  console.log("[CAL FIRE] Fetching:", url);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`CAL FIRE API error: ${res.status} ${res.statusText}`);
  }

  const raw: CalFireRawIncident[] = await res.json();
  setCache(cacheKey, raw);

  return raw;
}

// ===== Fetch GeoJSON from CAL FIRE =====

export async function fetchCalFireGeoJSON(options?: {
  year?: number;
  inactive?: boolean;
}): Promise<GeoJSON.FeatureCollection> {
  const incidents = await fetchCalFireIncidents(options);

  // Convert to GeoJSON FeatureCollection
  const features: GeoJSON.Feature[] = incidents
    .filter((inc) => inc.Latitude && inc.Longitude)
    .map((inc) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [inc.Longitude, inc.Latitude],
      },
      properties: {
        id: inc.UniqueId,
        name: inc.Name,
        acres: inc.AcresBurned,
        containment: inc.PercentContained,
        county: inc.County,
        isActive: inc.IsActive,
        updated: inc.Updated,
        url: inc.Url,
      },
    }));

  return {
    type: "FeatureCollection",
    features,
  };
}

// ===== Normalize CAL FIRE incident into our Incident interface =====

/**
 * Infer a rough fuel type based on county/location in California.
 * This is a simplification — real fuel models use LANDFIRE data.
 */
function inferFuelProxy(
  county: string,
  _location: string
): Incident["fuelProxy"] {
  const lowCounty = county.toLowerCase();

  // Southern CA chaparral-heavy counties
  if (
    ["los angeles", "ventura", "santa barbara", "san diego", "orange", "riverside", "san bernardino"].some(
      (c) => lowCounty.includes(c)
    )
  ) {
    return "chaparral";
  }

  // Central valley / Sacramento — grass
  if (
    ["sacramento", "san joaquin", "stanislaus", "merced", "fresno", "kern", "tulare", "kings", "madera"].some(
      (c) => lowCounty.includes(c)
    )
  ) {
    return "grass";
  }

  // Northern CA — mixed
  return "mixed";
}

/**
 * Estimate a rough perimeter radius from acres burned.
 * Assumes roughly circular fire: radius = sqrt(acres * 4046.86 / PI)
 */
function acresToRadiusMeters(acres: number | null): number {
  if (!acres || acres <= 0) return 100; // default 100m
  const areaM2 = acres * 4046.86; // 1 acre = 4046.86 m²
  return Math.round(Math.sqrt(areaM2 / Math.PI));
}

/**
 * Normalize a CAL FIRE raw incident into our app's Incident interface.
 */
export function normalizeCalFireIncident(
  raw: CalFireRawIncident
): Incident | null {
  if (!raw.Latitude || !raw.Longitude) return null;

  return {
    id: `calfire_${raw.UniqueId}`,
    name: raw.Name || "Unknown Fire",
    lat: raw.Latitude,
    lon: raw.Longitude,
    startTimeISO: raw.Started
      ? new Date(raw.Started).toISOString()
      : new Date().toISOString(),
    perimeter: {
      type: "Point",
      radiusMeters: acresToRadiusMeters(raw.AcresBurned),
    },
    fuelProxy: inferFuelProxy(raw.County || "", raw.Location || ""),
    notes: [
      raw.Location,
      raw.AcresBurned ? `${raw.AcresBurned.toLocaleString()} acres` : null,
      raw.PercentContained != null
        ? `${raw.PercentContained}% contained`
        : null,
      raw.County ? `${raw.County} County` : null,
    ]
      .filter(Boolean)
      .join(" • "),
  };
}

/**
 * Fetch and normalize CAL FIRE incidents.
 * By default fetches current year + previous year and merges/dedupes,
 * so we always have a meaningful list of recent fires.
 */
export async function getCalFireIncidents(options?: {
  year?: number;
  inactive?: boolean;
}): Promise<
  {
    incident: Incident;
    raw: CalFireRawIncident;
  }[]
> {
  let rawIncidents: CalFireRawIncident[];

  if (options?.year) {
    // Specific year requested
    rawIncidents = await fetchCalFireIncidents(options);
  } else {
    // Fetch current year + previous year for a richer list
    const currentYear = new Date().getFullYear();
    const [currentYearData, prevYearData] = await Promise.all([
      fetchCalFireIncidents({ inactive: options?.inactive ?? true }),
      fetchCalFireIncidents({ inactive: true, year: currentYear - 1 }),
    ]);

    // Merge and dedupe by UniqueId
    const seen = new Set<string>();
    rawIncidents = [];
    for (const inc of [...currentYearData, ...prevYearData]) {
      if (!seen.has(inc.UniqueId)) {
        seen.add(inc.UniqueId);
        rawIncidents.push(inc);
      }
    }
  }

  return rawIncidents
    .map((raw) => {
      const incident = normalizeCalFireIncident(raw);
      if (!incident) return null;
      return { incident, raw };
    })
    .filter(
      (item): item is { incident: Incident; raw: CalFireRawIncident } =>
        item !== null
    )
    .sort(
      (a, b) =>
        new Date(b.raw.Updated).getTime() - new Date(a.raw.Updated).getTime()
    );
}
