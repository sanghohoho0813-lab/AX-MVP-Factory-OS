import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.pvux-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/pvux.test.ts', formats: ['es'], fileName: () => 'pvux.mjs' },
    rollupOptions: { external: ['node:fs', 'node:path'] },
    minify: false,
    target: 'node20',
  },
})
