import { z } from 'zod';
import type { Progress, Roadmap, RoadmapItem } from '@/domain/types';
import type { ItemWithCompletion } from '@/usecases/progress';
import type { SweepResult } from '@/usecases/send-daily-digests';
import type { ValidationDetail } from '@/errors';
import {
  createRoadmapSchema,
  patchRoadmapSchema,
  uploadItemsSchema,
} from './schemas';

/**
 * The OpenAPI 3.1 description of the HTTP API, served at `/api/openapi.json` and
 * rendered by Swagger UI at `/api-docs`.
 *
 * The conventions this encodes — one error envelope, 404 for not-owned, a fixed
 * set of error codes — are argued in docs/ARCHITECTURE.md §7. This file is the
 * machine-readable form of that table, not a second source of truth for it.
 *
 * Two things keep it from rotting into fiction:
 *
 *  1. Request bodies are not re-described. They are `z.toJSONSchema` of the very
 *     schemas in `schemas.ts` that `parseBody` runs, so a validation change is
 *     published whether or not anyone remembers to update the docs.
 *  2. Response bodies are described here, but each one is declared
 *     `satisfies ZodType<T>` against the domain type the handler actually
 *     returns, so adding or renaming a field there fails `pnpm typecheck`.
 *
 * The remaining gap is the path table itself — a new route file with no entry
 * here. `tests/unit/http/openapi.test.ts` walks `app/api` and fails on one.
 */

// ── Response bodies ─────────────────────────────────────────────────────────
//
// `satisfies` is the drift check. It is one-directional by nature: a field added
// to a domain type breaks compilation here, which is the direction that matters,
// because that is the field a client would never learn about.

const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

const roadmapSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    startDate: z.string().meta({ examples: ['2026-08-01'] }),
    endDate: z.string().meta({ examples: ['2026-10-31'] }),
    sendTimeLocal: z.string().meta({ examples: ['07:30'] }),
    timezone: z.string().meta({ examples: ['Asia/Kolkata'] }),
    status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).meta({
      description:
        'COMPLETED is set by the server when the last item is marked done — not by the passing of `endDate`, and not by any request.',
    }),
  })
  .meta({
    description:
      'A time-boxed plan. Note the absence of a schedule: no item is pinned to a date, so the dates can change freely and the next digest simply reflects them.',
  }) satisfies z.ZodType<Roadmap>;

const roadmapItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    difficulty: difficultySchema,
    position: z.number().int().meta({
      description: 'Order within the roadmap, from the row order of the upload.',
    }),
  })
  .meta({
    description:
      'One thing to work through. Deliberately generic — nothing here is LeetCode-specific.',
  }) satisfies z.ZodType<RoadmapItem>;

const itemWithCompletionSchema = roadmapItemSchema
  .extend({
    completed: z.boolean().meta({
      description:
        'Derived from the progress log rather than stored on the item, because completion is an event.',
    }),
  })
  .meta({
    description:
      'A roadmap item plus whether it has been done. The list endpoint returns these; the aggregate counts live on `/progress`.',
  }) satisfies z.ZodType<ItemWithCompletion>;

const progressSchema = z
  .object({
    completedCount: z.number().int(),
    totalCount: z.number().int(),
    daysElapsed: z.number().int(),
    totalDays: z.number().int(),
  })
  .meta({
    description:
      'Both halves of "how far along am I": problems and time. Counting is inclusive of the start and end dates.',
  }) satisfies z.ZodType<Progress>;

const sweepResultSchema = z
  .object({
    sent: z.number().int(),
    skipped: z.number().int().meta({
      description:
        'Not due yet, or already sent today. The sweep is safe to run repeatedly.',
    }),
    failed: z.number().int(),
  })
  .meta({ description: 'What one cron tick did, per roadmap considered.' }) satisfies z.ZodType<SweepResult>;

const validationDetailSchema = z
  .object({
    path: z
      .string()
      .meta({
        description:
          'A field name, a dotted JSON path, or `row.N` for a line of a CSV upload.',
        examples: ['endDate', 'row.3'],
      }),
    message: z.string(),
  })
  .meta({
    description: 'One thing wrong with a request, and where.',
  }) satisfies z.ZodType<ValidationDetail>;

const errorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        'UNAUTHENTICATED',
        'NOT_FOUND',
        'MALFORMED_JSON',
        'VALIDATION_FAILED',
      ]),
      message: z.string(),
      details: z.array(validationDetailSchema).optional().meta({
        description:
          'Present on VALIDATION_FAILED. Always an array, so per-row CSV errors and multi-field errors share one shape.',
      }),
    }),
  })
  .meta({
    description: 'The single error envelope used by every endpoint.',
  });

