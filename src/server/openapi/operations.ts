// Every endpoint under /api/v1, for the OpenAPI document (spec.ts). Request
// schemas are the same zod schemas the routes validate with, so the document
// can't drift from what the API accepts. openapi.test.ts fails when a route
// file has a method that isn't listed here, or the other way round.
//
// The examples show the shape of each answer. Their values are made up for
// the example (ids, names, times); they are not readings from the road.
import { AADHAAR_CONSENT_VERSION, aadhaarQrBody } from "@/src/server/aadhaar/aadhaar.schemas";
import { z } from "zod";
import { adviceRequest } from "@/src/server/advice/advice.schemas";
import { auditLogQuery } from "@/src/server/audit-log/audit-log.schemas";
import { acceptInviteBody, createInviteBody } from "@/src/server/fleet/fleet.schemas";
import type { RateLimitName } from "@/src/server/http/rate-limit";
import type { Role } from "@/src/server/http/caller";
import { incidentsQuery } from "@/src/server/incidents/incidents.schemas";
import { deadLettersQuery } from "@/src/server/jobs/jobs.schemas";
import { subscriptionBody, unsubscribeBody } from "@/src/server/push/push.schemas";
import { modelCard } from "@/src/server/model/model-card";
import { decide, type Lot } from "@/src/shared/decide";
import type { RiskRow } from "@/src/shared/risk";
import {
  adminUpdatesQuery,
  createUpdateBody,
  deleteUpdateBody,
  editUpdateBody,
  publicUpdatesQuery,
  updateId,
} from "@/src/server/official-updates/official-updates.schemas";
import {
  adminReportsQuery,
  confirmBody,
  flagBody,
  idempotencyKey,
  moderateBody,
  publicReportsQuery,
  reportFields,
  reportId,
} from "@/src/server/reports/reports.schemas";
import { hexQuery, replayId, riskQuery, summaryQuery } from "@/src/server/risk/risk.schemas";
import { roadStatusBody } from "@/src/server/road-status/road-status.schemas";
import {
  createShipmentBody,
  locationBody,
  patchShipmentBody,
  shipmentId,
  shipmentsQuery,
  userId,
} from "@/src/server/shipments/shipments.schemas";
import {
  clerkUserId,
  deleteMeBody,
  onboardingBody,
  patchMeBody,
  reviewBody,
  roleChangeBody,
  usersListQuery,
} from "@/src/server/users/users.schemas";

export type Access = "public" | "signed-in" | readonly Role[];
export type Method = "get" | "post" | "patch" | "delete";

export type Answer = {
  description: string;
  example?: unknown; // the `data` (or whole body for non-JSON); see spec.ts
  contentType?: string; // default application/json
  envelope?: "data" | "list" | "none"; // how spec.ts wraps the example
  meta?: Record<string, unknown>; // for "list"
  headers?: Record<string, string>; // header name → description
};

export type Operation = {
  method: Method;
  path: string; // OpenAPI form: /api/v1/reports/{id}
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  rateLimit?: RateLimitName;
  // false for server-to-server routes with no Origin check (the queue worker).
  checkOrigin?: false;
  params?: Record<string, z.ZodType>;
  query?: z.ZodType;
  body?: z.ZodType;
  multipart?: z.ZodType; // the text fields; the photo is added by spec.ts
  headers?: { name: string; required: boolean; schema: z.ZodType; description: string }[];
  bodyExample?: unknown;
  success: Record<number, Answer>;
  // Error statuses this endpoint can answer, besides the ones spec.ts adds
  // for everyone (401/403 for sign-in, 422 for input, 429 for limits, 500).
  errors?: Record<number, string>;
};

// Example values -------------------------------------------------------------

const T = "2026-11-26T09:30:00.000Z";
const LATER = "2026-11-26T15:30:00.000Z";
const RUN_AT = "2026-11-26T09:00:00.000Z";
const USER = "user_2pExampleDriver01";
const AGENT = "user_2pExampleAgent001";
const REPORT_ID = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const SHIPMENT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const UPDATE_ID = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b";

const exampleRisk: RiskRow = {
  zone_id: 4,
  horizon_hours: 24,
  overall: 0.42,
  risk_low: 0.3,
  risk_high: 0.55,
  level: "medium",
  top_hazard: "landslide",
  confidence: "medium",
  hazards: { landslide: 0.42, rockfall: 0.3, flash_flood: 0.1, snow_ice: 0.05 },
  reason: "40 mm of rain in 24 h near Ramban on a stretch with very high landslide exposure.",
  reason_code: "landslide_rain",
  reason_params: { mm: 40, hours: 24, place: "z4_ramban", zone: 4, exposure: "very_high" },
};

