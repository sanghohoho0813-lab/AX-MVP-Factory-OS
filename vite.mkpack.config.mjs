import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.mkpack-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/mkpack.test.ts', formats: ['es'], fileName: () => 'mkpack.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
