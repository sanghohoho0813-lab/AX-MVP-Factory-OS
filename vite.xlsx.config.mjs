import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.xlsx-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/xlsx.test.ts', formats: ['es'], fileName: () => 'xlsx.mjs' },
    minify: false,
    target: 'node20',
  },
})
