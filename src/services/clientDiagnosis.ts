/**
 * D-352 맞춤 진단서 한 장 — 서류가 들어오면 대표님(고객)께 바로 드리는 '우리 회사 맞춤 진단'.
 * 대표 지시(고도화 최종 목표): "초보자가 써도 바로 컨설팅 전문가 · 서류가 다 들어오면 모듈 추천이 먼저 — 맞는 모듈을 싹 다, 눈에 잘 띄게".
 *
 *  - 맞춤 추천 탭과 같은 판정(buildInsights)을 그대로 — 먼저 제안할 것은 '이 업체에 먼저 제안할 것' 과 같은 순서 · 같은 3개(topPicks).
 *  - 나머지 모듈도 모두 한 줄씩(검토해 볼 만함 → 자료가 더 필요 → 분석 있음 → 지금은 어려움).
 *  - 받을 자료는 자료 요청 문구와 같은 표(requestItemsFrom — 어디서 떼는지 · 어느 진단에 쓰는지). 저희가 조회할 것은 따로.
 *  - 고객에게 드리는 종이 — 수수료 · 영업자 · 메모 · 업무 일기 · 내부 표시(★ 같은) · 화면 안내 말('올리면 · 판정해요')은 넣지 않는다.
 *  - 금액은 엔진이 이미 계산한 것만(짐작하지 않음). 규칙 계산이다 — 외부 호출 · LLM 0. 선정 · 승인을 보장하지 않는다.
 */
import type { ClientOpsRecord, DiagnosisGiven } from '../types/clientOps'
import { localDateOf } from '../lib/appClock'
import { withActivity } from './clientOpsActivity'
import { clientFacts } from '../tools/shared/clientPrefill'
import { regionOf } from './clientOpsProfile'
import { isPick, manwonText, topPicks, type Insight, type InsightTone } from './clientInsights'
import { policyBonus } from './policyEvidence'
import { requestItemsFrom, type RequestItem } from './recoRequest'

export interface DiagnosisLine {
  key: string
  label: string
  tone: InsightTone
  toneLabel: string
  /** 고객에게 보여 줄 한 줄 */
  text: string
  /** 엔진이 계산한 금액(없으면 '') */
  amount: string
}

/** D-363 지난번 드린 진단서 뒤 달라진 것(고객 종이 · 화면 같은 내용) */
export interface DiagnosisSince {
  /** 지난번 드린 날 YYYY-MM-DD */
  date: string
  how: DiagnosisGiven['how']
  /** 판정이 바뀐 모듈 */
  changed: { key: string; label: string; from: string; to: string; better: boolean }[]
  /** 그때 요청했고 지금은 더 필요 없는 자료(받은 자료) */
  received: string[]
}

export interface DiagnosisSheet {
  companyName: string
  today: string
  /** D-363 지난번(오늘 전) 드린 진단서와 견준 것 — 처음이면 null */
  since: DiagnosisSince | null
  /** 회사 한눈에 — 확인된 것만(모르면 칸을 빼서 비어 보이지 않게) */
  snapshot: { label: string; value: string }[]
  picks: DiagnosisLine[]
  others: DiagnosisLine[]
  /** 대표님께 받을 자료(어디서 떼는지 · 어느 진단에) */
  requests: RequestItem[]
  /** 저희가 직접 조회할 것 */
  ours: string[]
  /** 다음 순서 */
  steps: string[]
  notes: string[]
}

