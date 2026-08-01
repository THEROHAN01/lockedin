import { z } from 'zod';
import { daysInclusive, isValidTimeZone } from '@/domain/dates';

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
  }, 'no such calendar day');

const localTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time formatted HH:mm');

const timezone = z
  .string()
  .refine(isValidTimeZone, 'must be a known IANA time zone, e.g. Asia/Kolkata');

const name = z.string().trim().min(1, 'name is required').max(200);

export const createRoadmapSchema = z.object({
  name,
  startDate: localDate,
  endDate: localDate,
  sendTimeLocal: localTime,
  timezone,
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
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to update');

export const uploadItemsSchema = z.object({
  csv: z.string().min(1, 'csv is required'),
});
