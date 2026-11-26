// What is still in force at a given time. The server only sends reports that
// haven't expired and updates that are still valid, but a phone offline shows
// its saved copy, which can be hours old: these keep it from showing a report
// past its expiry time or an update past its end.
// Runs in the browser too: no server-only imports here.

// now = 0 means the clock isn't read yet (the prerendered page): keep all.
export function reportsInForce<T extends { expires_at: string }>(list: readonly T[], now: number): T[] {
  return now === 0 ? [...list] : list.filter((r) => Date.parse(r.expires_at) > now);
}

export function updatesInForce<T extends { valid_until: string | null }>(list: readonly T[], now: number): T[] {
  return now === 0 ? [...list] : list.filter((u) => u.valid_until === null || Date.parse(u.valid_until) > now);
}
