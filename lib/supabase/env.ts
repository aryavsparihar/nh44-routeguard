// Public Supabase settings for the Next.js app.
// Only the URL and the publishable (or legacy anon) key are ever used here.
// The secret / service_role key must never be imported into app code.

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
