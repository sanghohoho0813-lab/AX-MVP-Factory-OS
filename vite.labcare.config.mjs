import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.labcare-out',
    emptyOutDir: true,
    lib: { entry: './src/tools/labcare/__tests__/labcare.test.ts', formats: ['es'], fileName: () => 'labcare.mjs' },
    minify: false,
    target: 'node20',
  },
})
