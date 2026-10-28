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
 *
 * D-310 고용 — 4대보험 명부 진단이 센 인원(작년 매월 말 평균 → 올해)이 늘었으면 강점 '고용증가', 청년 직원이 있으면 청년 고용 '있음'.
 *  엔진은 이것으로 '고용창출' 자금을 꺼내고 중진공 쪽 점수를 올린다(서비스 6명 · 매출 4억 업체: 1순위 지역신용보증재단 → 중진공).
 *  명부가 400일보다 오래됐으면 쓰지 않고 새로 받으라고만 알린다.
 *
 * D-311 준비 서류 — 정책자금 엔진의 '자료 체크'(사업자등록증 · 재무제표 · 부가세 과세표준증명원 · 사업계획서 …)는 입력만 보고
 *  거의 다 '요청 필요' 라고 했다. 서류함에 있는 서류(칸 이름 · 만료 안 됨)를 엔진에 넘겨 '확보' 로 본다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { ClientFacts } from '../tools/shared/clientPrefill'
import type { BonusItem, DiagnosisInput } from '../tools/policyFunding/types'
import { allDocumentMetas } from './clientOpsDocuments'
import { documentStatus } from './clientOpsAlerts'
import { CUSTOM_FACT_PREFIX, usableFactValue } from './customerFacts'
import { latestEmploymentRoster } from './toolResultGroups'
import { headcountOf, headText } from '../tools/employment/lib/taxCredit'

export interface PolicyEvidence {
  /** 진단 입력에 덮어쓸 값(미확인을 채우는 것만) */
  input: Partial<Pick<DiagnosisInput, 'taxArrears' | 'insuranceArrears' | 'debtRatioStatus' | 'bonusItems' | 'strengths' | 'youthEmployment' | 'haveDocs'>>
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
  // 추천 기관이 바뀌는 근거(가점 · 고용)는 맨 앞에 — 맞춤 추천 카드는 앞의 몇 줄만 보인다
  const front: string[] = []
  // D-307 가점 — 특허 · 연구소 · 벤처 · 이노비즈 · 메인비즈 · 여성기업 · 사회적기업(기술보증 · 혁신성장 쪽 추천이 달라진다)
  const bonus = policyBonus(record, today)
  if (bonus.items.length) {
    input.bonusItems = bonus.items
    front.push(`가점 ${bonus.items.map((b) => BONUS_SHORT[b] ?? b).join(', ')}`)
  }
  // D-310 고용 증가 · 청년 직원 — 4대보험 명부
  const hire = policyHiring(record, today)
  if (hire?.grew) input.strengths = ['고용증가']
  if (hire && hire.youth > 0) input.youthEmployment = '있음'
  if (hire?.line) (hire.grew || hire.youth > 0 ? front : notes).push(hire.line)
  notes.unshift(...front)
  // D-311 서류함에 있는 준비 서류 → 엔진 자료 체크 '확보'
  const docs = policyDocs(record, today)
  if (docs.have.length) input.haveDocs = docs.have
  if (docs.expired.length) notes.push(`기한 지난 서류: ${docs.expired.join(', ')} — 새로 받기`)
  // 근거 줄은 ' · ' 로 이어 보이므로 목록은 쉼표로 — 만료는 따로 한 줄(가점 목록에 섞여 보이지 않게)
  if (bonus.expired.length) notes.push(`만료라 가점에서 뺀 인증: ${bonus.expired.join(', ')}`)
  return { input, notes, want }
}

/**
 * D-312 상황 예시 · 한 장 설계서가 판정에 넣은 가정 한 줄 — 엔진은 체납이 '미확인' 이면 '높음' 으로 올리지 않는다.
 * 예전 문구('체납은 모르면 문제없다고 보고')는 엔진과 반대였다.
 */
export function policyAssumption(ev: PolicyEvidence): string {
  const clear = ev.input.taxArrears === '없음' && ev.input.insuranceArrears === '없음'
  return clear ? '신용 · 부채는 모르면 보통으로 보고 진단(★ 상담에서 확인)' : "신용 · 부채는 모르면 보통으로 보고 진단 · 체납은 납세증명서 · 완납증명서가 없어 '높음' 으로 보지 않았어요(★ 상담에서 확인)"
}

/**
 * D-310 4대보험 명부 진단(업체에 붙인 결과) → 고용 증가 · 청년 직원.
 * 명부 날짜로 센 작년 평균 → 올해(D-302)가 늘었으면 grew. 지금 직원만 있는 명부(작년 퇴사자 없음)는 작년이 적게 셀 수 있어 그렇다고 붙인다.
 */
export function policyHiring(record: ClientOpsRecord, today: string): { grew: boolean; youth: number; line: string } | null {
  const roster = latestEmploymentRoster(record)
  if (!roster) return null
  const data = roster.data as { headcount?: unknown; counts?: { youthCount?: unknown } } | null
  const hc = headcountOf(data?.headcount)
  const asOf = hc?.asOf || dayOf(roster.createdAt)
  if (asOf && daysBetween(asOf, today) > 400) return { grew: false, youth: 0, line: '4대보험 명부가 1년 넘었어요 — 새로 받으면 고용 증가 확인' }
  const youth = typeof data?.counts?.youthCount === 'number' ? data.counts.youthCount : 0
  if (!hc) return youth > 0 ? { grew: false, youth, line: `청년 직원 ${youth}명(4대보험 명부)` } : null
  const p = `${hc.prev.year}년 평균 ${headText(hc.prev.total)}명`
  const c = `${hc.cur.year}년 ${hc.cur.actualMonths < 12 ? '예상 ' : ''}${headText(hc.cur.total)}명`
  // 카드의 근거 줄은 ' · ' 로 이어 보이므로 괄호 안은 쉼표로(D-307 가점 목록과 같은 까닭)
  const y = youth > 0 ? `, 청년 ${youth}명` : ''
  const partial = hc.basis === 'current' ? ', 지금 직원만 있는 명부' : ''
  if (hc.cur.total > hc.prev.total) return { grew: true, youth, line: `고용 증가(${p} → ${c}${y}${partial}) — 고용창출 자금 대상` }
  if (hc.cur.total < hc.prev.total) return { grew: false, youth, line: `직원이 줄었어요(${p} → ${c}) — 고용 유지 조건이 있는 자금은 확인` }
  return youth > 0 ? { grew: false, youth, line: `청년 직원 ${youth}명(4대보험 명부)` } : null
}

