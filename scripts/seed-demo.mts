// Demo accounts and demo rows for the round (BUILD_PROMPT section 19).
//
//   node scripts/seed-demo.mts --dry-run   show what it would do (no keys needed)
//   node scripts/seed-demo.mts             create or update everything
//   node scripts/seed-demo.mts --reset     remove the demo rows (is_demo) and
//                                         the demo accounts' reports and
//                                         official updates
//
// Idempotent: accounts are found by email, rows are replaced, so running it
// twice never makes copies. Aryaveer runs it on his machine; it needs:
//   CLERK_SECRET_KEY                     .env.local
//   SUPABASE_URL (or NEXT_PUBLIC_…)      .env.local or jobs/.env
//   SUPABASE_SECRET_KEY                  jobs/.env
//   DEMO_APP_URL (default http://localhost:3000), a running app: each demo
//   shipment's advice comes from its POST /api/v1/advice, the same code the
//   board uses, so no advice is made up here.
// It never prints a key.
//
// Accounts use Clerk test emails (…+clerk_test@example.com). On a Clerk
// development instance they sign in with the code 424242 and no email is
// sent. No real people, phone numbers or truck numbers.
import fs from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const reset = args.has("--reset");

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const key = t.slice(0, t.indexOf("=")).trim();
    const val = t.slice(t.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
const root = path.resolve(import.meta.dirname, "..");
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "jobs/.env"));

// ---- What we create --------------------------------------------------------

type Role = "admin" | "police" | "agent" | "driver" | "grower";
type Level = "email" | "agent_vouched" | "official";
type DemoUser = { key: string; email: string; name: string; role: Role; level: Level };

const USERS: DemoUser[] = [
  { key: "admin", email: "routeguard.admin+clerk_test@example.com", name: "Demo admin", role: "admin", level: "official" },
  { key: "police", email: "routeguard.police+clerk_test@example.com", name: "Demo police account", role: "police", level: "official" },
  { key: "agent", email: "routeguard.agent+clerk_test@example.com", name: "Demo agent", role: "agent", level: "email" },
  { key: "driverVouched", email: "routeguard.driver1+clerk_test@example.com", name: "Demo driver (vouched)", role: "driver", level: "agent_vouched" },
  { key: "driverNew", email: "routeguard.driver2+clerk_test@example.com", name: "Demo driver (not vouched)", role: "driver", level: "email" },
  { key: "grower", email: "routeguard.grower+clerk_test@example.com", name: "Demo grower", role: "grower", level: "email" },
];

type Lot = { variety: string; days_since_picking: number; tonnes: number; destination: string; truck_type: "light" | "heavy" };
type DemoShipment = {
  truck: string;
  lot: Lot;
  status: "planned" | "holding" | "moving" | "stuck" | "on_rail" | "delivered";
  driver: "driverVouched" | "driverNew" | null;
  // Last position (lat, lng) for trucks on the road, rounded to 0.01° (~1 km)
  // like the app does. Places are on NH-44, from data/incidents.csv.
  at?: [number, number];
};

// Fake truck numbers in the JK format; "ZZ" series is not issued in J&K.
const SHIPMENTS: DemoShipment[] = [
  { truck: "JK02ZZ0001", lot: { variety: "delicious", days_since_picking: 4, tonnes: 9, destination: "azadpur", truck_type: "heavy" }, status: "planned", driver: null },
  { truck: "JK02ZZ0002", lot: { variety: "kullu_delicious", days_since_picking: 10, tonnes: 12, destination: "azadpur", truck_type: "heavy" }, status: "holding", driver: "driverVouched" },
  { truck: "JK02ZZ0003", lot: { variety: "maharaji", days_since_picking: 6, tonnes: 8, destination: "narwal", truck_type: "heavy" }, status: "moving", driver: "driverVouched", at: [33.34, 75.19] },
  { truck: "JK02ZZ0004", lot: { variety: "ambri", days_since_picking: 15, tonnes: 5, destination: "narwal", truck_type: "light" }, status: "stuck", driver: "driverNew", at: [33.3, 75.18] },
  { truck: "JK02ZZ0005", lot: { variety: "delicious", days_since_picking: 8, tonnes: 10, destination: "azadpur", truck_type: "heavy" }, status: "on_rail", driver: null },
  { truck: "JK02ZZ0006", lot: { variety: "delicious", days_since_picking: 3, tonnes: 11, destination: "parimpora", truck_type: "heavy" }, status: "delivered", driver: null },
];

const HOUR = 3600_000;
const now = Date.now();

type DemoReport = {
  by: "police" | "driverVouched" | "driverNew";
  source: "police" | "driver";
  hazard: "landslide" | "rockfall" | "snow_ice";
  zone: number;
  at: [number, number];
  status: "confirmed" | "unconfirmed" | "expired";
  confirmations: number;
  ageHours: number;
  lifeHours: number; // from config/report-rules.json expiry_hours
  note: string;
};

