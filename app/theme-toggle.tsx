'use client';

import { useEffect, useState } from 'react';

/**
 * The only client-side JavaScript in the harness. Mirrors the pre-paint script
 * in layout.tsx, which owns the initial value.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // Also the class, for the same reason THEME_INIT writes both: Fumadocs'
    // theme and Tailwind's `dark:` variant read `.dark`, the blueprint tokens
    // read [data-theme].
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('lk-theme', next);
    setTheme(next);
  }

  return (
    <button type="button" className="lk-btn" onClick={toggle}>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
