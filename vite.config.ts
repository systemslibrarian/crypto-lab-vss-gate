/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/crypto-lab-vss-gate/',
  // Keep Vitest scoped to unit tests; the Playwright e2e specs live in e2e/.
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
