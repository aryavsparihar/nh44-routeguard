// Towns we label ourselves on the map in Hindi and Urdu. MapLibre draws text
// with its own glyphs and can't shape Devanagari conjuncts or join Urdu
// letters, so in those languages the base map's labels are hidden and these
// are drawn as page text, which the browser shapes properly.
//
// Positions: Jammu is the start of data/nh44_line.json; the rest are the
// weather points in jobs/points.json (placed with OpenStreetMap).
export const MAP_PLACES = [
  { id: "jammu", lng: 74.85683, lat: 32.72606 },
  { id: "udhampur", lng: 75.13315, lat: 32.92197 },
  { id: "ramban", lng: 75.24044, lat: 33.2387 },
  { id: "banihal", lng: 75.19549, lat: 33.43789 },
  { id: "qazigund", lng: 75.16582, lat: 33.59347 },
  { id: "srinagar", lng: 74.82044, lat: 34.07474 },
] as const;

export type MapPlaceId = (typeof MAP_PLACES)[number]["id"];
