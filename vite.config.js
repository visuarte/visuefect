import { defineConfig } from 'vite';

// Vite config: ensure Three/Pixi are pre-bundled for tests and SSR-safe
export default defineConfig({
  optimizeDeps: {
    include: ['three', 'pixi.js', '@mojs/core']
  },
  // For SSR and vitest we avoid externalizing these libs to ensure they
  // are processed by Vite and play nicely in the jsdom test environment
  ssr: {
    noExternal: ['three', 'pixi.js', '@mojs/core']
  },
  test: {
    // Vitest settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    deps: {
      inline: ['three', 'pixi.js', '@mojs/core']
    },
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously'
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  server: {
    fs: {
      allow: ['.']
    }
  },
  assetsInclude: ['**/*.gltf','**/*.glb','**/*.obj','**/*.bin','**/*.json','**/*.ktx','**/*.webp']
});