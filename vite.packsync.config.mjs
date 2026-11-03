import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.packsync-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/packSync.test.ts', formats: ['es'], fileName: () => 'packsync.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