const REPORTS: DemoReport[] = [
  { by: "police", source: "police", hazard: "rockfall", zone: 4, at: [33.3028, 75.1798], status: "confirmed", confirmations: 0, ageHours: 1, lifeHours: 6, note: "Demo report: stones on the road near Digdol, one lane open." },
  { by: "driverVouched", source: "driver", hazard: "landslide", zone: 5, at: [33.3365, 75.1924], status: "confirmed", confirmations: 2, ageHours: 2, lifeHours: 6, note: "Demo report: debris near Ramsoo, traffic stopped." },
  { by: "driverNew", source: "driver", hazard: "landslide", zone: 3, at: [33.1775, 75.3003], status: "unconfirmed", confirmations: 0, ageHours: 0.5, lifeHours: 6, note: "Demo report: small slide near Peerah." },
  { by: "driverVouched", source: "driver", hazard: "snow_ice", zone: 5, at: [33.4379, 75.1955], status: "expired", confirmations: 1, ageHours: 20, lifeHours: 12, note: "Demo report: ice on the road at Banihal (old)." },
];

// Copies of what public sources reported, from verified rows of
// data/incidents.csv. Titles say "Demo" and give the original date, so
// nobody mistakes them for a current advisory.
const UPDATES = [
  {
    zone_id: 2,
    kind: "closure" as const,
    title: "Demo update: highway shut after landslides at Jakhani and Samroli (reported 22 Jul 2026)",
    body: "Demo copy of a past news report, to show how official updates look. Check the source.",
    source_url: "https://www.tribuneindia.com/news/j-k/jammu-srinagar-highway-shut-for-third-day-following-landslides/",
    source_name: "The Tribune",
  },
  {
    zone_id: 4,
    kind: "reopened" as const,
    title: "Demo update: highway reopened after 3 days near Digdol (reported 6 Apr 2026)",
    body: "Demo copy of a past news report, to show how official updates look. Check the source.",
    source_url: "https://www.lokmattimes.com/national/srinagar-jammu-national-highway-reopened-after-3-days",
    source_name: "Lokmat Times (IANS)",
  },
];

// ---- Dry run ---------------------------------------------------------------

if (dryRun) {
  console.log(reset ? "Would remove:" : "Would create or update:");
  console.log(`  ${USERS.length} Clerk test accounts: ${USERS.map((u) => `${u.role} <${u.email}>`).join(", ")}`);
  console.log(`  ${SHIPMENTS.length} shipments on the demo agent's board (${SHIPMENTS.map((s) => s.status).join(", ")})`);
  console.log(`  ${REPORTS.length} reports (${REPORTS.map((r) => r.status).join(", ")})`);
  console.log(`  ${UPDATES.length} official updates with sources, and road_status (Mughal Road, rail) set to unknown`);
  process.exit(0);
}

// ---- Clients ---------------------------------------------------------------

function need(name: string, ...alts: string[]): string {
  for (const n of [name, ...alts]) if (process.env[n]) return process.env[n]!;
  console.error(`Missing ${name}. See the comment at the top of scripts/seed-demo.mts.`);
  process.exit(1);
}
const clerk = createClerkClient({ secretKey: need("CLERK_SECRET_KEY") });
const db = createClient(need("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const appUrl = (process.env.DEMO_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function check<T>(label: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    console.error(`${label}: ${res.error.message}`);
    process.exit(1);
  }
  return res.data;
}

async function findUserId(email: string): Promise<string | null> {
  const list = await clerk.users.getUserList({ emailAddress: [email] });
  return list.data[0]?.id ?? null;
}

// ---- Reset -----------------------------------------------------------------

if (reset) {
  const ids = (await Promise.all(USERS.map((u) => findUserId(u.email)))).filter((x): x is string => !!x);
  check("reports", await db.from("reports").delete().eq("is_demo", true));
  if (ids.length) check("demo accounts' reports", await db.from("reports").delete().in("user_id", ids));
  check("shipments", await db.from("shipments").delete().eq("is_demo", true));
  if (ids.length) check("official updates", await db.from("official_updates").delete().in("created_by", ids));
  if (ids.length) check("demo Aadhaar checks", await db.from("verifications").delete().in("user_id", ids).eq("method", "aadhaar_qr"));
  console.log("Removed demo reports, shipments and the demo accounts' official updates.");
  console.log("The demo accounts stay; delete them in the Clerk dashboard if you want them gone.");
  process.exit(0);
}

// ---- Accounts --------------------------------------------------------------