// The advice example is what our own rules (src/shared/decide.ts) answer for
// the example lot and the example score above, so it always has the real shape.
// A real replay (lib/risk/replays.json): snow at the Navyug Tunnel.
const exampleReplay = {
  id: "inc-2026-01-23-z5-snow_ice",
  date: "2026-01-23",
  scored_at: "2026-01-23T06:00:00Z",
  zone_id: 5,
  place: "Navyug Tunnel, Banihal",
  hazard: "snow_ice",
  source_publisher: "ETV Bharat (PTI)",
  source_url:
    "https://www.etvbharat.com/en/bharat/snow-shuts-srinagar-jammu-highway-other-key-kashmir-roads-vande-bharat-train-remains-operational-enn26012401721",
};
const exampleLot: Lot = { variety: "delicious", days_since_picking: 12, tonnes: 10, destination: "azadpur", truck_type: "heavy" };
const exampleAdvice = decide(
  exampleLot,
  { rows: [exampleRisk], run_at: RUN_AT },
  { mughal_road: "unknown", rail_parcel: "unknown" },
);

const exampleReport = {
  id: REPORT_ID,
  source: "driver",
  hazard_type: "rockfall",
  lat: 33.25,
  lng: 75.19,
  zone_id: 4,
  note: "Stones on the left lane after the tunnel.",
  status: "unconfirmed",
  confirmations: 0,
  created_at: T,
  expires_at: LATER,
  has_photo: true,
  is_demo: false,
};

const exampleUpdate = {
  id: UPDATE_ID,
  zone_id: 4,
  kind: "one_way",
  title: "One-way traffic from Jammu to Srinagar",
  body: "Light vehicles only until 14:00.",
  source_url: "https://example.org/traffic-advisory",
  source_name: "J&K Traffic Police",
  issued_at: T,
  valid_until: LATER,
  version: 1,
};

// What the admin routes return (every column, deleted ones too).
const exampleAdminUpdate = { ...exampleUpdate, supersedes_id: null, created_at: T, deleted_at: null, delete_reason: null };

const exampleShipment = {
  id: SHIPMENT_ID,
  agent_id: AGENT,
  created_by: AGENT,
  driver_id: USER,
  driver_name: "Bashir",
  truck_number: "JK05G7712",
  truck_type: "heavy",
  variety: "delicious",
  tonnes: 10,
  harvest_date: "2026-11-14",
  cold_stored: false,
  origin: "Sopore",
  destination: "azadpur",
  status: "moving",
  advice: exampleAdvice,
  eta: LATER,
  last_seen_at: T,
  last_lat: 33.25,
  last_lng: 75.19,
  is_demo: false,
  created_at: T,
  updated_at: T,
};

const exampleMe = {
  id: USER,
  role: "driver",
  display_name: "Bashir",
  language: "ur",
  verification_level: "agent_vouched",
  location_consent: true,
  consent_version: "2026-11-25",
  agent_id: AGENT,
  approval: "approved",
  review_note: null,
  onboarded: true,
};

const page = (count: number) => ({ count, next_cursor: null });

// The operations -------------------------------------------------------------

