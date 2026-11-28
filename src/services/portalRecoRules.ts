/**
 * D-689 고객 화면 '담당자가 추천해요' — 규칙(순수 함수 · AI 아님).
 *
 *  1) 후보 — 이 업체에 맞는 공고(grantMatch 판정 그대로: 맞음 · 확인 필요) · 먼저 제안할 것(맞춤 추천 판정 그대로 — D-618 판정은 한 곳).
 *     고객에게 보일 글은 금액 · 점수 · 판정 숫자 없이 근거 한 줄만 만든다(담당자가 고칠 수 있다).
 *  2) 금액 · 점수 짚기 — 고객 화면에 금액 · 점수를 쓰지 않는다(올리기 단추를 막는다).
 *  3) [관심 있어요] 후속 줄 — 고객이 누른 뒤 담당자가 아직 연락하지 않았으면(업체 기록 '안부 연락' 날 뒤) 오늘 화면에 한 줄.
 *     저절로 보내지 않는다 · 연락하면([연락했어요]) 저절로 빠진다.
 */
import type { GrantMatch } from './grants/grantMatch'
import { daysBetween, type PortalFollowUp } from './portalGrowthRules'
import { localDateOf } from '../lib/appClock'

export type RecoKind = 'grant' | 'task'

/** 고객 화면에 한 업체당 몇 개까지(서버도 같은 수로 막는다 — 0036) */
export const RECO_LIMIT = 3
export const RECO_TITLE_MAX = 80
export const RECO_REASON_MAX = 160
export const RECO_KIND_LABEL: Record<RecoKind, string> = { grant: '지원사업', task: '다음 과제' }

export interface RecoSourceRef {
  type: 'grant' | 'insight' | 'manual'
  id: string
}

export interface RecoCandidate {
  key: string
  kind: RecoKind
  title: string
  reason: string
  deadline: string | null
  linkUrl: string | null
  sourceRef: RecoSourceRef
  /** 이미 고객 화면에 올라와 있다 */
  shown: boolean
}

export const refKey = (r: { type: string; id: string } | null | undefined): string => (r && r.type && r.id ? `${r.type}:${r.id}` : '')

