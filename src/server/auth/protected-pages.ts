// Pages a signed-out visitor is sent to sign-in for (BUILD_PROMPT section 8).
// proxy.ts uses this for a quick first check. Each page still checks the
// role itself with requirePageRole() (src/server/auth/page.ts), because a
// path check in the proxy can miss a route that Next.js resolves differently.
//
// API routes are not listed here: withApi() checks every one of them and
// answers 401/403 as problem+json.
const PROTECTED_PAGES = ["/board", "/report/new", "/admin"];

// "/admin" and "/admin/users" match; "/administrator" doesn't.
export function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}