const ids: Record<string, string> = {};
for (const u of USERS) {
  let id = await findUserId(u.email);
  if (!id) {
    const created = await clerk.users.createUser({
      emailAddress: [u.email],
      firstName: u.name,
      skipPasswordRequirement: true,
      publicMetadata: { role: u.role },
    });
    id = created.id;
    console.log(`created ${u.role} account`);
  } else {
    await clerk.users.updateUserMetadata(id, { publicMetadata: { role: u.role } });
  }
  ids[u.key] = id;
}

for (const u of USERS) {
  const agentId = u.role === "driver" ? ids.agent : null;
  check(
    `user ${u.key}`,
    await db.from("users").upsert(
      { id: ids[u.key], role: u.role, display_name: u.name, agent_id: agentId, language: "en", verification_level: u.level, deleted_at: null },
      { onConflict: "id" },
    ),
  );
}

// Demo Aadhaar QR checks (docs/demo/aadhaar-demo-qr.png) start over, so the
// demo driver can scan it again on stage.
check("demo Aadhaar checks", await db.from("verifications").delete().in("user_id", Object.values(ids)).eq("method", "aadhaar_qr"));

// The vouched driver's verification record, once.
const vouch = check(
  "verifications",
  await db.from("verifications").select("id").eq("user_id", ids.driverVouched).eq("method", "agent_vouch").limit(1),
);
if (!vouch?.length) {
  check(
    "verifications insert",
    await db.from("verifications").insert({ user_id: ids.driverVouched, method: "agent_vouch", verdict: "verified", verified_by: ids.agent }),
  );
}

// ---- Road status: unknown until an admin sets it with a source --------------

for (const item of ["mughal_road", "rail_parcel"]) {
  check(`road_status ${item}`, await db.from("road_status").upsert({ item, state: "unknown", source_url: null, updated_by: ids.admin }));
}

// ---- Shipments ---------------------------------------------------------------

async function adviceFor(lot: Lot): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${appUrl}/api/v1/advice`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: appUrl },
      body: JSON.stringify(lot),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { data: Record<string, unknown> }).data;
  } catch (err) {
    console.warn(`advice not saved (${err instanceof Error ? err.message : err}); is the app running at ${appUrl}?`);
    return null;
  }
}

check("old demo shipments", await db.from("shipments").delete().eq("is_demo", true));
for (const s of SHIPMENTS) {
  const advice = await adviceFor(s.lot);
  const harvest = new Date(now - s.lot.days_since_picking * 24 * HOUR).toISOString().slice(0, 10);
  const onRoad = !!s.at;
  check(
    `shipment ${s.truck}`,
    await db.from("shipments").insert({
      agent_id: ids.agent,
      driver_id: s.driver ? ids[s.driver] : null,
      truck_number: s.truck,
      variety: s.lot.variety,
      tonnes: s.lot.tonnes,
      harvest_date: harvest,
      truck_type: s.lot.truck_type,
      origin: "Sopore",
      destination: s.lot.destination,
      status: s.status,
      advice,
      last_location: onRoad ? `SRID=4326;POINT(${s.at![1]} ${s.at![0]})` : null,
      last_seen_at: onRoad ? new Date(now - 10 * 60_000).toISOString() : null,
      created_by: ids.agent,
      is_demo: true,
    }),
  );
}

// ---- Reports -----------------------------------------------------------------

check("old demo reports", await db.from("reports").delete().eq("is_demo", true));
// Reports the signed-in Playwright tests posted as demo users.
check("demo accounts' reports", await db.from("reports").delete().in("user_id", Object.values(ids)));
for (const r of REPORTS) {
  const created = now - r.ageHours * HOUR;
  check(
    `report ${r.hazard} z${r.zone}`,
    await db.from("reports").insert({
      user_id: ids[r.by],
      source: r.source,
      hazard_type: r.hazard,
      location: `SRID=4326;POINT(${r.at[1]} ${r.at[0]})`,
      zone_id: r.zone,
      note: r.note,
      status: r.status,
      confirmations: r.confirmations,
      created_at: new Date(created).toISOString(),
      expires_at: new Date(created + r.lifeHours * HOUR).toISOString(),
      is_demo: true,
    }),
  );
}

// ---- Official updates --------------------------------------------------------

check("old demo updates", await db.from("official_updates").delete().in("created_by", [ids.admin, ids.police]));
for (const [i, u] of UPDATES.entries()) {
  check(
    `official update ${i + 1}`,
    await db.from("official_updates").insert({
      ...u,
      issued_at: new Date(now - (i + 1) * HOUR).toISOString(),
      valid_until: new Date(now + 12 * HOUR).toISOString(),
      created_by: i === 0 ? ids.police : ids.admin,
    }),
  );
}

console.log(`Demo data ready: ${USERS.length} accounts, ${SHIPMENTS.length} shipments, ${REPORTS.length} reports, ${UPDATES.length} official updates.`);
console.log("Sign in with any demo email and the code 424242.");
