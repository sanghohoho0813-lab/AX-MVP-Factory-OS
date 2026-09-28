import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.taxplan-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/taxPlan.test.ts', formats: ['es'], fileName: () => 'taxplan.mjs' },
    minify: false,
    target: 'node20',
  },
})
