import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: '.employment-out',
    emptyOutDir: true,
    lib: { entry: './src/tools/employment/__tests__/employment.test.ts', formats: ['es'], fileName: () => 'employment.mjs' },
    minify: false,
    target: 'node20',
    // 명부 진단이 OS 의 서류 판독기(docTextExtract)를 부르는데, 그 안의 pdfjs·tesseract 는 브라우저 전용이라 시험 번들에서 뺀다
    rollupOptions: { external: [/^pdfjs-dist/, /^tesseract\.js/] },
  },
})
