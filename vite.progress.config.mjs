import { defineConfig } from 'vite'

// 프로젝트 진행상태(deriveProjectProgress) 순수 함수 단위 테스트 빌드 설정.
// projectProgressService 는 repositories 를 import 하지만 테스트는 순수 함수만
// 호출하므로 node 환경에서 localStorage 없이도 실행 가능해야 한다.
export default defineConfig({
  build: {
    outDir: '.progress-out',
    emptyOutDir: true,
    lib: {
      entry: './src/services/__tests__/progress.test.ts',
      formats: ['es'],
      fileName: () => 'progress.mjs',
    },
    minify: false,
    target: 'node20',
  },
})