// ── Components ──────────────────────────────────────────────────────────────

/**
 * The component list, spelled out.
 *
 * Local registries rather than `z.globalRegistry`, which `.meta()` also writes
 * to: serialising the global one would publish whatever anybody happened to give
 * an id to, from anywhere in the codebase. Membership here is a decision.
 *
 * Descriptions still come from `.meta()` — the converter reads them from the
 * global registry as it walks each schema — so only the *names* are declared
 * here, and the prose stays next to the field it describes.
 *
 * Split in two because a Zod object means different things in each direction.
 * Converted as *output* it gains `additionalProperties: false`, which is true of
 * a response — the server sends exactly these fields — and false of a request,
 * where unknown keys are stripped rather than rejected. Publishing one document
 * for both would make the API look stricter about input than it is.
 */
const responseComponents = z.registry<{ id: string }>();

responseComponents.add(roadmapSchema, { id: 'Roadmap' });
responseComponents.add(roadmapItemSchema, { id: 'RoadmapItem' });
responseComponents.add(itemWithCompletionSchema, { id: 'ItemWithCompletion' });
responseComponents.add(progressSchema, { id: 'Progress' });
responseComponents.add(sweepResultSchema, { id: 'SweepResult' });
responseComponents.add(validationDetailSchema, { id: 'ValidationDetail' });
responseComponents.add(errorSchema, { id: 'Error' });

const requestComponents = z.registry<{ id: string }>();

requestComponents.add(createRoadmapSchema, { id: 'CreateRoadmap' });
requestComponents.add(patchRoadmapSchema, { id: 'PatchRoadmap' });
requestComponents.add(uploadItemsSchema, { id: 'UploadItems' });

// ── Reusable pieces of the document ─────────────────────────────────────────

function ref(id: string): { $ref: string } {
  return { $ref: `#/components/schemas/${id}` };
}

function json(schemaId: string, description: string): object {
  return {
    description,
    content: { 'application/json': { schema: ref(schemaId) } },
  };
}

function jsonArray(schemaId: string, description: string): object {
  return {
    description,
    content: {
      'application/json': {
        schema: { type: 'array', items: ref(schemaId) },
      },
    },
  };
}

function requestBody(schemaId: string): object {
  return {
    required: true,
    content: { 'application/json': { schema: ref(schemaId) } },
  };
}

/**
 * Every session-authenticated endpoint answers these three identically, so they
 * are attached wholesale rather than restated nine times.
 *
 * 404 covers "no such roadmap" and "not yours" without distinguishing them: a 403
 * on someone else's id would confirm the id exists, which turns the API into an
 * id oracle.
 */
const commonErrors = {
  '400': json('Error', 'Request body is not valid JSON.'),
  '401': json('Error', 'No session, or a session that is no longer valid.'),
  '404': json(
    'Error',
    'No such resource, **or** it belongs to another user — the two are indistinguishable by design.',
  ),
} as const;

const validationFailed = json(
  'Error',
  'Syntactically valid but rejected by a business rule — a bad `HH:mm`, an `endDate` before `startDate`, an unknown IANA zone, a malformed CSV row. `details` lists every problem.',
);

const roadmapIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Roadmap id. Must belong to the caller.',
  schema: { type: 'string' },
} as const;

/**
 * Removes three things the converter emits that carry no contract:
 *
 * `$schema` and `$id` are stamped on every component. Both are noise inside an
 * OpenAPI `components` block — the document declares its dialect once, at the
 * top — and Swagger UI renders the stray `$id` as though it were a field.
 *
 * `z.number().int()` becomes `integer` bounded by ±`Number.MAX_SAFE_INTEGER`.
 * True, and useless: it restates "this is a JavaScript number" on every count and
 * position in the document, where a reader looking for a real constraint has to
 * check each one to find there isn't any.
 */
const SAFE_INTEGER_BOUNDS = { minimum: -9007199254740991, maximum: 9007199254740991 };

function tidy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(tidy);
  if (value === null || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, inner]) => {
      if (key === '$schema' || key === '$id') return false;
      if (key === 'minimum') return inner !== SAFE_INTEGER_BOUNDS.minimum;
      if (key === 'maximum') return inner !== SAFE_INTEGER_BOUNDS.maximum;
      return true;
    },
  );

  return Object.fromEntries(entries.map(([key, inner]) => [key, tidy(inner)]));
}

/**
 * Builds the document.
 *
 * A function rather than a constant because `serverUrl` differs per deployment,
 * and because the route handler should not be shipping a value frozen at module
 * load in a long-lived server process.
 */
