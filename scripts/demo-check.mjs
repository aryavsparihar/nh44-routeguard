// Demo-day check (docs/demo-script.md, "Before we present"). Read-only: it
// only sends GET requests and never writes anything. It prints one PASS or
// FAIL line per check and never prints a key.
//
//   node scripts/demo-check.mjs http://localhost:3000
//   node scripts/demo-check.mjs https://<live url>
//
// The public checks need nothing. The account checks also need
// CLERK_SECRET_KEY and SUPABASE_URL + SUPABASE_SECRET_KEY (read from
// .env.local and jobs/.env, like the seed); without them they are SKIP.
// Exit code 1 if any check fails.
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// The demo accounts the seed makes (scripts/seed-demo.mts), with the role
// and approval each must have.
export const DEMO_ACCOUNTS = [
  { email: "routeguard.admin+clerk_test@example.com", role: "admin", approval: "approved" },
  { email: "routeguard.agent+clerk_test@example.com", role: "agent", approval: "approved" },
  { email: "routeguard.driver1+clerk_test@example.com", role: "driver", approval: "approved", level: "agent_vouched" },
  { email: "routeguard.driver2+clerk_test@example.com", role: "driver", approval: "approved", level: "email" },
  { email: "routeguard.grower+clerk_test@example.com", role: "grower", approval: "approved" },
  { email: "routeguard.newdriver+clerk_test@example.com", role: "driver", approval: "pending" },
];

let failed = 0;
function line(result, name, detail = "") {
  if (result === "FAIL") failed += 1;
  console.log(`${result.padEnd(4)}  ${name}${detail ? `: ${detail}` : ""}`);
}

async function getJson(pathname) {
  const res = await fetch(`${base}${pathname}`, { headers: { accept: "application/json" } });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { status: res.status, body };
}

// One check: run it, turn an exception into a FAIL line.
async function check(name, fn) {
  try {
    const [result, detail] = await fn();
    line(result, name, detail);
  } catch (err) {
    line("FAIL", name, err instanceof Error ? err.message : String(err));
  }
}

// ---- Public checks -----------------------------------------------------------

await check("health/ready answers", async () => {
  const { status, body } = await getJson("/api/v1/health/ready");
  return status === 200 && body?.data?.database === "ok"
    ? ["PASS", "database ok"]
    : ["FAIL", `HTTP ${status}`];
});

await check("risk data is fresh", async () => {
  const { body } = await getJson("/api/v1/health/ready");
  const d = body?.data;
  if (!d) return ["FAIL", "no answer"];
  return d.stale === false
    ? ["PASS", `${d.data_age_minutes} min old (limit ${d.stale_after_minutes})`]
    : ["FAIL", `stale (${d.data_age_minutes ?? "no"} min old): run the risk job (risk-job.yml, Run workflow)`];
});

await check("an official update is in force", async () => {
  const { status, body } = await getJson("/api/v1/official-updates");
  const now = Date.now();
  const live = (body?.data ?? []).filter((u) => !u.valid_until || Date.parse(u.valid_until) > now);
  return live.length > 0 ? ["PASS", `${live.length} in force`] : ["FAIL", `HTTP ${status}, none in force: run the seed`];
});

await check("demo reports are on the map", async () => {
  const { status, body } = await getJson("/api/v1/reports");
  const demo = (body?.data ?? []).filter((r) => r.is_demo);
  const confirmed = demo.filter((r) => r.status === "confirmed").length;
  const unconfirmed = demo.filter((r) => r.status === "unconfirmed").length;
  // Steps 3 and 5 of the demo script need a confirmed and an unconfirmed one.
  return confirmed > 0 && unconfirmed > 0
    ? ["PASS", `${confirmed} confirmed, ${unconfirmed} unconfirmed`]
    : ["FAIL", `HTTP ${status}, ${confirmed} confirmed, ${unconfirmed} unconfirmed: run the seed`];
});

await check("storm replays load", async () => {
  const { status, body } = await getJson("/api/v1/risk/replays");
  const list = body?.data ?? [];
  if (status !== 200 || list.length === 0) return ["FAIL", `HTTP ${status}, ${list.length} replays`];
  for (const r of list) {
    const one = await getJson(`/api/v1/risk/replays/${encodeURIComponent(r.id)}`);
    if (one.status !== 200) return ["FAIL", `${r.id}: HTTP ${one.status}`];
  }
  return ["PASS", `${list.length} replays`];
});

// ---- Account checks (need keys, read-only) -------------------------------------

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const key = t.slice(0, t.indexOf("=")).trim();
    const val = t.slice(t.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
const root = path.resolve(import.meta.dirname, "..");
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "jobs/.env"));

const clerkKey = process.env.CLERK_SECRET_KEY;
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

async function clerkUserId(email) {
  const url = `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${clerkKey}` } });
  if (!res.ok) throw new Error(`Clerk HTTP ${res.status}`);
  const users = await res.json();
  return users[0] ?? null;
}

async function userRow(id) {
  const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=role,approval,verification_level,deleted_at`;
  const res = await fetch(url, { headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` } });
  if (!res.ok) throw new Error(`database HTTP ${res.status}`);
  return (await res.json())[0] ?? null;
}

for (const a of DEMO_ACCOUNTS) {
  const name = `account ${a.email.split("+")[0]} (${a.role}, ${a.approval})`;
  if (!clerkKey || !supabaseUrl || !supabaseKey) {
    line("SKIP", name, "no keys here");
    continue;
  }
  await check(name, async () => {
    const user = await clerkUserId(a.email);
    if (!user) return ["FAIL", "no Clerk account: run the seed"];
    const row = await userRow(user.id);
    if (!row || row.deleted_at) return ["FAIL", "no users row: run the seed"];
    const tokenRole = user.public_metadata?.role ?? null;
    // Approved accounts carry their role in Clerk; a pending one has none yet.
    const wantTokenRole = a.approval === "approved" ? a.role : null;
    const problems = [];
    if (row.role !== a.role) problems.push(`role ${row.role}`);
    if (row.approval !== a.approval) problems.push(`approval ${row.approval}`);
    if (tokenRole !== wantTokenRole) problems.push(`Clerk role ${tokenRole}`);
    if (a.level && row.verification_level !== a.level) problems.push(`level ${row.verification_level}`);
    return problems.length === 0 ? ["PASS", ""] : ["FAIL", `${problems.join(", ")}: run the seed`];
  });
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
