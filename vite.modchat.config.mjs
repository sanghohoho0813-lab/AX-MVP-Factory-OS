import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.modchat-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/modChat.test.ts', formats: ['es'], fileName: () => 'modchat.mjs' },
    minify: false,
    target: 'node20',
    rollupOptions: { external: ['@supabase/supabase-js', 'pdfjs-dist', 'tesseract.js'] },
  },
})
