import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js', 'src/**/*.test.js', '**/*.test.js'],
    setupFiles: ['./test/setup.js']
  }
});
