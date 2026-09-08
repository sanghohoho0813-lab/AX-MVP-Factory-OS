import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.consulting-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/consulting.test.ts', formats: ['es'], fileName: () => 'consulting.mjs' },
    rollupOptions: { external: ['@supabase/supabase-js'] },
    minify: false,
    target: 'node20',
  },
})
