/**
 * Vitest configuration.
 *
 * The puzzle state machine is pure TypeScript and needs no browser, so tests
 * run in the `node` environment. A separate config keeps Vitest from loading
 * the IWSDK Vite plugin (which is a browser/dev-server concern only).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
