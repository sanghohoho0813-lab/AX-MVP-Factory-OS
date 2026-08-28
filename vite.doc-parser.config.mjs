import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.doc-parser-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/koreanDocParser.test.ts', formats: ['es'], fileName: () => 'doc-parser.mjs' },
    minify: false,
    target: 'node20',
  },
})