/**
 * D-311 정책자금 준비 서류(document-library.json key) ↔ 서류함 칸. 칸 이름은 띄어쓰기를 빼고 본다.
 * 거래처 계약서는 '거래 · 공급 · 납품 · 발주 · 구매' 가 붙은 것만(컨설팅 계약서 · 임대차계약서가 섞이지 않게).
 */
const POLICY_DOC_RULES: [string, (key: string, label: string) => boolean][] = [
  ['bizReg', (k, l) => k === 'businessRegistration' || /^사업자등록증/.test(l)],
  ['financial', (k, l) => k === 'financialStatements' || /재무제표|재무상태표|손익계산서/.test(l)],
  ['vat', (_k, l) => /과세표준증명|부가(?:가치)?세.*증명|면세.*수입금액증명/.test(l)],
  ['insuranceList', (k, l) => k === 'payrollRoster' || /가입자명부|피보험자명부/.test(l)],
  ['bizPlan', (_k, l) => /사업계획서/.test(l)],
  ['quote', (_k, l) => /견적서/.test(l)],
  ['machinePhoto', (_k, l) => /(?:기계|설비|장비).*사진/.test(l)],
  ['factoryPhoto', (_k, l) => /(?:공장|사업장|매장|작업장).*사진/.test(l)],
  ['clientContract', (_k, l) => /(?:거래|공급|납품|구매).*계약서|발주서/.test(l) && !/임대차|컨설팅|용역/.test(l)],
  ['patentCert', (_k, l) => /특허/.test(l)],
  ['labCert', (_k, l) => /연구소|연구개발전담부서/.test(l)],
  ['bizCert', (_k, l) => /벤처기업|이노비즈|메인비즈|여성기업|사회적기업|기술혁신형|경영혁신형/.test(l)],
  ['corpRegistry', (k, l) => k === 'corporateRegistry' || /법인등기/.test(l)],
  ['shareholders', (_k, l) => /주주명부/.test(l)],
  ['lease', (_k, l) => /임대차/.test(l)],
  ['ownDeed', (_k, l) => /(?:건물|부동산|사업장|토지).*등기/.test(l)],
  ['exportProof', (_k, l) => /수출실적/.test(l)],
  ['idCard', (k, l) => k === 'representativeId' || /신분증/.test(l)],
  ['salesEvidence', (_k, l) => /세금계산서|카드매출|POS|매출(?:내역|명세|정산)|정산내역/i.test(l)],
]

/** 서류함에 있는(받음 · 기한 안) 정책자금 준비 서류 key · 기한이 지난 서류 이름 */
export function policyDocs(record: ClientOpsRecord, today: string): { have: string[]; expired: string[] } {
  const have = new Set<string>()
  const expired: string[] = []
  for (const m of allDocumentMetas(record)) {
    const st = record.documents?.[m.key]
    if (!st || !(st.received || st.fileName)) continue
    const label = m.label.replace(/\s+/g, '')
    const hits = POLICY_DOC_RULES.filter(([, ok]) => ok(m.key, label)).map(([k]) => k)
    if (!hits.length) continue
    if (documentStatus(m.key, { ...st, received: true }, today, m).expired) {
      expired.push(m.label)
      continue
    }
    for (const h of hits) have.add(h)
  }
  // 같은 서류가 다시 받은 칸('(2)')에 유효하면 기한 지남 목록에서 뺀다
  const fresh = (name: string) => {
    const base = name.replace(/\s*\(\d+\)$/, '').replace(/\s+/g, '')
    return POLICY_DOC_RULES.filter(([, ok]) => ok('', base)).every(([k]) => have.has(k))
  }
  return { have: [...have], expired: [...new Set(expired.filter((e) => !fresh(e)).map((e) => e.replace(/\s*\(\d+\)$/, '')))] }
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
    // 같은 인증서가 여럿이면(다시 받은 것 '(2)') 하나라도 유효하면 그대로 — 모두 만료면 글에 적혀 있어도 빼고 알린다
    const untilOf = (v: string) => /(\d{4}-\d{2}-\d{2})\s*까지/.exec(v)?.[1]
    const matching = certs.filter((c) => r.cert.test(c.name.replace(/\s*\(\d+\)$/, '')))
    const valid = matching.filter((c) => !((untilOf(c.value) ?? '9999') < today))
    if (matching.length && !valid.length) {
      expired.push(`${matching[0].name.replace(/\s*\(\d+\)$/, '')}(${matching.map((c) => untilOf(c.value)).sort().pop()}까지)`)
      continue
    }
    if (fromText || valid.length) items.push(r.item)
  }
  return { items, expired }
}
