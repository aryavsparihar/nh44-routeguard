import "server-only";
import { createHash } from "node:crypto";
import pino, { type DestinationStream } from "pino";

// JSON logs to stdout. Azure Container Apps sends stdout to Log Analytics.
//
// Rule: never log request bodies, tokens, cookies, phone numbers, photos or
// query strings. withApi() only logs the fields it picks by hand; the redact
// list below is a second lock in case someone logs a whole object by mistake.
const REDACT_PATHS = [
  "authorization",
  "cookie",
  "token",
  "phone",
  "headers.authorization",
  "headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.token",
  "*.phone",
];

export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      base: null, // no pid or hostname: not useful in a container
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
    },
    destination,
  );
}

export const logger = createLogger();

// Logs show a short hash of the user id, never the id itself. The same user
// always gets the same hash, so we can still follow one person's requests.
export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}
