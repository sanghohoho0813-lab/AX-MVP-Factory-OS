// 미니앱 전용 PDF → 텍스트 추출기 (원본 src/mini/pdf.js).
// [D-93] pdf.js 본체는 쓸 때만 내려받는다(이 OS 는 화면마다 나눠 싣는다). 나머지는 원본 그대로.
//   좌표(transform) 기준으로 같은 줄을 묶고 x순으로 정렬하는 작업은 엔진의 groupItemsIntoLines를 재사용한다.
import { groupItemsIntoLines } from "../engine/index.js";

// File → 레이아웃 복원 텍스트(엔진 입력용). onProgress(page, total)로 진행률 통지.
// 반환: { text, pages } — pages=[{pageNo, text}] (페이지별 보존 → 섹션 추출 정확도 향상).
export async function extractPdfText(file, onProgress) {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  try {
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  } catch (e) {}
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = [];
    content.items.forEach((it) => {
      if (!it || typeof it.str !== "string" || it.str.trim() === "") return;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      items.push({ text: it.str, x: tr[4], y: tr[5], w: it.width || 0, h: it.height || Math.abs(tr[3]) || 10 });
    });
    const lines = groupItemsIntoLines(items);
    pages.push({ pageNo: i, text: (lines || []).map((l) => l.text).join("\n") });
    if (onProgress) onProgress(i, doc.numPages);
  }
  try { await doc.destroy(); } catch (e) {}
  return { text: pages.map((p) => p.text).join("\n").trim(), pages };
}
