/**
 * 크레탑 분석 → 1차 미팅 포인트 (D-88).
 *
 * 원본: corp-consult-sales-os/src/App.jsx 2328~2375 `cretopGradeIsLow` · `buildCretopMeetingPoints`.
 * 엔진 README 가 "영업 OS 측 코드로 남겨두었다" 고 한 두 함수 가운데 하나다. 판정 문턱(부채비율 150·
 * 유동비율 100·이자보상 3·순이익 1.5억·이익잉여금 3억·신용 CCC↓)과 문장은 원본 그대로 옮겼다.
 * 15개 규칙의 순서·심각도(sev)도 그대로다 — 상위 5개가 같은 것이 나오게.
 */

import { cretopRowRank, cretopRowTrend, extractRowEok, parseNumLoose } from '../engine/index.js'
import type { CretopAmount, CretopExtractRow, CretopTrend } from '../engine/index.js'

export function cretopGradeIsLow(grade: unknown): boolean {
  const s = String(grade || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!s) return false
  return /^(CCC|CC|C|D|R)/.test(s)
}

export interface MeetingPointsInput {
  rows: CretopExtractRow[]
  company?: { industry?: string; employees?: number | string }
  external?: {
    hasResearchInst?: boolean
    certNames?: string[]
    ip?: Array<{ count: number }>
    bid?: { tenders?: number; wins?: number }
  }
  computed?: Record<string, CretopAmount | null | undefined>
}

export interface MeetingPoints {
  topPoints: string[]
  pointPairs: Array<{ title: string; q: string }>
  questions: string[]
  risks: string[]
  proposals: string[]
  docs: string[]
}

