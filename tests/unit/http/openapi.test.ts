import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '@/http/openapi';

/**
 * The OpenAPI document derives its request bodies from the Zod schemas and
 * type-checks its response bodies against the domain types, so those two cannot
 * drift silently. Its path table cannot be derived from anything — it is prose
 * about files — so it is checked here instead.
 *
 * Without this, the failure mode is a new endpoint that simply never appears in
 * the docs, which nobody notices because the docs still look complete.
 */

const appApi = fileURLToPath(new URL('../../../app/api', import.meta.url));

/**
 * Routes that describe the API rather than being part of it. Listing them is the
 * point: an undocumented route has to be named here, so it is a decision on the
 * record rather than an omission.
 */
const NOT_PART_OF_THE_API = new Set([
  '/api/openapi.json',
  /**
   * Backs the docs site's search dialog (app/docs/**). It serves the
   * documentation rather than the product, and its request/response shape is
   * Fumadocs' to define, not this app's — publishing it in the LockedIn API
   * reference would describe a contract we do not own.
   */
  '/api/search',
]);

/**
 * Better Auth mounts its whole surface behind one catch-all file, so there is no
 * file-to-path correspondence to check. The document describes the two endpoints
 * this app actually depends on; the rest are Better Auth's to document.
 */
const CATCH_ALL_PREFIXES = ['/api/auth'];

/** Every `route.ts` under app/api, as the URL path it serves. */
function routeFilePaths(): string[] {
  const found: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') found.push(full);
    }
  }

  walk(appApi);

  return found.map((file) => {
    const segments = relative(appApi, file).split('/').slice(0, -1);
    return `/api/${segments.join('/')}`.replace(/\/$/, '');
  });
}

/** `[id]` in a directory name is `{id}` in an OpenAPI path. */
function toOpenApiPath(routePath: string): string {
  return routePath.replace(/\[(\.{3})?([^\]]+)\]/g, '{$2}');
}

function isCatchAll(routePath: string): boolean {
  return CATCH_ALL_PREFIXES.some((prefix) => routePath.startsWith(prefix));
}

const document = openApiDocument('http://localhost:3000');
const paths = document.paths as Record<string, Record<string, unknown>>;
const schemas = (document.components as { schemas: Record<string, unknown> })
  .schemas;

/** Reaches into a generated component, failing loudly rather than on `undefined`. */
function componentAt(path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    expect(value, `no such component path: ${path}`).toHaveProperty(key);
    return (value as Record<string, unknown>)[key];
  }, schemas);
}

describe('openApiDocument', () => {
  it('documents every route handler in app/api', () => {
    const undocumented = routeFilePaths()
      .filter((path) => !NOT_PART_OF_THE_API.has(path) && !isCatchAll(path))
      .map(toOpenApiPath)
      .filter((path) => !(path in paths));

    expect(undocumented).toEqual([]);
  });

  it('documents no path that has no route handler', () => {
    const real = new Set(routeFilePaths().map(toOpenApiPath));

    const fictional = Object.keys(paths).filter(
      (path) => !real.has(path) && !isCatchAll(path),
    );

    expect(fictional).toEqual([]);
  });

  it('documents every verb each route handler exports', () => {
    const verbs = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

    const missing: string[] = [];

    for (const routePath of routeFilePaths()) {
      if (NOT_PART_OF_THE_API.has(routePath) || isCatchAll(routePath)) continue;

      const source = readFileSync(
        join(appApi, routePath.replace('/api/', ''), 'route.ts'),
        'utf8',
      );
      const operations = paths[toOpenApiPath(routePath)] ?? {};

      for (const match of source.matchAll(verbs)) {
        const verb = match[1] ?? '';
        if (!(verb.toLowerCase() in operations)) {
          missing.push(`${verb} ${routePath}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('resolves every $ref it uses', () => {
    const referenced = [
      ...JSON.stringify(document).matchAll(
        /"\$ref":"#\/components\/schemas\/([^"]+)"/g,
      ),
    ].map((match) => match[1] ?? '');

    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((id) => !(id in schemas))).toEqual([]);
  });

  it('derives request bodies from the schemas that actually validate', () => {
    // Not a restatement of the schema — the point is that the published contract
    // comes from `parseBody`'s input and not from a hand-copied duplicate, so a
    // rule tightened in schemas.ts shows up here without anyone editing docs.
    expect(
      componentAt('CreateRoadmap.properties.sendTimeLocal.pattern'),
    ).toBe('^([01]\\d|2[0-3]):[0-5]\\d$');
  });

  it('states the error envelope once, and only the four codes that exist', () => {
    expect(componentAt('Error.properties.error.properties.code.enum')).toEqual([
      'UNAUTHENTICATED',
      'NOT_FOUND',
      'MALFORMED_JSON',
      'VALIDATION_FAILED',
    ]);
  });
});
