// Checks that run before a route's own code. Each one throws an ApiError
// when the request isn't allowed.
import type { Caller, Role } from "./caller";
import { AuthError, ForbiddenError } from "./errors";

// Who may call a route:
//   "public"     anyone, signed in or not
//   "signed-in"  any signed-in user
//   ["agent", "admin"]  signed in with one of these roles
export type Access = "public" | "signed-in" | Role[];

export function requireAccess(caller: Caller | null, access: Access): void {
  if (access === "public") return;
  if (!caller) throw new AuthError();
  if (access === "signed-in") return;
  if (!caller.role || !access.includes(caller.role)) {
    throw new ForbiddenError("Your role can't do this.");
  }
}

// For routes whose access isn't "public". withApi() has already made sure
// there is a caller, but TypeScript can't see that, so handlers call this to
// get a Caller instead of Caller | null.
export function requireCaller(caller: Caller | null): Caller {
  if (!caller) throw new AuthError();
  return caller;
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// CSRF protection. A browser always sends Origin on these methods, and a
// page on another site can't fake it. So for anything that changes data,
// Origin must be our own host. Requests without Origin (curl, Postman) must
// set it by hand; the Postman collection does.
export function checkOrigin(req: Request): void {
  if (!STATE_CHANGING.has(req.method)) return;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    throw new ForbiddenError("Missing Origin header.");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host; // "null" or junk fails here
  } catch {
    throw new ForbiddenError("Origin doesn't match this site.");
  }
  if (originHost !== host) {
    throw new ForbiddenError("Origin doesn't match this site.");
  }
}
