/** [D-119] 크레탑 PDF → 글(pdf.js) — TS 에서 부를 때의 모양 */
export function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ text: string; pages: Array<{ pageNo: number; text: string }> }>
