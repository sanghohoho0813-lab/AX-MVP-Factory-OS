/**
 * 공고 한 장 핵심만 (D-182) — 오늘 · 확인할 것의 '자세히' 를 누르면 그 자리에서 펼친다.
 *
 * 예전에는 '자세히' 가 지원사업 알림의 업체 창(맞는 공고 61건 전부)으로 넘어가 오히려 복잡했다.
 * 이제는 그 공고 하나만: 얼마(지원 금액) · 몇 곳(선정 규모) · 언제까지(접수 기간 · 마감) · 누가(지원 대상 · 조건) ·
 * 왜 이 업체에 맞나 · 원문. 다른 공고는 '이 업체 공고 더 보기' 로 따로 간다.
 *
 * 공고 글에 적힌 것만 옮긴다 — 숫자를 지어내지 않는다(금액을 못 읽으면 '공고에 금액이 안 적혀 있어요'). 순수 함수.
 */
import { GRANT_CATEGORY_LABEL, rulesText, type GrantMatch } from './grantMatch'
import { amountOf, manText, slotsOf } from './grantFilter'

export interface GrantBrief {
  noticeId: string
  /** 분야(자금 · 인력 · 마케팅 …) */
  category: string
  /** 지원 금액 — 글 그대로 짧게('최대 5천만원'). 못 읽으면 '' */
  amount: string
  /** '선정 10곳' — 못 읽으면 '' */
  slots: string
  /** 접수 기간 '10.01 ~ 10.31' · '상시 접수' · '예산 소진 시까지' */
  period: string
  /** 마감까지('오늘 마감' · 'D-5') */
  deadline: string
  /** 소관 · 수행 기관 */
  agency: string
  /** 지원 대상 — 원문 앞부분(길면 자른다) */
  target: string
  /** 공고가 거는 조건(사람 말) */
  conditions: string[]
  /** 이 업체와 맞는 조건 */
  fits: string[]
  /** 확인이 더 필요한 조건 */
  checks: string[]
  /** 공고 요약 — 앞부분만 */
  summary: string
  url: string
}

const md = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : '')

/** 길면 문장 · 글자 경계에서 자른다 */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다 '), cut.lastIndexOf(' · '))
  return `${(stop > max * 0.6 ? cut.slice(0, stop + 1) : cut).trim()}…`
}

export function grantBriefOf(m: GrantMatch): GrantBrief {
  const n = m.notice
  const a = amountOf(n)
  // 목록 칩과 같은 규칙 — 읽은 글이 짧으면 그대로, 길면 '최대 ○○'
  const amount = a.man !== null ? (a.text && a.text.length <= 24 ? a.text : `최대 ${manText(a.man)}`) : clip(n.amountText, 40)
  const slots = slotsOf(n)
  const period =
    n.deadlineKind === 'always'
      ? '상시 접수'
      : n.deadlineKind === 'first_come'
        ? `${md(n.applyStart) ? `${md(n.applyStart)}부터 ` : ''}예산 소진 시까지`
        : [md(n.applyStart), md(n.applyEnd)].filter(Boolean).join(' ~ ') + (n.applyEndTime ? ` ${n.applyEndTime}` : '')
  return {
    noticeId: n.id,
    category: GRANT_CATEGORY_LABEL[n.category] ?? '',
    amount,
    slots: slots !== null ? `선정 ${slots.toLocaleString('ko-KR')}곳` : '',
    period,
    deadline: m.deadline.label,
    agency: [n.agency, n.operator && n.operator !== n.agency ? n.operator : ''].filter(Boolean).join(' · '),
    target: clip(n.target, 140),
    conditions: rulesText(n.rules).slice(0, 6),
    fits: m.reasons.filter((r) => r.state === 'ok').map((r) => `${r.label}: ${r.text}`).slice(0, 5),
    checks: m.reasons.filter((r) => r.state === 'unknown').map((r) => `${r.label}: ${r.text}`).slice(0, 3),
    summary: clip(n.summary, 160),
    url: n.url,
  }
}
