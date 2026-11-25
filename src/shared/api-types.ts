// Shapes of the public list endpoints, shared by the routes' tests and the
// screens. JSON turns dates into ISO strings.
export type Zone = {
  id: number;
  name: string;
  from_place: string;
  to_place: string;
  length_km: number;
  danger_km: number;
};

export type PublicReport = {
  id: string;
  source: "driver" | "police" | "admin";
  hazard_type: "landslide" | "rockfall" | "flash_flood" | "snow_ice" | "accident" | "other";
  lat: number;
  lng: number;
  zone_id: number | null;
  note: string | null;
  status: "unconfirmed" | "confirmed";
  confirmations: number;
  created_at: string;
  expires_at: string;
  is_demo: boolean;
};

export type OfficialUpdate = {
  id: string;
  zone_id: number | null;
  kind: "closure" | "one_way" | "reopened" | "advisory";
  title: string;
  body: string | null;
  source_url: string;
  source_name: string;
  issued_at: string;
  valid_until: string;
  version: number;
};
