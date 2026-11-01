/**
 * AI 도우미 지시문 묶음 — 전문 모듈 한눈에(고객 전체를 모듈 기준으로 거꾸로). builders 에서 떼어 냄(D-479).
 * 이 묶음만 판정 엔진(buildInsights)을 쓴다 — 업무 화면(업체 상세 · 오늘 …)이 AI 도우미 띠 때문에 판정 엔진 전체를 받지 않게. 묶음 내용 · 지시문은 그대로.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import type { GrantNotice } from '../grants/grantMatch'
import { INSIGHT_TONE_LABEL, buildInsights } from '../clientInsights'
import type { Insight } from '../clientInsights'
import { isContractClient } from '../salesPipeline'
import { latestEmploymentRoster } from '../toolResultGroups'
import { RefBook, personNames, safeText, wonText } from './context'
import type { AssistBundle, AssistRow } from './context'
import { todayLabel } from './builders'

/* ------------------------------------------------------------------ */
/* 전문 모듈 한눈에(고객 전체를 거꾸로)                                     */
/* ------------------------------------------------------------------ */

const MODULE_NAME: Record<string, string> = {
  'policy-funding': '정책자금',
  employment: '고용지원금',
  labcare: '기업부설연구소',
  'startup-tax': '창업감면',
  tax: '절세',
  cretop: '크레탑 재무',
  'cert-os': '기업인증',
  grants: '지원사업',
}

export function moduleBundle(i: { today: string; records: ClientOpsRecord[]; features: readonly string[]; notices: readonly GrantNotice[]; usable: (key: string) => boolean; title: string }): AssistBundle {
  const book = new RefBook()
  const want = new Set(i.features)
  const rows: AssistRow[] = []
  for (const r of i.records.filter((x) => x.archivedAt === null)) {
    let list: Insight[] = []
    try {
      list = buildInsights(r, i.today, i.notices, (k) => want.has(k) && (k === 'grants' || i.usable(k))).filter((x) => want.has(x.key))
    } catch {
      list = []
    }
    if (list.length === 0) continue
    const names = personNames(r)
    const roster = want.has('employment') ? latestEmploymentRoster(r) : null
    const rosterData = (roster?.data ?? {}) as { counts?: Record<string, number>; subsidySummary?: { name: string; candidateCount: number; level?: string }[]; subsidyTotal?: number }
    for (const x of list) {
      rows.push({
        ref: book.client(r),
        업체: r.companyName,
        구분: isContractClient(r) ? '계약' : '잠재',
        모듈: x.label,
        판정: INSIGHT_TONE_LABEL[x.tone],
        한줄: safeText(x.headline, names, 160),
        자세히: safeText(x.detail, names, 220),
        금액: x.amount ?? '',
        모자란것: x.missing.slice(0, 6),
        ...(x.key === 'employment' && roster
          ? { 명부: `명부 기준 ${roster.createdAt.slice(0, 10)}`, 명부지원금: (rosterData.subsidySummary ?? []).filter((s) => s.candidateCount > 0).map((s) => `${s.name} 대상 ${s.candidateCount}명`), 명부합계: wonText(rosterData.subsidyTotal ?? null) }
          : {}),
      })
    }
  }
  const rank: Record<string, number> = { '가능성 높음': 0, '검토해 볼 만함': 1, '정보가 더 필요해요': 2, '이미 함': 3, '해당 없음': 4 }
  rows.sort((a, b) => (rank[String(a.판정)] ?? 9) - (rank[String(b.판정)] ?? 9))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: i.title,
      today: todayLabel(i.today),
      purpose: `고객 전체를 ${i.features.map((k) => MODULE_NAME[k] ?? k).join(' · ')} 기준으로 거꾸로 훑기 — 누구에게 무엇을 받아 줄 수 있나`,
      sections: [{ name: '업체 × 모듈 판정(규칙 계산 그대로)', rows: rows.slice(0, 120), total: rows.length }],
      facts: ['판정 · 금액은 OS 규칙 계산 결과다. 바꾸지 말고 그대로 쓴다.'],
    },
  }
}
