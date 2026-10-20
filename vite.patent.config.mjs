import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.patent-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/patentSpec.test.ts', formats: ['es'], fileName: () => 'patent.mjs' },
    rollupOptions: { external: ['node:fs', 'node:path'] },
    minify: false,
    target: 'node20',
  },
})
