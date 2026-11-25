// GET /api/v1/openapi.json: the OpenAPI 3.1 document for this API, built from
// the routes' own zod schemas (src/server/openapi/). Public. The docs page
// /api/docs shows it with Swagger UI.
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { openApiResponse } from "@/src/server/openapi/spec";
import pkg from "@/package.json";

export const GET = withApi({ access: "public" }, async () => openApiResponse(pkg.version));

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
