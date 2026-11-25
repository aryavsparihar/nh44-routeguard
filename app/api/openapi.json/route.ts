// GET /api/openapi.json: the usual place tools look for an OpenAPI document.
// The same document as /api/v1/openapi.json.
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { openApiResponse } from "@/src/server/openapi/spec";
import pkg from "@/package.json";

export const GET = withApi({ access: "public" }, async () => openApiResponse(pkg.version));

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
