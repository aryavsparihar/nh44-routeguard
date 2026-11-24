import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve('jobs/.env'));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SECRET_KEY in jobs/.env');
  process.exit(1);
}

const csvFilePath = path.resolve('data/incidents.csv');
const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/incidents`;
const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
};

async function seed() {
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: File not found at ${csvFilePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvFilePath, 'utf8').trim();
  const lines = content.split(/\r?\n/);
  const csvHeaders = lines[0].split(',').map((h) => h.trim());

  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row = Object.fromEntries(csvHeaders.map((h, i) => [h, values[i]]));

    return {
      date: row.date,
      zone_id: parseInt(row.zone_id, 10),
      place: row.place,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      hazard_type: row.hazard_type.toLowerCase(),
      hours_closed: parseFloat(row.hours_closed),
      trucks_stranded: parseInt(row.trucks_stranded, 10),
      source_url: row.source_url,
    };
  });

  // 1. Fetch existing incidents to avoid duplicates on re-run
  const getRes = await fetch(`${restUrl}?select=date,zone_id,place`, { headers });
  if (!getRes.ok) {
    console.error('Error fetching existing incidents:', await getRes.text());
    process.exit(1);
  }

  const existing = await getRes.json();
  const existingKeys = new Set(
    existing.map((r) => `${r.date}|${r.zone_id}|${r.place}`)
  );

  const newRows = rows.filter(
    (r) => !existingKeys.has(`${r.date}|${r.zone_id}|${r.place}`)
  );

  if (newRows.length === 0) {
    console.log('All incidents already exist in Supabase. Nothing new to insert.');
    return;
  }

  // 2. Insert only new rows
  const postRes = await fetch(restUrl, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(newRows),
  });

  if (!postRes.ok) {
    console.error('Error inserting incidents:', await postRes.text());
    process.exit(1);
  }

  console.log(`Successfully inserted ${newRows.length} new incident(s).`);
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
