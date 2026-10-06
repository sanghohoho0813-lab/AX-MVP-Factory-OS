import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.pilot-out',
    emptyOutDir: true,
    lib: { entry: './src/auth/__tests__/pilot.test.ts', formats: ['es'], fileName: () => 'pilot.mjs' },
    minify: false,
    target: 'node20',
  },
})
