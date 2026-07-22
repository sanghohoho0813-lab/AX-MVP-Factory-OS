import { defineConfig } from 'vite'

// 설문 저장 신뢰성 단위 테스트 빌드 설정 (직렬 큐·sanitizer·draft 최신성).
export default defineConfig({
  build: {
    outDir: '.persistence-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/persistence.test.ts',
      formats: ['es'],
      fileName: () => 'persistence.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
