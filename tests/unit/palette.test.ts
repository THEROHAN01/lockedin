import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the accessibility claims made in docs/ARCHITECTURE.md §6.
 *
 * The palette was specified externally and one of its colours is unusable as
 * text on one of its backgrounds, which is why the accent is split into a
 * text-safe token and a fills-only token. That split is easy to undo by
 * accident — someone "simplifies" tokens.css by pointing --accent at the vivid
 * green and every link in the light theme silently drops to 1.88:1.
 *
 * These tests read the real tokens.css rather than restating the values, so
 * this file contains no hex literals and cannot drift from the source.
 */

const TOKENS = readFileSync(
  new URL('../../src/styles/tokens.css', import.meta.url),
  'utf8',
);

function palette(name: string): string {
  const match = TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`--${name} not found in tokens.css`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const GREEN = palette('lk-green');
const OLIVE = palette('lk-olive');
const BLACK = palette('lk-black');
const PAPER = palette('lk-paper');

const AA_TEXT = 4.5;

describe('palette contrast', () => {
  it('has all four source colours defined in tokens.css', () => {
    expect([GREEN, OLIVE, BLACK, PAPER]).toHaveLength(4);
    expect(new Set([GREEN, OLIVE, BLACK, PAPER]).size).toBe(4);
  });

  describe('light theme, background is paper', () => {
    it('body text (ink = black) clears AA', () => {
      expect(contrast(BLACK, PAPER)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('text-safe accent (olive) clears AA', () => {
      expect(contrast(OLIVE, PAPER)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('vivid green FAILS as text — this is why it is fills-only', () => {
      // Not a bug being tolerated: an invariant. If this ever starts passing,
      // the palette changed and the accent split in tokens.css can be revisited.
      expect(contrast(GREEN, PAPER)).toBeLessThan(AA_TEXT);
    });
  });

  describe('dark theme, background is black', () => {
    it('body text (ink = paper) clears AA', () => {
      expect(contrast(PAPER, BLACK)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('vivid green IS text-safe here, so accent may use it', () => {
      expect(contrast(GREEN, BLACK)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('text placed on an accent fill', () => {
    it('accent-ink on the text-safe accent clears AA in both themes', () => {
      // Light theme pairs --accent-ink (paper) with --accent (olive).
      // Dark theme pairs --accent-ink (black) with --accent (green).
      expect(contrast(PAPER, OLIVE)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(BLACK, GREEN)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});

/**
 * tokens.css and palette.ts hold the same four values in two representations,
 * because email clients support neither var() nor color-mix(). This is what stops
 * them drifting: change one and this fails.
 */
describe('palette.ts mirrors tokens.css', () => {
  it('agrees on all four values', async () => {
    const { PALETTE } = await import('@/styles/palette');
    expect(PALETTE.green).toBe(GREEN);
    expect(PALETTE.olive).toBe(OLIVE);
    expect(PALETTE.black).toBe(BLACK);
    expect(PALETTE.paper).toBe(PAPER);
  });

  it('never uses the vivid green for email text', async () => {
    const { EMAIL, PALETTE } = await import('@/styles/palette');
    for (const role of ['ink', 'inkSoft', 'accent'] as const) {
      expect(EMAIL[role]).not.toBe(PALETTE.green);
      expect(contrast(EMAIL[role], EMAIL.background)).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    }
  });
});

