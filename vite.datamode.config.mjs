import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.datamode-out', emptyOutDir: true,
    lib: { entry: './src/services/__tests__/dataModeUrl.test.ts', formats: ['es'], fileName: () => 'datamode.mjs' },
    minify: false, target: 'node20',
  },
})
