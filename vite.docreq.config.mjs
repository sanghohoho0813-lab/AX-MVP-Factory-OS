import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.docreq-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/docRequests.test.ts', formats: ['es'], fileName: () => 'docreq.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
