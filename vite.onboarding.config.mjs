import { defineConfig } from 'vite'

// 처음 사용 가이드(온보딩) 순수 로직·저장소 단위 테스트 빌드 설정.
// 서비스는 repositories 를 import 하지만 저장소는 window 부재 시 메모리 대체를
// 사용하므로 node 환경에서 실행 가능하다.
export default defineConfig({
  build: {
    outDir: '.onboarding-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/onboarding.test.ts',
      formats: ['es'],
      fileName: () => 'onboarding.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
