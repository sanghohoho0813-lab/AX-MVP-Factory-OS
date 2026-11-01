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
  return fixDateNoise(String(text || ''))
    // D-442 숫자 덩어리 맨 앞의 l · I(1) — 'l8O,OOO,OOO' · 'I2,000' → 1(뒤가 숫자로 이어질 때만 · 영어 낱말은 그대로)
    .replace(/(^|[^0-9A-Za-z])[Il](?=\d[\dOoIl,.]*(?![0-9A-Za-z]))/g, '$11')
    // D-427 숫자 덩어리 안의 영문 O(OCR 이 0 을 O 로 읽음) — '2,4OO,OOO,OOO' · '2O25' → 0. 숫자로 시작하는 덩어리 안에서만('A01' 같은 코드 · 영어 낱말은 그대로)
    .replace(/(^|[^0-9A-Za-z])(\d[\dOo,.]*[Oo][\dOo,.]*[\dOo]|\d[\dOo,.]*[Oo])(?![0-9A-Za-z])/g, (_m, pre: string, num: string) => `${pre}${num.replace(/[Oo]/g, '0')}`)
    // D-442 숫자 1 을 영문 l · I 로 읽음 — 숫자 덩어리 안('2,l00,000' · '3I0,000') · 세 자리 묶음 앞('l,200,000' · 'I.500.000') → 1
    .replace(/(^|[^0-9A-Za-z])(\d[\dIl,.]*[Il][\dIl,.]*\d)(?![0-9A-Za-z])/g, (_m, pre: string, num: string) => `${pre}${num.replace(/[Il]/g, '1')}`)
    .replace(/(^|[^0-9A-Za-z])[Il]((?:[,.]\d{3})+)(?![0-9A-Za-z])/g, '$11$2')
    .replace(/(^|[^\d.,])(\d{1,3}(?:[.,]\d{3}){2,})(?!\d)/g, (_m, pre: string, num: string) => `${pre}${num.replace(/\./g, ',')}`)
    .replace(/(\d{1,3}(?:,\d{3})*),[ \t]+(\d{3}(?:,\d{3})*)(?![\d])/g, '$1,$2')
    // D-446 숫자 사이에 낀 괄호('6(00,000,000') → 뺌. 앞뒤를 감싼 괄호('(1,000)' 음수)는 그대로
    .replace(/(\d)[()](?=\d)/g, '$1')
    // D-446 맨 앞 묶음이 네 자리 이상인 금액('1500,000,000' — 쉼표 하나가 빠짐) → 다시 묶음(1,500,000,000). 쉼표를 숫자로 읽은 것('22400,000,000')은 재무제표 셈이 고친다
    .replace(/(^|[^\d.,])(\d{4,})((?:,\d{3})+)(?![\d,])/g, (m, pre: string, lead: string, rest: string) => {
      const d = `${lead}${rest.replace(/,/g, '')}`
      return d.length > 15 ? m : `${pre}${Number(d).toLocaleString('en-US')}`
    })
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

/**
 * D-434 날짜 안의 OCR 잡음 — '2O19 년 O3 월 l5 일' · '2O26. 1O. 2O' · '2O26년 O9월' → 숫자(O → 0 · l/I → 1).
 * 예전에는 스캔 사업자등록증 개업일 'O3 월' 때문에 설립일이 비었다(D-427 은 숫자로 시작하는 덩어리만 고쳤다).
 * 연도가 1 · 2 로 시작하는 네 자리 · 월 1~12 · 일 1~31 일 때만 바꾼다(코드 · 낱말은 그대로).
 */
export function fixDateNoise(text: string): string {
  const fix = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
  const ok = (y: string, m: string, d?: string) => {
    const Y = Number(fix(y))
    const M = Number(fix(m))
    const D = d === undefined ? 1 : Number(fix(d))
    return Y >= 1900 && Y <= 2100 && M >= 1 && M <= 12 && D >= 1 && D <= 31
  }
  const Ch = '[\\dOoIl]'
  return String(text || '')
    // '년 … 월 (… 일)'
    .replace(new RegExp(`(^|[^0-9A-Za-z])([12]${Ch}{3})(\\s*년\\s*)(${Ch}{1,2})(\\s*월)(?:(\\s*)(${Ch}{1,2})(?=\\s*일))?`, 'g'), (m, pre: string, y: string, a: string, mo: string, b: string, c?: string, d?: string) =>
      ok(y, mo, d) ? `${pre}${fix(y)}${a}${fix(mo)}${b}${d !== undefined ? `${c ?? ''}${fix(d)}` : ''}` : m)
    // '2O26.1O.2O' · '2O26-O3-15' · '2O26. 1O. 2O'
    .replace(new RegExp(`(^|[^0-9A-Za-z])([12]${Ch}{3})(\\s*[.\\-/]\\s*)(${Ch}{1,2})(\\s*[.\\-/]\\s*)(${Ch}{1,2})(?![0-9A-Za-z])`, 'g'), (m, pre: string, y: string, a: string, mo: string, b: string, d: string) =>
      ok(y, mo, d) ? `${pre}${fix(y)}${a}${fix(mo)}${b}${fix(d)}` : m)
}

/** D-446 원래 글자(숫자만)에서 한두 글자를 빼면 그 숫자가 되나 — 같으면 그대로(괄호 · 점이 낀 경우) */
export function digitsFit(token: string, value: number): boolean {
  const d = token.replace(/[^\d]/g, '')
  const s = String(Math.abs(Math.round(value)))
  if (s.length < 4 || !d) return false
  if (d === s) return true
  if (d.length - s.length < 1 || d.length - s.length > 2) return false
  let i = 0
  for (const ch of d) if (i < s.length && ch === s[i]) i++
  return i === s.length
}

/** D-448 글자 인식이 자주 헷갈리는 숫자 짝(6↔8 · 3↔8 · 0↔8 · 5↔6 · 5↔8 · 1↔7 · 0↔6 · 0↔9 · 4↔9 · 8↔9) */
const CONFUSABLE = new Set(['06', '08', '09', '17', '38', '49', '56', '58', '68', '89'])
/**
 * D-448 원래 글자가 그 숫자의 '글자 인식 실수' 로 설명되나 — 한두 글자가 더 낌(digitsFit) 또는 같은 길이에서 숫자 하나가 헷갈리는 짝으로 바뀜('860' → '880').
 */
export function ocrNear(token: string, value: number): boolean {
  if (digitsFit(token, value)) return true
  const d = token.replace(/[^\d]/g, '')
  const s = String(Math.abs(Math.round(value)))
  if (d.length !== s.length || s.length < 4) return false
  const diff = [...d].map((ch, i) => [ch, s[i]] as const).filter(([a, b]) => a !== b)
  return diff.length === 1 && CONFUSABLE.has([diff[0][0], diff[0][1]].sort().join(''))
}
