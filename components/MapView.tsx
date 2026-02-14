"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Incident, SpreadEnvelope, Asset } from "@/lib/types";

// Envelope colors: 1h=yellow, 2h=orange, 3h=red
const ENVELOPE_COLORS: Record<number, [number, number, number, number]> = {
  1: [255, 235, 59, 80],   // yellow, semi-transparent
  2: [255, 152, 0, 100],   // orange
  3: [244, 67, 54, 120],   // red
};

const ENVELOPE_LINE_COLORS: Record<number, [number, number, number]> = {
  1: [255, 235, 59],
  2: [255, 152, 0],
  3: [244, 67, 54],
};

const PRIORITY_COLORS: Record<string, [number, number, number]> = {
  high: [244, 67, 54],
  medium: [255, 152, 0],
  low: [76, 175, 80],
};

interface PerimeterPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface HotspotPoint {
  lat: number;
  lon: number;
  frp: number;
}

interface MapViewProps {
  incident: Incident | null;
  envelopes: SpreadEnvelope[];
  assets: Asset[];
  /** ArcGIS fire perimeter polygon (live mode) */
  perimeterPolygon?: PerimeterPolygon | null;
  /** NASA FIRMS raw hotspot points for heat-like layer (live mode) */
  firmsHotspots?: HotspotPoint[];
}

export default function MapView({ incident, envelopes, assets, perimeterPolygon, firmsHotspots }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const animationRef = useRef<number>(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    console.log("[MapView] Token available:", !!token, "Length:", token?.length);
    
    if (!token || token === "your_mapbox_token_here") {
      setMapError("Mapbox token not set. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local");
      return;
    }

    try {
      mapboxgl.accessToken = token.trim();

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-122.17, 37.42],
        zoom: 12,
        pitch: 0,
        bearing: 0,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-left");

      map.on("load", () => {
        console.log("[MapView] Map loaded successfully");
        
        // Create Deck.gl overlay after map is loaded
        try {
          const overlay = new MapboxOverlay({
            layers: [],
          });
          map.addControl(overlay as unknown as mapboxgl.IControl);
          overlayRef.current = overlay;
        } catch (e) {
          console.warn("[MapView] Deck.gl overlay failed, map will work without it:", e);
        }
        
        setMapLoaded(true);
      });

      map.on("error", (e) => {
        console.error("[MapView] Map error:", e);
        setMapError(`Map error: ${e.error?.message || "Unknown error"}`);
      });

      mapRef.current = map;
    } catch (e) {
      console.error("[MapView] Failed to create map:", e);
      setMapError(`Failed to create map: ${e instanceof Error ? e.message : String(e)}`);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      overlayRef.current = null;
    };
  }, []);

  // Fly to incident when it changes
  useEffect(() => {
    if (!mapRef.current || !incident) return;

    mapRef.current.flyTo({
      center: [incident.lon, incident.lat],
      zoom: 13,
      duration: 1500,
    });
  }, [incident?.id]);

  // Update Deck.gl layers
  const updateLayers = useCallback(() => {
    if (!overlayRef.current || !mapLoaded) return;

    const layers: (GeoJsonLayer | ScatterplotLayer)[] = [];

    // ArcGIS fire perimeter polygon (render behind everything)
    if (perimeterPolygon) {
      layers.push(
        new GeoJsonLayer({
          id: "fire-perimeter",
          data: {
            type: "Feature",
            geometry: perimeterPolygon,
            properties: { type: "perimeter" },
          },
          filled: true,
          stroked: true,
          getFillColor: [255, 69, 0, 60], // red-orange, very translucent
          getLineColor: [255, 69, 0, 220],
          getLineWidth: 3,
          lineWidthUnits: "pixels",
          pickable: true,
        })
      );
    }

    // FIRMS satellite hotspot points (render behind envelopes, as heat-like dots)
    if (firmsHotspots && firmsHotspots.length > 0) {
      // Compute max FRP for color scaling
      const maxFrp = Math.max(...firmsHotspots.map((h) => h.frp), 1);

      layers.push(
        new ScatterplotLayer({
          id: "firms-hotspots",
          data: firmsHotspots,
          getPosition: (d: HotspotPoint) => [d.lon, d.lat],
          getRadius: 400,
          getFillColor: (d: HotspotPoint) => {
            // Color from yellow (low FRP) to red (high FRP)
            const t = Math.min(d.frp / maxFrp, 1);
            return [
              255,
              Math.round(200 * (1 - t)), // yellow → red
              0,
              Math.round(80 + 120 * t), // more opaque at higher FRP
            ] as [number, number, number, number];
          },
          radiusUnits: "meters",
          pickable: false,
        })
      );
    }

    // Spread envelope layers (render in reverse so 3h is behind 1h)
    const sortedEnvelopes = [...envelopes].sort((a, b) => b.tHours - a.tHours);
    
    for (const env of sortedEnvelopes) {
      const fillColor = ENVELOPE_COLORS[env.tHours] || [200, 200, 200, 80];
      const lineColor = ENVELOPE_LINE_COLORS[env.tHours] || [200, 200, 200];

      layers.push(
        new GeoJsonLayer({
          id: `envelope-${env.tHours}h`,
          data: {
            type: "Feature",
            geometry: env.polygon,
            properties: { tHours: env.tHours },
          },
          filled: true,
          stroked: true,
          getFillColor: fillColor,
          getLineColor: [...lineColor, 200],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          pickable: true,
        })
      );
    }

    // Asset markers
    if (assets.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: "assets",
          data: assets,
          getPosition: (d: Asset) => [d.lon, d.lat],
          getRadius: 200,
          getFillColor: (d: Asset) => [
            ...(PRIORITY_COLORS[d.priority] || [150, 150, 150]),
            180,
          ] as [number, number, number, number],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          stroked: true,
          lineWidthUnits: "pixels",
          radiusUnits: "meters",
          pickable: true,
        })
      );
    }

    // Incident point (pulsing fire origin)
    if (incident) {
      const pulseRadius = 150 + Math.sin(Date.now() / 300) * 50;

      layers.push(
        new ScatterplotLayer({
          id: "incident-pulse",
          data: [incident],
          getPosition: (d: Incident) => [d.lon, d.lat],
          getRadius: pulseRadius,
          getFillColor: [255, 87, 34, 100],
          getLineColor: [255, 87, 34, 255],
          getLineWidth: 3,
          stroked: true,
          lineWidthUnits: "pixels",
          radiusUnits: "meters",
        })
      );

      layers.push(
        new ScatterplotLayer({
          id: "incident-center",
          data: [incident],
          getPosition: (d: Incident) => [d.lon, d.lat],
          getRadius: 80,
          getFillColor: [255, 61, 0, 220],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          stroked: true,
          lineWidthUnits: "pixels",
          radiusUnits: "meters",
        })
      );
    }

    overlayRef.current.setProps({ layers });
  }, [incident, envelopes, assets, perimeterPolygon, firmsHotspots, mapLoaded]);

  // Animate pulse + update layers
  useEffect(() => {
    if (!mapLoaded) return;

    let running = true;

    const animate = () => {
      if (!running) return;
      updateLayers();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mapLoaded, updateLayers]);

  if (mapError) {
    return (
      <div className="absolute inset-0 w-full h-full bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-2 p-4">
          <p className="text-red-400 text-sm font-medium">Map Error</p>
          <p className="text-zinc-500 text-xs max-w-md">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ minHeight: "100%" }} />
  );
}