export function buildCretopMeetingPoints(input: MeetingPointsInput): MeetingPoints {
  const { rows, company, external, computed } = input
  const m: Record<string, CretopExtractRow> = {}
  ;(rows || []).forEach((r) => {
    if (r.status === '제외') return
    if (!m[r.accountKey] || cretopRowRank(r) > cretopRowRank(m[r.accountKey])) m[r.accountKey] = r
  })
  const eok = (k: string): number | null => {
    const r = m[k]
    return r && !r.isGrade ? extractRowEok(r) : null
  }
  const ratio = (k: string): number | null => {
    const r = m[k]
    return r ? parseNumLoose(r.rawValue) : null
  }
  const cp = computed || {}
  const cpVal = (k: string): number | null => {
    const v = cp[k]
    return v && typeof v.value === 'number' ? v.value : null
  }
  const revE = eok('revenue')
  const opE = eok('operatingProfit')
  const niE = eok('netIncome')
  const retE = eok('retainedEarnings')
  // 비율은 최신 재무제표 기준 계산값 우선(없으면 후보행 값). 유동비율 200%+인데 '낮은 편'으로 잘못 나오는 문제 방지
  const debt = cpVal('debtRatio') != null ? cpVal('debtRatio') : ratio('debtRatio')
  const cur = cpVal('currentRatio') != null ? cpVal('currentRatio') : ratio('currentRatio')
  const icr = cpVal('interestCoverageRatio') != null ? cpVal('interestCoverageRatio') : ratio('interestCoverageRatio')
  let opMargin = ratio('opMargin')
  if (opMargin == null && revE && opE != null) opMargin = revE > 0 ? (opE / revE) * 100 : null
  let netMargin = ratio('netMargin')
  if (netMargin == null && revE && niE != null) netMargin = revE > 0 ? (niE / revE) * 100 : null
  const grade = m.creditGrade ? m.creditGrade.rawValue : null
  const ind = (company && company.industry) || ''
  const emp = Number(company && company.employees) || 0
  // 3개년 추이/비율 기반 동적 포인트(전년 대비 방향 반영)
  const trend = (k: string): CretopTrend | null => {
    const r = m[k]
    return r ? cretopRowTrend(r) : null
  }
  const tRev = trend('revenue')
  const tNi = trend('netIncome')
  const debtDep = trend('debtDependency')
  const cfRow = m.cashflowGrade
  const cfSeries = cfRow && cfRow.gradeSeries ? cfRow.gradeSeries : null
  const cfWorse =
    cfSeries &&
    cfSeries.length >= 2 &&
    (() => {
      const a = parseInt(String(cfSeries[cfSeries.length - 2]).replace(/\D/g, ''), 10)
      const b = parseInt(String(cfSeries[cfSeries.length - 1]).replace(/\D/g, ''), 10)
      return !isNaN(a) && !isNaN(b) && b > a
    })()
  const ext = external || {}
  const points: Array<{ title: string; q: string; sev: number }> = []
  const questions: string[] = []
  const risks: string[] = []
  const proposals: string[] = []
  const docs = new Set<string>()
  const add = (title: string, q: string, r: string, p: string, dd: string[], sev?: number) => {
    points.push({ title, q: q || '', sev: sev || 1 })
    if (q) questions.push(q)
    if (r) risks.push(r)
    if (p) proposals.push(p)
    ;(dd || []).forEach((x) => docs.add(x))
  }
  if (cfWorse && cfSeries)
    add(
      `현금흐름등급이 악화된 편(${cfSeries.join('→')}) — 운전자금·회수기간·재고·차입구조 점검 후보`,
      '현금흐름이 빡빡해진 부분이 있으신가요? 매출채권 회수나 재고는 어떠신가요?',
      '현금흐름등급 악화는 운전자금·회수기간·재고·차입 구조 자료 확인 후 판단 필요',
      '자금·지원금 / 운전자금 점검',
      ['현금흐름표', '매출채권·재고 명세', '차입금 내역'],
      5,
    )
  if (ext.hasResearchInst || /제조|IT|소프트|개발|기술|연구/.test(ind))
    add(
      '연구개발 활동/부설연구소 관련 — 연구소·전담부서·연구개발비 세액공제 점검 후보',
      '연구개발 인력이나 부설연구소 운영 현황은 어떻게 되시나요?',
      '연구개발 활동이 있으면 연구소·전담부서·세액공제 요건 자료 확인 후 판단 필요',
      '인증·연구소',
      ['연구개발 인력 현황', '연구개발비 계정', '연구노트'],
    )
  if (ext.certNames && ext.certNames.length)
    add(
      `기업인증 보유(${ext.certNames.join('·')}) — 인증 갱신·활용·신뢰도 자료 점검 후보`,
      '보유하신 인증의 갱신 시점이나 활용 계획은 어떻게 보고 계신가요?',
      '인증은 갱신·활용·요건 유지 자료 확인 후 판단 필요',
      '인증·연구소',
      ['인증서 사본', '인증 갱신 일정'],
    )
  if (ext.ip && ext.ip.some((x) => x.count > 0))
    add(
      '산업재산권 보유 — 지식재산 관리·직무발명보상제도 점검 후보',
      '특허·디자인 등 지식재산 관리나 직무발명보상제도 운영은 어떠신가요?',
      '산업재산권은 권리 유지·직무발명보상제도 요건 자료 확인 후 판단 필요',
      '지식재산·브랜딩',
      ['산업재산권 목록', '직무발명보상 규정'],
    )
  if (ext.bid && (ext.bid.tenders || ext.bid.wins))
    add(
      '나라장터 입찰 이력 — 공공조달·입찰·정책자금·신용도 관리 점검 후보',
      '공공조달이나 입찰 비중이 어느 정도이신가요? 신용도 관리는 어떻게 하고 계신가요?',
      '공공조달 비중·입찰 신용도는 자료 확인 후 판단 필요',
      '신용·보증·성장지원 / 자금·지원금',
      ['입찰 실적', '신용평가서'],
    )
  if (tRev && tRev.dir === '하락')
    add(
      '매출이 전년 대비 감소 — 주요 거래처·수주·단가·제품군 변화 점검 후보',
      '최근 매출이 줄어든 데에는 어떤 요인이 있었나요? (거래처·단가·수주)',
      '매출 감소 원인은 거래처·단가·제품군 자료 확인 후 판단 필요',
      '원가·매출 구조 점검',
      ['손익계산서', '거래처별 매출 내역'],
      3,
    )
  if (tNi && tNi.dir === '하락')
    add(
      '당기순이익 감소 — 영업외비용·이자비용·법인세·일회성 비용 점검 후보',
      '순이익이 줄어든 부분에 영업외비용이나 이자비용 영향이 있었나요?',
      '순이익 감소는 영업외·이자·법인세 항목 자료 확인 후 판단 필요',
      '세무·정관 / 비용 구조 점검',
      ['손익계산서', '이자비용·영업외비용 내역'],
      3,
    )
  if (debt != null && cur != null && debt < 100 && cur >= 150)
    add(
      '부채비율 낮고 유동비율 높은 편 — 재무 안정성은 양호해 보이나 현금흐름·운전자금 구조 확인 후보',
      '재무는 안정적으로 보이는데, 현금흐름이나 운전자금 운용은 어떻게 하고 계신가요?',
      '안정성은 양호해 보이나 현금흐름·운전자금 구조는 원문 기준 확인 필요',
      '자금·지원금 / 운전자금 점검',
      ['재무제표', '현금흐름표'],
    )
  const cashE = eok('cash')
  if (cur != null && cur >= 150 && cashE != null && cashE < 1)
    add(
      '유동비율은 높지만 현금성자산이 적은 편 — 재고·매출채권·단기자산 구성 확인 후보',
      '유동자산 중 현금 외에 재고나 매출채권 비중은 어느 정도인가요?',
      '유동비율이 높아도 현금성자산이 적으면 자산 구성 확인 필요',
      '운전자금 점검',
      ['재무상태표', '재고·매출채권 명세'],
    )
  if (debtDep && debtDep.dir === '상승')
    add(
      '차입금의존도 상승 — 보증·대출 구조와 리파이낸싱 검토 후보',
      '차입금이 늘어난 배경과 상환·차환 계획은 어떻게 보고 계신가요?',
      '차입금의존도 상승은 보증·대출 구조 자료 확인 후 판단 필요',
      '신용·보증·성장지원 / 자금·지원금',
      ['대출/보증 내역', '재무제표'],
      4,
    )
  if (revE && opMargin != null && opMargin < 5)
    add(
      '매출 대비 영업이익률이 낮은 편 — 원가·판관비·가격정책 점검 후보',
      '매출원가나 판관비 중 부담이 큰 항목은 무엇인가요?',
      '영업이익률이 낮으면 비용 구조 점검이 우선 필요',
      '세무·정관 / 원가·비용 구조 점검',
      ['손익계산서', '계정별원장'],
      4,
    )
  if (niE != null && (niE >= 1.5 || (netMargin != null && netMargin >= 7)))
    add(
      '이익이 쌓이는 구조 — 법인세·이익잉여금·배당·임원퇴직금·목적자금 검토 후보',
      '이익이 꾸준한 편인데 법인세·배당·이익잉여금 정리는 어떻게 보고 계신가요?',
      '이익이 쌓일수록 주식가치·세부담이 커질 수 있어 사전 점검 필요',
      '세무·정관 / 승계·지분 / 보험·퇴직금',
      ['재무제표', '주주명부', '정관'],
      5,
    )
  if (debt != null && debt >= 150)
    add(
      '부채비율이 높은 편 — 보증/대출/리파이낸싱/정책자금 구조 점검 후보',
      '차입 구조나 금융비용 부담은 어느 정도이신가요?',
      '부채비율이 높으면 자금 구조·금융비용 점검 필요',
      '신용·보증·성장지원 / 자금·지원금',
      ['대출/보증 내역', '재무제표'],
      6,
    )
  if (cur != null && cur < 100)
    add(
      '유동비율이 낮은 편 — 현금흐름·단기차입금·운전자금 점검 후보',
      '단기 운전자금 흐름은 어떻게 관리하고 계신가요?',
      '유동비율이 낮으면 단기 자금 흐름 점검 필요(고객 현금흐름 확인 필요)',
      '자금·지원금 / 운전자금 점검',
      ['재무제표', '차입금 내역'],
      7,
    )
  if (icr != null && icr < 3)
    add(
      '이자보상배수가 낮은 편 — 금융비용 부담·차입구조 점검 후보',
      '이자 비용 대비 영업이익 수준은 어떻게 보고 계신가요?',
      '이자보상배수가 낮으면 금융비용 부담 점검 필요',
      '신용·보증·성장지원',
      ['대출/보증 내역', '손익계산서'],
      7,
    )
  if (grade && cretopGradeIsLow(grade))
    add(
      `신용등급(${String(grade)})이 낮은 편 — 신용등급 관리·재무구조 개선·보증기관 대응 점검 후보`,
      '신용등급 관리나 보증기관 대응에서 신경 쓰시는 부분이 있으신가요?',
      '신용등급이 낮으면 보증·대출·입찰에 영향, 재무구조 개선 점검 필요',
      '신용·보증·성장지원',
      ['신용평가서', '재무제표'],
      6,
    )
  if (retE != null && retE >= 3)
    add(
      '미처분이익잉여금이 큰 편 — 배당정책·이익소각·임원퇴직금·목적자금 검토 후보',
      '이익잉여금이 쌓여 있는데 배당이나 정리 계획을 생각해보신 적 있으신가요?',
      '이익잉여금이 크면 승계·증여·주식가치 부담 사전 점검 필요',
      '승계·지분 / 보험·퇴직금',
      ['재무제표', '주주명부', '정관'],
      5,
    )
  if (emp > 0)
    add(
      `직원이 있는 기업(${emp}명) — 고용지원금·노무·사내근로복지기금 점검 후보`,
      '최근 채용이나 인원 변동이 있으셨나요? 노무 관리는 어떻게 하고 계신가요?',
      '직원이 있으면 고용·노무 리스크와 지원사업 점검 필요',
      '자금·지원금 / 복지·노무',
      ['4대보험 가입자명부', '급여대장'],
    )
  if (/제조|IT|소프트|개발|기술|연구/.test(ind))
    add(
      '제조·IT·연구개발 키워드 — 기업부설연구소·벤처·특허·인증 점검 후보',
      '연구개발 인력이나 개발 활동이 있으신가요?',
      '개발 활동이 있으면 연구소·인증·세액공제 검토 가능성 점검 필요',
      '인증·연구소 / 지식재산·브랜딩',
      ['연구개발 인력 현황', '특허·인증 목록'],
    )
  // 심각도(sev) 높은 포인트 우선 — 유동비율 낮음·이자보상 낮음 같은 핵심 위험이 상위 5개 밖으로 밀리지 않게(동일 sev는 원래 순서 유지)
  const ordered = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.sev || 1) - (a.p.sev || 1) || a.i - b.i)
    .map((x) => x.p)
  return {
    topPoints: ordered.slice(0, 5).map((p) => p.title),
    pointPairs: ordered.slice(0, 5).map((p) => ({ title: p.title, q: p.q })),
    questions: questions.slice(0, 8),
    risks,
    proposals: Array.from(new Set(proposals)),
    docs: Array.from(docs),
  }
}
