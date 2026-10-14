import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.youtube-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/youtube.test.ts', formats: ['es'], fileName: () => 'youtube.mjs' },
    minify: false,
    target: 'node20',
  },
})
