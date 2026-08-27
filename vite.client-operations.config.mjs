import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: '.client-operations-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/clientOperations.test.ts',
      formats: ['es'],
      fileName: () => 'client-operations.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
