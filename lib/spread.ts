import { Incident, Weather, WindShift, SpreadEnvelope, SpreadResult } from "./types";
import { buildConePolygon } from "./geo";

/**
 * Compute the fire spread rate in km/h.
 *
 * Formula (toy but explainable):
 *   baseRate = 0.6 km/h
 *   windFactor = 1 + windSpeedMps / 10
 *   humidityFactor = humidity < 20% ? 1.4 : humidity < 30% ? 1.2 : 1.0
 *   fuelFactor = depends on fuel type
 *   rate = baseRate * windFactor * humidityFactor * fuelFactor
 */
export function computeSpreadRate(
  weather: Weather,
  fuelProxy: string = "mixed"
): { rate: number; windFactor: number; humidityFactor: number; fuelFactor: number } {
  const baseRate = 0.6; // km/h

  const windFactor = 1 + weather.windSpeedMps / 10;

  let humidityFactor: number;
  if (weather.humidityPct < 20) {
    humidityFactor = 1.4;
  } else if (weather.humidityPct < 30) {
    humidityFactor = 1.2;
  } else {
    humidityFactor = 1.0;
  }

  let fuelFactor: number;
  switch (fuelProxy) {
    case "grass":
      fuelFactor = 1.3; // fast-moving
      break;
    case "chaparral":
      fuelFactor = 1.2; // intense
      break;
    case "brush":
      fuelFactor = 1.1;
      break;
    case "mixed":
    default:
      fuelFactor = 1.0;
      break;
  }

  const rate = baseRate * windFactor * humidityFactor * fuelFactor;

  return { rate, windFactor, humidityFactor, fuelFactor };
}

/**
 * Compute spread envelopes at 1h, 2h, 3h horizons.
 *
 * If windShift is enabled, the envelope after the shift time uses the new direction.
 */
export function computeSpreadEnvelopes(
  incident: Incident,
  weather: Weather,
  horizonHours: number = 3,
  windShift?: WindShift
): SpreadResult {
  const { rate, windFactor, humidityFactor, fuelFactor } = computeSpreadRate(
    weather,
    incident.fuelProxy
  );

  const envelopes: SpreadEnvelope[] = [];
  const notes: string[] = [];

  notes.push(`Base rate: 0.6 km/h`);
  notes.push(`Wind factor: ${windFactor.toFixed(2)} (${weather.windSpeedMps} m/s)`);
  notes.push(`Humidity factor: ${humidityFactor.toFixed(1)} (${weather.humidityPct}%)`);
  if (fuelFactor !== 1.0) {
    notes.push(`Fuel factor: ${fuelFactor.toFixed(1)} (${incident.fuelProxy})`);
  }
  notes.push(`Effective spread rate: ${rate.toFixed(2)} km/h`);

  for (let t = 1; t <= horizonHours; t++) {
    let windDir = weather.windDirDeg;

    // Handle wind shift: if shift happens before this time horizon
    if (windShift?.enabled && windShift.atMinutes < t * 60) {
      // Blend: fraction of time under new wind
      const shiftFraction =
        (t * 60 - windShift.atMinutes) / (t * 60);
      // Simple: use new direction for the shifted portion
      windDir = windShift.newDirDeg;

      if (t === Math.ceil(windShift.atMinutes / 60)) {
        // ASCII-only to avoid any Windows encoding/mojibake issues in logs/UI
        notes.push(
          `Wind shift at +${windShift.atMinutes}m: ${weather.windDirDeg} deg -> ${windShift.newDirDeg} deg`
        );
      }
    }

    const length = rate * t; // km downwind
    const width = 0.5 * length; // km cross-wind

    const polygon = buildConePolygon(
      incident.lat,
      incident.lon,
      windDir,
      length,
      width
    );

    envelopes.push({
      tHours: t,
      polygon: {
        type: "Polygon",
        coordinates: polygon,
      },
    });
  }

  if (windShift?.enabled) {
    notes.push(`Direction follows wind, shifts at +${windShift.atMinutes}m`);
  }
  notes.push("Rate increases with low humidity");

  return {
    envelopes,
    explain: {
      model: "wind-cone-v1",
      rateKmH: rate,
      windFactor,
      humidityFactor,
      notes,
    },
  };
}