const cut = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** http(s) 주소만(서버와 같은 규칙) — 아니면 null */
export function cleanLink(url: string | null | undefined): string | null {
  const t = (url ?? '').trim()
  return t && t.length <= 500 && /^https?:\/\/[^\s<>"]+$/i.test(t) ? t : null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** 맞는 공고 → 후보(맞음 · 확인 필요만 · 마감 안 지난 것 · 5개까지). 금액 글(amountText)은 싣지 않는다 */
export function grantCandidates(matches: readonly GrantMatch[], shownRefs: ReadonlySet<string>, max = 5): RecoCandidate[] {
  return matches
    .filter((m) => (m.verdict === 'fit' || m.verdict === 'check') && m.deadline.open)
    .slice(0, max)
    .map((m) => {
      const ok = m.reasons.filter((r) => r.state === 'ok').map((r) => r.label).filter(Boolean).slice(0, 3)
      const reason =
        m.verdict === 'fit'
          ? ok.length ? `${ok.join(' · ')} 조건이 맞아요` : '회사 조건에 맞는 공고예요'
          : `확인할 조건이 ${Math.max(1, m.unknownCount)}가지 있어요 — 함께 확인해 봐요`
      const sourceRef: RecoSourceRef = { type: 'grant', id: m.notice.id }
      return {
        key: refKey(sourceRef),
        kind: 'grant' as const,
        title: cut(m.notice.title, RECO_TITLE_MAX),
        reason: cut(reason, RECO_REASON_MAX),
        deadline: m.notice.deadlineKind === 'date' && YMD.test(m.notice.applyEnd) ? m.notice.applyEnd : null,
        linkUrl: cleanLink(m.notice.url),
        sourceRef,
        shown: shownRefs.has(refKey(sourceRef)),
      }
    })
}

/** 먼저 제안할 것(맞춤 추천 판정 그대로 · 3개까지) → 후보. 판정 글 · 예상 금액은 싣지 않는다 */
export function taskCandidates(picks: readonly { key: string; label: string }[], shownRefs: ReadonlySet<string>): RecoCandidate[] {
  return picks.slice(0, 3).map((p) => {
    const sourceRef: RecoSourceRef = { type: 'insight', id: p.key }
    return {
      key: refKey(sourceRef),
      kind: 'task' as const,
      title: cut(p.label, RECO_TITLE_MAX),
      reason: '회사 기록으로 보면 함께 검토해 볼 만해요 — 자세한 것은 담당자가 안내해 드려요',
      deadline: null,
      linkUrl: null,
      sourceRef,
      shown: shownRefs.has(refKey(sourceRef)),
    }
  })
}

/** 고객 화면에 쓰지 않는 금액 · 점수 · 확률 — 찾으면 그 낱말(없으면 null) */
export function amountIn(text: string): string | null {
  const m = /\d[\d,.]*\s*(?:억|천만|백만|만\s*원|만원|원|%|퍼센트|점)|최대\s*\d[\d,.]*/.exec(text)
  return m ? m[0].trim() : null
}

/** 올리기 전 확인 — 고칠 것이 있으면 사람 말 한 줄(없으면 null) */
export function recoInputProblem(input: { title: string; reason: string; linkUrl: string }): string | null {
  const title = input.title.trim()
  if (!title) return '제목을 적어 주세요.'
  if (title.length > RECO_TITLE_MAX) return `제목은 ${RECO_TITLE_MAX}자까지예요.`
  if (input.reason.trim().length > RECO_REASON_MAX) return `근거는 ${RECO_REASON_MAX}자까지예요.`
  const amount = amountIn(`${title} ${input.reason}`)
  if (amount) return `금액 · 점수('${amount}')는 고객 화면에 쓰지 않아요 — 빼고 적어 주세요.`
  if (input.linkUrl.trim() && !cleanLink(input.linkUrl)) return '주소는 http:// 나 https:// 로 시작해야 해요.'
  return null
}

/** 고객 화면에서 보일 마감 글 — '1/15 마감' · 지났으면 '마감' */
export function recoDeadlineText(deadline: string | null, today: string): string {
  if (!deadline || !YMD.test(deadline)) return ''
  const left = daysBetween(today, deadline)
  if (left < 0) return '마감'
  const md = `${Number(deadline.slice(5, 7))}/${Number(deadline.slice(8, 10))}`
  return left === 0 ? '오늘 마감' : left <= 7 ? `${md} 마감 · ${left}일 남음` : `${md} 마감`
}

export interface RecoLite {
  id: string
  title: string
  status: 'shown' | 'withdrawn'
}

export interface RecoInterestLite {
  recId: string
  interestedAt: string
}

/** 연락이 필요한 관심 — 올라와 있는 추천에 누른 것 가운데 마지막 안부 연락 날 뒤의 것(가장 이른 것 먼저) */
export function pendingInterests(recos: readonly RecoLite[], interests: readonly RecoInterestLite[], lastContactAt?: string | null): (RecoInterestLite & { title: string })[] {
  const shown = new Map(recos.filter((r) => r.status === 'shown').map((r) => [r.id, r.title]))
  const after = (lastContactAt ?? '').slice(0, 10)
  return interests
    .filter((i) => shown.has(i.recId) && (!after || localDateOf(i.interestedAt) > after))
    .map((i) => ({ ...i, title: shown.get(i.recId) ?? '' }))
    .sort((a, b) => a.interestedAt.localeCompare(b.interestedAt))
}

/** 오늘 '고객 화면 챙길 것' — 관심 있다고 하신 곳(업체마다 한 줄) */
export function recoInterestFollowUps(
  input: { clientId: string; recos: readonly RecoLite[]; interests: readonly RecoInterestLite[]; lastContactAt?: string | null },
  today: string,
): PortalFollowUp[] {
  const pend = pendingInterests(input.recos, input.interests, input.lastContactAt)
  if (!pend.length) return []
  const titles = [...new Set(pend.map((p) => p.title))]
  const first = pend[0]
  const last = pend[pend.length - 1]
  const what = titles.length === 1 ? `'${cut(titles[0], 18)}' 추천` : `추천 ${titles.length}개`
  return [
    {
      key: `${input.clientId}:reco:${last.interestedAt}`,
      rule: 'reco_interest',
      clientId: input.clientId,
      days: Math.max(0, daysBetween(localDateOf(first.interestedAt), today)),
      text: `${what}에 관심 있다고 하셨어요 — 연락드려 주세요`,
    },
  ]
}
