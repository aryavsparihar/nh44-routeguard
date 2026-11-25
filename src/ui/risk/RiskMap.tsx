"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { CorridorSegment, LngLat } from "@/src/shared/corridor";
import type { PublicReport } from "@/src/shared/api-types";
import type { Level } from "@/src/shared/risk";

// The base map: OpenFreeMap (free, no key, OpenStreetMap data). Allowed in
// the CSP (src/server/security-headers.ts).
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// MapLibre's worker file, copied into public/vendor/ before dev and build
// (scripts/ui/copy-maplibre-worker.mjs). Keep the version in step with
// package.json; the name changes with it, so browsers never mix versions.
const WORKER_URL = "/vendor/maplibre-gl-worker-6.17.0.mjs";

export type MapProps = {
  segments: CorridorSegment[];
  bounds: [LngLat, LngLat];
  levels: Record<number, Level>; // zone id → level to draw
  reports: PublicReport[];
  label: string; // what the map shows, for screen readers
  failedText: string;
  // Hindi/Urdu: our own town labels (page text) instead of the base map's.
  placeLabels?: { name: string; lng: number; lat: number }[];
  // H3 cells along the road, each with the level to draw.
  hexes?: { boundary: [number, number][]; level: Level }[];
};

function hexData(hexes: MapProps["hexes"]) {
  return {
    type: "FeatureCollection" as const,
    features: (hexes ?? []).map((h) => ({
      type: "Feature" as const,
      properties: { level: h.level },
      geometry: { type: "Polygon" as const, coordinates: [h.boundary] },
    })),
  };
}

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#737b75";
}

function corridorData(segments: CorridorSegment[], levels: Record<number, Level>) {
  return {
    type: "FeatureCollection" as const,
    features: segments.map((s) => ({
      type: "Feature" as const,
      properties: { zone: s.zone, level: levels[s.zone] ?? "low" },
      geometry: { type: "LineString" as const, coordinates: s.coords },
    })),
  };
}

// The map is a picture of the zone list below it, so it is hidden from
// screen readers except for one label (role="img").
export function RiskMap({ segments, bounds, levels, reports, label, failedText, placeLabels, hexes }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // The newest props, for the map's load handler (which runs later).
  const latest = useRef({ segments, levels, placeLabels, hexes });
  useEffect(() => {
    latest.current = { segments, levels, placeLabels, hexes };
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    // MapLibre is about 1 MB of script. Start it once the browser is idle, so
    // the scores and text paint first (Lighthouse "total blocking time").
    const idle = new Promise<void>((resolve) => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 1500 });
      else setTimeout(resolve, 200);
    });
    idle
      .then(() => import("maplibre-gl"))
      .then((maplibregl) => {
        if (cancelled || !container.current) return;
        maplibregl.setWorkerUrl(WORKER_URL);
        const created = new maplibregl.Map({
          container: container.current,
          style: STYLE_URL,
          bounds,
          fitBoundsOptions: { padding: { top: 24, right: 24, bottom: 64, left: 24 } },
          attributionControl: { compact: true },
          cooperativeGestures: true, // one finger scrolls the page, two move the map
          dragRotate: false,
          pitchWithRotate: false,
        });
        instance = created;
        created.touchZoomRotate.disableRotation();
        map.current = created;
        let ready = false;
        created.on("error", () => {
          if (!ready) setFailed(true);
        });
        created.on("load", () => {
          ready = true;
          const m = created;
          const { segments: segs, levels: lv, placeLabels: places, hexes: cells } = latest.current;
          if (places?.length) {
            // The base map's labels would be English or badly shaped here.
            for (const layer of m.getStyle().layers ?? []) {
              if (layer.type === "symbol") m.setLayoutProperty(layer.id, "visibility", "none");
            }
            for (const p of places) {
              const el = document.createElement("span");
              el.className = "map-place";
              el.textContent = p.name; // text, never HTML
              new maplibregl.Marker({ element: el, anchor: "left", offset: [6, 0] }).setLngLat([p.lng, p.lat]).addTo(m);
            }
          }
          const color = ["match", ["get", "level"], "high", cssColor("--color-risk-high"), "medium", cssColor("--color-risk-medium"), cssColor("--color-risk-low")];
          const width = ["match", ["get", "level"], "high", 9, "medium", 7, 4];
          // H3 cells first, so the corridor line draws on top of them.
          m.addSource("hexes", { type: "geojson", data: hexData(cells) });
          m.addLayer({
            id: "hexes",
            type: "fill",
            source: "hexes",
            paint: { "fill-color": color as never, "fill-opacity": 0.35, "fill-outline-color": color as never },
          });
          m.addSource("corridor", { type: "geojson", data: corridorData(segs, lv) });
          m.addLayer({
            id: "corridor-casing",
            type: "line",
            source: "corridor",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#ffffff", "line-width": ["+", width, 3] as never },
          });
          m.addLayer({
            id: "corridor",
            type: "line",
            source: "corridor",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": color as never, "line-width": width as never },
          });
          setLoaded(true);
          // The page can still shift (scores, fonts) after the map is made;
          // without a resize the canvas keeps a blank band until the next
          // window resize. Measure again now and once the first tiles are in.
          requestAnimationFrame(() => created.resize());
          created.once("idle", () => {
            created.resize();
            // On a phone the open attribution box covers the bottom of the
            // map. Fold it; the (i) button still shows it.
            const attrib = container.current?.querySelector(".maplibregl-ctrl-attrib");
            attrib?.classList.remove("maplibregl-compact-show");
            attrib?.removeAttribute("open");
          });
        });
      })
      .catch(() => setFailed(true)); // no WebGL, or the script didn't load

    return () => {
      cancelled = true;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      instance?.remove();
      map.current = null;
    };
    // The map is made once; later changes go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New horizon or hazard filter: recolour the line.
  useEffect(() => {
    if (!loaded || !map.current) return;
    const source = map.current.getSource("corridor") as GeoJSONSource | undefined;
    source?.setData(corridorData(segments, levels));
  }, [loaded, segments, levels]);

  // New cells (horizon change, or they arrived after the map): redraw them.
  useEffect(() => {
    if (!loaded || !map.current) return;
    const source = map.current.getSource("hexes") as GeoJSONSource | undefined;
    source?.setData(hexData(hexes));
  }, [loaded, hexes]);

  // Report markers: solid outline when confirmed or from police/admin,
  // dashed when unconfirmed (the legend below says so).
  useEffect(() => {
    if (!loaded || !map.current) return;
    const m = map.current;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = reports.map((report) => {
        const el = document.createElement("div");
        const solid = report.status === "confirmed" || report.source !== "driver";
        el.className = solid
          ? "size-5 rounded-full border-[3px] border-solid border-primary bg-elevated"
          : "size-5 rounded-full border-[3px] border-dashed border-primary bg-elevated";
        el.setAttribute("aria-hidden", "true");
        return new maplibregl.Marker({ element: el }).setLngLat([report.lng, report.lat]).addTo(m);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, reports]);

  if (failed) {
    return <p className="rounded-md border border-border bg-surface p-3 text-sm">{failedText}</p>;
  }
  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      className="h-80 w-full overflow-hidden rounded-lg border border-border bg-map"
    />
  );
}
