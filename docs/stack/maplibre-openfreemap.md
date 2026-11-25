# MapLibre GL and OpenFreeMap

**In one line:** MapLibre draws the interactive map in the browser; OpenFreeMap gives us the free base map (roads, towns, rivers) to draw on.

## What they are

- **MapLibre GL JS** (version 6.17.0) is an open-source map library. It draws maps with the phone's graphics chip (WebGL), so panning and zooming are smooth.
- **OpenFreeMap** is a free map-tile service built on OpenStreetMap data. It needs no API key or account.

## Why we use them

- Free, with no key to leak and no bill.
- MapLibre lets us colour the NH-44 line and the hexagons by risk on top of the base map.
- Its "Positron" style is pale, so our risk colours stand out.

## Where they are in our project

| Path | What it holds |
| --- | --- |
| `src/ui/risk/RiskMap.tsx` | The full map: base map from `https://tiles.openfreemap.org/styles/positron`, the corridor coloured by risk, hexagons, reports |
| `src/ui/risk/SimpleMap.tsx` | A plain SVG map, shown when MapLibre can't run (no WebGL, or an ad blocker stops the tile host) |
| `src/ui/risk/hex-pick.ts` | Finds which hexagon you tapped |
| `scripts/ui/copy-maplibre-worker.mjs` | Copies MapLibre's worker file into `public/vendor/` before `dev` and `build` |
| `public/sw.js` | Keeps map tiles for the NH-44 area so the map works offline |

## How it works in RouteGuard

- MapLibre 6 does heavy work in a Web Worker loaded from its own file. Next.js doesn't bundle that file, so a script copies it into `public/vendor/` and the map loads it from our own server. The security policy (CSP) can then stay `worker-src 'self' blob:`.
- Line widths change with risk: low 4 px, medium 7 px, high 9 px, so the risk is visible without relying on colour alone.
- The service worker keeps only tiles that touch the NH-44 corridor box, with a cap on how many, oldest out first.

## Learn more

- https://maplibre.org/maplibre-gl-js/docs/
- https://openfreemap.org/

## Questions you may be asked

**Q: Why not Google Maps?**
A: Google Maps needs an API key and billing. MapLibre and OpenFreeMap are free, open source and need no key.

**Q: What happens on an old phone without WebGL?**
A: `RiskMap` switches to `SimpleMap`, an SVG drawing of the corridor coloured by risk. It needs no WebGL and no other website.

**Q: Does the map work offline?**
A: Yes, for tiles you have already seen along NH-44. The service worker keeps them, and the risk data comes from the last saved copy.

**Q: Where does the map data come from?**
A: OpenStreetMap, served as tiles by OpenFreeMap. The risk colours come from our own API.
