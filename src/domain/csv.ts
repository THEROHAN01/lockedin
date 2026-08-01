import { DIFFICULTIES } from './types';
import type { Difficulty, ParsedItem } from './types';

/**
 * Parses the `title,url,difficulty` upload format.
 *
 * Collects every bad row rather than stopping at the first: the API rejects the
 * whole upload, so the user needs the full list in one response instead of
 * fixing one row per round trip.
 */

export interface CsvRowError {
  /** 1-based line number in the original input, header included. */
  line: number;
  message: string;
}

export interface ParseCsvResult {
  items: ParsedItem[];
  errors: CsvRowError[];
}

const HEADER = ['title', 'url', 'difficulty'];

/** Minimal RFC-4180 field splitting: enough to survive a comma in a title. */
function splitFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);

    if (inQuotes) {
      if (char !== '"') {
        current += char;
      } else if (line.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function isHeaderRow(fields: readonly string[]): boolean {
  return (
    fields.length === HEADER.length &&
    fields.every((field, i) => field.toLowerCase() === HEADER[i])
  );
}

/** The first problem with a row, or null if it is fine. */
function validate(fields: readonly string[]): string | null {
  if (fields.length !== HEADER.length) {
    return `expected 3 columns (title, url, difficulty), got ${fields.length}`;
  }
  if (fields[0] === '') return 'title is required';
  if (fields[1] === '') return 'url is required';

  const difficulty = (fields[2] ?? '').toUpperCase();
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    return `difficulty must be EASY, MEDIUM or HARD, got "${fields[2]}"`;
  }
  return null;
}

export function parseCsv(text: string): ParseCsvResult {
  const items: ParsedItem[] = [];
  const errors: CsvRowError[] = [];
  const lines = text.split(/\r?\n/);
  let headerChecked = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (raw.trim() === '') continue;

    const fields = splitFields(raw).map((field) => field.trim());

    if (!headerChecked) {
      headerChecked = true;
      if (isHeaderRow(fields)) continue;
    }

    const problem = validate(fields);
    if (problem !== null) {
      errors.push({ line: i + 1, message: problem });
      continue;
    }

    items.push({
      title: fields[0] ?? '',
      url: fields[1] ?? '',
      difficulty: (fields[2] ?? '').toUpperCase() as Difficulty,
    });
  }

  return { items, errors };
}
