import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.startup-tax-out',
    emptyOutDir: true,
    lib: { entry: './src/tools/startupTax/__tests__/selftest.test.ts', formats: ['es'], fileName: () => 'startup-tax.mjs' },
    minify: false,
    target: 'node20',
  },
})
