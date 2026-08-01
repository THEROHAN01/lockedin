import { describe, expect, it } from 'vitest';

/**
 * Verifies the test harness itself: Vitest runs, TypeScript compiles under the
 * `unit` project, and globals are available. Real behaviour is tested in the
 * sibling files that cover src/domain.
 */
describe('test harness', () => {
  it('runs typescript with strict null checks in effect', () => {
    const maybe: string | undefined = ['ok'][0];
    expect(maybe).toBe('ok');
  });
});
