import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.client-ops-stage2-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/clientOpsStage2.test.ts', formats: ['es'], fileName: () => 'stage2.mjs' },
    minify: false,
    target: 'node20',
  },
})
