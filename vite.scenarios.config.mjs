import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.scenarios-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/scenarios.test.ts', formats: ['es'], fileName: () => 'scenarios.mjs' },
    minify: false,
    target: 'node20',
  },
})
