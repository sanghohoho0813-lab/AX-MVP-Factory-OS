import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.talk-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/consultTalk.test.ts', formats: ['es'], fileName: () => 'talk.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
