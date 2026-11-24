// Any /api/* path that has no route of its own lands here, so unknown API
// paths get a JSON 404 (problem+json) instead of the HTML 404 page.
import { NotFoundError } from "@/src/server/http/errors";
import { withApi } from "@/src/server/http/with-api";

const notFound = withApi({ access: "public", checkOrigin: false }, async () => {
  throw new NotFoundError("There is no API route at this path.");
});

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
