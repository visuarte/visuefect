import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['three', 'pixi.js', '@mojs/core']
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