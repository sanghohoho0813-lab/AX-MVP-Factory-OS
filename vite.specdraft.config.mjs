import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.specdraft-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/specDraft.test.ts', formats: ['es'], fileName: () => 'specdraft.mjs' },
    rollupOptions: { external: ['node:fs', 'node:path'] },
    minify: false,
    target: 'node20',
  },
})
