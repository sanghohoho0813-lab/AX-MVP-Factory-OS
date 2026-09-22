import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.tools-out',
    emptyOutDir: true,
    lib: { entry: './src/tools/__tests__/tools.test.ts', formats: ['es'], fileName: () => 'tools.mjs' },
    minify: false,
    target: 'node20',
  },
})