export function openApiDocument(serverUrl?: string): Record<string, unknown> {
  // A registered schema becomes a component; anything else is inlined where it
  // is used, which is why `RoadmapItem` inside `ItemWithCompletion` is a `$ref`
  // and an anonymous nested object is not.
  const convert = (
    registry: z.core.$ZodRegistry<{ id: string }>,
    io: 'input' | 'output',
  ): Record<string, unknown> =>
    z.toJSONSchema(registry, {
      target: 'draft-2020-12',
      io,
      uri: (id) => `#/components/schemas/${id}`,
    }).schemas;

  const schemas = tidy({
    ...convert(responseComponents, 'output'),
    ...convert(requestComponents, 'input'),
  }) as Record<string, unknown>;

  return {
    openapi: '3.1.0',
    info: {
      title: 'LockedIn API',
      version: '0.1.0',
      description: [
        'A roadmap is a time-boxed plan; items are uploaded to it as CSV; the server emails a',
        'daily selection and tracks what has been marked done.',
        '',
        '**Authentication.** Every `/api/roadmaps/**` endpoint needs a session cookie, issued by',
        'the Better Auth endpoints under `/api/auth/**`. In this page, sign in first (see the',
        '`POST /api/auth/sign-in/email` example below), and the browser will carry the cookie',
        'into every subsequent "Try it out" — there is no token to paste. `/api/cron/send-daily`',
        'is the exception: it is machine-to-machine and takes a Bearer secret instead.',
        '',
        '**Errors** all share one envelope: `{ "error": { "code", "message", "details"? } }`.',
        'The reasoning behind these conventions is in `docs/ARCHITECTURE.md` §7.',
      ].join('\n'),
    },
    servers: [{ url: serverUrl ?? '/', description: 'This deployment' }],
    tags: [
      { name: 'Roadmaps', description: 'Creating and maintaining plans.' },
      { name: 'Items', description: 'What is in a plan, and what is done.' },
      { name: 'Progress', description: 'How far along.' },
      {
        name: 'Cron',
        description: 'The daily sweep. Called by a scheduler, not by a browser.',
      },
      {
        name: 'Auth',
        description:
          'Handled by Better Auth. The catch-all route mounts more endpoints than the two documented here; these are the ones this app relies on.',
      },
    ],
    paths: {
      '/api/roadmaps': {
        get: {
          tags: ['Roadmaps'],
          summary: 'List your roadmaps',
          operationId: 'listRoadmaps',
          description: 'Scoped to the signed-in user. Never anyone else’s.',
          responses: {
            '200': jsonArray('Roadmap', 'Every roadmap belonging to the caller.'),
            '401': commonErrors['401'],
          },
        },
        post: {
          tags: ['Roadmaps'],
          summary: 'Create a roadmap',
          operationId: 'createRoadmap',
          description:
            'Returns the whole object rather than an id: the client needs the fields to render, and one shape across all creates is one fewer thing to remember.',
          requestBody: requestBody('CreateRoadmap'),
          responses: {
            '201': json('Roadmap', 'The created roadmap.'),
            '400': commonErrors['400'],
            '401': commonErrors['401'],
            '422': validationFailed,
          },
        },
      },
      '/api/roadmaps/{id}': {
        parameters: [roadmapIdParam],
        get: {
          tags: ['Roadmaps'],
          summary: 'Fetch one roadmap',
          operationId: 'getRoadmap',
          responses: {
            '200': json('Roadmap', 'The roadmap.'),
            '401': commonErrors['401'],
            '404': commonErrors['404'],
          },
        },
        patch: {
          tags: ['Roadmaps'],
          summary: 'Update a roadmap',
          operationId: 'updateRoadmap',
          description:
            'Also how archiving works: `{ "status": "ARCHIVED" }`. Archiving is a field rather than an endpoint, which removes an endpoint instead of adding one.',
          requestBody: requestBody('PatchRoadmap'),
          responses: {
            '200': json('Roadmap', 'The updated roadmap.'),
            ...commonErrors,
            '422': validationFailed,
          },
        },
      },
      '/api/roadmaps/{id}/items': {
        parameters: [roadmapIdParam],
        get: {
          tags: ['Items'],
          summary: 'List items, with completion',
          operationId: 'listItems',
          description:
            'In roadmap order. `completed` is derived per item; the aggregate counts live on `/progress`.',
          responses: {
            '200': jsonArray('ItemWithCompletion', 'The roadmap’s items.'),
            '401': commonErrors['401'],
            '404': commonErrors['404'],
          },
        },
        post: {
          tags: ['Items'],
          summary: 'Upload items as CSV',
          operationId: 'uploadItems',
          description:
            'Appends to whatever is already there. All-or-nothing: if any row fails to parse, nothing is written and the 422 names every bad row.',
          requestBody: requestBody('UploadItems'),
          responses: {
            '201': jsonArray('RoadmapItem', 'The items created, in full.'),
            ...commonErrors,
            '422': validationFailed,
          },
        },
      },
      '/api/roadmaps/{id}/items/{itemId}/completion': {
        parameters: [
          roadmapIdParam,
          {
            name: 'itemId',
            in: 'path',
            required: true,
            description:
              'Item id. Must be in this roadmap — a mismatched pair is a 404, not a silent success.',
            schema: { type: 'string' },
          },
        ],
        put: {
          tags: ['Items'],
          summary: 'Mark an item complete',
          operationId: 'markItemComplete',
          description: [
            'Completion is a subresource, so `PUT` — idempotent by definition of the verb rather',
            'than by informal promise. Repeating it answers 204 again rather than conflicting.',
            '',
            'Marking the last outstanding item is what moves the roadmap to `COMPLETED`.',
            'Un-marking is out of scope for now; `DELETE` on this URI is its obvious home.',
          ].join('\n'),
          responses: {
            '204': { description: 'Marked, or already was.' },
            '401': commonErrors['401'],
            '404': commonErrors['404'],
          },
        },
      },
      '/api/roadmaps/{id}/progress': {
        parameters: [roadmapIdParam],
        get: {
          tags: ['Progress'],
          summary: 'Progress for a roadmap',
          operationId: 'getProgress',
          description:
            '"Today" is resolved in the roadmap’s own time zone, so `daysElapsed` matches what the user sees on their calendar.',
          responses: {
            '200': json('Progress', 'Counts of items and of days.'),
            '401': commonErrors['401'],
            '404': commonErrors['404'],
          },
        },
      },
      '/api/cron/send-daily': {
        get: {
          tags: ['Cron'],
          summary: 'Run the daily digest sweep',
          operationId: 'runDailySweep',
          security: [{ cronSecret: [] }],
          description: [
            'Sends one digest per roadmap that is due now and has not already been sent today,',
            'so calling it repeatedly is safe.',
            '',
            'It mutates on `GET`, which violates GET-safety. Vercel Cron only issues `GET` to a',
            'configured path, so no other verb is available. The Bearer secret controls who can',
            'trigger it, and the handler is `force-dynamic` so a cached 200 can never stand in',
            'for actually running the sweep.',
            '',
            'A session cookie does **not** authorise this endpoint.',
          ].join('\n'),
          responses: {
            '200': json(
              'SweepResult',
              'The sweep ran. Some roadmaps may have failed — it is built to survive that, so partial failure is reported in the body rather than in the status.',
            ),
            '401': {
              description:
                'Missing or wrong `Authorization: Bearer $CRON_SECRET`, or no secret configured on the server. The body is the standard envelope with code `UNAUTHENTICATED`.',
              content: { 'application/json': { schema: ref('Error') } },
            },
            '503': json(
              'SweepResult',
              'Every attempt failed and none succeeded — a revoked API key, say. Distinguished from partial failure because cron monitoring keys off HTTP status, so a systemic outage must not look healthy.',
            ),
          },
        },
      },
      '/api/auth/sign-up/email': {
        post: {
          tags: ['Auth'],
          summary: 'Create an account',
          operationId: 'signUpWithEmail',
          security: [],
          description:
            'Better Auth. Sets the session cookie on success, so no separate sign-in is needed. There is no verification email in this build.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Signed up. `Set-Cookie` carries the session.',
            },
            '422': {
              description:
                'Better Auth’s own error shape, which is not the envelope above — e.g. the address is already registered.',
            },
          },
        },
      },
      '/api/auth/sign-in/email': {
        post: {
          tags: ['Auth'],
          summary: 'Sign in',
          operationId: 'signInWithEmail',
          security: [],
          description:
            'Run this first if you want to try the roadmap endpoints from this page: the response sets the session cookie the browser then sends automatically.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Signed in. `Set-Cookie` carries the session.',
            },
            '401': { description: 'Wrong email or password.' },
          },
        },
      },
    },
    components: {
      schemas,
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description:
            'Set by the Better Auth endpoints. Browsers send it automatically; there is nothing to paste.',
        },
        cronSecret: {
          type: 'http',
          scheme: 'bearer',
          description: '`CRON_SECRET` from the server environment.',
        },
      },
    },
    // The default for every operation; the two auth endpoints and the cron route
    // override it with their own `security`.
    security: [{ sessionCookie: [] }],
  };
}
