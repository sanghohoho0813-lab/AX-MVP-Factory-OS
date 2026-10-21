import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.vstudy-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/videoStudy.test.ts', formats: ['es'], fileName: () => 'vstudy.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
