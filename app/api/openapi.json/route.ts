import { openApiDocument } from '@/http/openapi';

/**
 * The machine-readable API description, for Swagger UI at `/api-docs` and for
 * anything else that speaks OpenAPI — a client generator, a Postman import, an
 * editor's request runner.
 *
 * Unauthenticated on purpose. It describes the shape of the API, which is a
 * contract, not a secret; the endpoints it names all enforce their own auth.
 *
 * `origin` comes from the request rather than from an environment variable so
 * the "Try it out" button targets the deployment the reader is actually looking
 * at, including preview URLs.
 */
export function GET(request: Request): Response {
  const { origin } = new URL(request.url);

  return Response.json(openApiDocument(origin), {
    headers: {
      // Stale docs are worse than a rebuild: this is generated in memory from
      // code that is already loaded, so there is nothing to save by caching it.
      'cache-control': 'no-store',
    },
  });
}
