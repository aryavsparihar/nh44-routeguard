// How old the risk scores are, and whether that counts as stale
// (BUILD_PROMPT section 15). Shared by /api/v1/health/ready, the /status
// page and the stale-data banner, so they all use the same rule.
// Runs in the browser too: no server-only imports here.

// The job runs every hour (started at :07, retried at :37). Past 90 minutes
// at least one run has been missed.
export const STALE_AFTER_MINUTES = 90;

// Whole minutes since runAt (a Date or an ISO timestamp). A time in the
// future (clock drift between servers) counts as 0.
export function dataAgeMinutes(runAt: Date | string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(runAt).getTime();
  return Math.max(0, Math.floor(ms / 60_000));
}

// No run at all counts as stale.
export function isStale(ageMinutes: number | null): boolean {
  return ageMinutes === null || ageMinutes > STALE_AFTER_MINUTES;
}
