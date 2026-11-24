// seed.mjs: loads data/incidents.csv into the incidents table (BUILD_PROMPT section 14).
//
//   npm run db:seed-incidents -- --dry-run         check and show what would load (no keys needed)
//   npm run db:seed-incidents                      upsert the verified rows
//   npm run db:seed-incidents -- --remove-legacy   also delete old rows that have no CSV id
//
// * Runs scripts/validate_incidents.py first and stops if it fails.
// * Loads only verified rows (verified_by filled) that are not demo rows.
// * Upserts on external_id (the CSV id), so running it again updates rows
//   instead of adding copies. The CSV's event_start_date goes into "date".
// * Reads SUPABASE_URL and SUPABASE_SECRET_KEY from jobs/.env (the risk job's
//   gitignored file) or the environment. It never prints them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const removeLegacy = args.has('--remove-legacy');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// RFC 4180 CSV: quoted fields may contain commas, newlines and "" for a quote.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const text = (v) => (v === '' ? null : v);
const int = (v) => (v === '' ? null : Number.parseInt(v, 10));
const num = (v) => (v === '' ? null : Number.parseFloat(v));
const bool = (v) => (v === '' ? null : v === 'true');

export function toDbRow(r) {
  return {
    external_id: r.id,
    date: r.event_start_date,
    event_end_date: text(r.event_end_date),
    date_basis: text(r.date_basis),
    zone_id: int(r.zone_id),
    place: text(r.place),
    lat: num(r.lat),
    lng: num(r.lng),
    coord_basis: text(r.coord_basis),
    hazard_type: r.hazard_type,
    hours_closed: num(r.hours_closed),
    hours_basis: text(r.hours_basis),
    vehicles_stranded: int(r.vehicles_stranded),
    trucks_stranded: int(r.trucks_stranded),
    apple_trucks_mentioned: bool(r.apple_trucks_mentioned),
    source_url: r.source_url,
    source_publisher: text(r.source_publisher),
    source_published_date: text(r.source_published_date),
    evidence_quote: text(r.evidence_quote),
    archive_url: text(r.archive_url),
    second_source_url: text(r.second_source_url),
    added_by: text(r.added_by),
    verified_by: text(r.verified_by),
    verified_on: text(r.verified_on),
    confidence: text(r.confidence),
    notes: text(r.notes),
    is_demo: r.is_demo === 'true',
  };
}

async function main() {
  try {
    execFileSync('python3', ['scripts/validate_incidents.py'], { stdio: 'inherit' });
  } catch {
    console.error('incidents.csv did not pass the validator, so nothing was loaded.');
    process.exit(1);
  }

  const all = parseCsv(fs.readFileSync(path.resolve('data/incidents.csv'), 'utf8'));
  const rows = all.filter((r) => r.verified_by && r.is_demo !== 'true').map(toDbRow);
  console.log(`${rows.length} of ${all.length} rows are verified and will be loaded.`);

  if (dryRun) {
    if (rows[0]) console.log('First row:', rows[0]);
    console.log('Dry run: nothing was sent.');
    return;
  }

  loadEnvFile(path.resolve('jobs/.env'));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY (jobs/.env).');
    process.exit(1);
  }
  const rest = `${url.replace(/\/$/, '')}/rest/v1/incidents`;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // legacy service_role JWT

  if (rows.length) {
    const res = await fetch(`${rest}?on_conflict=external_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      console.error(`Upsert failed (${res.status}):`, await res.text());
      process.exit(1);
    }
    console.log(`Upserted ${rows.length} incident(s).`);
  }

  if (removeLegacy) {
    const res = await fetch(`${rest}?external_id=is.null`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=representation' },
    });
    if (!res.ok) {
      console.error(`Removing old rows failed (${res.status}):`, await res.text());
      process.exit(1);
    }
    console.log(`Removed ${(await res.json()).length} old row(s) that had no CSV id.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  });
}
