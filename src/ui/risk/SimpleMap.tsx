import type { CorridorSegment, LngLat } from "@/src/shared/corridor";
import type { PublicReport } from "@/src/shared/api-types";
import type { Level } from "@/src/shared/risk";
import { linePath, projector } from "./simple-map";

// The map without MapLibre: the corridor coloured by risk, the towns and the
// road reports, drawn as an SVG from data already on the page. RiskMap shows
// it when the full map can't run (no WebGL, or Brave Shields or an ad blocker
// stopping the base map's host). It needs no script, no WebGL and no other
// website, so it works wherever the page does.

const STROKE: Record<Level, string> = { low: "stroke-risk-low", medium: "stroke-risk-medium", high: "stroke-risk-high" };
// The same widths as the full map (RiskMap.tsx), in screen pixels.
const WIDTH: Record<Level, number> = { low: 4, medium: 7, high: 9 };

// The SVG is 1000 units tall and the box 320 px (h-80): about 3 units a pixel.
const PX = 1000 / 320;

export type SimpleMapProps = {
  segments: CorridorSegment[];
  bounds: [LngLat, LngLat];
  levels: Record<number, Level>;
  reports: PublicReport[];
  places: { name: string; lng: number; lat: number }[];
  label: string;
};

export function SimpleMap({ segments, bounds, levels, reports, places, label }: SimpleMapProps) {
  const p = projector(bounds);
  const lines = segments.map((s) => ({ zone: s.zone, d: linePath(s.coords, p), level: levels[s.zone] ?? "low" }));
  return (
    <div role="img" aria-label={label} className="h-80 w-full overflow-hidden rounded-lg border border-border bg-map">
      <svg
        aria-hidden="true"
        viewBox={p.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="size-full overflow-visible"
      >
        {lines.map((l) => (
          <path
            key={`casing-${l.zone}`}
            d={l.d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={WIDTH[l.level] + 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {lines.map((l) => (
          <path
            key={`line-${l.zone}`}
            d={l.d}
            fill="none"
            className={STROKE[l.level]}
            strokeWidth={WIDTH[l.level]}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {places.map((place) => {
          const [x, y] = p.point(place.lng, place.lat);
          return (
            <g key={place.name}>
              <circle cx={x} cy={y} r={3 * PX} className="fill-primary" />
              {/* Text, never HTML. ltr so the label always starts to the right
                  of its dot; the browser still shapes Urdu right to left. */}
              <text
                x={x + 8 * PX}
                y={y}
                dominantBaseline="middle"
                direction="ltr"
                className="fill-primary font-bold"
                fontSize={13 * PX}
                stroke="#ffffff"
                strokeWidth={3 * PX}
                paintOrder="stroke"
              >
                {place.name}
              </text>
            </g>
          );
        })}
        {reports.map((report) => {
          const [x, y] = p.point(report.lng, report.lat);
          // Solid outline when confirmed or from police/admin, dashed when
          // unconfirmed, as on the full map.
          const solid = report.status === "confirmed" || report.source !== "driver";
          return (
            <circle
              key={report.id}
              cx={x}
              cy={y}
              r={8 * PX}
              className="fill-elevated stroke-primary"
              strokeWidth={3}
              strokeDasharray={solid ? undefined : "4 3"}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}
