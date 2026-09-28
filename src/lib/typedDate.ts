/** D-131: 큰 달력의 '직접 적기' — 사람이 적은 날짜를 YYYY-MM-DD 로. 없는 날짜(2월 30일)는 null */
/** 날짜 두 자리 */
const pad = (n: number) => String(n).padStart(2, '0')

/** 사람이 적은 날짜 — 20150302 · 2015-03-02 · 2015.3.2 · 2015/3/2 · 2015년 3월 2일 */
export function parseTypedDate(text: string): string | null {
  const t = text.trim()
  let y = 0
  let m = 0
  let d = 0
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(t.replace(/\s/g, ''))
  const loose = /^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\.?$/.exec(t)
  if (compact) [y, m, d] = [Number(compact[1]), Number(compact[2]), Number(compact[3])]
  else if (loose) [y, m, d] = [Number(loose[1]), Number(loose[2]), Number(loose[3])]
  else return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

