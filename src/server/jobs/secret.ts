import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AuthError, ServiceUnavailableError } from "@/src/server/http/errors";

// The queue worker is called by pg_cron (through pg_net) with the header
// X-Jobs-Secret: <JOBS_SECRET>. The same value is in Supabase Vault as
// jobs_secret (docs/runbook.md). Without JOBS_SECRET on this server the
// worker stays off (503).
export const JOBS_SECRET_HEADER = "x-jobs-secret";
const MIN_LENGTH = 32;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function jobsSecretSet(): boolean {
  return (process.env.JOBS_SECRET?.trim().length ?? 0) >= MIN_LENGTH;
}

// Compares hashes of equal length in constant time, so how long the check
// takes says nothing about how much of the secret was right.
export function checkJobsSecret(sent: string | null): void {
  const secret = process.env.JOBS_SECRET?.trim() ?? "";
  if (secret.length < MIN_LENGTH) throw new ServiceUnavailableError("The job worker is not set up on this server.");
  if (!sent || !timingSafeEqual(digest(sent.trim()), digest(secret))) {
    throw new AuthError("Send the worker secret in the X-Jobs-Secret header.");
  }
}
