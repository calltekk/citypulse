
"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function LondonMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    // Load MapLibre's worker from the public directory.
    maplibregl.setWorkerUrl("/maplibre-worker.mjs");

    console.log("CityPulse: Initialising London map");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [-0.1276, 51.5072],
      zoom: 10.5,
      pitch: 0,
      bearing: 0,
      attributionControl: {},
    });

    // Navigation controls.
    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    // ------------------------------------
    // MAP DIAGNOSTICS
    // ------------------------------------

    map.on("load", () => {
      console.log("CityPulse: MapLibre map loaded");

      console.log(
        "CityPulse: Map layers:",
        map.getStyle().layers?.length
      );

      console.log(
        "CityPulse: Map center:",
        map.getCenter().toArray()
      );

      console.log(
        "CityPulse: Zoom level:",
        map.getZoom()
      );

      console.log(
        "CityPulse: Map fully loaded:",
        map.loaded()
      );
    });

    map.on("error", (event) => {
      console.error(
        "CityPulse MapLibre error:",
        event.error
      );
    });

    map.on("idle", () => {
      console.log(
        "CityPulse: Map rendering idle"
      );
    });

    // Store map instance.
    mapRef.current = map;

    // Clean up when component unmounts.
    return () => {
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
          Interactive geographic view of London.
          Station data and spatial analytics coming next.
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-[500px] w-full"
        aria-label="Interactive map centred on London"
      />

      <div className="border-t border-slate-800 px-6 py-4">
        <p className="text-xs text-slate-500">
          Powered by MapLibre GL JS.
          Transport overlays will be added in the next phase.
        </p>
      </div>
    </section>
  );
}
