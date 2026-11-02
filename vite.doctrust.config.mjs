import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.doctrust-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/docTrust.test.ts', formats: ['es'], fileName: () => 'doctrust.mjs' },
    minify: false,
    target: 'node20',
  },
})
