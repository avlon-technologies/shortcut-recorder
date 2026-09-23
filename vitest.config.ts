import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node by default: the core must work with no DOM at all. Files that need a
    // DOM opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
