// GET /api/v1/me/realtime-token: the caller's own Clerk session token (it
// lives about a minute), so the board can open Supabase Realtime as them and
// RLS decides which shipment changes they hear about. It is the same token
// the browser already holds in Clerk's __session cookie; this route only
// saves loading Clerk's whole browser library on the board. Never cached.
import { auth } from "@clerk/nextjs/server";
import { AuthError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";

export const GET = withApi({ access: "signed-in" }, async () => {
  const token = await (await auth()).getToken();
  if (!token) throw new AuthError();
  return ok({ token }, { headers: { "Cache-Control": "no-store" } });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
