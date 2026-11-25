// Shapes of the public list endpoints, shared by the routes' tests and the
// screens. JSON turns dates into ISO strings.
import type { RiskRow } from "./risk";

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
  has_photo: boolean;
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

// GET /api/v1/shipments (and /shipments/{id}). driver_name is null when the
// reader may not see the driver's profile. last_lat/last_lng are rounded to
// 2 decimals (about 1 km).
export type ShipmentStatus = "planned" | "holding" | "moving" | "stuck" | "on_rail" | "diverted" | "delivered";
export type Shipment = {
  id: string;
  agent_id: string | null;
  created_by: string | null;
  driver_id: string | null;
  driver_name: string | null;
  truck_number: string | null;
  truck_type: "light" | "heavy";
  variety: string;
  tonnes: number;
  harvest_date: string;
  cold_stored: boolean;
  origin: string | null;
  destination: string;
  status: ShipmentStatus;
  advice: import("./decide").Advice | null;
  eta: string | null;
  last_seen_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type FleetDriver = {
  id: string;
  display_name: string | null;
  verification_level: "none" | "email" | "agent_vouched" | "aadhaar_qr" | "official";
  location_consent: boolean;
};

export type AgentInvite = {
  code: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_name: string | null;
};

// GET /api/v1/me
export type MeProfile = {
  id: string;
  role: "grower" | "trader" | "agent" | "driver" | "police" | "admin" | null;
  display_name: string | null;
  language: string | null;
  verification_level: FleetDriver["verification_level"] | null;
  location_consent: boolean;
  consent_version: string | null;
  agent_id: string | null;
  onboarded: boolean;
};

// GET /api/v1/risk/hexes (src/server/risk/hexes.ts).
export type RiskHex = {
  h3_index: string;
  zone_id: number | null;
  overall: number | null;
  hazards: { landslide: number; rockfall: number; flash_flood: number; snow_ice: number };
  level: "low" | "medium" | "high";
  top_hazard: string | null;
  confidence: string | null;
  reason: string;
  reason_code: string | null;
  reason_params: Record<string, unknown> | null;
  slope_deg: number | null;
  boundary: [number, number][];
};

// GET /api/v1/risk/replays: a real past storm (jobs/replay.py), scored on
// the weather that actually happened. Never today's conditions.
export type ReplaySummary = {
  id: string;
  date: string; // incident date, YYYY-MM-DD
  scored_at: string; // 12:00 IST on that date
  zone_id: number;
  place: string;
  hazard: string;
  source_publisher: string;
  source_url: string;
};

// GET /api/v1/risk/replays/{id}?horizon=
export type Replay = ReplaySummary & { rows: RiskRow[]; hexes: RiskHex[] };
