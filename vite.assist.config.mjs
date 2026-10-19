import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.assist-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/aiAssist.test.ts', formats: ['es'], fileName: () => 'assist.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
