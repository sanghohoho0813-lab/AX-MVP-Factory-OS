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
import type { BonusItem, DiagnosisInput } from '../tools/policyFunding/types'
import { allDocumentMetas } from './clientOpsDocuments'
import { CUSTOM_FACT_PREFIX, usableFactValue } from './customerFacts'

export interface PolicyEvidence {
  /** 진단 입력에 덮어쓸 값(미확인을 채우는 것만) */
  input: Partial<Pick<DiagnosisInput, 'taxArrears' | 'insuranceArrears' | 'debtRatioStatus' | 'bonusItems'>>
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
  // D-307 가점 — 특허 · 연구소 · 벤처 · 이노비즈 · 메인비즈 · 여성기업 · 사회적기업(기술보증 · 혁신성장 쪽 추천이 달라진다)
  const bonus = policyBonus(record, today)
  if (bonus.items.length) {
    input.bonusItems = bonus.items
    // 추천 기관이 바뀌는 근거라 맨 앞에
    notes.unshift(`가점 ${bonus.items.map((b) => BONUS_SHORT[b] ?? b).join(', ')}`)
  }
  // 근거 줄은 ' · ' 로 이어 보이므로 목록은 쉼표로 — 만료는 따로 한 줄(가점 목록에 섞여 보이지 않게)
  if (bonus.expired.length) notes.push(`만료라 가점에서 뺀 인증: ${bonus.expired.join(', ')}`)
  return { input, notes, want }
}

const BONUS_SHORT: Partial<Record<BonusItem, string>> = { '특허 보유': '특허', '기업부설연구소 보유': '연구소' }

/** 이름 · 칸에서 찾을 가점 — 회사 정보 글(보유 인증 · 특허 · 연구소)과 올린 인증서(cf:이름) */
const BONUS_RULES: { item: BonusItem; text: RegExp; cert: RegExp }[] = [
  { item: '특허 보유', text: /특허/, cert: /^특허$/ },
  { item: '기업부설연구소 보유', text: /부설\s*연구소|연구소/, cert: /^기업부설연구소$/ },
  { item: '벤처기업', text: /벤처/, cert: /^벤처기업/ },
  { item: '이노비즈', text: /이노\s*비즈|기술\s*혁신형/, cert: /^이노비즈/ },
  { item: '메인비즈', text: /메인\s*비즈|경영\s*혁신형/, cert: /^메인비즈/ },
  { item: '여성기업', text: /여성\s*기업/, cert: /^여성기업/ },
  { item: '사회적기업', text: /사회적\s*기업/, cert: /^사회적기업/ },
]
const NONE = /^(없음|아니오|아니요|미보유|해당\s*없음|-)$/

/**
 * 업체 기록의 인증 · 특허 · 연구소 → 정책자금 가점. 올린 인증서에 유효기간이 지났으면(…까지) 빼고 알린다.
 * 회사 정보 글은 대표가 적은 값 그대로(유효기간을 모름 — 그대로 쓴다).
 */
export function policyBonus(record: ClientOpsRecord, today: string): { items: BonusItem[]; expired: string[] } {
  const text = {
    certs: usableFactValue(record, 'certifications'),
    patents: usableFactValue(record, 'patents'),
    lab: usableFactValue(record, 'researchLab'),
  }
  const certs = Object.entries(record.factValues ?? {})
    .filter(([k, v]) => k.startsWith(CUSTOM_FACT_PREFIX) && String(v).trim() !== '')
    .map(([k, v]) => ({ name: k.slice(CUSTOM_FACT_PREFIX.length).trim(), value: String(v) }))
  const items: BonusItem[] = []
  const expired: string[] = []
  for (const r of BONUS_RULES) {
    const fromText =
      r.item === '특허 보유' ? !!text.patents && !NONE.test(text.patents.trim()) : r.item === '기업부설연구소 보유' ? !!text.lab && !NONE.test(text.lab.trim()) && r.text.test(text.lab) : r.text.test(text.certs)
    const cert = certs.find((c) => r.cert.test(c.name))
    const until = cert ? /(\d{4}-\d{2}-\d{2})\s*까지/.exec(cert.value)?.[1] : undefined
    // 올린 인증서가 만료면 회사 정보 글에 적혀 있어도 빼고 알린다(글은 예전에 적은 것일 수 있다)
    if (cert && until && until < today) {
      expired.push(`${cert.name}(${until}까지)`)
      continue
    }
    if (fromText || cert) items.push(r.item)
  }
  return { items, expired }
}
