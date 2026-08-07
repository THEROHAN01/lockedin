import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Geist({
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Geist({
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
 * Writes the theme twice, to `data-theme` and to the `dark` class, because the
 * two halves of the app read it differently and neither is worth converting:
 * the blueprint tokens key off [data-theme] (tokens.css), while Fumadocs' theme
 * and its Tailwind `dark:` variant key off `.dark` — stock, unpatched. Setting
 * both means /docs gets working dark mode with no CSS overrides, and one
 * localStorage key still decides the theme for the whole app. The docs
 * subtree's next-themes provider is configured with the same pair
 * (app/docs/layout.tsx), so toggling on either side agrees with the other.
 *
 * Injected with dangerouslySetInnerHTML, which is safe here and must stay safe:
 * this is a module-level constant with no interpolation and no request, user or
 * database data in it. Never template anything into this string.
 */
const THEME_INIT = `
(function () {
  function apply(dark) {
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.classList.toggle('dark', dark);
  }
  try {
    var saved = localStorage.getItem('lk-theme');
    apply(saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {
    apply(false);
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
