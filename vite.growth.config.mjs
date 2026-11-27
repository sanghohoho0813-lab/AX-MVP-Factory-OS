import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.growth-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/portalGrowth.test.ts', formats: ['es'], fileName: () => 'growth.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
