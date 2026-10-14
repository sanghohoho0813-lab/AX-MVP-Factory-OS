import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.ownerai-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/ownerAi.test.ts', formats: ['es'], fileName: () => 'ownerai.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
