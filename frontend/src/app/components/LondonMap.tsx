
"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type StationFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    station_id: string;
    station_name: string;
  };
};

type StationCollection = {
  type: "FeatureCollection";
  features: StationFeature[];
};

const STATION_SOURCE = "tube-stations";
const STATION_LAYER = "tube-station-circles";

export default function LondonMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [stationCount, setStationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    // Use our existing MapLibre worker.
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:
        "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [-0.1276, 51.5072],
      zoom: 10.5,
      pitch: 0,
      bearing: 0,
      attributionControl: {},
    });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    mapRef.current = map;

    let cancelled = false;

    map.on("load", async () => {
      try {
        const response = await fetch("/api/stations", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Station API returned ${response.status}`
          );
        }

        const stations: StationCollection =
          await response.json();

        if (cancelled) return;

        if (
          stations.type !== "FeatureCollection" ||
          !Array.isArray(stations.features)
        ) {
          throw new Error("Invalid station GeoJSON");
        }

        // Add station GeoJSON to MapLibre.
        map.addSource(STATION_SOURCE, {
          type: "geojson",
          data: stations,
        });

        // Draw stations as cyan circles.
        map.addLayer({
          id: STATION_LAYER,
          type: "circle",
          source: STATION_SOURCE,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9, 3,
              12, 5,
              15, 8,
            ],
            "circle-color": "#22d3ee",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.85,
          },
        });

        // Show station details when a marker is clicked.
        map.on("click", STATION_LAYER, (event) => {
          const feature = event.features?.[0];

          if (!feature) return;

          // Only process point geometries.
          if (feature.geometry.type !== "Point") {
            return;
          }

          const coordinates = feature.geometry.coordinates as [
            number,
            number
          ];

          const name = String(
            feature.properties?.station_name ??
              "Unknown station"
          );

          const stationId = String(
            feature.properties?.station_id ?? ""
          );

          // Build popup safely using DOM elements.
          const popupContent = document.createElement("div");

          const title = document.createElement("strong");
          title.textContent = name;

          const subtitle = document.createElement("p");
          subtitle.textContent = `Station ID: ${stationId}`;
          subtitle.style.marginTop = "6px";

          popupContent.append(title, subtitle);

          new maplibregl.Popup({
            offset: 12,
            closeButton: true,
          })
            .setLngLat(coordinates)
            .setDOMContent(popupContent)
            .addTo(map);
        });

        // Change cursor when hovering over a station.
        map.on("mouseenter", STATION_LAYER, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", STATION_LAYER, () => {
          map.getCanvas().style.cursor = "";
        });

        setStationCount(stations.features.length);

        console.log(
          `CityPulse: Loaded ${stations.features.length} station locations`
        );
      } catch (err) {
        if (cancelled) return;

        console.error(
          "CityPulse station map error:",
          err
        );

        setError("Unable to load Underground stations");
      }
    });

    map.on("error", (event) => {
      console.error(
        "CityPulse MapLibre error:",
        event.error
      );
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#111b2e]">
      <div className="p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
          Geospatial intelligence
        </p>

        <h3 className="text-xl font-semibold">
          London transport map
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Explore real Underground station locations,
          powered by TfL data and PostGIS.
        </p>

        <p className="mt-3 text-sm text-cyan-400">
          {error
            ? error
            : stationCount > 0
              ? `${stationCount} station locations loaded`
              : "Loading Underground stations..."}
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-[500px] w-full"
        aria-label="Interactive London Underground station map"
      />

      <div className="border-t border-slate-800 px-6 py-4">
        <p className="text-xs text-slate-500">
          Click a cyan marker to inspect a station.
          Geographic data: TfL Unified API.
          Mapping: MapLibre GL JS.
        </p>
      </div>
    </section>
  );
}
