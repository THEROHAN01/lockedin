import tseslint from 'typescript-eslint';

/**
 * Layer boundaries are enforced here, not just documented.
 *
 * docs/ARCHITECTURE.md §2 states that `src/domain/` is pure and that the
 * dependency direction points inward. Both claims are load-bearing — domain
 * purity is what makes the pacing engine testable with zero infrastructure —
 * and both are the kind of rule that rots silently. A single `import type`
 * from Prisma for convenience breaks the guarantee without adding any runtime
 * I/O, so it would never show up in a test.
 *
 * `no-restricted-imports` catches type-only imports too, which is the whole
 * point.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'src/generated/**',
      'next-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // ── The domain layer is pure ────────────────────────────────────────────
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '.prisma/**', '@/generated/**'],
              message:
                'src/domain must not know about Prisma, including type-only imports. Repositories in src/data map rows into the plain types in src/domain/types.ts.',
            },
            {
              group: [
                '@/data/**',
                '@/usecases/**',
                '@/notifications/**',
                '@/sources/**',
                '@/emails/**',
              ],
              message:
                'Dependencies point inward. src/domain is the innermost layer and imports nothing from outer layers.',
            },
            {
              group: ['next', 'next/**', 'react', 'react-dom', 'server-only'],
              message:
                'src/domain is framework-agnostic. Anything needing Next or React belongs in an outer layer.',
            },
            {
              group: ['resend', 'better-auth', 'better-auth/**'],
              message: 'src/domain must not depend on a vendor SDK.',
            },
          ],
        },
      ],
    },
  },

  // ── Presentation talks to use cases, never straight to the database ─────
  {
    files: ['app/**/*.ts', 'app/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/**'],
              message:
                'Route handlers and pages go through src/usecases, which owns orchestration. Reaching past it into a repository bypasses ownership checks and duplicates logic.',
            },
          ],
        },
      ],
    },
  },

  // ── The clock lives in use cases, not in domain or presentation ─────────
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'src/domain takes the current instant as a parameter. `new Date()` here breaks purity and forces clock mocking in tests.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'src/domain takes the current instant as a parameter. `Date.now()` here breaks purity and forces clock mocking in tests.',
        },
      ],
    },
  },
);
