import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // Each test file provisions its own temp SQLite database; run files
    // sequentially for deterministic, isolated runs.
    fileParallelism: false,
    pool: 'forks',
  },
});
