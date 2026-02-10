import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.js', 'src/**/*.test.js', '**/*.test.js'],
    setupFiles: ['./vitest.setup.js']
  }
});
