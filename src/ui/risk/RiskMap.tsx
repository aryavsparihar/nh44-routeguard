"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { CorridorSegment, LngLat } from "@/src/shared/corridor";
import type { PublicReport } from "@/src/shared/api-types";
import type { Level } from "@/src/shared/risk";
import { SimpleMap } from "./SimpleMap";
import { centre, metresPerPixel, pickHex } from "./hex-pick";

// The base map: OpenFreeMap (free, no key, OpenStreetMap data). Allowed in
// the CSP (src/server/security-headers.ts).
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// MapLibre's worker file, copied into public/vendor/ before dev and build
// (scripts/ui/copy-maplibre-worker.mjs). Keep the version in step with
// package.json; the name changes with it, so browsers never mix versions.
const WORKER_URL = "/vendor/maplibre-gl-worker-6.17.0.mjs";

// Room around the corridor when the whole road is shown (bottom: the
// attribution button).
const FIT_PADDING = { top: 24, right: 24, bottom: 64, left: 24 };
// A tap counts for the nearest cell within this many screen pixels.
const TAP_PX = 16;
// Zoom that a picked cell is shown at: cells are about 40 px across.
const PICK_ZOOM = 12;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type MapProps = {
  segments: CorridorSegment[];
  bounds: [LngLat, LngLat];
  levels: Record<number, Level>; // zone id → level to draw
  reports: PublicReport[];
  label: string; // what the map shows, for screen readers
  simpleText: string; // under the simple map: why it is simple
  // Town names in the page's language. The full map draws them only when
  // baseLabels is false (Hindi/Urdu: the base map's own labels would be
  // English or badly shaped); the simple map always does.
  places: { name: string; lng: number; lat: number }[];
  baseLabels: boolean;
  // H3 cells along the road, each with the level to draw.
  hexes?: { id: string; boundary: [number, number][]; level: Level }[];
  // Tapping the road picks the cell under the finger (null: tapped off the
  // road); the picked cell gets an outline.
  pickedHex?: string | null;
  onPickHex?: (id: string | null) => void;
};

function hexData(hexes: MapProps["hexes"]) {
  return {
    type: "FeatureCollection" as const,
    features: (hexes ?? []).map((h) => ({
      type: "Feature" as const,
      properties: { level: h.level, id: h.id },
      geometry: { type: "Polygon" as const, coordinates: [h.boundary] },
    })),
  };
}

// MapLibre needs WebGL 2. Brave and Chrome have none with "Use hardware
// acceleration" off, so check before downloading the map's script.
function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
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
// screen readers except for one label (role="img"). When the full map can't
// run (no WebGL, or the base map's host blocked by Brave Shields or an ad
// blocker) it falls back to the simple SVG map (SimpleMap.tsx).
export function RiskMap({
  segments,
  bounds,
  levels,
  reports,
  label,
  simpleText,
  places,
  baseLabels,
  hexes,
  pickedHex = null,
  onPickHex,
}: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // True after a pick zoomed the map in; clearing the pick zooms back out.
  const zoomedIn = useRef(false);
  // The newest props, for the map's load handler (which runs later).
  const latest = useRef({ segments, levels, places, baseLabels, hexes, pickedHex, onPickHex });
  useEffect(() => {
    latest.current = { segments, levels, places, baseLabels, hexes, pickedHex, onPickHex };
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    // Give up on the full map: drop it and show the simple one.
    const fallBack = () => {
      if (cancelled) return;
      cancelled = true;
      const old = instance;
      instance = null;
      map.current = null;
      setFailed(true);
      // Not inside MapLibre's own event handler.
      if (old) setTimeout(() => old.remove(), 0);
    };
    if (!hasWebGL2()) {
      // In a timeout, not straight in the effect body (one render at a time).
      const t = setTimeout(fallBack, 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
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
          fitBoundsOptions: { padding: FIT_PADDING },
          attributionControl: { compact: true },
          cooperativeGestures: true, // one finger scrolls the page, two move the map
          dragRotate: false,
          pitchWithRotate: false,
        });
        instance = created;
        created.touchZoomRotate.disableRotation();
        map.current = created;
        let ready = false;
        // Before "load" an error means the style, its fonts or its icons
        // didn't arrive (blocked or offline): nothing useful will draw.
        created.on("error", () => {
          if (!ready) fallBack();
        });
        created.on("load", () => {
          ready = true;
          const m = created;
          const { segments: segs, levels: lv, places: names, baseLabels: base, hexes: cells } = latest.current;
          if (!base) {
            // The base map's labels would be English or badly shaped here.
            for (const layer of m.getStyle().layers ?? []) {
              if (layer.type === "symbol") m.setLayoutProperty(layer.id, "visibility", "none");
            }
            for (const p of names) {
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
          // The picked cell's outline, on top of the road line.
          m.addLayer({
            id: "hex-picked",
            type: "line",
            source: "hexes",
            filter: ["==", ["get", "id"], latest.current.pickedHex ?? ""],
            paint: { "line-color": cssColor("--color-primary"), "line-width": 3 },
          });
          // A tap picks the cell it lands in, or the nearest one within a
          // finger's width (hex-pick.ts). With the whole road showing, the
          // cells are a pixel or two wide, so the map also zooms in to the
          // picked cell; clearing the pick zooms back out (effect below).
          m.on("click", (e) => {
            const { lng, lat } = e.lngLat;
            const tolKm = (TAP_PX * metresPerPixel(lat, m.getZoom())) / 1000;
            const cell = pickHex(latest.current.hexes ?? [], [lng, lat], tolKm);
            latest.current.onPickHex?.(cell ? cell.id : null);
            if (cell && m.getZoom() < PICK_ZOOM) {
              zoomedIn.current = true;
              m.easeTo({ center: centre(cell.boundary), zoom: PICK_ZOOM, duration: reducedMotion() ? 0 : 600 });
            }
          });
          m.on("mouseenter", "hexes", () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", "hexes", () => (m.getCanvas().style.cursor = ""));
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
      .catch(fallBack); // WebGL failed after all, or the script didn't load

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

  // Outline the picked cell. With nothing picked any more, go back to the
  // whole road if a pick had zoomed in.
  useEffect(() => {
    if (!loaded || !map.current) return;
    map.current.setFilter("hex-picked", ["==", ["get", "id"], pickedHex ?? ""]);
    if (!pickedHex && zoomedIn.current) {
      zoomedIn.current = false;
      map.current.fitBounds(bounds, { padding: FIT_PADDING, duration: reducedMotion() ? 0 : 600 });
    }
  }, [loaded, pickedHex, bounds]);

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
    return (
      <div className="flex flex-col gap-1">
        <SimpleMap segments={segments} bounds={bounds} levels={levels} reports={reports} places={places} label={label} />
        <p className="text-sm text-secondary">{simpleText}</p>
      </div>
    );
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
