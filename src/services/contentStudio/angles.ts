/**
 * D-230 제목 각도 — 콘텐츠 작성 규칙집 2장(제목 · 후킹 각도 17개) · 2-1(후보 5개는 서로 다른 각도 · 검색 의도) · 2-2(키워드별로 쓴 각도를 기록해 빼고 고른다).
 *
 * 각도마다 쓸 수 있는 조건이 있다 — 우리 데이터가 있을 때만(통계 · 비교 경험), 경력이 사실일 때만(권위), 실제 고객 말이 있을 때만(사례),
 * 의료는 비용 · 가격 각도 금지, 의료 · 교육은 압박형 금지. 조건이 안 맞는 각도는 후보에 넣지 않는다(지어내지 않는다).
 * 규칙으로 고른다(AI 아님).
 */
import { contentLib } from './library'
import type { ContentProfile } from './profile'
import { applyTone } from './tone'
import { blogTitleFit, clean, fitText, isB2B, j, mainKeyword, monthOf, withoutArea } from './generate'

export type AngleId = 'stat' | 'fail' | 'cost' | 'expert' | 'compare' | 'myth' | 'paradox' | 'fit' | 'timing' | 'prep' | 'after' | 'target' | 'question' | 'case' | 'trap' | 'inside' | 'urgent'

/** 규칙집 2-1 검색 의도 다섯 가지 — 후보마다 하나씩 붙이면 겹치지 않는다 */
export type SearchIntent = '문제 해결' | '비용' | '불안 해소' | '비교 · 선택' | '정보 탐색'

export interface AngleDef {
  id: AngleId
  /** 규칙집 2장 번호 */
  no: number
  label: string
  intent: SearchIntent
  /** 쓸 때 조건(화면 안내) */
  rule: string
}

export const ANGLES: AngleDef[] = [
  { id: 'stat', no: 1, label: '통계 + 놓침', intent: '문제 해결', rule: '우리 조사 · 고객 데이터가 있을 때만' },
  { id: 'fail', no: 2, label: '실패 · 손해 피하기', intent: '문제 해결', rule: '손해 금액은 사실일 때만' },
  { id: 'cost', no: 3, label: '비용 비교', intent: '비용', rule: '의료는 쓰지 않아요' },
  { id: 'expert', no: 4, label: '권위 경험담', intent: '불안 해소', rule: '경력이 사실 목록에 있을 때만' },
  { id: 'compare', no: 5, label: '비교 경험', intent: '비교 · 선택', rule: '실제로 비교해 본 경우만' },
  { id: 'myth', no: 6, label: '통념 뒤집기', intent: '정보 탐색', rule: '' },
  { id: 'paradox', no: 7, label: '원인 뒤집기 · 역설', intent: '비용', rule: '의료는 가격 이야기를 쓰지 않아요' },
  { id: 'fit', no: 8, label: '맞춤 진단', intent: '비교 · 선택', rule: '' },
  { id: 'timing', no: 9, label: '시기 팁', intent: '정보 탐색', rule: '' },
  { id: 'prep', no: 10, label: '사전 준비', intent: '문제 해결', rule: '' },
  { id: 'after', no: 11, label: '구매 후 활용', intent: '정보 탐색', rule: '' },
  { id: 'target', no: 12, label: '대상 부르기', intent: '불안 해소', rule: '대상은 브리프의 독자' },
  { id: 'question', no: 13, label: '고민 질문', intent: '불안 해소', rule: '제목 끝 물음표' },
  { id: 'case', no: 14, label: '고객 사례 · 후기', intent: '비교 · 선택', rule: '실제 고객 말이 있을 때만' },
  { id: 'trap', no: 15, label: '함정 TOP N', intent: '비교 · 선택', rule: '' },
  { id: 'inside', no: 16, label: '구조 설명(업계 비밀)', intent: '비용', rule: '다른 업체를 깎아내리지 않기 · 의료는 쓰지 않아요' },
  { id: 'urgent', no: 17, label: '긴급 · 미래 후회', intent: '불안 해소', rule: '의료 · 교육은 쓰지 않아요' },
]

export const ANGLE_LABEL = Object.fromEntries(ANGLES.map((a) => [a.id, a.label])) as Record<AngleId, string>
export const ANGLE_IDS = ANGLES.map((a) => a.id)

/** 도구가 거의 매번 고르는 기본 3개(통계 · 실패 · 비용)를 앞에 두지 않는다 — 규칙집 2-2 */
const ORDER: AngleId[] = ['fail', 'myth', 'expert', 'fit', 'question', 'trap', 'cost', 'prep', 'paradox', 'inside', 'timing', 'after', 'target', 'case', 'urgent', 'stat', 'compare']

/** 직함만(이름 빼고) — '대표 김한솔' → '대표' */
function titleWord(p: ContentProfile): string {
  const w = p.speaker.split(/\s+/)[0] ?? ''
  return /^(?:대표|원장|실장|팀장|이사|사장|소장|관장|점장|매니저|디자이너|선생님|강사|MD)$/.test(w) ? w : ''
}

