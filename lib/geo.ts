/**
 * Geospatial utility functions for fire spread calculations.
 * Uses simple spherical geometry — no heavy GIS library needed.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Compute a destination point given a start point, bearing, and distance.
 * Uses the Haversine formula for great-circle navigation.
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): [number, number] {
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const bearing = toRad(bearingDeg);
  const angularDist = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [toDeg(lat2), toDeg(lon2)];
}

/**
 * Generate points along an arc from startAngle to endAngle (degrees),
 * centered at (lat, lon) with the given radius in km.
 * Returns an array of [lon, lat] (GeoJSON order).
 */
export function pointsOnArc(
  lat: number,
  lon: number,
  radiusKm: number,
  startAngleDeg: number,
  endAngleDeg: number,
  numPoints: number = 24
): number[][] {
  const points: number[][] = [];
  const step = (endAngleDeg - startAngleDeg) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngleDeg + step * i;
    const [pLat, pLon] = destinationPoint(lat, lon, angle, radiusKm);
    points.push([pLon, pLat]); // GeoJSON: [lon, lat]
  }

  return points;
}

/**
 * Build a wind-driven cone polygon around an incident origin.
 *
 * The cone is an elongated shape pointing in the wind direction:
 *   - Head (downwind): extends `length` km
 *   - Flanks: extend `width/2` km perpendicular to wind
 *   - Rear (upwind): extends `length * 0.15` km (backing fire)
 *
 * @param lat      Origin latitude
 * @param lon      Origin longitude
 * @param windDirDeg  Wind direction (where wind comes FROM, meteorological)
 * @param lengthKm    Downwind spread distance
 * @param widthKm     Cross-wind spread distance
 * @returns GeoJSON Polygon coordinates array
 */
export function buildConePolygon(
  lat: number,
  lon: number,
  windDirDeg: number,
  lengthKm: number,
  widthKm: number
): number[][][] {
  // Fire spreads in the direction the wind is blowing TO
  const spreadDirDeg = (windDirDeg + 180) % 360;
  const halfWidth = widthKm / 2;
  const backingDist = lengthKm * 0.15; // small backing fire component

  // Head point (downwind)
  const [headLat, headLon] = destinationPoint(lat, lon, spreadDirDeg, lengthKm);

  // Rear point (upwind, backing fire)
  const rearDirDeg = windDirDeg; // opposite of spread
  const [rearLat, rearLon] = destinationPoint(lat, lon, rearDirDeg, backingDist);

  // Generate flanking arc (wide part of the cone, around the midpoint area)
  const leftFlankDeg = (spreadDirDeg - 90 + 360) % 360;
  const rightFlankDeg = (spreadDirDeg + 90) % 360;

  // Build polygon: rear -> left flank arc -> head -> right flank arc -> rear
  const points: number[][] = [];

  // Start at rear
  points.push([rearLon, rearLat]);

  // Left flank: arc from rear-left to head-left
  const leftArc = pointsOnArc(
    lat,
    lon,
    halfWidth * 0.6,
    (rearDirDeg + 360) % 360,
    leftFlankDeg,
    6
  );
  points.push(...leftArc);

  // Mid-left flank point
  const [mlLat, mlLon] = destinationPoint(lat, lon, leftFlankDeg, halfWidth);
  points.push([mlLon, mlLat]);

  // Head-left
  const [hlLat, hlLon] = destinationPoint(
    headLat,
    headLon,
    leftFlankDeg,
    halfWidth * 0.3
  );
  points.push([hlLon, hlLat]);

  // Head
  points.push([headLon, headLat]);

  // Head-right
  const [hrLat, hrLon] = destinationPoint(
    headLat,
    headLon,
    rightFlankDeg,
    halfWidth * 0.3
  );
  points.push([hrLon, hrLat]);

  // Mid-right flank point
  const [mrLat, mrLon] = destinationPoint(lat, lon, rightFlankDeg, halfWidth);
  points.push([mrLon, mrLat]);

  // Right flank arc back to rear
  const rightArc = pointsOnArc(
    lat,
    lon,
    halfWidth * 0.6,
    rightFlankDeg,
    (rearDirDeg + 360) % 360,
    6
  );
  points.push(...rightArc);

  // Close the polygon
  points.push([rearLon, rearLat]);

  return [points];
}

/**
 * Compute distance between two points in km (Haversine).
 */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Check if a point is inside a GeoJSON polygon (simple ray-casting).
 */
export function pointInPolygon(
  lat: number,
  lon: number,
  polygon: number[][][]
): boolean {
  const ring = polygon[0]; // outer ring
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1]; // lat
    const yi = ring[i][0]; // lon
    const xj = ring[j][1];
    const yj = ring[j][0];

    const intersect =
      yi > lon !== yj > lon &&
      lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Find the minimum distance from a point to any vertex of a polygon (approximate).
 */
export function minDistToPolygon(
  lat: number,
  lon: number,
  polygon: number[][][]
): number {
  const ring = polygon[0];
  let minDist = Infinity;

  for (const vertex of ring) {
    const d = distanceKm(lat, lon, vertex[1], vertex[0]);
    if (d < minDist) minDist = d;
  }

  return minDist;
}