/** 화면 안내 말 · 내부 표시를 고객 말로 — '★ 세무사' 같은 표시 · '(추정)' 은 그대로 두지 않는다 */
export function customerText(s: string): string {
  return s
    .replace(/\s*\(★[^)]*\)/g, '')
    .replace(/★\s*/g, '')
    .replace(/\s*·\s*신고 때 빠졌으면[^·]*/g, '')
    // 자료 요청 표의 'PDF를 올리면 … 채워집니다' 는 우리 화면 안내 — 고객 종이에서는 뺀다(괄호 속 안내는 남김)
    .replace(/\s*—\s*[^—()]*올리면[^—()]*(?=\(|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const ORDER: Record<InsightTone, number> = { good: 0, maybe: 1, need: 2, done: 3, no: 4 }
/** 종이에 쓰는 짧은 판정 이름(한 줄에 들어가게) */
export const SHEET_TONE: Record<InsightTone, string> = { good: '가능성 높음', maybe: '검토해 볼 만함', need: '자료 필요', done: '분석 있음', no: '지금은 어려움' }

function lineOf(i: Insight): DiagnosisLine {
  // 자료가 더 필요한 모듈 — 화면 안내('…을 알면 판정해요 · 올리면 …') 대신 받을 자료 이름으로
  const text =
    i.tone === 'need'
      ? i.missing.length
        ? `필요한 자료: ${i.missing.join(' · ')}`
        : customerText(i.headline)
      : customerText(i.headline)
  return { key: i.key, label: i.label, tone: i.tone, toneLabel: SHEET_TONE[i.tone], text, amount: i.amount ? customerText(i.amount) : '' }
}

const won = (n: number) => manwonText(n)

/** 판정이 나아졌는지 — 가능성 높음 > 검토해 볼 만함 · 분석 있음 > 자료 필요 > 지금은 어려움 */
const RANK: Record<string, number> = { good: 3, maybe: 2, done: 2, need: 1, no: 0 }
const toneName = (t: string) => SHEET_TONE[t as InsightTone] ?? t

/** D-363 오늘 전에 드린 가장 최근 진단서와 견준다 — 바뀐 판정 · 받은 자료. 처음이면 null */
export function diagnosisSince(given: readonly DiagnosisGiven[] | undefined, lines: readonly DiagnosisLine[], requests: readonly { label: string }[], today: string): DiagnosisSince | null {
  const prev = (given ?? []).find((g) => localDateOf(g.at) && localDateOf(g.at) < today)
  if (!prev) return null
  const before = new Map(prev.lines.map((l) => [l.key, l]))
  const changed: DiagnosisSince['changed'] = []
  for (const l of lines) {
    const b = before.get(l.key)
    if (!b || b.tone === l.tone) continue
    changed.push({ key: l.key, label: l.label, from: toneName(b.tone), to: l.toneLabel, better: (RANK[l.tone] ?? 0) > (RANK[b.tone] ?? 0) })
  }
  changed.sort((a, b) => Number(b.better) - Number(a.better))
  const still = new Set(requests.map((r) => r.label))
  const received = prev.requests.filter((r) => !still.has(r))
  return { date: localDateOf(prev.at), how: prev.how, changed, received }
}

/**
 * D-366 '먼저 제안할 것' 카드의 한 줄 — 마지막으로 드린 진단서(오늘 것 포함)와 지금 판정을 견준다.
 * 달라졌으면 '다시 드릴 때', 그대로면 언제 드렸는지만. 드린 적이 없으면 null(줄 없음).
 */
export function diagnosisNote(record: ClientOpsRecord, insights: readonly Insight[], today: string): { state: 'changed' | 'same' | 'today'; text: string } | null {
  const last = record.diagnosisGiven?.[0]
  if (!last) return null
  const d = buildDiagnosis(record, insights, today)
  // 오늘 드린 것까지 견준다 — '오늘 전' 대신 아주 먼 날을 기준으로 맨 앞 기록을 고른다
  const s = diagnosisSince(record.diagnosisGiven, [...d.picks, ...d.others], d.requests, '9999-12-31')
  const date = localDateOf(last.at)
  const when = date === today ? '오늘' : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
  const parts = [s?.changed.length ? `판정 바뀐 것 ${s.changed.length}` : '', s?.received.length ? `받은 자료 ${s.received.length}` : ''].filter(Boolean)
  if (parts.length) return { state: 'changed', text: `${when} 진단서 드린 뒤 달라짐 — ${parts.join(' · ')} · 다시 드릴 때예요` }
  return { state: date === today ? 'today' : 'same', text: `${when} 진단서 드림(${last.how === 'print' ? '인쇄 · PDF' : '카톡 요약'}) — 그 뒤 판정 그대로` }
}

/** D-363 진단서를 드린 기록 한 건(그때 판정 · 요청 자료) */
export function givenOf(d: DiagnosisSheet, how: DiagnosisGiven['how'], at: string): DiagnosisGiven {
  return {
    id: `dg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at,
    how,
    lines: [...d.picks.map((l) => ({ key: l.key, label: l.label, tone: l.tone, pick: true })), ...d.others.map((l) => ({ key: l.key, label: l.label, tone: l.tone, pick: false }))],
    requests: d.requests.map((r) => r.label),
  }
}

/**
 * D-363 드린 기록을 맨 앞에(최근 5번) + 활동 기록 한 줄. 같은 날 같은 방법으로 또 누르면 그 줄만 바꾼다(두 번 눌러도 한 줄).
 */
export function withDiagnosisGiven(record: ClientOpsRecord, given: DiagnosisGiven): ClientOpsRecord {
  const prev = record.diagnosisGiven ?? []
  const same = !!prev[0] && localDateOf(prev[0].at) === localDateOf(given.at) && prev[0].how === given.how
  const next = { ...record, diagnosisGiven: [given, ...(same ? prev.slice(1) : prev)].slice(0, 5) }
  if (same) return next
  const picks = given.lines.filter((l) => l.pick).map((l) => l.label)
  return withActivity(
    next,
    'tool',
    `맞춤 진단서 드림(${given.how === 'print' ? '인쇄 · PDF' : '카톡 요약'})${picks.length ? ` — 먼저 제안: ${picks.join(' · ')}` : ''}${given.requests.length ? ` · 요청한 자료 ${given.requests.length}가지` : ''}`,
    null,
    given.at,
  )
}

export function buildDiagnosis(record: ClientOpsRecord, insights: readonly Insight[], today: string): DiagnosisSheet {
  const facts = clientFacts(record, new Date(`${today}T00:00:00`))
  const snapshot: { label: string; value: string }[] = []
  const industry = facts.industryText || [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' · ')
  if (industry) snapshot.push({ label: '업종', value: industry.slice(0, 60) })
  if (facts.establishedAt) snapshot.push({ label: '설립', value: `${facts.establishedAt}${facts.years !== null ? ` · 업력 ${facts.years}년` : ''}` })
  const region = regionOf(facts.address || '')
  if (region) snapshot.push({ label: '지역', value: region })
  if (facts.employeeCount !== null) snapshot.push({ label: '직원', value: `${facts.employeeCount}명` })
  if (facts.revenue && facts.revenue.won > 0) snapshot.push({ label: '매출', value: `${won(facts.revenue.won)}${facts.revenue.asOf ? `(${facts.revenue.asOf.slice(0, 4)}${facts.revenue.estimated ? ' 추정' : ''})` : ''}` })
  // D-374 개인사업자는 사업소득(소득금액증명)이 법인전환 · 정책자금 판단의 근거 — 회사 한눈에 같이
  if (facts.businessType === 'individual' && facts.netIncome && facts.netIncome.won > 0 && !facts.netIncome.estimated) snapshot.push({ label: '사업소득', value: `${won(facts.netIncome.won)}${facts.netIncome.asOf ? `(${facts.netIncome.asOf.slice(0, 4)})` : ''}` })
  const held = policyBonus(record, today).items.map((x) => x.replace(/ 보유$/, ''))
  if (held.length) snapshot.push({ label: '보유', value: held.join(' · ') })

  const picks = topPicks(insights).map(lineOf)
  const pickKeys = new Set(picks.map((p) => p.key))
  const others = insights
    .filter((i) => !pickKeys.has(i.key))
    .map(lineOf)
    .sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
  const raw = requestItemsFrom(insights)
  const requests = raw.items.map((r) => ({ ...r, where: customerText(r.where) }))
  const ours = raw.ours

  const steps: string[] = []
  if (requests.length) steps.push(`아래 자료 ${requests.length}가지를 보내 주세요 — 받는 대로 나머지 진단을 마저 해 드립니다.`)
  for (const p of topPicks(insights)) steps.push(p.action ? customerText(p.action) : `${p.label} — 진행 여부를 함께 정하고 준비를 시작합니다.`)
  const moreGood = insights.filter(isPick).length - picks.length
  if (moreGood > 0) steps.push(`검토해 볼 만한 것 ${moreGood}가지는 위 결과를 보고 순서를 정합니다.`)
  steps.push('진행하는 것마다 마감 · 서류를 저희가 챙기고, 결과가 나오면 다시 정리해 드립니다.')

  return {
    companyName: record.companyName || facts.companyName || '대표님 회사',
    today,
    since: diagnosisSince(record.diagnosisGiven, [...picks, ...others], requests, today),
    snapshot,
    picks,
    others,
    requests,
    ours,
    steps: steps.slice(0, 6),
    notes: [
      '보내 주신 자료와 회사 정보로 정리한 1차 진단입니다 — 금액 · 자격은 기관 심사와 세무 검토로 확정됩니다.',
      '선정 · 승인을 약속드리는 것이 아니며, 회사 상황이 바뀌면 결과도 달라질 수 있습니다.',
    ],
  }
}

/** D-363 '달라진 것' 한 줄씩 — 종이 · 카톡 같은 말 */
export function sinceLines(since: DiagnosisSince | null): string[] {
  if (!since) return []
  const out = since.changed.map((c) => `${c.label}: ${c.from} → ${c.to}`)
  if (since.received.length) out.push(`받은 자료: ${since.received.join(' · ')}`)
  return out
}

/** 카톡 요약 — 먼저 제안할 것 · 받을 자료 · 다음 순서(짧게) */
export function diagnosisKakao(d: DiagnosisSheet, sender = ''): string {
  const out: string[] = [`[${d.companyName}] 맞춤 진단 요약 (${d.today})`, '']
  const since = sinceLines(d.since)
  if (since.length) {
    out.push(`■ 지난 진단(${d.since?.date}) 뒤 달라진 것`, ...since.map((x) => `- ${x}`), '')
  }
  if (d.picks.length) {
    out.push('■ 먼저 제안드릴 것')
    d.picks.forEach((p, i) => out.push(`${i + 1}. ${p.label} — ${p.text}${p.amount ? ` (${p.amount})` : ''}`))
    out.push('')
  }
  const maybe = d.others.filter((o) => o.tone === 'maybe')
  if (maybe.length) {
    out.push(`■ 함께 검토할 것: ${maybe.map((o) => o.label).join(' · ')}`, '')
  }
  if (d.requests.length) {
    out.push('■ 보내 주실 자료')
    for (const r of d.requests) out.push(`- ${r.label}${r.where ? ` (${r.where})` : ''}`)
    out.push('')
  }
  out.push('자세한 진단서는 PDF로 보내 드리겠습니다.')
  if (sender) out.push(sender)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
