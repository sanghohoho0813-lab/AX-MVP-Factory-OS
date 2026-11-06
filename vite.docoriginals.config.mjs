import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.docoriginals-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/docOriginals.test.ts', formats: ['es'], fileName: () => 'docoriginals.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
