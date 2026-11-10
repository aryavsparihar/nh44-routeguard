import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ZoneStatus() {
  // Read the database on every request, not once at build time.
  await connection();

  const supabase = await createClient();
  if (!supabase) {
    return <p>Supabase not connected (env vars missing)</p>;
  }

  const { count, error } = await supabase
    .from("zones")
    .select("*", { count: "exact", head: true });

  if (error || count === null) {
    return <p>Supabase not connected</p>;
  }

  return <p>Supabase connected: {count} zones</p>;
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">NH-44 RouteGuard</h1>
      <Suspense fallback={<p>Supabase connected: checking…</p>}>
        <ZoneStatus />
      </Suspense>
    </main>
  );
}
