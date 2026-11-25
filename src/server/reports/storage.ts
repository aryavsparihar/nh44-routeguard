import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { ServiceUnavailableError } from "@/src/server/http/errors";

// Report photos in the private Storage bucket "report-photos"
// (migration 20261125160000_reports_write.sql).
//
// Uploads use the reporter's own Clerk session token, so Storage's RLS
// decides: you can only write into the folder named after your user id.
// Signed links are made as a signed-out visitor, which the policy allows only
// for photos of reports that aren't hidden. No secret key is used here.
export const PHOTO_BUCKET = "report-photos";
export const SIGNED_URL_SECONDS = 600; // 10 minutes (section 10)

function client(token?: string) {
  const env = getSupabasePublicEnv();
  if (!env) throw new ServiceUnavailableError("Photo storage is not set up on this server.");
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { accessToken: async () => token } : {}),
  });
}

async function sessionToken(): Promise<string> {
  const token = await (await auth()).getToken();
  if (!token) throw new ServiceUnavailableError("Could not read your session for the photo upload.");
  return token;
}

export function photoPath(userId: string, clientId: string): string {
  return `${userId}/${clientId}.webp`;
}

export async function uploadPhoto(path: string, webp: Buffer): Promise<void> {
  const { error } = await client(await sessionToken())
    .storage.from(PHOTO_BUCKET)
    .upload(path, webp, { contentType: "image/webp", upsert: true, cacheControl: "600" });
  if (error) throw new ServiceUnavailableError("The photo could not be saved. Try again.");
}

// Best effort: used when a report was merged into an earlier one.
export async function removePhoto(path: string): Promise<void> {
  await client(await sessionToken()).storage.from(PHOTO_BUCKET).remove([path]);
}

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await client().storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return error || !data ? null : data.signedUrl;
}
