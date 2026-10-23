import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.threads-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/threads.test.ts', formats: ['es'], fileName: () => 'threads.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
