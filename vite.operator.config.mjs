import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.operator-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/operator.test.ts', formats: ['es'], fileName: () => 'operator.mjs' },
    rollupOptions: { external: ['@supabase/supabase-js'] },
    minify: false,
    target: 'node20',
  },
})
