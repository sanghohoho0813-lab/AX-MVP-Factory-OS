import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.office-docs-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/officeDocs.test.ts', formats: ['es'], fileName: () => 'office-docs.mjs' },
    minify: false,
    target: 'node20',
  },
})
