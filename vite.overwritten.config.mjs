import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.overwritten-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/overwrittenView.test.ts', formats: ['es'], fileName: () => 'overwritten.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
