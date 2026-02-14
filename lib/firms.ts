import Papa from "papaparse";
import type { FirmsHotspot } from "./types";

/**
 * NASA FIRMS (Fire Information for Resource Management System)
 * Fetches near-real-time satellite fire hotspot detections.
 *
 * API docs: https://firms.modaps.eosdis.nasa.gov/api/area/
 */

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

// California bounding box
const CA_BBOX = "-124.5,32.5,-114.1,42.1";

// Supported VIIRS/MODIS NRT sources
export const FIRMS_SOURCES = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
] as const;

export type FirmsSource = (typeof FIRMS_SOURCES)[number];

// ===== In-memory cache with stale-while-revalidate =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const firmsCache: Record<string, CacheEntry<FirmsHotspot[]>> = {};
const inflightRequests = new Map<string, Promise<FirmsHotspot[]>>(); // Request deduplication
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (extended from 3 for better performance)
const STALE_WHILE_REVALIDATE_MS = 15 * 60 * 1000; // Serve stale data for up to 15 minutes

interface CacheResult {
  data: FirmsHotspot[] | null;
  isStale: boolean;
}

function getCached(key: string): CacheResult {
  const entry = firmsCache[key];
  if (!entry) return { data: null, isStale: false };

  const age = Date.now() - entry.timestamp;

  // If data is too old, remove and return null
  if (age > STALE_WHILE_REVALIDATE_MS) {
    delete firmsCache[key];
    return { data: null, isStale: false };
  }

  // Return data and indicate if it's stale (for background refresh)
  return {
    data: entry.data,
    isStale: age > CACHE_TTL_MS
  };
}

function setCache(key: string, data: FirmsHotspot[]): void {
  firmsCache[key] = { data, timestamp: Date.now() };
}

// ===== Parse CSV row into FirmsHotspot =====

function parseRow(row: Record<string, string>): FirmsHotspot | null {
  const lat = parseFloat(row.latitude);
  const lon = parseFloat(row.longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  return {
    latitude: lat,
    longitude: lon,
    brightness: parseFloat(row.bright_ti4 || row.brightness) || 0,
    scan: parseFloat(row.scan) || 0,
    track: parseFloat(row.track) || 0,
    acq_date: row.acq_date || "",
    acq_time: row.acq_time || "",
    satellite: row.satellite || "",
    instrument: row.instrument || "",
    confidence: row.confidence || "",
    version: row.version || "",
    bright_t31: parseFloat(row.bright_ti5 || row.bright_t31) || 0,
    frp: parseFloat(row.frp) || 0,
    daynight: row.daynight || "",
  };
}

// ===== Fetch hotspots from a single FIRMS source =====

async function fetchSingleSource(
  mapKey: string,
  source: string,
  bbox: string,
  days: number
): Promise<FirmsHotspot[]> {
  const cacheKey = `firms_${source}_${bbox}_${days}`;
  const cached = getCached(cacheKey);

  if (cached.data) {
    if (!cached.isStale) {
      console.log(`[FIRMS] Cache hit for ${source} (${cached.data.length} pts, fresh)`);
      return cached.data;
    } else {
      console.log(`[FIRMS] Cache hit for ${source} (${cached.data.length} pts, stale - serving while revalidating)`);
      // Return stale data immediately, refresh in background (fire-and-forget)
      // Only start background refresh if not already in flight
      if (!inflightRequests.has(cacheKey)) {
        const promise = fetchAndCache(mapKey, source, bbox, days, cacheKey)
          .catch((err) => {
            console.warn(`[FIRMS] Background refresh failed for ${source}:`, err.message);
            return []; // Return empty on error for background refresh
          })
          .finally(() => {
            inflightRequests.delete(cacheKey);
          });
        inflightRequests.set(cacheKey, promise);
      }
      return cached.data;
    }
  }

  // Check if there's already a request in flight for this key (request deduplication)
  const existingRequest = inflightRequests.get(cacheKey);
  if (existingRequest) {
    console.log(`[FIRMS] Request already in flight for ${source}, waiting...`);
    return existingRequest;
  }

  // No cache and no inflight request - fetch immediately
  const promise = fetchAndCache(mapKey, source, bbox, days, cacheKey)
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, promise);
  return promise;
}

// Separate function for actual fetching and caching
async function fetchAndCache(
  mapKey: string,
  source: string,
  bbox: string,
  days: number,
  cacheKey: string
): Promise<FirmsHotspot[]> {
  const url = `${FIRMS_BASE}/${mapKey}/${source}/${bbox}/${days}`;
  console.log(`[FIRMS] Fetching: ${url.substring(0, 100)}...`);

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `FIRMS API error ${res.status}: ${res.statusText} - ${text.substring(0, 200)}`
    );
  }

  const csv = await res.text();

  if (!csv.trim() || csv.trim().startsWith("<!DOCTYPE") || csv.trim().startsWith("<html")) {
    console.warn(`[FIRMS] ${source} returned non-CSV response, skipping`);
    return [];
  }

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // We parse manually for safety
  });

  if (parsed.errors.length > 0) {
    console.warn(`[FIRMS] CSV parse warnings for ${source}:`, parsed.errors.slice(0, 3));
  }

  const hotspots: FirmsHotspot[] = [];
  for (const row of parsed.data) {
    const hs = parseRow(row);
    if (hs) hotspots.push(hs);
  }

  console.log(`[FIRMS] ${source}: ${hotspots.length} hotspots parsed`);
  setCache(cacheKey, hotspots);

  return hotspots;
}

// ===== Public API =====

export interface FetchFirmsOptions {
  bbox?: string;
  days?: number;
  sources?: FirmsSource[];
}

/**
 * Fetch FIRMS hotspots for the given bounding box and time range.
 * Merges results from multiple satellite sources.
 */
export async function fetchFirmsHotspots(
  options?: FetchFirmsOptions
): Promise<FirmsHotspot[]> {
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    throw new Error("FIRMS_MAP_KEY not set in environment variables");
  }

  const bbox = options?.bbox || CA_BBOX;
  const days = Math.min(Math.max(options?.days || 1, 1), 10);
  const sources = options?.sources || ["VIIRS_SNPP_NRT"];

  // Fetch all sources in parallel
  const results = await Promise.allSettled(
    sources.map((src) => fetchSingleSource(mapKey, src, bbox, days))
  );

  const allHotspots: FirmsHotspot[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allHotspots.push(...result.value);
    } else {
      console.error("[FIRMS] Source fetch failed:", result.reason);
    }
  }

  // Sort by most recent detection first
  allHotspots.sort((a, b) => {
    const dateA = `${a.acq_date} ${a.acq_time}`;
    const dateB = `${b.acq_date} ${b.acq_time}`;
    return dateB.localeCompare(dateA);
  });

  console.log(`[FIRMS] Total hotspots across all sources: ${allHotspots.length}`);
  return allHotspots;
}
