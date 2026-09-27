import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.facts-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/customerFacts.test.ts', formats: ['es'], fileName: () => 'facts.mjs' },
    minify: false,
    target: 'node20',
  },
})
