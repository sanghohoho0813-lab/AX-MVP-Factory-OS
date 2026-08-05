import { defineConfig } from 'vite'

// 고객 운영 레저 서비스 단위 테스트 빌드 설정.
export default defineConfig({
  build: {
    outDir: '.client-ops-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/clientOpsLedger.test.ts',
      formats: ['es'],
      fileName: () => 'client-ops.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
