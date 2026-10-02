import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.finance-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/finance.test.ts', formats: ['es'], fileName: () => 'finance.mjs' },
    minify: false,
    target: 'node20',
  },
})