export const OPERATIONS: Operation[] = [
  // Health
  {
    method: "get",
    path: "/api/v1/health",
    tag: "Health",
    summary: "Liveness: the server is up",
    description: "No database call, so it answers even when the database is down.",
    access: "public",
    success: { 200: { description: "Up.", example: { status: "ok" } } },
  },
  {
    method: "get",
    path: "/api/v1/health/ready",
    tag: "Health",
    summary: "Readiness: database reachable, and how old the scores are",
    description: "Old scores are still a 200 with `stale: true`; the app keeps working and shows a banner.",
    access: "public",
    success: {
      200: {
        description: "Ready.",
        example: {
          status: "ready",
          database: "ok",
          last_run_at: RUN_AT,
          data_age_minutes: 30,
          stale: false,
          stale_after_minutes: 90,
        },
      },
    },
    errors: { 503: "The database can't be reached." },
  },

  // Risk
  {
    method: "get",
    path: "/api/v1/zones",
    tag: "Risk",
    summary: "The six NH-44 zones, Jammu to Srinagar",
    access: "public",
    success: {
      200: {
        description: "The zones.",
        envelope: "list",
        meta: page(1),
        // Zone 4 as seeded (supabase/migrations/20261110173420_seed_zones.sql).
        example: [{ id: 4, name: "Ramban → Ramsoo", from_place: "Ramban", to_place: "Ramsoo", length_km: 22, danger_km: 9.5 }],
      },
    },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "get",
    path: "/api/v1/risk",
    tag: "Risk",
    summary: "The newest closure-risk scores",
    description:
      "Without `horizon` or `zone`, every row of the newest run (6 zones × 4 horizons). The ETag is the run time; send `If-None-Match` to get a 304.",
    access: "public",
    query: riskQuery,
    success: {
      200: {
        description: "Scores of the newest run.",
        envelope: "list",
        meta: { count: 1, next_cursor: null, run_at: RUN_AT, model_version: "rules-2026-11-25" },
        example: [exampleRisk],
        headers: { ETag: "The run time of these scores." },
      },
      304: { description: "Not modified: you already have this run.", envelope: "none" },
    },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "get",
    path: "/api/v1/risk/hexes",
    tag: "Risk",
    summary: "The newest scores for every H3 cell along NH-44, with outlines",
    description:
      "Resolution-8 H3 cells (about 0.8 km² each here) the highway passes through, built by `jobs/tools/build_hexes.py`. Each cell is scored with its slope (`slope_deg`: the steepest centre-to-corner slope, Copernicus DEM via Open-Meteo; null if unknown) and nearest weather point. `reason` is the job's English sentence; `reason_code` and `reason_params` are the same reason for translation (codes in `lib/risk/reason_codes.json`). `boundary` is a closed ring of [lng, lat]. The ETag is the run time and horizon.",
    access: "public",
    query: hexQuery,
    success: {
      200: {
        description: "Cells of the newest run at one horizon.",
        envelope: "list",
        meta: { count: 1, next_cursor: null, run_at: RUN_AT },
        example: [
          {
            h3_index: "883d308abdfffff",
            zone_id: 4,
            overall: 0,
            hazards: { landslide: 0, rockfall: 0, flash_flood: 0, snow_ice: 0 },
            level: "low",
            top_hazard: null,
            confidence: "low",
            reason: "Zone 4: no rain, snow or frost trigger in the window",
            reason_code: "none",
            reason_params: { zone: 4 },
            slope_deg: 16.6,
            boundary: [[75.2323, 33.2429], [75.2329, 33.2379], [75.2384, 33.2359], [75.2434, 33.2388], [75.2429, 33.2438], [75.2373, 33.2458], [75.2323, 33.2429]],
          },
        ],
        headers: { ETag: "The run time and horizon of these scores." },
      },
      304: { description: "Not modified: you already have this run.", envelope: "none" },
    },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "get",
    path: "/api/v1/risk/replays",
    tag: "Risk",
    summary: "Past storms the map can replay",
    description:
      "Verified incidents from `data/incidents.csv`, scored by `jobs/replay.py` with the same rules as the hourly job, on the weather that actually happened (ERA5 reanalysis via the Open-Meteo archive), at 12:00 IST on the incident date. For showing the map in bad weather on a dry day. Not today's conditions, and never written to the live scores.",
    access: "public",
    success: {
      200: {
        description: "The storms.",
        envelope: "list",
        meta: { count: 1, next_cursor: null, model_version: "rules-v0.1", weather_source: "ERA5 reanalysis via the Open-Meteo archive API" },
        example: [exampleReplay],
      },
    },
  },
  {
    method: "get",
    path: "/api/v1/risk/replays/{id}",
    tag: "Risk",
    summary: "One past storm, scored like the live map",
    description:
      "`rows` are the zone scores for every horizon, in the shape of `GET /api/v1/risk`; `hexes` are the H3 cells at the asked horizon, in the shape of `GET /api/v1/risk/hexes`. The +12, +24 and +48 h scores use the weather that actually came, not a forecast. Confidence uses exposure only (no past incidents or reports are counted).",
    access: "public",
    params: { id: replayId },
    query: hexQuery,
    success: {
      200: {
        description: "The storm's scores.",
        example: {
          ...exampleReplay,
          rows: [
            {
              zone_id: 5,
              horizon_hours: 0,
              overall: 1,
              risk_low: 0.95,
              risk_high: 1,
              level: "high",
              top_hazard: "snow_ice",
              confidence: "medium",
              hazards: { landslide: 0.5, rockfall: 0.7, flash_flood: 0.264, snow_ice: 1 },
              reason: "Snow/ice: 0.32 m on the ground near Ramsoo; zone 5 is very exposed to snow/ice",
              reason_code: "snow_ice",
              reason_params: { snow_cm: 0, depth_m: 0.32, black_ice: "no", place: "z5_ramsoo", zone: 5, exposure: "very_high" },
            },
          ],
          hexes: [
            {
              h3_index: "883d309525fffff",
              zone_id: 5,
              overall: 1,
              hazards: { landslide: 0.45, rockfall: 0.63, flash_flood: 0.264, snow_ice: 1 },
              level: "high",
              top_hazard: "snow_ice",
              confidence: "medium",
              reason: "Snow/ice: 0.43 m on the ground near Banihal; zone 5 is very exposed to snow/ice",
              reason_code: "snow_ice",
              reason_params: { snow_cm: 0, depth_m: 0.43, black_ice: "no", place: "z5_banihal", zone: 5, exposure: "very_high" },
              slope_deg: 31.5,
              boundary: [[75.1889, 33.4351], [75.1895, 33.4301], [75.195, 33.4281], [75.2, 33.431], [75.1995, 33.436], [75.1939, 33.4381], [75.1889, 33.4351]],
            },
          ],
        },
      },
    },
  },
  {
    method: "get",
    path: "/api/v1/risk/summary",
    tag: "Risk",
    summary: "The newest scores as a few lines of plain text (under 5 KB)",
    access: "public",
    query: summaryQuery,
    success: {
      200: {
        description: "Plain text for a weak connection.",
        contentType: "text/plain",
        envelope: "none",
        example: "NH-44 risk, 26 Nov 15:00 IST\nZone 4 Ramban → Ramsoo: medium in 24 h (landslide)\n",
      },
    },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "get",
    path: "/api/v1/road-status",
    tag: "Risk",
    summary: "Mughal Road and the parcel train, as an admin last set them",
    access: "public",
    success: {
      200: {
        description: "Both items.",
        envelope: "list",
        meta: page(1),
        example: [
          { item: "mughal_road", state: "open", source_url: "https://example.org/mughal-road", updated_at: T },
        ],
      },
    },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "get",
    path: "/api/v1/model",
    tag: "Risk",
    summary: "The model card and backtest results",
    access: "public",
    success: { 200: { description: "Read from files in the repository.", example: modelCard() } },
  },
  {
    method: "get",
    path: "/api/v1/incidents",
    tag: "Risk",
    summary: "Verified past closures on NH-44, newest first",
    access: "public",
    query: incidentsQuery,
    success: {
      200: {
        description: "Past closures.",
        envelope: "list",
        meta: page(1),
        example: [
          // The first row of data/incidents.csv.
          {
            id: 1,
            date: "2018-02-06",
            end_date: "2018-02-06",
            zone_id: 5,
            place: "Ramsoo",
            hazard_type: "landslide",
            hours_closed: 9,
            vehicles_stranded: null,
            source_url:
              "https://www.business-standard.com/article/pti-stories/landslide-jammu-srinagar-highway-reopens-after-9-hrs-118020601542_1.html",
            source_publisher: "Business Standard (PTI)",
            confidence: "high",
          },
        ],
      },
    },
    errors: { 503: "The database can't be reached." },
  },

  // Advice
  {
    method: "post",
    path: "/api/v1/advice",
    tag: "Advice",
    summary: "SEND, HOLD, RAIL or DIVERT for one lot",
    description:
      "From the newest risk scores and the admin-set road status. Nothing is stored. The phone runs the same rules (`decide()`) offline.",
    access: "public",
    rateLimit: "advice",
    body: adviceRequest,
    bodyExample: exampleLot,
    success: { 200: { description: "The advice.", example: exampleAdvice } },
    errors: { 503: "The database can't be reached." },
  },

  // Reports
  {
    method: "get",
    path: "/api/v1/reports",
    tag: "Reports",
    summary: "Road reports on the map right now",
    description: "Unconfirmed or confirmed, not expired, not hidden. No user ids.",
    access: "public",
    query: publicReportsQuery,
    success: { 200: { description: "Reports.", envelope: "list", meta: page(1), example: [exampleReport] } },
    errors: { 503: "The database can't be reached." },
  },
  {
    method: "post",
    path: "/api/v1/reports",
    tag: "Reports",
    summary: "Report a hazard on the road",
    description:
      "multipart/form-data with an optional photo (JPEG, PNG or WebP, up to 5 MB; re-encoded to WebP without EXIF). Sending the same `Idempotency-Key` again returns the first answer.",
    access: ["driver", "agent", "admin"],
    rateLimit: "report",
    multipart: reportFields,
    headers: [
      { name: "Idempotency-Key", required: true, schema: idempotencyKey, description: "A UUID made once per report." },
    ],
    success: {
      201: {
        description: "A new report.",
        example: { id: REPORT_ID, status: "unconfirmed", outcome: "created" },
        headers: { Location: "/api/v1/reports/{id}" },
      },
      200: {
        description: "The same report again (`repeat`), or counted as a confirmation of one nearby (`merged`).",
        example: { id: REPORT_ID, status: "confirmed", outcome: "merged" },
      },
    },
    errors: {
      400: "Not multipart, or the Idempotency-Key is missing or not a UUID.",
      403: "Your role can't post reports, you are a driver who isn't verified yet (vouched by your agent or Aadhaar checked), or the write came without our Origin header.",
      409: "This Idempotency-Key was already used for another report.",
      413: "The form or the photo is too big.",
      503: "Reporting is paused (FEATURE_REPORTS_WRITE=false).",
    },
  },
  {
    method: "get",
    path: "/api/v1/reports/{id}/photo",
    tag: "Reports",
    summary: "A report's photo (WebP, EXIF removed)",
    access: "public",
    params: { id: reportId },
    success: { 200: { description: "The photo.", contentType: "image/webp", envelope: "none" } },
    errors: { 404: "No such visible report, or it has no photo." },
  },
  {
    method: "post",
    path: "/api/v1/reports/{id}/confirm",
    tag: "Reports",
    summary: "\"I see it too\"",
    description:
      "Verified drivers, agents and TCU, once per person, never on your own report. Two verified people within 2 km and 3 h, or TCU on its own, confirm a report.",
    access: ["driver", "agent", "admin"],
    rateLimit: "confirmation",
    params: { id: reportId },
    body: confirmBody,
    bodyExample: { lat: 33.25, lng: 75.19 },
    success: { 200: { description: "Counted.", example: { status: "confirmed", confirmations: 2, outcome: "confirmed" } } },
    errors: { 404: "No such report on the map.", 409: "Your own report, or you already confirmed it." },
  },
  {
    method: "post",
    path: "/api/v1/reports/{id}/flag",
    tag: "Reports",
    summary: "\"This is wrong\", with a reason",
    access: "signed-in",
    rateLimit: "confirmation",
    params: { id: reportId },
    body: flagBody,
    bodyExample: { reason: "not_there" },
    success: { 200: { description: "Flagged.", example: { status: "unconfirmed", outcome: "flagged" } } },
    errors: { 404: "No such report on the map.", 409: "You already flagged it." },
  },

  // Official updates
  {
    method: "get",
    path: "/api/v1/official-updates",
    tag: "Official updates",
    summary: "Official updates (copied from police or TCU advisories) still in force, with their source",
    access: "public",
    query: publicUpdatesQuery,
    success: { 200: { description: "Updates.", envelope: "list", meta: page(1), example: [exampleUpdate] } },
    errors: { 503: "The database can't be reached." },
  },

  // Me
  {
    method: "get",
    path: "/api/v1/me",
    tag: "Me",
    summary: "Your profile and role",
    access: "signed-in",
    success: { 200: { description: "You.", example: exampleMe } },
    errors: { 409: "Your profile isn't set up yet." },
  },
  {
    method: "patch",
    path: "/api/v1/me",
    tag: "Me",
    summary: "Change your name, language or location sharing",
    description: "Turning `location_consent` on records the privacy notice version; turning it off deletes your last position.",
    access: "signed-in",
    body: patchMeBody,
    bodyExample: { location_consent: true },
    success: { 200: { description: "Your updated profile.", example: exampleMe } },
    errors: { 409: "Your profile isn't set up yet." },
  },
  {
    method: "delete",
    path: "/api/v1/me",
    tag: "Me",
    summary: "Delete your account",
    description:
      "Your profile, shipments, invites, confirmations and photos go; your road reports stay without your user id. TCU accounts are removed by the operator.",
    access: "signed-in",
    rateLimit: "role",
    body: deleteMeBody,
    bodyExample: { confirm: "DELETE" },
    success: { 204: { description: "Deleted.", envelope: "none" } },
    errors: { 409: "TCU accounts can't delete themselves.", 503: "Your data was deleted, but the sign-in account wasn't. Try again." },
  },
  {
    method: "post",
    path: "/api/v1/me/onboarding",
    tag: "Me",
    summary: "Ask for your role once: grower, trader, agent or driver",
    description:
      "Saves the request as approval 'pending'. TCU approves it (POST /api/v1/admin/users/{id}/review); only then does the role reach the session token. Until then the account counts as signed in with no role.",
    access: "signed-in",
    rateLimit: "role",
    body: onboardingBody,
    bodyExample: { role: "driver", display_name: "Bashir", language: "ur" },
    success: {
      201: { description: "Request saved; waiting for TCU.", example: { ...exampleMe, approval: "pending", agent_id: null } },
      200: { description: "The same request again.", example: { ...exampleMe, approval: "pending", agent_id: null } },
    },
    errors: { 409: "You already asked for a different role; TCU can change it." },
  },
  {
    method: "get",
    path: "/api/v1/me/realtime-token",
    tag: "Me",
    summary: "Your short-lived session token, for Supabase Realtime on the board",
    access: "signed-in",
    success: { 200: { description: "The token (about a minute).", example: { token: "eyJhbGciOiJSUzI1NiJ9.example" } } },
  },

  // Shipments
  {
    method: "get",
    path: "/api/v1/shipments",
    tag: "Shipments",
    summary: "The shipments on your board, newest first",
    description: "An agent sees their own, a driver the ones assigned to them, a grower or trader the lots they saved, an admin all.",
    access: ["grower", "trader", "agent", "driver", "admin"],
    query: shipmentsQuery,
    success: { 200: { description: "Shipments.", envelope: "list", meta: page(1), example: [exampleShipment] } },
  },
  {
    method: "post",
    path: "/api/v1/shipments",
    tag: "Shipments",
    summary: "Save a lot or a truck on your board, with the advice of this moment",
    access: ["grower", "trader", "agent"],
    body: createShipmentBody,
    bodyExample: {
      variety: "delicious",
      tonnes: 10,
      harvest_date: "2026-11-14",
      destination: "azadpur",
      truck_type: "heavy",
      truck_number: "JK05G7712",
    },
    success: {
      201: {
        description: "Saved.",
        example: { id: SHIPMENT_ID, status: "planned", advice: exampleAdvice },
        headers: { Location: "/api/v1/shipments/{id}" },
      },
    },
    errors: { 409: "This truck already has a shipment that isn't delivered." },
  },
  {
    method: "get",
    path: "/api/v1/shipments/{id}",
    tag: "Shipments",
    summary: "One shipment on your board",
    access: ["grower", "trader", "agent", "driver", "admin"],
    params: { id: shipmentId },
    success: { 200: { description: "The shipment.", example: exampleShipment } },
    errors: { 404: "Not on your board." },
  },
  {
    method: "patch",
    path: "/api/v1/shipments/{id}",
    tag: "Shipments",
    summary: "Change status, driver or ETA (the owner agent)",
    access: ["agent"],
    params: { id: shipmentId },
    body: patchShipmentBody,
    bodyExample: { status: "moving", eta: LATER },
    success: { 200: { description: "The updated shipment.", example: exampleShipment } },
    errors: { 404: "Not one of your shipments.", 409: "Conflicts with another shipment." },
  },
  {
    method: "post",
    path: "/api/v1/shipments/{id}/location",
    tag: "Shipments",
    summary: "Share where the truck is (the assigned driver, with sharing on)",
    description: "Stored rounded to 2 decimals (about 1 km).",
    access: ["driver"],
    params: { id: shipmentId },
    body: locationBody,
    bodyExample: { lat: 33.2512, lng: 75.1934 },
    success: { 200: { description: "Saved.", example: { last_seen_at: T } } },
    errors: { 404: "Not a shipment assigned to you that is on the road.", 409: "Location sharing is off." },
  },

  // Agents
  {
    method: "get",
    path: "/api/v1/agents/invites",
    tag: "Agents",
    summary: "Your invite codes, newest first",
    access: ["agent"],
    success: {
      200: {
        description: "Codes.",
        envelope: "list",
        meta: page(1),
        example: [{ code: "K7MPQ2XR", created_at: T, expires_at: LATER, accepted_at: null, accepted_by_name: null }],
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/agents/invites",
    tag: "Agents",
    summary: "A new code a driver types to join your fleet",
    access: ["agent"],
    body: createInviteBody,
    bodyExample: { days: 7 },
    success: { 201: { description: "The code.", example: { code: "K7MPQ2XR", expires_at: LATER } } },
    errors: { 429: "You already have 20 open codes." },
  },
  {
    method: "post",
    path: "/api/v1/agents/invites/accept",
    tag: "Agents",
    summary: "Join an agent's fleet with their code (drivers)",
    access: ["driver"],
    rateLimit: "verification",
    body: acceptInviteBody,
    bodyExample: { code: "K7MPQ2XR" },
    success: { 200: { description: "Joined, or already joined with this code.", example: { agent_id: AGENT, outcome: "joined" } } },
    errors: { 404: "Unknown code.", 409: "Used by someone else, or expired." },
  },
  {
    method: "get",
    path: "/api/v1/agents/drivers",
    tag: "Agents",
    summary: "The drivers in your fleet",
    access: ["agent"],
    success: {
      200: {
        description: "Drivers.",
        envelope: "list",
        meta: page(1),
        example: [{ id: USER, display_name: "Bashir", verification_level: "email", location_consent: true }],
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/agents/drivers/{driverId}/vouch",
    tag: "Agents",
    summary: "Say you know this driver (raises them to agent_vouched)",
    access: ["agent"],
    rateLimit: "verification",
    params: { driverId: userId },
    success: { 200: { description: "Vouched.", example: { verification_level: "agent_vouched", outcome: "vouched" } } },
    errors: { 404: "Not a driver in your fleet." },
  },
  {
    method: "post",
    path: "/api/v1/verify/aadhaar-qr",
    tag: "Agents",
    summary: "Optional Aadhaar Secure QR check (raises you to aadhaar_qr)",
    description:
      "Behind `FEATURE_AADHAAR_QR` (404 when off). Send the digits your camera read from the Secure QR on an Aadhaar card or e-Aadhaar, with the consent tick. The server checks UIDAI's RSA signature against the pinned certificate (`config/uidai/certs.json`), reads the name and compares it with your profile name, and stores only the verdict, the last 4 digits, the consent version and the certificate version. The QR, name, date of birth, address and photo are never stored or logged. `test_key: true` means the demo key signed it (only when `AADHAAR_ALLOW_TEST_CERT=true`). Never send an Aadhaar number.",
    access: ["driver", "agent"],
    rateLimit: "verification",
    body: aadhaarQrBody,
    bodyExample: { qr: "48356781203947561029384756", consent: true, consent_version: AADHAAR_CONSENT_VERSION },
    success: {
      200: {
        description: "The check ran. A verdict of rejected is still a 200; `reason` says why.",
        example: { verdict: "verified", reason: null, verification_level: "aadhaar_qr", test_key: false },
      },
    },
    errors: {
      404: "The Aadhaar check is not turned on.",
      409: "Finish onboarding first.",
      503: "No UIDAI certificate is pinned on this server.",
    },
  },

  // Admin
  {
    method: "get",
    path: "/api/v1/admin/official-updates",
    tag: "Admin",
    summary: "Every version of every official update, deleted ones too",
    access: ["admin"],
    query: adminUpdatesQuery,
    success: { 200: { description: "History.", envelope: "list", meta: page(1), example: [exampleAdminUpdate] } },
  },
  {
    method: "post",
    path: "/api/v1/admin/official-updates",
    tag: "Admin",
    summary: "Post an official update (TCU only) with the https link where it was published",
    access: ["admin"],
    body: createUpdateBody,
    bodyExample: {
      zone_id: 4,
      kind: "one_way",
      title: "One-way traffic from Jammu to Srinagar",
      source_url: "https://example.org/traffic-advisory",
      source_name: "J&K Traffic Police",
      issued_at: "2026-11-26T15:00:00+05:30",
      valid_until: "2026-11-26T21:00:00+05:30",
    },
    success: {
      201: { description: "Posted (audited).", example: exampleAdminUpdate, headers: { Location: "/api/v1/admin/official-updates/{id}" } },
    },
  },
  {
    method: "patch",
    path: "/api/v1/admin/official-updates/{id}",
    tag: "Admin",
    summary: "Edit an update (makes a new version; the old one stays in the history)",
    access: ["admin"],
    params: { id: updateId },
    body: editUpdateBody,
    bodyExample: { title: "Road open both ways", kind: "reopened" },
    success: {
      200: {
        description: "The new version.",
        example: { ...exampleAdminUpdate, id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", version: 2, supersedes_id: UPDATE_ID },
      },
    },
    errors: { 404: "No such current update.", 409: "Someone edited it first." },
  },
  {
    method: "delete",
    path: "/api/v1/admin/official-updates/{id}",
    tag: "Admin",
    summary: "Take an update down, with a reason (kept in the history)",
    access: ["admin"],
    params: { id: updateId },
    body: deleteUpdateBody,
    bodyExample: { reason: "Posted for the wrong zone." },
    success: {
      200: { description: "Taken down.", example: { ...exampleAdminUpdate, deleted_at: T, delete_reason: "Posted for the wrong zone." } },
    },
    errors: { 404: "No such current update." },
  },
  {
    method: "get",
    path: "/api/v1/admin/reports",
    tag: "Admin",
    summary: "Every report, hidden ones too, with flag counts",
    access: ["admin"],
    query: adminReportsQuery,
    success: {
      200: { description: "Reports.", envelope: "list", meta: page(1), example: [{ ...exampleReport, status: "hidden", hidden_reason: "Hidden after 3 flags.", flags: 3 }] },
    },
  },
  {
    method: "patch",
    path: "/api/v1/admin/reports/{id}",
    tag: "Admin",
    summary: "Hide, resolve or restore a report, with a reason (audited)",
    access: ["admin"],
    params: { id: reportId },
    body: moderateBody,
    bodyExample: { action: "hide", reason: "Photo shows a person's face." },
    success: { 200: { description: "Done.", example: { id: REPORT_ID, status: "hidden" } } },
    errors: { 404: "No such report.", 409: "That action doesn't fit the report's status." },
  },
  {
    method: "patch",
    path: "/api/v1/admin/road-status",
    tag: "Admin",
    summary: "Set Mughal Road or the parcel train, with the link that says so",
    access: ["admin"],
    body: roadStatusBody,
    bodyExample: { item: "mughal_road", state: "closed", source_url: "https://example.org/mughal-road" },
    success: {
      200: {
        description: "Saved (audited).",
        example: { item: "mughal_road", state: "closed", source_url: "https://example.org/mughal-road", updated_at: T },
      },
    },
  },
  {
    method: "patch",
    path: "/api/v1/admin/users/{id}/role",
    tag: "Admin",
    summary: "TCU moves an approved user to another self-service role, with a reason (audited)",
    description: "TCU (admin) is the only staff role and can't be given in the app; the police role was merged into TCU.",
    access: ["admin"],
    rateLimit: "role",
    params: { id: clerkUserId },
    body: roleChangeBody,
    bodyExample: { role: "agent", reason: "Now runs his own trucks; checked with the transport union." },
    success: {
      200: {
        description: "Changed. The user's session picks it up within about a minute.",
        example: { id: USER, old_role: "driver", role: "agent", token_refresh_needed: true },
      },
    },
    errors: { 404: "No such user." },
  },
  {
    method: "get",
    path: "/api/v1/admin/users",
    tag: "Admin",
    summary: "Accounts waiting for TCU (or turned down), oldest first, with their sign-in email",
    access: ["admin"],
    query: usersListQuery,
    success: {
      200: {
        description: "Accounts.",
        envelope: "list",
        meta: page(1),
        example: [
          {
            id: USER,
            role: "driver",
            display_name: "Bashir",
            email: "bashir@example.com",
            verification_level: "email",
            approval: "pending",
            review_note: null,
            reviewed_at: null,
            created_at: T,
          },
        ],
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/admin/users/{id}/review",
    tag: "Admin",
    summary: "TCU approves or turns down a waiting account (audited)",
    description:
      "Approving puts the requested role into Clerk, so it reaches the person's token within about a minute. Turning down needs a reason, which the person sees on /me. Sending the same decision again changes nothing.",
    access: ["admin"],
    rateLimit: "review",
    params: { id: clerkUserId },
    body: reviewBody,
    bodyExample: { decision: "approved" },
    success: {
      200: { description: "Decided.", example: { id: USER, approval: "approved", role: "driver" } },
    },
    errors: { 404: "No such account.", 409: "Already approved." },
  },
  {
    method: "get",
    path: "/api/v1/admin/audit-log",
    tag: "Admin",
    summary: "Who did which privileged thing, when and why (read-only)",
    access: ["admin"],
    query: auditLogQuery,
    success: {
      200: {
        description: "Entries, newest first.",
        envelope: "list",
        meta: page(1),
        example: [
          {
            id: 42,
            at: T,
            actor_id: AGENT,
            actor_role: "admin",
            action: "official_update.created",
            target_type: "official_update",
            target_id: UPDATE_ID,
            reason: null,
            request_id: "4c1f7e2a9b3d",
            meta: null,
          },
        ],
      },
    },
  },

  {
    method: "get",
    path: "/api/v1/admin/dead-letters",
    tag: "Admin",
    summary: "Queue jobs that failed 5 times (read-only)",
    description: "Payloads hold ids only.",
    access: ["admin"],
    query: deadLettersQuery,
    success: {
      200: {
        description: "Failed jobs, newest first.",
        envelope: "list",
        meta: page(1),
        example: [
          {
            id: 3,
            msg_id: 118,
            job: "official_update.created",
            payload: { update_id: UPDATE_ID },
            attempts: 5,
            last_error: "Error: push service answered 500",
            enqueued_at: T,
            failed_at: LATER,
          },
        ],
      },
    },
  },

  // Alerts
  {
    method: "get",
    path: "/api/v1/push/subscriptions",
    tag: "Alerts",
    summary: "Your browsers with alerts on, and the zones each follows",
    access: "signed-in",
    success: {
      200: {
        description: "Your browsers.",
        envelope: "list",
        meta: page(1),
        example: [
          {
            id: "3c9e2b1a-7d4f-4a6b-9c8d-1e2f3a4b5c6d",
            endpoint: "https://fcm.googleapis.com/fcm/send/example-endpoint",
            zones: [3, 4],
            language: "hi",
            created_at: T,
            updated_at: T,
          },
        ],
      },
    },
  },
  {
    method: "post",
    path: "/api/v1/push/subscriptions",
    tag: "Alerts",
    summary: "Turn alerts on in this browser, or change its zones or language",
    description:
      "The endpoint and keys come from PushSubscription.toJSON(). Only the browsers' push services are accepted as endpoints (Google, Mozilla, Apple, Microsoft). Alerts go out for confirmed road reports and official updates in the zones you follow. At most 10 browsers per account.",
    access: "signed-in",
    rateLimit: "push",
    body: subscriptionBody,
    bodyExample: {
      endpoint: "https://fcm.googleapis.com/fcm/send/example-endpoint",
      keys: {
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
        auth: "tBHItJI5svbpez7KI4CCXg",
      },
      zones: [3, 4],
      language: "hi",
    },
    success: {
      201: {
        description: "Alerts are on in this browser.",
        headers: { Location: "The list of your browsers." },
        example: { id: "3c9e2b1a-7d4f-4a6b-9c8d-1e2f3a4b5c6d", zones: [3, 4], language: "hi" },
      },
      200: {
        description: "Already on; zones and language updated.",
        example: { id: "3c9e2b1a-7d4f-4a6b-9c8d-1e2f3a4b5c6d", zones: [3, 4], language: "hi" },
      },
    },
    errors: {
      403: "Pick your role on the account page before turning alerts on.",
      409: "Alerts are on in 10 browsers already. Turn one off first.",
      503: "Alerts are not set up on this server.",
    },
  },
  {
    method: "delete",
    path: "/api/v1/push/subscriptions",
    tag: "Alerts",
    summary: "Turn alerts off in this browser",
    description: "204 whether or not the browser was yours or on, so the answer says nothing about other people's browsers.",
    access: "signed-in",
    rateLimit: "push",
    body: unsubscribeBody,
    bodyExample: { endpoint: "https://fcm.googleapis.com/fcm/send/example-endpoint" },
    success: { 204: { description: "Off.", envelope: "none" } },
  },

  // Internal
  {
    method: "post",
    path: "/api/v1/internal/jobs/run",
    tag: "Internal",
    summary: "Run the queue worker (called by pg_cron, not by browsers)",
    description:
      "Takes waiting jobs from the queue for up to 20 s: a finished job is removed, a failed one is tried again later, and after 5 tries it goes to the dead letters. No Origin check; the X-Jobs-Secret header is the lock.",
    access: "public",
    checkOrigin: false,
    headers: [
      { name: "X-Jobs-Secret", required: true, schema: z.string(), description: "The JOBS_SECRET value (also in Supabase Vault as jobs_secret)." },
    ],
    success: {
      200: { description: "What this run did.", example: { done: 3, retry: 0, dead: 0, runs: 1 } },
    },
    errors: {
      401: "Send the worker secret in the X-Jobs-Secret header.",
      503: "The job worker is not set up on this server.",
    },
  },

  // Docs
  {
    method: "get",
    path: "/api/v1/openapi.json",
    tag: "Docs",
    summary: "This document",
    access: "public",
    success: { 200: { description: "OpenAPI 3.1.", envelope: "none" } },
  },
];
