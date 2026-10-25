import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.saasusage-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/saasUsage.test.ts', formats: ['es'], fileName: () => 'saasusage.mjs' },
    minify: false,
    target: 'node20',
  },
})
