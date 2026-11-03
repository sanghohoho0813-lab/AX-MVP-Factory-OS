import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.draftsync-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/draftSync.test.ts', formats: ['es'], fileName: () => 'draftsync.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
