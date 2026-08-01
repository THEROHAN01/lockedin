// `renderToReadableStream`, not `renderToStaticMarkup`. Next patches the legacy
// react-dom/server APIs to throw at runtime — "do not use legacy
// react-dom/server APIs" — and it does so *only* at runtime, so the build and any
// test that renders outside Next both pass while the real send fails. This is the
// non-legacy API and is safe inside a route handler.
//
// The `.edge` subpath because Next's build additionally refuses the bare
// `react-dom/server` specifier, on the reasonable assumption that it signals a
// mis-rendered component. This is not a component; it is a string-producing
// function for an email body.
import { renderToReadableStream } from 'react-dom/server.edge';
import { EMAIL, PALETTE } from '@/styles/palette';
import type { DailyDigest, Difficulty, DigestItem } from '@/domain/types';

/**
 * The daily email. This is the product, so it is the one template worth care.
 *
 * Written as JSX in the repo, which is ADR-005's stated reason for choosing
 * Resend. It does not use a component library: the layout is one centred column
 * and a list, so a nested table with inline styles covers every client, and the
 * library that would otherwise supply this is deprecated on npm.
 *
 * Constraints that shape everything here:
 *   - Email clients support neither `var()` nor `color-mix()`, so colours are
 *     inlined from src/styles/palette.ts, which a test pins to tokens.css.
 *   - Outlook ignores most modern CSS, hence tables and `align`.
 *   - The vivid green is 1.88:1 on the paper background, so it is only ever a
 *     border here, never text. Mentioned by name rather than by value because
 *     the token guard rightly refuses hex literals in this file.
 */

const BODY_FONT = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const MONO_FONT = 'Consolas, "Courier New", monospace';

const DIFFICULTY_RULE: Record<Difficulty, string> = {
  EASY: PALETTE.green,
  MEDIUM: EMAIL.inkSoft,
  HARD: EMAIL.ink,
};

function Problem({ item }: { item: DigestItem }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td
            style={{
              paddingLeft: '14px',
              paddingTop: '10px',
              paddingBottom: '10px',
              borderLeft: `3px solid ${DIFFICULTY_RULE[item.difficulty]}`,
            }}
          >
            <a
              href={item.url}
              style={{
                color: EMAIL.accent,
                fontFamily: BODY_FONT,
                fontSize: '17px',
                fontWeight: 'bold',
                textDecoration: 'underline',
              }}
            >
              {item.title}
            </a>
            <div
              style={{
                fontFamily: MONO_FONT,
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: EMAIL.inkSoft,
                paddingTop: '4px',
              }}
            >
              {item.difficulty}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Digest({ digest }: { digest: DailyDigest }) {
  const { roadmapName, items, progress, quote } = digest;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{subjectFor(digest)}</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: EMAIL.background,
          color: EMAIL.ink,
        }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: EMAIL.background }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: '28px 12px' }}>
                <table
                  role="presentation"
                  width={560}
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ width: '560px', maxWidth: '100%', textAlign: 'left' }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          fontFamily: MONO_FONT,
                          fontSize: '11px',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: EMAIL.inkSoft,
                          paddingBottom: '4px',
                        }}
                      >
                        LockedIn
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          fontFamily: MONO_FONT,
                          fontSize: '26px',
                          color: EMAIL.ink,
                          paddingBottom: '2px',
                        }}
                      >
                        {roadmapName}
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          fontFamily: MONO_FONT,
                          fontSize: '12px',
                          color: EMAIL.inkSoft,
                          paddingBottom: '18px',
                        }}
                      >
                        {progress.completedCount} of {progress.totalCount} solved
                        {' · '}
                        day {progress.daysElapsed} of {progress.totalDays}
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          borderTop: `2px solid ${EMAIL.rule}`,
                          paddingTop: '18px',
                          paddingBottom: '6px',
                          fontFamily: MONO_FONT,
                          fontSize: '11px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: EMAIL.inkSoft,
                        }}
                      >
                        {items.length === 1 ? 'Today' : `Today · ${items.length}`}
                      </td>
                    </tr>

                    {items.map((item) => (
                      <tr key={item.url}>
                        <td style={{ paddingBottom: '6px' }}>
                          <Problem item={item} />
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td
                        style={{
                          paddingTop: '22px',
                          borderTop: `1px solid ${EMAIL.inkSoft}`,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: BODY_FONT,
                            fontStyle: 'italic',
                            fontSize: '15px',
                            color: EMAIL.inkSoft,
                            paddingTop: '14px',
                          }}
                        >
                          {quote}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function subjectFor(digest: DailyDigest): string {
  const n = digest.items.length;
  return `${digest.roadmapName} — ${n} problem${n === 1 ? '' : 's'} today`;
}

export async function renderDailyDigest(digest: DailyDigest): Promise<string> {
  // React escapes text content, so a problem title containing markup cannot
  // inject into the email. `allReady` waits for the whole tree rather than
  // letting a shell flush early — there is nothing to stream to, we want the
  // finished document.
  const stream = await renderToReadableStream(<Digest digest={digest} />);
  await stream.allReady;
  const body = await new Response(stream).text();

  return `<!DOCTYPE html>${body}`;
}
