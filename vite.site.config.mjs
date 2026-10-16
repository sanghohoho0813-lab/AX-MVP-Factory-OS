import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.site-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/siteBuilder.test.ts', formats: ['es'], fileName: () => 'site.mjs' },
    minify: false,
    target: 'node20',
  },
})
