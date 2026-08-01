import { parseCsv } from '@/domain/csv';
import { ValidationError } from '@/errors';
import type { ParsedItem } from '@/domain/types';
import type { RoadmapSource } from './source';

/**
 * Populates a roadmap from pasted or uploaded `title,url,difficulty` rows.
 *
 * Any invalid row rejects the whole upload — no partial imports — and every bad
 * row is reported at once, because the alternative is the user fixing one row per
 * round trip.
 */
export const csvUploadSource: RoadmapSource = {
  read(input: string): Promise<ParsedItem[]> {
    const { items, errors } = parseCsv(input);

    if (errors.length > 0) {
      throw new ValidationError(
        errors.map((error) => ({
          path: `row.${error.line}`,
          message: error.message,
        })),
      );
    }

    return Promise.resolve(items);
  },
};
