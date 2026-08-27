import { defineConfig } from 'vite'

// 고객사 운영 마감·누락 경고 엔진 단위 테스트 빌드 설정.
export default defineConfig({
  build: {
    outDir: '.client-ops-alerts-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/clientOpsAlerts.test.ts',
      formats: ['es'],
      fileName: () => 'client-ops-alerts.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
