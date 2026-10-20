import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.chat-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/chat.test.ts', formats: ['es'], fileName: () => 'chat.mjs' },
    rollupOptions: { external: ['node:fs', 'node:path'] },
    minify: false,
    target: 'node20',
  },
})
