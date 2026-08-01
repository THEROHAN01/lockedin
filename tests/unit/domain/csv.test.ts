import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/domain/csv';

describe('parseCsv', () => {
  it('parses title, url and difficulty', () => {
    const result = parseCsv(
      'Two Sum,https://leetcode.com/problems/two-sum,EASY\n' +
        'Add Two Numbers,https://leetcode.com/problems/add-two-numbers,MEDIUM',
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        title: 'Two Sum',
        url: 'https://leetcode.com/problems/two-sum',
        difficulty: 'EASY',
      },
      {
        title: 'Add Two Numbers',
        url: 'https://leetcode.com/problems/add-two-numbers',
        difficulty: 'MEDIUM',
      },
    ]);
  });

  it('skips an optional header row', () => {
    const result = parseCsv(
      'title,url,difficulty\nTwo Sum,https://leetcode.com/problems/two-sum,EASY',
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
  });

  it('skips blank lines without reporting them', () => {
    const result = parseCsv(
      '\nTwo Sum,https://example.com/a,EASY\n\n  \nHard One,https://example.com/b,HARD\n',
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(2);
  });

  it('accepts difficulty in any case and trims whitespace', () => {
    const result = parseCsv('  Two Sum , https://example.com/a , easy ');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toEqual({
      title: 'Two Sum',
      url: 'https://example.com/a',
      difficulty: 'EASY',
    });
  });

  it('supports quoted fields containing commas', () => {
    const result = parseCsv('"Sum, of Two",https://example.com/a,EASY');
    expect(result.errors).toEqual([]);
    expect(result.items[0]?.title).toBe('Sum, of Two');
  });

  it('reports an unknown difficulty against its line number', () => {
    const result = parseCsv('Two Sum,https://example.com/a,TRIVIAL');
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([
      { line: 1, message: 'difficulty must be EASY, MEDIUM or HARD, got "TRIVIAL"' },
    ]);
  });

  it('reports a missing url', () => {
    const result = parseCsv('Two Sum,,EASY');
    expect(result.errors).toEqual([{ line: 1, message: 'url is required' }]);
  });

  it('reports a missing title', () => {
    const result = parseCsv(',https://example.com/a,EASY');
    expect(result.errors).toEqual([{ line: 1, message: 'title is required' }]);
  });

  it('reports the wrong number of columns', () => {
    const result = parseCsv('Two Sum,https://example.com/a');
    expect(result.errors).toEqual([
      { line: 1, message: 'expected 3 columns (title, url, difficulty), got 2' },
    ]);
  });

  it('reports every bad row, not just the first', () => {
    // The API rejects the whole upload, so the user needs the full list in one
    // response rather than fixing one row per round trip.
    const result = parseCsv(
      [
        'Good,https://example.com/a,EASY',
        'Bad diff,https://example.com/b,TRIVIAL',
        'Also good,https://example.com/c,HARD',
        'No url,,MEDIUM',
      ].join('\n'),
    );
    expect(result.errors.map((e) => e.line)).toEqual([2, 4]);
  });

  it('numbers lines by the original input, ignoring the header', () => {
    const result = parseCsv(
      'title,url,difficulty\nGood,https://example.com/a,EASY\nBad,,EASY',
    );
    expect(result.errors).toEqual([{ line: 3, message: 'url is required' }]);
  });

  it('returns nothing at all for empty input', () => {
    expect(parseCsv('')).toEqual({ items: [], errors: [] });
    expect(parseCsv('   \n  ')).toEqual({ items: [], errors: [] });
  });
});
