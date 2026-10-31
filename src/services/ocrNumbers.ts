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
    // D-427 숫자 덩어리 안의 영문 O(OCR 이 0 을 O 로 읽음) — '2,4OO,OOO,OOO' · '2O25' → 0. 숫자로 시작하는 덩어리 안에서만('A01' 같은 코드 · 영어 낱말은 그대로)
    .replace(/(^|[^0-9A-Za-z])(\d[\dOo,.]*[Oo][\dOo,.]*[\dOo]|\d[\dOo,.]*[Oo])(?![0-9A-Za-z])/g, (_m, pre: string, num: string) => `${pre}${num.replace(/[Oo]/g, '0')}`)
    .replace(/(^|[^\d.,])(\d{1,3}(?:[.,]\d{3}){2,})(?!\d)/g, (_m, pre: string, num: string) => `${pre}${num.replace(/\./g, ',')}`)
    .replace(/(\d{1,3}(?:,\d{3})*),[ \t]+(\d{3}(?:,\d{3})*)(?![\d])/g, '$1,$2')
    // D-416 한 묶음이라도 '원' · '주' 가 바로 붙으면 금액 · 주식 수('5.000 원' · '15.000주' → 5,000 · 15,000)
    .replace(/(^|[^\d.,])(\d{1,3})\.(\d{3})(?=\s*(?:원|주)(?![가-힣]))/g, '$1$2,$3')
}

/**
 * D-416 스캔 글자가 한 글자씩 띄워 읽은 말('발 행 주 식 의 총 수' · '박 지 훈' · '취 임') → 붙임.
 * 한 글자 한글이 빈칸 하나씩 두고 둘 이상 이어질 때만(탭으로 나뉜 표 칸 · 낱말 사이 띄어쓰기는 그대로).
 */
export function joinSpacedHangul(text: string): string {
  return String(text || '').replace(/(^|[\s])([가-힣](?: [가-힣])+)(?=\s|$)/gm, (_m, pre: string, run: string) => `${pre}${run.replace(/ /g, '')}`)
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
