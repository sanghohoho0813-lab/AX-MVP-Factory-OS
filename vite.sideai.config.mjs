import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.sideai-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/sideAi.test.ts', formats: ['es'], fileName: () => 'sideai.mjs' },
    minify: false,
    target: 'node20',
  },
})
