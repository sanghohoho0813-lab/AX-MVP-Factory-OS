import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.grants-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/grants.test.ts', formats: ['es'], fileName: () => 'grants.mjs' },
    minify: false,
    target: 'node20',
  },
})
