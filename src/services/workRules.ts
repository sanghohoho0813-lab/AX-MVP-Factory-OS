/**
 * D-339 취업규칙 → 정년 · 계속고용 제도.
 *
 * 고령자 계속고용장려금은 정년 연장(1년 이상) · 정년 폐지 · 정년 뒤 재고용 중 하나를 취업규칙 등에 두고 1년 넘게 운영해야 받는다(2026 고용노동부 안내).
 * 올린 취업규칙 글에서 정년 나이와 그 제도가 있는지를 읽는다. 확정이 아니라 '읽은 대로' — 화면은 ★ 확인으로.
 */

export interface RetireRule {
  /** 정년 나이(만) — 못 읽으면 null */
  age: number | null
  /** 'rehire' 정년 뒤 재고용 · 'extend' 정년이 만 60세보다 늦음(연장) · 'abolish' 정년 없음 · null 조항 못 찾음 */
  continuing: 'rehire' | 'extend' | 'abolish' | null
}

/** 취업규칙인가 — 파일 이름이나 앞부분에 '취업규칙' 이 있고, 근로 규정 낱말이 보이는 글 */
export function looksLikeWorkRules(text: string, fileName = ''): boolean {
  const head = `${fileName} ${String(text || '').slice(0, 3000)}`
  return /취\s*업\s*규\s*칙/.test(head) && /정\s*년|근\s*로\s*시\s*간|휴\s*가|퇴\s*직/.test(String(text || ''))
}

/** 정년 · 계속고용 조항 — 정년 이야기가 없으면 null */
export function readRetireRule(text: string): RetireRule | null {
  const t = String(text || '').replace(/\s+/g, ' ')
  if (!/정\s*년/.test(t)) return null
  // 정년 없음 · 폐지
  if (/정\s*년\s*(?:을|를|은|는)?\s*(?:두지\s*아니|두지\s*않|폐지|없)/.test(t)) return { age: null, continuing: 'abolish' }
  const ageM = /정\s*년\s*(?:은|는|을|를)?\s*(?:만\s*)?(\d{2})\s*세/.exec(t)
  const age = ageM && Number(ageM[1]) >= 55 && Number(ageM[1]) <= 75 ? Number(ageM[1]) : null
  // 정년 뒤 다시 쓰는 조항 — 재고용 · 촉탁 · 계속 고용 · 정년 뒤 근로계약. 정년이 나오는 조(제n조)에서만 —
  // 다른 조항의 '퇴직자 재고용' 을 정년 조항으로 읽지 않게. 조 번호가 없는 글이면 정년 낱말 뒤 100자
  const articles = t.split(/(?=제\s*\d+\s*조)/)
  const near =
    articles.length > 1
      ? articles.filter((a) => /정\s*년/.test(a)).join(' | ')
      : [...t.matchAll(/정\s*년/g)].map((m) => t.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 100)).join(' | ')
  const rehire = /재\s*고\s*용|촉\s*탁|계\s*속\s*고\s*용|(?:다시|새로)\s*(?:고용|채용|근로\s*계약)/.test(near)
  if (age === null && !rehire) return null
  // 법정 정년(만 60세)보다 늦으면 정년 연장으로 본다 — 언제 늘렸는지(1년 넘게 운영)는 ★ 확인
  return { age, continuing: rehire ? 'rehire' : age !== null && age > 60 ? 'extend' : null }
}

/** 회사 정보 '정년 · 계속고용' 칸에 넣는 한 줄 */
export function retireRuleLine(r: RetireRule): string {
  if (r.continuing === 'abolish') return '정년 없음(정년 폐지) — 계속고용 제도 있음(취업규칙)'
  const age = r.age !== null ? `정년 ${r.age}세` : '정년 나이 못 읽음'
  if (r.continuing === 'rehire') return `${age} · 정년 뒤 재고용 조항 있음(취업규칙)`
  if (r.continuing === 'extend') return `${age} · 법정 정년(60세)보다 늦음 — 정년 연장 조항 있음(취업규칙 · 늘린 때 확인)`
  return `${age} · 정년 뒤 재고용 · 연장 조항 없음(취업규칙)`
}

/** 칸 글 → 제도가 있나(있음 · 없음 · 모름) */
export function continuingOf(line: string): 'yes' | 'no' | null {
  if (!line.trim()) return null
  if (/조항 없음/.test(line)) return 'no'
  if (/조항 있음|정년 폐지|계속고용 제도 있음/.test(line)) return 'yes'
  return null
}
