import { Weather } from "./types";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Fetch current weather from Open-Meteo API.
 * Returns normalized Weather object.
 * No API key required.
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: [
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "temperature_2m",
      "relative_humidity_2m",
    ].join(","),
    wind_speed_unit: "ms",
  });

  const url = `${OPEN_METEO_BASE}?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      throw new Error(`Open-Meteo API error: ${res.status}`);
    }

    const data = await res.json();
    const current = data.current;

    return {
      windSpeedMps: current.wind_speed_10m ?? 5,
      windGustMps: current.wind_gusts_10m ?? 8,
      windDirDeg: current.wind_direction_10m ?? 245,
      temperatureC: current.temperature_2m ?? 25,
      humidityPct: current.relative_humidity_2m ?? 30,
    };
  } catch (error) {
    console.error("Failed to fetch weather, using fallback:", error);
    // Fallback weather for demo reliability
    return {
      windSpeedMps: 8.2,
      windGustMps: 12.7,
      windDirDeg: 245,
      temperatureC: 29,
      humidityPct: 18,
    };
  }
}
