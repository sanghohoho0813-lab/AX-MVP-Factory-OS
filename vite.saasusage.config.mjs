import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.saasusage-out',
    emptyOutDir: true,
    lib: { entry: './src/services/__tests__/saasUsage.test.ts', formats: ['es'], fileName: () => 'saasusage.mjs' },
    minify: false,
    target: 'node20',
    // 화면 파일을 읽어 안내 열쇠(data-guide)가 빠짐없이 글이 있는지 본다(K20) — 노드 기본 모듈은 묶지 않는다
    rollupOptions: { external: ['node:fs', 'node:path'] },
  },
})
