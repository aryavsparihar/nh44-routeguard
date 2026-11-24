import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { getDb } from "@/src/server/db";
import { latestZoneRisk, type ZoneRisk } from "@/src/server/risk/risk.repository";
import { STALE_AFTER_MINUTES, dataAgeMinutes, isStale } from "@/src/shared/freshness";

// Internal check page for the team (not one of the app screens).
// Shows the newest risk job run: the 6 zones at horizon 0.

export const metadata: Metadata = { title: "Status · NH-44 RouteGuard" };

function fmt(d: Date) {
  const ist = d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC (${ist} IST)`;
}

async function LatestRun() {
  await connection(); // read the database on every visit

  let data: ZoneRisk[];
  try {
    data = await latestZoneRisk(await getDb(), 0);
  } catch {
    return <p>Could not read latest_risk (database not connected or not reachable).</p>;
  }
  if (!data.length) return <p>No risk job run yet.</p>;

  const runAt = data[0].run_at;
  if (!runAt) return <p>Latest run has no timestamp.</p>;
  // Rendered per visit (after connection()), so "now" is the visit time.
  const ageMin = dataAgeMinutes(runAt);

  return (
    <>
      <p>
        Last run: {fmt(runAt)} · {ageMin} min ago · {data[0].model_version}
        {isStale(ageMin) ? ` · ⚠ older than ${STALE_AFTER_MINUTES} min, check GitHub Actions` : ""}
      </p>
      <table>
        <thead>
          <tr>
            <th>Zone</th>
            <th>Score</th>
            <th>Range</th>
            <th>Level</th>
            <th>Top hazard</th>
            <th>Confidence</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.zone_id}>
              <td>
                {r.zone_id}. {r.zone_name}
              </td>
              <td>{r.overall?.toFixed(2)}</td>
              <td>
                {r.risk_low?.toFixed(2)}–{r.risk_high?.toFixed(2)}
              </td>
              <td>{r.level}</td>
              <td>{r.top_hazard ?? "–"}</td>
              <td>{r.confidence}</td>
              <td>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function StatusPage() {
  return (
    <main className="p-6 text-sm [&_table]:mt-4 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
      <h1 className="text-lg font-semibold">Risk job status</h1>
      <p>Horizon 0 h (now). Internal check page.</p>
      <Suspense fallback={<p>Loading latest run…</p>}>
        <LatestRun />
      </Suspense>
    </main>
  );
}
