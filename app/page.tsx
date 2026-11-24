import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/src/server/db";
import { countZones } from "@/src/server/zones/zones.repository";

async function ZoneStatus() {
  // Read the database on every request, not once at build time.
  await connection();

  const count = await getDb()
    .then(countZones)
    .catch(() => null);
  if (count === null) return <p>Database not connected</p>;
  return <p>Database connected: {count} zones</p>;
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">NH-44 RouteGuard</h1>
      <Suspense fallback={<p>Database connected: checking…</p>}>
        <ZoneStatus />
      </Suspense>
    </main>
  );
}
