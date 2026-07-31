/*
 * The four palette values again, as TypeScript.
 *
 * This is the second and last file allowed to contain a hex literal (see
 * scripts/check-tokens.sh). It exists because email clients support neither
 * var() nor color-mix(), so the daily digest cannot consume tokens.css and has to
 * inline real colours.
 *
 * tests/unit/palette.test.ts asserts these match tokens.css, so the two
 * representations cannot drift.
 */

export const PALETTE = {
  green: '#08cb00',
  olive: '#253900',
  black: '#000000',
  paper: '#eeeeee',
} as const;

/**
 * Email roles, mirroring the light theme in tokens.css.
 *
 * `green` is 1.88:1 on `paper` and is therefore never text — only borders and
 * fills. Secondary text uses `olive` rather than a grey, so the email needs no
 * fifth colour.
 */
export const EMAIL = {
  background: PALETTE.paper,
  ink: PALETTE.black,
  inkSoft: PALETTE.olive,
  accent: PALETTE.olive,
  accentInk: PALETTE.paper,
  rule: PALETTE.black,
  vivid: PALETTE.green,
} as const;
