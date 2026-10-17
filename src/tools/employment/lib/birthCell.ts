/**
 * D-215: 명부 · 엑셀 가져오기의 '생년월일' 칸 읽기 — 숫자로 들어온 생년월일을 바르게.
 *
 * 엑셀은 '010203'(2001-02-03) 같은 6자리 생년월일을 숫자로 바꿔 앞의 0을 떼고 10203 으로 준다.
 * 예전에는 5자리를 늘 엑셀 날짜 번호로 읽어 10203 → 1927-12-07 로 저장했고(경고 없음), 6자리 950115 는 '형식 확인 필요' 로 비웠다.
 * 2000년대생(청년 지원금의 핵심 대상)이 정확히 이 모양이다.
 *
 * - 6자리: YYMMDD(올해 두 자리보다 크면 1900년대).
 * - 5자리 이하: 칸 이름이 '주민앞자리 · 생년월일6자리' 처럼 6자리 칸이면 앞을 0으로 채워 YYMMDD.
 *   그냥 '생년월일' 칸이면 엑셀 날짜 번호를 먼저 보되, 그 해가 사람 나이로 말이 안 되면(1930년 전 · 14살 미만) 0을 채운 YYMMDD.
 * - 8자리 · 구분자 있는 날짜는 그대로.
 */
const pad2 = (n: number) => String(n).padStart(2, '0')
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
function valid(y: number, m: number, d: number): string | null {
  if (!(y >= 1900 && y <= 2200) || m < 1 || m > 12 || d < 1 || d > dim(y, m)) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}
function yymmdd(six: string, today: Date): string | null {
  const yy = Number(six.slice(0, 2))
  const cur = today.getFullYear() % 100
  return valid((yy <= cur ? 2000 : 1900) + yy, Number(six.slice(2, 4)), Number(six.slice(4, 6)))
}
function serial(n: number): string | null {
  if (!(n >= 61 && n < 80000)) return null
  const t = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000)
  return t.toISOString().slice(0, 10)
}

export function normBirthCell(v: unknown, opts: { sixDigit?: boolean; today?: Date } = {}): string | null {
  if (v == null) return null
  const today = opts.today ?? new Date()
  if (v instanceof Date && !isNaN(v.getTime())) return valid(v.getFullYear(), v.getMonth() + 1, v.getDate())
  const s = String(v).trim().replace(/[T\s]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/, '').replace(/\.0+$/, '')
  if (!s) return null
  if (/^\d{1,6}$/.test(s)) {
    if (s.length === 6) return yymmdd(s, today)
    const padded = yymmdd(s.padStart(6, '0'), today)
    if (opts.sixDigit) return padded
    if (s.length !== 5) return null
    const ser = serial(Number(s))
    const y = ser ? Number(ser.slice(0, 4)) : 0
    if (ser && y >= 1930 && y <= today.getFullYear() - 14) return ser
    return padded ?? ser
  }
  let m = s.replace(/[.·/년월]/g, '-').replace(/일/g, '').replace(/\s+/g, '').replace(/-+/g, '-').replace(/-$/, '')
  if (/^\d{8}$/.test(m)) m = `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}`
  const mm = m.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (mm) return valid(Number(mm[1]), Number(mm[2]), Number(mm[3]))
  const two = m.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/)
  if (two) return yymmdd(`${two[1]}${pad2(Number(two[2]))}${pad2(Number(two[3]))}`, today)
  return null
}

/** 6자리 칸 이름(주민 앞자리 · 생년월일6자리) — 숫자가 짧으면 앞 0이 빠진 것 */
export const SIX_DIGIT_BIRTH_HEADER = /앞\s*자리|6\s*자리|여섯/
