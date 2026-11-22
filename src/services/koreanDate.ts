/**
 * D-648 한국식 날짜 읽기 — 'YYYY년 MM월 DD일' / 'YYYY-MM-DD' / 'YYYY.MM.DD' / 숫자 8자리 → YYYY-MM-DD.
 * 서류 해석기(koreanDocParser)에서 떼어 낸 작은 파일 — 고객 사실 창고(customerFacts)가 이 함수 하나 때문에
 * 서류 해석기 전체를 오늘 · 고객 관리 · 일정 · 스레드 첫 화면으로 끌어오지 않게. 예전 파일이 그대로 다시 내보낸다(동작 그대로).
 */

function digits(s: string): string {
  return s.replace(/[^0-9]/g, '')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseKoreanDate(input: string): string | undefined {
  const s = input.trim()
  let m = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s)
  if (!m) m = /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/.exec(s)
  if (!m) {
    const d = digits(s)
    if (d.length === 8) m = [s, d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)] as unknown as RegExpExecArray
  }
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || da < 1 || da > 31) return undefined
  return `${y}-${pad2(mo)}-${pad2(da)}`
}