/** 각도 하나로 제목 — 조건이 안 맞으면 null(지어내지 않는다) */
export function angleTitle(p: ContentProfile, id: AngleId, keyword: string, c: number, today: string): string | null {
  const lib = contentLib(p.industry)
  const kw = clean(keyword) || mainKeyword(p)
  const health = p.industry === 'health'
  switch (id) {
    case 'stat':
    case 'compare':
      // 우리 조사 · 실제로 비교한 기록이 없으면 쓰지 않는다(규칙집 1-6 · 2장 5번)
      return null
    case 'fail':
      return `${kw}, 알아봐도 계속 실패하는 이유 ${c}가지`
    case 'cost':
      return health ? null : `${kw}, 견적 차이는 여기서 납니다`
    case 'expert':
      return p.years !== null && p.years >= 3 ? `${kw}, ${p.years}년 차 ${j(titleWord(p) || lib.placeNoun, '이/가')} 알려 주는 고르는 법` : null
    case 'myth':
      return p.rebuttal ? `${kw}, "${p.rebuttal}" 만 믿으면 안 되는 이유` : `${kw}, 흔히 아는 것만 믿으면 안 되는 이유`
    case 'paradox':
      return health ? null : `${kw}, 싼 곳이 오히려 비싸지는 이유`
    case 'fit':
      return `${kw}, 내 상황에 맞는 ${lib.placeNoun} 찾는 법`
    case 'timing':
      return `${kw}, ${monthOf(today)}월에 이것부터 해야 하는 이유`
    case 'prep':
      return `${kw}, 시작 전에 챙길 ${c}가지`
    case 'after':
      return `${kw}, 맡긴 뒤에는 이렇게만 하세요`
    case 'target':
      return `${kw}, 처음 맡기는 분이 자주 놓치는 ${c}가지`
    case 'question':
      return p.objection ? `${kw}, ${p.objection.replace(/[?？.]+$/, '')}?` : `${kw}, 처음 맡겨도 괜찮을까요?`
    case 'case':
      return p.voice ? `${kw}, 실제로 맡겨 본 고객이 바꾼 한 가지` : null
    case 'trap':
      return `${kw}, 고를 때 후회하는 함정 TOP ${c}`
    case 'inside':
      return health ? null : `${kw}, 가격이 이렇게 정해지는 구조`
    case 'urgent':
      return health || p.industry === 'education' ? null : `${kw}, 지금 안 챙기면 다음에 아쉬운 이유`
  }
}

export interface TitleCandidate {
  id: AngleId
  label: string
  intent: SearchIntent
  title: string
  /** 이 키워드로 이미 쓴 각도(새 각도가 모자라 다시 꺼낸 것) */
  again?: boolean
}

/**
 * 후보 5개 — 서로 다른 각도, 검색 의도도 되도록 서로 다르게. 같은 키워드로 쓴 각도(used)는 빼고 고른다.
 * 블로그 제목은 25~35자로 맞춘다(짧으면 소비자형 괄호 보충 · 기업형 줄표).
 */
export function titleCandidates(p: ContentProfile, keyword: string, today: string, used: readonly AngleId[] = [], n = 5, c = 2, variant = 0): TitleCandidate[] {
  const order = [...ORDER.slice(variant % ORDER.length), ...ORDER.slice(0, variant % ORDER.length)]
  const pool = order
    .filter((id) => !used.includes(id))
    .map((id) => ({ def: ANGLES.find((a) => a.id === id) as AngleDef, title: angleTitle(p, id, keyword, c, today) }))
    .filter((x): x is { def: AngleDef; title: string } => !!x.title)
  const out: TitleCandidate[] = []
  const take = (x: { def: AngleDef; title: string }, again = false) => out.push({ id: x.def.id, label: x.def.label, intent: x.def.intent, title: applyTone(blogTitleFit(p, x.title), p.tone), ...(again ? { again } : {}) })
  // 1차 — 검색 의도가 겹치지 않게
  for (const x of pool) if (out.length < n && !out.some((o) => o.intent === x.def.intent)) take(x)
  // 2차 — 남은 자리는 다른 각도로
  for (const x of pool) if (out.length < n && !out.some((o) => o.id === x.def.id)) take(x)
  // 3차 — 새 각도를 다 썼으면 가장 오래전에 쓴 각도부터 다시(빈 칸으로 두지 않는다)
  for (const id of [...used].reverse()) {
    if (out.length >= n) break
    const title = angleTitle(p, id, keyword, c, today)
    if (title && !out.some((o) => o.id === id)) take({ def: ANGLES.find((a) => a.id === id) as AngleDef, title }, true)
  }
  return out
}

/** 유튜브 제목으로(말투는 부르는 쪽에서) — 지역을 빼고, 기업형은 괄호 없이 25~35자 · 소비자형은 (괄호 꼬리말) 40~55자 */
export function angleVideoTitle(p: ContentProfile, id: AngleId, keyword: string, c: number, today: string): string | null {
  const t = angleTitle(p, id, withoutArea(p, keyword) || p.item, c, today)
  if (!t) return null
  const base = t.replace(/^([^,]+), /, (_m, k: string) => `${k} `)
  if (isB2B(p)) return fitText([base, `${base} 총정리`, `${base} — ${contentLib(p.industry).field}에서 본 기준`], 25, 35)
  return fitText(['모르면 다시 알아보게 되는 이유', '현장에서 자주 보는 실수까지 정리', '처음 알아보는 분이라면 꼭 보세요', '맡기기 전에 꼭 보세요', '현장에서 자주 보는 실수까지 한 번에 정리'].map((x) => `${base} (${x})`), 40, 55)
}

/** 규칙집 2-2 — 이 키워드로 쓴 각도(최근 것 먼저 · 겹치지 않게) */
export function usedAngles(items: readonly { input: { keyword?: string; angle?: AngleId }; createdAt: string }[], keyword: string): AngleId[] {
  const kw = clean(keyword)
  return [...items]
    .filter((x) => x.input.angle && clean(x.input.keyword ?? '') === kw)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((x) => x.input.angle as AngleId)
    .filter((a, i, all) => all.indexOf(a) === i)
}
