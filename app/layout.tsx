import type { Metadata } from 'next';
import { JetBrains_Mono, Source_Serif_4, VT323 } from 'next/font/google';
import './globals.css';

const display = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-body-src',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-src',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LockedIn',
  description: 'A roadmap that nags you until you finish it.',
};

/**
 * Runs before first paint so a dark-theme user never sees a light flash.
 * Inline by necessity: any deferred script is already too late.
 *
 * Injected with dangerouslySetInnerHTML, which is safe here and must stay safe:
 * this is a module-level constant with no interpolation and no request, user or
 * database data in it. Never template anything into this string.
 */
const THEME_INIT = `
(function () {
  try {
    var saved = localStorage.getItem('lk-theme');
    var dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
