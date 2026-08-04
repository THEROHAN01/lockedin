import { ThemeToggle } from '../../theme-toggle';

/**
 * Token preview. A development aid, not a product screen: it exists so the design
 * layer can be eyeballed in both themes and so a contrast regression is visible
 * rather than theoretical.
 */

const SURFACES = [
  ['--bg', 'page background'],
  ['--bg-surface', 'card'],
  ['--bg-surface-hover', 'card hover'],
  ['--code-bg', 'code block'],
] as const;

const TEXT_ON_BG = [
  ['--ink', 'body text', '21.0:1 light / 18.1:1 dark'],
  ['--ink-soft', 'secondary text', 'derived'],
  ['--ink-mute', 'metadata', 'derived'],
  ['--accent', 'links, emphasis', '10.7:1 light / 9.65:1 dark'],
] as const;

const DIFFICULTY = [
  ['--difficulty-easy', 'EASY'],
  ['--difficulty-medium', 'MEDIUM'],
  ['--difficulty-hard', 'HARD'],
] as const;

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  marginBlock: 24,
} as const;

function Swatch({ token, note }: { token: string; note: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          background: `var(${token})`,
          border: '1px solid var(--rule-soft)',
          flexShrink: 0,
        }}
      />
      <span>
        <code>{token}</code>
        <span className="lk-label" style={{ display: 'block' }}>
          {note}
        </span>
      </span>
    </div>
  );
}

export default function TokenPreview() {
  return (
    <main className="lk-container" style={{ paddingBlock: 48 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <div>
          <h1>LockedIn</h1>
          <p className="lk-label">Design token preview — not a product screen</p>
        </div>
        <ThemeToggle />
      </header>

      <hr />

      <section>
        <h3>Palette</h3>
        <p style={{ color: 'var(--ink-soft)' }}>
          Four source values in <code>src/styles/tokens.css</code>. Everything else
          is derived from them with <code>color-mix()</code>. The vivid green is
          1.88:1 on the light background, so it is restricted to fills, borders and
          dots — never text.
        </p>
        <div style={GRID}>
          <Swatch token="--accent-vivid" note="brand green, non-text only" />
          <Swatch token="--accent" note="text-safe accent" />
          <Swatch token="--ink" note="text" />
          <Swatch token="--bg" note="background" />
        </div>
      </section>

      <hr />

      <section>
        <h3>Surfaces</h3>
        <div style={GRID}>
          {SURFACES.map(([token, note]) => (
            <Swatch key={token} token={token} note={note} />
          ))}
        </div>
      </section>

      <hr />

      <section>
        <h3>Text on background</h3>
        <ul style={{ listStyle: 'none', padding: 0, marginBlock: 24 }}>
          {TEXT_ON_BG.map(([token, role, ratio]) => (
            <li key={token} style={{ marginBottom: 14 }}>
              <span style={{ color: `var(${token})`, fontSize: '1.05rem' }}>
                The quick brown fox jumps over the lazy dog.
              </span>
              <span className="lk-label" style={{ display: 'block' }}>
                <code>{token}</code> · {role} · {ratio}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <hr />

      <section>
        <h3>Primitives</h3>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBlock: 24,
          }}
        >
          <button type="button" className="lk-btn">
            Secondary
          </button>
          <button type="button" className="lk-btn lk-btn-primary">
            Primary
          </button>
          <span className="lk-dot lk-dot-done" aria-hidden />
          <span className="lk-dot lk-dot-pending" aria-hidden />
          {DIFFICULTY.map(([token, label]) => (
            <span
              key={token}
              className="lk-label"
              style={{ borderLeft: `3px solid var(${token})`, paddingLeft: 8 }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="lk-card lk-card-raised" style={{ maxWidth: 420 }}>
          <span className="lk-label">Progress</span>
          <p style={{ margin: '4px 0 12px' }}>7 of 30 solved · day 9 of 30</p>
          <div className="lk-progress">
            <div
              className="lk-progress-fill"
              style={{ ['--bar-pct' as string]: '23%' }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
