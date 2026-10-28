/**
 * D-306 정책자금 판정의 '미확인' 을 서류함으로 채운다 — 대표 "서류가 다 들어오면 모듈 추천이 먼저(정확하게)".
 *
 * 정책자금 엔진은 체납 여부가 '미확인' 이면 가능성을 '높음' 으로 올리지 않는다(확인 전 상한 69점).
 * 업체 기록에서 판정할 때는 체납이 늘 미확인이라, 납세증명서를 받아 둔 업체도 '높음' 이 나올 수 없었다.
 *  - 국세 납세증명서 + 지방세 납세증명서가 둘 다 서류함에 있고 발급(없으면 올린 날) 90일 안 → 세금 체납 '없음'.
 *    (납세증명서는 체납이 있으면 발급되지 않는다. 하나만 있으면 다른 하나를 받으라고만 알린다.)
 *  - 4대보험 완납증명서가 90일 안 → 4대보험 체납 '없음'.
 *  - 재무제표 자산 ≤ 부채(자본잠식) → 부채비율 '높음'(부결의 흔한 원인 — 정책자금 사전 점검표). 자본이 있으면 짐작하지 않는다(미확인 그대로).
 * 서류 내용(체납액)은 다시 읽지 않는다 — 칸 이름 · 발급일 · 올린 날만. 칸을 손으로 옮기면 그대로 따른다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { ClientFacts } from '../tools/shared/clientPrefill'
import type { DiagnosisInput } from '../tools/policyFunding/types'
import { allDocumentMetas } from './clientOpsDocuments'

export interface PolicyEvidence {
  /** 진단 입력에 덮어쓸 값(미확인을 채우는 것만) */
  input: Partial<Pick<DiagnosisInput, 'taxArrears' | 'insuranceArrears' | 'debtRatioStatus'>>
  /** 무엇으로 채웠는지 한 줄씩 */
  notes: string[]
  /** 받으면 확인되는 서류(있으면 더 정확) */
  want: string[]
}

const FRESH_DAYS = 90
const dayOf = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : '')
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

type Kind = 'national' | 'local' | 'insurance'

/** 서류 칸 이름 → 어떤 완납 증명인가 */
function kindOf(label: string): Kind | null {
  const l = label.replace(/\s/g, '')
  if (/지방세/.test(l) && /납세|완납/.test(l)) return 'local'
  if (/4대보험|사회보험/.test(l) && /완납/.test(l)) return 'insurance'
  if (/^(?:국세)?(?:납세증명서|국세완납증명서?)/.test(l) || /국세.*(?:납세|완납)/.test(l)) return 'national'
  return null
}

/** 칸마다 가장 최근 것 — 발급일, 없으면 올린 날 */
function freshest(record: ClientOpsRecord, today: string): Record<Kind, { day: string; age: number; label: string } | null> {
  const out: Record<Kind, { day: string; age: number; label: string } | null> = { national: null, local: null, insurance: null }
  for (const m of allDocumentMetas(record)) {
    const kind = kindOf(m.label)
    const st = record.documents?.[m.key]
    if (!kind || !st || !(st.received || st.fileName)) continue
    const day = dayOf(st.issuedAt) || dayOf(st.uploadedAt ?? '') || dayOf(st.updatedAt ?? '')
    if (!day) continue
    const age = daysBetween(day, today)
    if (age < 0) continue
    const cur = out[kind]
    if (!cur || age < cur.age) out[kind] = { day, age, label: m.label }
  }
  return out
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

export function policyEvidence(record: ClientOpsRecord, facts: Pick<ClientFacts, 'totalAssets' | 'totalLiabilities'>, today: string): PolicyEvidence {
  const input: PolicyEvidence['input'] = {}
  const notes: string[] = []
  const want: string[] = []
  const f = freshest(record, today)
  const ok = (k: Kind) => !!f[k] && f[k]!.age <= FRESH_DAYS
  if (ok('national') && ok('local')) {
    input.taxArrears = '없음'
    notes.push(`세금 체납 없음(국세 ${md(f.national!.day)} · 지방세 ${md(f.local!.day)} 납세증명서)`)
  } else {
    const stale = (['national', 'local'] as const).filter((k) => f[k] && !ok(k))
    if (stale.length) notes.push(`납세증명서가 ${FRESH_DAYS}일보다 오래됐어요 — 새로 받으면 체납 확인`)
    if (!ok('national')) want.push('국세 납세증명서')
    if (!ok('local')) want.push('지방세 납세증명서')
  }
  if (ok('insurance')) {
    input.insuranceArrears = '없음'
    notes.push(`4대보험 체납 없음(${md(f.insurance!.day)} 완납증명서)`)
  } else {
    if (f.insurance) notes.push(`4대보험 완납증명서가 ${FRESH_DAYS}일보다 오래됐어요`)
    want.push('4대보험 완납증명서')
  }
  // 자본잠식 — 자산 ≤ 부채. 적어 둔 값 · 확인된 값만(예상값은 쓰지 않는다)
  const a = facts.totalAssets && !facts.totalAssets.estimated ? facts.totalAssets.won : null
  const l = facts.totalLiabilities && !facts.totalLiabilities.estimated ? facts.totalLiabilities.won : null
  if (a !== null && l !== null && a > 0 && l >= a) {
    input.debtRatioStatus = '높음'
    notes.push(`자본잠식(자산 ${Math.round(a / 1e6).toLocaleString('ko-KR')}백만 ≤ 부채 ${Math.round(l / 1e6).toLocaleString('ko-KR')}백만) — 부결의 흔한 원인`)
  }
  return { input, notes, want }
}
