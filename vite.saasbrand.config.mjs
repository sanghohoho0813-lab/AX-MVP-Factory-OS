import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.saasbrand-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/saasBrand.test.ts', formats: ['es'], fileName: () => 'saasbrand.mjs' },
    minify: false,
    target: 'node20',
  },
})
