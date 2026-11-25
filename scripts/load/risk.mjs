// Load test for the risk read path (BUILD_PROMPT sections 17 and 18).
//
//   node scripts/load/risk.mjs [base-url] [seconds]
//
// Default base is http://localhost:3000 (run `npm run build && npm start`
// first; dev mode is much slower and not what we measure). Prints p50/p90/p97.5/p99 (autocannon has no p95)
// latency and requests per second for:
//   cold  — the first request after the server starts (one sample)
//   warm  — plain GETs, served from the per-instance memory cache
//   304   — GETs that send the ETag back, answered with 304 and no body
// Keep runs short against the deployed app: every request spends credit.
import autocannon from "autocannon";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const duration = Number(process.argv[3] ?? 10);
const url = `${base}/api/v1/risk`;

function run(title, headers = {}) {
  return new Promise((resolve, reject) => {
    autocannon({ url, connections: 10, duration, headers }, (err, result) => {
      if (err) return reject(err);
      resolve({ title, result });
    });
  });
}

const t0 = performance.now();
const first = await fetch(url);
const coldMs = performance.now() - t0;
const etag = first.headers.get("etag");
await first.arrayBuffer();
if (first.status !== 200) {
  console.error(`GET ${url} answered ${first.status}; is the database set up?`);
  process.exit(1);
}

const rows = [await run("warm (200)")];
if (etag) rows.push(await run("revalidate (304)", { "if-none-match": etag }));
else console.warn("No ETag on /api/v1/risk, skipping the 304 run.");

console.log(`\n${url}, 10 connections, ${duration} s per run, ${new Date().toISOString()}`);
console.log(`cold first request: ${coldMs.toFixed(0)} ms\n`);
console.log("| Run | p50 ms | p90 ms | p97.5 ms | p99 ms | req/s | non-2xx/3xx |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const { title, result: r } of rows) {
  const bad = r.non2xx - (title.includes("304") ? r["3xx"] ?? 0 : 0);
  console.log(
    `| ${title} | ${r.latency.p50} | ${r.latency.p90} | ${r.latency.p97_5} | ${r.latency.p99} | ${Math.round(r.requests.average)} | ${bad} |`,
  );
}
