/**
 * 주민등록번호가 저장되지 않게 막는 곳 (D-136).
 *
 * 규칙(CLAUDE.md): 주민등록번호는 저장하지 않는다. 엑셀 칸 이름이 헷갈려(예: '주민등록번호' 가 '등록번호' 로 잡혀)
 * 사업자번호 칸에 들어오거나, 메모에 적혀 있어도 저장 직전에 걸러 낸다.
 * 모양만 본다 — 가려 쓴 것(950115-1******)도 주민번호로 본다. 법인등록번호(같은 13자리 모양)도 함께 걸러진다.
 */

/**
 * 6자리-7자리(가림 * 포함) · 붙은 13자리(앞 6자리가 날짜인 것) · 6자리 공백 7자리.
 * 파일 경로·저장 id 안의 숫자(예: 1727654400000_a.pdf)는 건드리지 않게 앞뒤가 영문·숫자·_·/·. 이면 보지 않는다.
 */
const RRN_PATTERNS: RegExp[] = [
  /(?<![A-Za-z0-9_./])\d{6}\s*[-‐‑‒–—―−－]\s*[0-9*xX●•○#]{7}(?![0-9A-Za-z*●•○#_])/g,
  /(?<![A-Za-z0-9_./-])\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[0-9]\d{6}(?![A-Za-z0-9_./])/g,
  /(?<![A-Za-z0-9_./])\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s+[0-9][0-9*]{6}(?![0-9A-Za-z*_])/g,
]

export const RRN_REMOVED = '[주민번호 지움]'

/** 주민등록번호처럼 보이는 글자가 들어 있나 */
export function looksLikeRrn(v: unknown): boolean {
  if (v == null) return false
  const s = String(v)
  return RRN_PATTERNS.some((re) => {
    re.lastIndex = 0
    const hit = re.test(s)
    re.lastIndex = 0
    return hit
  })
}

/** 글자 안의 주민번호 모양을 지운다 */
export function stripRrn(v: string): string {
  let s = v
  for (const re of RRN_PATTERNS) {
    re.lastIndex = 0
    s = s.replace(re, RRN_REMOVED)
  }
  return s
}

/** 객체·배열 안의 모든 글자에서 주민번호 모양을 지운다 (저장 직전 마지막 그물) */
export function scrubRrnDeep<T>(v: T): T {
  if (typeof v === 'string') return (looksLikeRrn(v) ? stripRrn(v) : v) as unknown as T
  if (Array.isArray(v)) return v.map((x) => scrubRrnDeep(x)) as unknown as T
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = scrubRrnDeep(x)
    return out as T
  }
  return v
}

/** 사업자등록번호 칸 값이 주민번호(또는 13자리 번호)처럼 보이나 — 사업자번호는 10자리다 */
export function bizNoLooksLikeRrn(v: unknown): boolean {
  const s = v == null ? '' : String(v).trim()
  if (!s) return false
  return looksLikeRrn(s) || s.replace(/[^0-9*]/g, '').length === 13
}

/** 사업자등록번호 칸 — 주민번호 모양이면 아예 비운다 */
export function safeBizNo(v: unknown): string {
  const s = v == null ? '' : String(v).trim()
  return bizNoLooksLikeRrn(s) ? '' : s
}

/**
 * 엑셀 칸 이름이 주민번호·외국인등록번호 칸인가 (이런 칸은 어떤 항목에도 자동으로 잇지 않는다).
 * '주민번호 앞자리' 처럼 앞자리만 담는 칸은 생년월일로 읽을 수 있어 뺀다 — 값은 생년월일로만 바뀌고 그대로 저장되지 않는다.
 */
export function isRrnHeader(h: unknown): boolean {
  const n = String(h == null ? '' : h).replace(/\s+/g, '')
  return /주민|외국인등록/.test(n) && !/앞/.test(n)
}

/**
 * 생년월일 칸 값 → 'YYYY-MM-DD' | ''. 주민번호 모양(앞 7자리 이상)이면 생년월일만 뽑고 나머지는 버린다.
 * normDate 는 보통 날짜 글자를 읽는 함수(엑셀 마법사 · 명부).
 */
export function birthFromCell(v: unknown, normDate: (s: string) => string): { value: string; fromRrn: boolean; ok: boolean } {
  const s = v == null ? '' : String(v).trim()
  if (!s) return { value: '', fromRrn: false, ok: true }
  const m = s.match(/^(\d{6})\s*-?\s*([0-9])[0-9*xX●•○#]{0,6}$/)
  if (m && (s.includes('-') || /^\d{7}$|^\d{13}$/.test(s.replace(/[*xX●•○#]/g, '0')))) {
    const yy = Number(m[1].slice(0, 2))
    const mm = Number(m[1].slice(2, 4))
    const dd = Number(m[1].slice(4, 6))
    const g = m[2]
    const century = '1256'.includes(g) ? 1900 : '3478'.includes(g) ? 2000 : '90'.includes(g) ? 1800 : 0
    const iso = century ? normDate(`${century + yy}-${mm}-${dd}`) : ''
    return { value: iso, fromRrn: true, ok: !!iso }
  }
  const iso = normDate(s)
  return { value: iso, fromRrn: false, ok: !!iso }
}
