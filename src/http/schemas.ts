import { z } from 'zod';
import { daysInclusive, isValidTimeZone } from '@/domain/dates';

/**
 * These schemas are also the source of the request half of the OpenAPI document
 * (`src/http/openapi.ts` derives it with `z.toJSONSchema`), which is why each one
 * carries `.meta()`. The prose is documentation, not validation — it never
 * changes what a request is allowed to contain, so the published contract cannot
 * drift from the check that actually runs.
 *
 * Refinements do not survive the translation: `no such calendar day` and the IANA
 * zone lookup are custom predicates with no JSON Schema equivalent, so their
 * rules live in the descriptions below and are enforced only here.
 */

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be formatted YYYY-MM-DD')
  .refine((value) => {
    // The regex admits 2026-02-30; this rejects it.
    try {
      daysInclusive(value, value);
      return true;
    } catch {
      return false;
    }
  }, 'no such calendar day')
  .meta({
    description:
      'A calendar date in the roadmap\'s own time zone, formatted YYYY-MM-DD. Must be a day that exists: 2026-02-30 is rejected.',
    examples: ['2026-08-03'],
  });

const localTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time formatted HH:mm')
  .meta({
    description:
      'The wall-clock time the daily digest goes out, in the roadmap\'s time zone. 24-hour HH:mm.',
    examples: ['07:30'],
  });

const timezone = z
  .string()
  .refine(isValidTimeZone, 'must be a known IANA time zone, e.g. Asia/Kolkata')
  .meta({
    description:
      'IANA time zone name. Every date and send time on the roadmap is interpreted in this zone.',
    examples: ['Asia/Kolkata'],
  });

const name = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(200)
  .meta({ description: 'Display name, 1–200 characters after trimming.' });

export const createRoadmapSchema = z
  .object({
    name,
    startDate: localDate,
    endDate: localDate,
    sendTimeLocal: localTime,
    timezone,
  })
  .meta({
    description:
      'A new roadmap. `endDate` must not precede `startDate`; that is a cross-field rule, so it fails at 422 rather than being expressible here.',
  });

/**
 * `status` admits only the two values a user may set. COMPLETED is derived from
 * finishing the last item, so accepting it here would let a request declare
 * itself done.
 */
export const patchRoadmapSchema = z
  .object({
    name: name.optional(),
    startDate: localDate.optional(),
    endDate: localDate.optional(),
    sendTimeLocal: localTime.optional(),
    timezone: timezone.optional(),
    status: z
      .enum(['ACTIVE', 'ARCHIVED'])
      .optional()
      .meta({
        description:
          'Archive or unarchive. COMPLETED is server-derived — it is set by finishing the last item — and is rejected as an input.',
      }),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to update')
  .meta({
    description:
      'Every field is optional, but the body must contain at least one of them. Moving one end of the date range is re-checked against the stored other end.',
  });

export const uploadItemsSchema = z
  .object({
    csv: z.string().min(1, 'csv is required').meta({
      description:
        'The whole CSV file as one string, header row included: title,url,difficulty. Difficulty is EASY, MEDIUM or HARD.',
      examples: [
        'title,url,difficulty\nTwo Sum,https://leetcode.com/problems/two-sum/,EASY',
      ],
    }),
  })
  .meta({
    description:
      'A CSV upload. One invalid row rejects the whole file — there are no partial imports — and the 422 lists every bad row as `row.N`.',
  });
