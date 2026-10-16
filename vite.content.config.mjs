import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.content-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/contentStudio.test.ts', formats: ['es'], fileName: () => 'content.mjs' },
    minify: false,
    target: 'node20',
  },
})
