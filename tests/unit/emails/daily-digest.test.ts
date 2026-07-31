import { describe, expect, it } from 'vitest';
import { renderDailyDigest, subjectFor } from '@/emails/daily-digest';
import { PALETTE } from '@/styles/palette';
import type { DailyDigest, DigestItem } from '@/domain/types';

function item(n: number): DigestItem {
  return {
    title: `Problem ${n}`,
    url: `https://leetcode.com/problems/p${n}`,
    difficulty: n === 1 ? 'EASY' : n === 2 ? 'MEDIUM' : 'HARD',
  };
}

function digest(count: number): DailyDigest {
  return {
    roadmapName: 'Blind 75',
    items: Array.from({ length: count }, (_, i) => item(i + 1)),
    progress: {
      completedCount: 7,
      totalCount: 30,
      daysElapsed: 9,
      totalDays: 30,
    },
    quote: 'Consistency beats intensity.',
  };
}

describe('renderDailyDigest', () => {
  it('carries all five fields ROADMAP feature 5 specifies', () => {
    const html = renderDailyDigest(digest(1));

    expect(html).toContain('Problem 1');
    expect(html).toContain('https://leetcode.com/problems/p1');
    expect(html).toContain('EASY');
    expect(html).toContain('7');
    expect(html).toContain('30');
    expect(html).toContain('Consistency beats intensity.');
  });

  it('renders a list when the quota is more than one', () => {
    const html = renderDailyDigest(digest(5));
    for (let n = 1; n <= 5; n++) {
      expect(html).toContain(`Problem ${n}`);
    }
  });

  it('renders one problem without list scaffolding for a quota of one', () => {
    const html = renderDailyDigest(digest(1));
    expect(html).not.toContain('Problem 2');
  });

  it('states both halves of progress', () => {
    const html = renderDailyDigest(digest(2));
    expect(html).toMatch(/7\s*(of|\/)\s*30/);
    expect(html).toMatch(/9\s*(of|\/)\s*30/);
  });

  it('inlines real colours, because email clients have no var() or color-mix()', () => {
    const html = renderDailyDigest(digest(1));
    expect(html).toContain(PALETTE.paper);
    expect(html).not.toContain('var(--');
    expect(html).not.toContain('color-mix');
  });

  it('never paints text in the vivid green', () => {
    // 1.88:1 on the paper background. Fills and borders only.
    // The delimiter matters: this must catch `color:` but not `border-left-color:`.
    const html = renderDailyDigest(digest(1));
    expect(html).not.toMatch(new RegExp(`["';]\\s*color:\\s*${PALETTE.green}`, 'i'));
  });

  it('escapes a title that contains markup', () => {
    const evil: DailyDigest = {
      ...digest(1),
      items: [{ ...item(1), title: '<script>alert(1)</script>' }],
    };
    const html = renderDailyDigest(evil);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces a complete document', () => {
    const html = renderDailyDigest(digest(1));
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });
});

describe('subjectFor', () => {
  it('names the roadmap and how many problems are due', () => {
    expect(subjectFor(digest(1))).toBe('Blind 75 — 1 problem today');
    expect(subjectFor(digest(3))).toBe('Blind 75 — 3 problems today');
  });
});
