/*
 * The light-theme palette values as TypeScript.
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
  black: '#18181b',
  paper: '#fafafa',
} as const;

/**
 * Email roles, mirroring the light theme in tokens.css.
 *
 * This uses the same light-theme pairing as the app: gray-900 on gray-50.
 * The vivid green and olive remain unchanged for secondary text/accents.
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
