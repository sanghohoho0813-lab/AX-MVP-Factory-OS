import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.homeask-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/homeAsk.test.ts', formats: ['es'], fileName: () => 'homeask.mjs' },
    minify: false,
    target: 'node20',
  },
})
