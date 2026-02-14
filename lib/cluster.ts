import type { FirmsHotspot, FireCluster, Incident, EnrichedIncident, Resources, Asset } from "./types";

/**
 * DBSCAN-style clustering of FIRMS hotspots into fire events.
 * Groups nearby detections (~1km) into clusters that look like "incidents."
 */

// Haversine distance in meters between two lat/lon points
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Parse FIRMS date/time strings into a Date object
function parseFirmsDateTime(acq_date: string, acq_time: string): Date {
  // acq_date: "2026-02-14", acq_time: "0642" (HHMM)
  const hh = acq_time.padStart(4, "0").substring(0, 2);
  const mm = acq_time.padStart(4, "0").substring(2, 4);
  return new Date(`${acq_date}T${hh}:${mm}:00Z`);
}

// ===== DBSCAN Clustering =====

const EPS_METERS = 1500; // 1.5km radius — hotspots within this distance are same fire
const MIN_POINTS = 1; // Even a single detection counts as a cluster

interface ClusterAssignment {
  clusterId: number;
  hotspot: FirmsHotspot;
}

/**
 * Simple DBSCAN implementation for geographic points.
 * Returns cluster assignments for each hotspot.
 */
function dbscan(hotspots: FirmsHotspot[], eps: number, minPts: number): ClusterAssignment[] {
  const n = hotspots.length;
  const labels = new Int32Array(n).fill(-1); // -1 = unvisited
  let clusterId = 0;

  // Precompute: find neighbors for each point
  function regionQuery(idx: number): number[] {
    const neighbors: number[] = [];
    const p = hotspots[idx];
    for (let j = 0; j < n; j++) {
      if (j === idx) continue;
      const dist = haversineMeters(
        p.latitude,
        p.longitude,
        hotspots[j].latitude,
        hotspots[j].longitude
      );
      if (dist <= eps) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue; // Already assigned

    const neighbors = regionQuery(i);

    if (neighbors.length + 1 < minPts) {
      labels[i] = -2; // Noise
      continue;
    }

    // Start a new cluster
    labels[i] = clusterId;
    const queue = [...neighbors];
    const visited = new Set<number>([i]);

    while (queue.length > 0) {
      const j = queue.shift()!;
      if (visited.has(j)) continue;
      visited.add(j);

      if (labels[j] === -2) {
        labels[j] = clusterId; // Was noise, now border point
      }

      if (labels[j] !== -1) continue; // Already in a cluster
      labels[j] = clusterId;

      const jNeighbors = regionQuery(j);
      if (jNeighbors.length + 1 >= minPts) {
        queue.push(...jNeighbors);
      }
    }

    clusterId++;
  }

  // Assign noise points as their own single-point clusters
  for (let i = 0; i < n; i++) {
    if (labels[i] === -2) {
      labels[i] = clusterId++;
    }
  }

  return hotspots.map((hs, i) => ({
    clusterId: labels[i],
    hotspot: hs,
  }));
}

// ===== Build FireCluster from grouped hotspots =====

function buildCluster(id: string, hotspots: FirmsHotspot[]): FireCluster {
  let sumLat = 0;
  let sumLon = 0;
  let maxFrp = 0;
  let maxBrightness = 0;
  let totalFrp = 0;
  let latestDate = new Date(0);

  for (const hs of hotspots) {
    sumLat += hs.latitude;
    sumLon += hs.longitude;
    if (hs.frp > maxFrp) maxFrp = hs.frp;
    if (hs.brightness > maxBrightness) maxBrightness = hs.brightness;
    totalFrp += hs.frp;
    const dt = parseFirmsDateTime(hs.acq_date, hs.acq_time);
    if (dt > latestDate) latestDate = dt;
  }

  const centroidLat = sumLat / hotspots.length;
  const centroidLon = sumLon / hotspots.length;

  // Compute rough radius: max distance from centroid to any point
  let maxDist = 100; // minimum 100m
  for (const hs of hotspots) {
    const dist = haversineMeters(centroidLat, centroidLon, hs.latitude, hs.longitude);
    if (dist > maxDist) maxDist = dist;
  }

  return {
    id,
    centroidLat,
    centroidLon,
    pointCount: hotspots.length,
    maxFrp,
    maxBrightness,
    totalFrp,
    lastSeen: latestDate.toISOString(),
    radiusMeters: Math.round(maxDist + 375), // Add satellite pixel half-width (~375m for VIIRS)
    hotspots,
  };
}

// ===== Public API =====

/**
 * Cluster FIRMS hotspots into fire events using DBSCAN.
 */
export function clusterHotspots(
  hotspots: FirmsHotspot[],
  options?: { eps?: number; minPts?: number }
): FireCluster[] {
  if (hotspots.length === 0) return [];

  const eps = options?.eps ?? EPS_METERS;
  const minPts = options?.minPts ?? MIN_POINTS;

  const assignments = dbscan(hotspots, eps, minPts);

  // Group by cluster ID
  const groups = new Map<number, FirmsHotspot[]>();
  for (const { clusterId, hotspot } of assignments) {
    if (!groups.has(clusterId)) groups.set(clusterId, []);
    groups.get(clusterId)!.push(hotspot);
  }

  // Build cluster objects
  const clusters: FireCluster[] = [];
  let idx = 0;
  for (const [, groupHotspots] of groups) {
    clusters.push(buildCluster(`firms_cluster_${idx}`, groupHotspots));
    idx++;
  }

  // Sort by total FRP descending (most intense fires first)
  clusters.sort((a, b) => b.totalFrp - a.totalFrp);

  console.log(
    `[Cluster] ${hotspots.length} hotspots -> ${clusters.length} clusters`
  );

  return clusters;
}

// ===== Convert cluster to Incident shape =====

function inferFuelProxy(lat: number, lon: number): Incident["fuelProxy"] {
  if (lat < 35.5) return "chaparral";
  if (lat < 38 && lon > -121) return "grass";
  return "mixed";
}

/**
 * Generate a human-readable name for a FIRMS cluster.
 * Uses a combination of the dominant satellite + cluster index.
 */
function generateClusterName(cluster: FireCluster, index: number): string {
  // Count satellites
  const satCounts = new Map<string, number>();
  for (const hs of cluster.hotspots) {
    const sat = hs.satellite || "Unknown";
    satCounts.set(sat, (satCounts.get(sat) || 0) + 1);
  }
  const dominantSat = [...satCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Satellite";

  const latDir = cluster.centroidLat >= 0 ? "N" : "S";
  const lonDir = cluster.centroidLon >= 0 ? "E" : "W";

  return `${dominantSat} Detection ${index + 1} (${Math.abs(cluster.centroidLat).toFixed(2)}${latDir}, ${Math.abs(cluster.centroidLon).toFixed(2)}${lonDir})`;
}

/**
 * Convert a FireCluster into an EnrichedIncident.
 */
export function clusterToEnrichedIncident(
  cluster: FireCluster,
  index: number
): EnrichedIncident {
  const satellites = [...new Set(cluster.hotspots.map((h) => h.satellite).filter(Boolean))];

  const incident: Incident = {
    id: cluster.id,
    name: generateClusterName(cluster, index),
    lat: cluster.centroidLat,
    lon: cluster.centroidLon,
    startTimeISO: cluster.lastSeen,
    perimeter: {
      type: "Point",
      radiusMeters: cluster.radiusMeters,
    },
    fuelProxy: inferFuelProxy(cluster.centroidLat, cluster.centroidLon),
    notes: [
      `${cluster.pointCount} satellite detections`,
      `Max FRP: ${cluster.maxFrp.toFixed(1)} MW`,
      `Last seen: ${new Date(cluster.lastSeen).toLocaleString()}`,
      satellites.length > 0 ? `Satellites: ${satellites.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" • "),
  };

  const DEFAULT_FIRMS_RESOURCES: Resources = {
    enginesAvailable: 2,
    dozersAvailable: 0,
    airSupportAvailable: false,
    etaMinutesEngine: 25,
    etaMinutesAir: 60,
  };

  return {
    incident,
    source: "firms",
    calfire: null,
    perimeter: null,
    firms: {
      pointCount: cluster.pointCount,
      maxFrp: cluster.maxFrp,
      totalFrp: cluster.totalFrp,
      lastSeen: cluster.lastSeen,
      satellites,
    },
    nws: null,
    resources: DEFAULT_FIRMS_RESOURCES,
    assets: [] as Asset[],
  };
}
