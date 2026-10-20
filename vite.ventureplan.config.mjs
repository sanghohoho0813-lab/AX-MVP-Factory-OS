import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.ventureplan-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/venturePlan.test.ts', formats: ['es'], fileName: () => 'ventureplan.mjs' },
    rollupOptions: { external: ['node:fs', 'node:path'] },
    minify: false,
    target: 'node20',
  },
})
