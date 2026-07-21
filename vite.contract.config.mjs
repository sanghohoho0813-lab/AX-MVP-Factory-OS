import { defineConfig } from 'vite'

// Mock Supabase 저장소 계약 테스트 빌드 설정.
// 실제 Supabase SDK 는 타입 전용 import 라 번들에 포함되지 않는다(external 처리).
export default defineConfig({
  build: {
    outDir: '.contract-out',
    emptyOutDir: true,
    lib: {
      entry: './src/repositories/supabase/__contract__/contract.test.ts',
      formats: ['es'],
      fileName: () => 'contract.mjs',
    },
    rollupOptions: { external: ['@supabase/supabase-js'] },
    minify: false,
    target: 'node20',
  },
})
