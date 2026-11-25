// Fails CI when the three message files disagree (BUILD_PROMPT section 12):
// a key missing in one language, an empty string, or a message whose
// placeholders ({time}, {minutes, plural, ...}) differ from English.
//
//   node scripts/ci/check-i18n.mjs
import fs from 'node:fs';

export const LOCALES = ['en', 'hi', 'ur'];

// { a: { b: "x" } } → Map { "a.b" => "x" }
export function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

// The top-level argument names of an ICU message, with their type:
// "{time}" → "time", "{minutes, plural, ...}" → "minutes:plural".
// Text inside plural branches ("# minutes ago") is translated, so only the
// argument names and types must match.
export function placeholders(message) {
  const found = new Set();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const c = message[i];
    if (c === '{') {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z0-9_]+)\s*(?:,\s*([a-z]+))?/.exec(message.slice(i));
        if (m) found.add(m[2] ? `${m[1]}:${m[2]}` : m[1]);
      }
      depth++;
    } else if (c === '}') {
      depth--;
    }
  }
  return [...found].sort().join(',');
}

export function compare(catalogs) {
  const problems = [];
  const [base, ...others] = LOCALES;
  const ref = flatten(catalogs[base]);
  for (const locale of LOCALES) {
    for (const [key, value] of flatten(catalogs[locale])) {
      if (typeof value !== 'string' || !value.trim()) problems.push(`${locale}: ${key} is empty or not text`);
    }
  }
  for (const locale of others) {
    const cat = flatten(catalogs[locale]);
    for (const [key, value] of ref) {
      if (!cat.has(key)) problems.push(`${locale}: missing ${key}`);
      else if (placeholders(String(cat.get(key))) !== placeholders(String(value)))
        problems.push(`${locale}: ${key} has placeholders {${placeholders(String(cat.get(key)))}}, English has {${placeholders(String(value))}}`);
    }
    for (const key of cat.keys()) if (!ref.has(key)) problems.push(`${locale}: ${key} is not in en.json`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalogs = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(`messages/${l}.json`, 'utf8'))]));
  const problems = compare(catalogs);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`${problems.length} problem(s) in messages/*.json`);
    process.exit(1);
  }
  console.log(`messages: ${flatten(catalogs.en).size} keys, same in ${LOCALES.join(', ')}`);
}
