// Every request gets an id. It goes back in the X-Request-Id header and into
// every log line, so a user can quote it and we can find their request.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reuse the caller's id only if it is a plain UUID. Anything else (too long,
// odd characters, log injection attempts) is replaced with a fresh one.
export function getRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  if (incoming && UUID.test(incoming)) return incoming.toLowerCase();
  return crypto.randomUUID();
}
