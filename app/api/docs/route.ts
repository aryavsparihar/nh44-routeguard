// GET /api/docs: the API documentation page, Swagger UI showing
// /api/v1/openapi.json. Swagger UI is served from our own site
// (public/vendor/swagger-ui-<version>/, copied by scripts/ui/copy-swagger-ui.mjs),
// so the CSP stays 'self'. "Try it out" sends requests from this page, so
// the browser adds our Origin header and, when signed in, Clerk's cookie.
import { notAllowed, withApi } from "@/src/server/http/with-api";
import swagger from "swagger-ui-dist/package.json";

const BASE = `/vendor/swagger-ui-${swagger.version}`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API · RouteGuard NH-44</title>
<link rel="stylesheet" href="${BASE}/swagger-ui.css">
<style>
  body { margin: 0; background: #fafafa; }
  .rg-note { margin: 0; padding: 12px 16px; background: #fceebf; color: #4f3a00; font: 14px/1.4 system-ui, sans-serif; }
  .rg-note a { color: inherit; font-weight: 700; }
</style>
</head>
<body>
<p class="rg-note">RouteGuard is advisory and not an official police service. Postman collection: <a href="https://github.com/aryavsparihar/nh44-routeguard/tree/main/postman">postman/</a> in the repository. Raw document: <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>.</p>
<div id="swagger"></div>
<script src="${BASE}/swagger-ui-bundle.js"></script>
<script>
  window.ui = SwaggerUIBundle({
    url: "/api/v1/openapi.json",
    dom_id: "#swagger",
    deepLinking: true,
    withCredentials: true,
    defaultModelsExpandDepth: 0,
  });
</script>
</body>
</html>
`;

export const GET = withApi({ access: "public" }, async () => {
  return new Response(PAGE, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
