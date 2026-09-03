import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.autherrors-out', emptyOutDir: true,
    lib: { entry: './src/services/__tests__/authErrors.test.ts', formats: ['es'], fileName: () => 'autherrors.mjs' },
    minify: false, target: 'node20',
  },
})
