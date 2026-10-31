/**
 * D-414 스캔본(사진 · OCR) · 표에서 꺼낸 글의 금액 잡음 — 재무 서류(재무제표 · 과세표준증명 · 소득금액증명 · 부가세 신고서 ·
 * 원천세 신고서 · 사업장현황신고서)를 읽기 전에 한 번 고친다.
 *
 *  - 쉼표가 마침표로 읽힘: '2.400.000.000' → '2,400,000,000'. 세 자리 묶음이 둘 이상일 때만(100만 이상) —
 *    날짜 '2025.07.25' · 소수 '10.5' · '150.000' 처럼 한 묶음은 그대로. 쉼표와 섞여도('2,400.000,000') 같게.
 *  - 쉼표 뒤 빈칸: '2,400, 000,000' → '2,400,000,000'. 쉼표 뒤가 정확히 세 자리(그 뒤에 숫자가 더 붙지 않음)일 때만.
 *    예전에는 '2,400' 까지만 읽어 매출 2,400원이 들어갔다.
 * 규칙 계산 — 외부 호출 없음.
 */
export function fixAmountNoise(text: string): string {
  return String(text || '')
    .replace(/(^|[^\d.,])(\d{1,3}(?:[.,]\d{3}){2,})(?!\d)/g, (_m, pre: string, num: string) => `${pre}${num.replace(/\./g, ',')}`)
    .replace(/(\d{1,3}(?:,\d{3})*),[ \t]+(\d{3}(?:,\d{3})*)(?![\d])/g, '$1,$2')
}

/**
 * D-414 표 칸이 줄마다 따로 나온 글('매출액' 다음 줄에 '2,400,000,000' · '2,000,000,000') — 숫자만 있는 줄을 앞 줄 끝에 붙인다.
 * 이름과 숫자가 한 줄에 있는 글은 그대로.
 */
export function joinNumberOnlyLines(lines: readonly string[]): string[] {
  const out: string[] = []
  const numOnly = /^[\s(（]*[△▲-]?\s*\d[\d,]*\s*[)）]?(?:\s+[(（]?[△▲-]?\s*\d[\d,]*[)）]?)*\s*원?\s*$/
  for (const l of lines) {
    if (out.length && numOnly.test(l) && /\d{1,3},\d{3}|\d{4,}/.test(l)) out[out.length - 1] = `${out[out.length - 1]} ${l.trim()}`
    else out.push(l)
  }
  return out
}
