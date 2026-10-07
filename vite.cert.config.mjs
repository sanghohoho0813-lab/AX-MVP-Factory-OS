import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.cert-out',
    emptyOutDir: true,
    lib: { entry: './src/certification/__tests__/certification.test.ts', formats: ['es'], fileName: () => 'cert.mjs' },
    minify: false,
    target: 'node20',
  },
})
