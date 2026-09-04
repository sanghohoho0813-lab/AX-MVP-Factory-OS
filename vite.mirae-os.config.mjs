import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.mirae-os-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/miraeOs.test.ts', formats: ['es'], fileName: () => 'mirae-os.mjs' },
    minify: false,
    target: 'node20',
  },
})
