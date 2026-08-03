/**
 * Swagger UI, served as one static HTML document that renders
 * `/api/openapi.json`.
 *
 * A route handler rather than a page because there is nothing for React to do
 * here: Swagger UI is a self-contained bundle that takes over a div. Routing it
 * through a client component would mean shipping the app's React tree to render
 * a viewer that immediately replaces its own subtree.
 *
 * The bundle comes from a CDN, pinned to an exact version and checked with SRI,
 * rather than from a dependency. `swagger-ui-dist` is ~2 MB of prebuilt assets
 * that Next has no way to serve from `node_modules` without a copy step into
 * `public/`, and it would be a production dependency purchased entirely for a
 * documentation page. The cost is that this page — and only this page — needs
 * network access to unpkg; the JSON it renders is served locally either way, so
 * `curl /api/openapi.json` still works offline.
 */

const SWAGGER_UI_VERSION = '5.32.12';

// sha384 of the exact files at that version. If the version above changes, both
// of these must be recomputed or the browser will refuse to load the assets:
//   curl -sL https://unpkg.com/swagger-ui-dist@VERSION/FILE | openssl dgst -sha384 -binary | openssl base64 -A
const CSS_INTEGRITY =
  'sha384-9Q2fpS+xeS4ffJy6CagnwoUl+4ldAYhOs9pgZuEKxypVModhmZFzeMlvVsAjf7uT';
const BUNDLE_INTEGRITY =
  'sha384-aPw2h1Un96ObRq1fD7AOgyf0r9jgkhMD51uBltHKtT0++4LsgMUkQD52RFNWcAil';

const base = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>LockedIn API</title>
    <link
      rel="stylesheet"
      href="${base}/swagger-ui.css"
      integrity="${CSS_INTEGRITY}"
      crossorigin="anonymous"
    />
    <style>
      /* Swagger UI ships its own complete stylesheet, so this is only the two
         things it cannot know: that it owns the whole page, and that its topbar
         — a URL bar for loading *other* specs — is pointless here.

         Deliberately no product tokens. This is a vendored viewer, not a screen
         of the app, and dressing it in the app's palette would imply otherwise
         while breaking the one-file colour rule (ARCHITECTURE §6). */
      body { margin: 0; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script
      src="${base}/swagger-ui-bundle.js"
      integrity="${BUNDLE_INTEGRITY}"
      crossorigin="anonymous"
    ></script>
    <script>
      window.SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        tryItOutEnabled: true,
        // Same origin, so the session cookie set by signing in through this page
        // is sent with every subsequent "Try it out". Without it there is no way
        // to exercise an authenticated endpoint from here at all.
        requestInterceptor: function (request) {
          request.credentials = 'same-origin';
          return request;
        },
      });
    </script>
  </body>
</html>
`;

export function GET(): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
