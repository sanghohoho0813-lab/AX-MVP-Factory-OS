import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.catalog-out',
    emptyOutDir: true,
    lib: { entry: './src/config/__tests__/catalog.test.ts', formats: ['es'], fileName: () => 'catalog.mjs' },
    minify: false,
    target: 'node20',
  },
})
