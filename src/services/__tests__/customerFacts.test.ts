/**
 * 고객 사실 창고 시험 (D-128) — 자료는 한 번, 확인은 최소, 고객 정보는 하나, 모듈은 다시 쓴다.
 *  - 사실의 자리: 업체 칸이 있으면 그 칸, 없으면 factValues 한 곳(복제 없음)
 *  - 출처 · 상태: 예전 값은 '적어 둠', 자료에서 확인하면 '확인됨', 예상은 '예상값'
 *  - 자료 → 후보: 크레탑 결과 · 받아 둔 후보는 확인 전에는 사실이 아니다(모듈도 안 쓴다)
 *  - 모두 확인 · 틀린 것만 고치기 · 틀림(다시 안 묻기) · 나중에(그대로 남음)
 *  - 모듈 어댑터(clientFacts)가 후보를 쓰지 않는다 · 예상값은 표시된다
 * 실행: npm run test:facts
 */

import { normalizeClientOps } from '../clientOpsService'
import {
  FACT_DEFS,
  cretopFacts,
  formatWon,
  hardFactsToConfirm,
  pendingFacts,
  readFact,
  readFacts,
  sameFactValue,
  factDef,
  withFactCandidates,
  withFactConfirmed,
  withFactDecisions,
  withFactValue,
  parseWonInput,
  normalizeFactInput,
  factNoteFor,
  withProfileFieldEdit,
} from '../customerFacts'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { certificateValue, parseCertificateDocument } from '../certDocParser'
import { factCandidatesFromDocText, withDocFacts } from '../docFacts'
import { previewKindOf } from '../../lib/filePreview'
import type { ClientOpsRecord } from '../../types/clientOps'
import { NOTE_CONFLICT, NOTE_OCR, autoFillFromDocs } from '../docAutoFill'
import { looksLikeCretop, looksLikeRoster } from '../docAutoAnalyze'
import { buildInsights, recommendNextSteps } from '../clientInsights'
import { classifyDocument } from '../docClassify'
import { DOCUMENTS } from '../../content/clientOpsCatalog'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const NOW = '2026-09-27T09:00:00.000Z'
let n = 0
const makeId = () => `id${++n}`

const base = normalizeClientOps({
  id: 'c1',
  companyName: '한솔테크(주)',
  businessNumber: '123-45-67890',
  establishedAt: '2019-03-02',
  employeeCount: '12명(대표 포함)',
  toolResults: [],
} as Partial<ClientOpsRecord>)

const withCretop = (r: ClientOpsRecord): ClientOpsRecord => ({
  ...r,
  toolResults: [
    {
      id: 'cr1',
      toolKey: 'cretop',
      title: '크레탑 분석',
      verdict: null,
      verdictLabel: '',
      summary: '',
      deadlines: [],
      createdAt: NOW,
      publishedUpdateId: null,
      data: {
        companyInfo: { companyName: '(주)한솔테크', businessNo: '1234567890', ceoName: '김대표', established: '2019.03.02', employees: '12명', address: '서울 강남구 테헤란로 1' },
        corePreview: {
          revenue: { value: 1234, unit: '백만원', eok: 12.34, year: 2025 },
          operatingProfit: { value: -50, unit: '백만원', eok: -0.5, year: 2025 },
          netIncome: { value: 30, unit: '백만원', eok: 0.3, year: 2025 },
          totalAssets: { value: 2000, unit: '백만원', year: 2025 },
          totalLiabilities: null,
          shortTermBorrowings: { value: 0, absent: true },
        },
      },
    },
  ],
})

/* ---- 정의 ---- */
{
  const keys = FACT_DEFS.map((d) => d.key)
  check('정의: 이름이 겹치지 않는다', new Set(keys).size === keys.length)
  check('정의: 요청한 공통 사실이 있다', ['companyName', 'businessNumber', 'corporateNumber', 'representativeName', 'establishedAt', 'businessAddress', 'businessCategory', 'businessItem', 'employeeCount', 'revenue', 'operatingProfit', 'totalAssets', 'totalLiabilities', 'mainCustomers', 'certifications', 'patents', 'researchLab'].every((k) => keys.includes(k)))
  check('정의: 업체 칸이 있는 사실은 그 칸을 쓴다(복제 없음)', FACT_DEFS.filter((d) => d.field).every((d) => d.field === d.key))
  check('정의: 20개를 넘지 않는다(거대한 스키마 금지)', FACT_DEFS.length <= 20, String(FACT_DEFS.length))
}

/* ---- 읽기 · 출처 · 상태 ---- */
{
  const f = readFact(base, 'businessNumber')!
  check('예전 값: 출처 없음 → 직접 적음 · 적어 둠(확인됨 아님)', f.status === 'entered' && f.source === 'manual' && f.sourceLabel === '직접 적음 · 적어 둠', f.sourceLabel)
  check('없는 값: missing', readFact(base, 'revenue')!.status === 'missing' && readFact(base, 'revenue')!.display === '')
  check('직원 수 표시', readFact(base, 'employeeCount')!.display === '12명(대표 포함)')
  const r = withFactValue(base, 'revenue', '1200000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  const rv = readFact(r, 'revenue')!
  check('매출: 재무제표 2025 · 확인됨', rv.display === '12억원' && rv.sourceLabel === '재무제표 2025 · 확인됨' && rv.confirmedAt === NOW, rv.sourceLabel)
  check('매출: 값은 factValues 한 곳에', r.factValues.revenue === '1200000000' && !('revenue' in (r as unknown as Record<string, unknown>) && (r as unknown as Record<string, unknown>).revenue))
  const e = withFactValue(base, 'expectedRevenue', '1500000000', { source: 'meeting', now: NOW })
  check('예상 매출: 처음부터 예상값 · 상담 메모', readFact(e, 'expectedRevenue')!.status === 'estimated' && readFact(e, 'expectedRevenue')!.sourceLabel === '상담 메모 · 예상값')
  const cleared = withFactValue(r, 'revenue', '', { now: NOW })
  check('비우면 값과 출처가 함께 없어진다', !cleared.factValues.revenue && !cleared.factMeta.revenue && readFact(cleared, 'revenue')!.status === 'missing')
  const conf = withFactConfirmed(base, 'businessNumber', NOW)
  check('적어 둔 값 → 확인됨(값 그대로)', readFact(conf, 'businessNumber')!.status === 'confirmed' && conf.businessNumber === base.businessNumber)
  check('formatWon', formatWon(1234000000) === '12억 3,400만원' && formatWon(80000000) === '8,000만원' && formatWon(-50000000) === '-5,000만원' && formatWon(200000000) === '2억원')
  check('같은 값: 회사명 (주) 위치 · 직원 수 단서 · 번호 하이픈', sameFactValue(factDef('companyName'), '한솔테크(주)', '(주)한솔테크') && sameFactValue(factDef('employeeCount'), '12명(대표 포함)', '12') && sameFactValue(factDef('businessNumber'), '123-45-67890', '1234567890'))
  check('제출 전 확인: 확인됨이 아닌 꼭 필요한 사실', hardFactsToConfirm(base).some((f) => f.key === 'businessNumber') && !hardFactsToConfirm(conf).some((f) => f.key === 'businessNumber'))
  check('모든 사실을 한 번에 읽는다', readFacts(base).length === FACT_DEFS.length)
}

/* ---- 자료 → 후보 (크레탑) ---- */
{
  const r = withCretop(base)
  const cf = cretopFacts(r)
  const val = (k: string) => cf.find((c) => c.key === k)?.value
  check('크레탑: 백만원 → 원(원문 값 × 원문 단위)', val('revenue') === '1234000000' && val('operatingProfit') === '-50000000' && val('totalAssets') === '2000000000', `${val('revenue')} ${val('totalAssets')}`)
  check('크레탑: 없는 칸은 안 만든다', val('totalLiabilities') === undefined)
  check('크레탑: 설립일 2019.03.02 → 2019-03-02', val('establishedAt') === '2019-03-02')
  check('크레탑: 기준 연도', cf.find((c) => c.key === 'revenue')?.asOf === '2025')
  const p = pendingFacts(r)
  const keys = p.map((x) => x.key)
  check('후보: 지금 값과 같은 것은 묻지 않는다(회사명 · 번호 · 설립일 · 직원 수)', !keys.includes('companyName') && !keys.includes('businessNumber') && !keys.includes('establishedAt') && !keys.includes('employeeCount'), keys.join())
  check('후보: 대표자 · 주소 · 매출 · 영업이익 · 순이익 · 자산', ['representativeName', 'businessAddress', 'revenue', 'operatingProfit', 'netIncome', 'totalAssets'].every((k) => keys.includes(k)), keys.join())
  check('후보: 출처 이름 · 표시', p.find((x) => x.key === 'revenue')?.sourceLabel === '크레탑 보고서 2025' && p.find((x) => x.key === 'revenue')?.display === '12억 3,400만원')
  // 확인 전에는 사실이 아니다 — 모듈도 쓰지 않는다
  const facts = clientFacts(r, new Date('2026-09-27T00:00:00'))
  check('확인 전: 모듈 어댑터가 후보를 쓰지 않는다', facts.revenue === null && facts.representativeName === '')
  check('확인 전: 매출 사실은 없음', readFact(r, 'revenue')!.status === 'missing')

  // 모두 확인
  const all = withFactDecisions(r, p.map((x) => ({ id: x.id, action: 'accept' as const })), NOW)
  check('모두 확인: 매출 확인됨 · 출처 크레탑 2025', readFact(all, 'revenue')!.sourceLabel === '크레탑 보고서 2025 · 확인됨')
  check('모두 확인: 대표자는 업체 칸에', all.representativeName === '김대표' && readFact(all, 'representativeName')!.status === 'confirmed')
  check('모두 확인: 더 물을 것이 없다', pendingFacts(all).length === 0, pendingFacts(all).map((x) => x.key).join())
  const f2 = clientFacts(all, new Date('2026-09-27T00:00:00'))
  check('확인 뒤: 모듈이 매출 · 순이익을 쓴다', f2.revenue?.won === 1234000000 && f2.revenue.asOf === '2025' && !f2.revenue.estimated && f2.netIncome?.won === 30000000)

  // 틀린 것만 고치기 + 틀림 + 나중에
  const rev = p.find((x) => x.key === 'revenue')!
  const addr = p.find((x) => x.key === 'businessAddress')!
  const ceo = p.find((x) => x.key === 'representativeName')!
  const mixed = withFactDecisions(r, [
    { id: rev.id, action: 'fix', value: '1250000000' },
    { id: addr.id, action: 'reject' },
    { id: ceo.id, action: 'accept' },
  ], NOW)
  check('고치기: 고친 값 · 직접 적음 · 확인됨', readFact(mixed, 'revenue')!.value === '1250000000' && readFact(mixed, 'revenue')!.sourceLabel === '직접 적음 · 확인됨')
  const left = pendingFacts(mixed).map((x) => x.key)
  check('고치기: 그 자료를 다시 묻지 않는다', !left.includes('revenue'), left.join())
  check('틀림: 다시 묻지 않고 값도 넣지 않는다', !left.includes('businessAddress') && mixed.businessAddress === '')
  check('나중에: 결정하지 않은 것은 그대로 남는다', left.includes('operatingProfit') && left.includes('totalAssets'), left.join())
  // 새 크레탑 결과가 오면 다시 묻는다(자료가 다르다)
  const newer = { ...mixed, toolResults: [{ ...mixed.toolResults[0], id: 'cr2' }] }
  check('새 자료: 다른 자료면 다시 묻는다', pendingFacts(newer).some((x) => x.key === 'businessAddress'))
}

/* ---- 자료 → 후보 (사업자등록증 · 받아 둔 후보) ---- */
{
  const r = withFactCandidates(base, [
    { key: 'corporateNumber', value: '110111-1234567', source: 'corporateRegistry', asOf: '', ref: 'doc:corporateRegistry:1' },
    { key: 'businessItem', value: '응용 소프트웨어 개발', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:1' },
    { key: 'nope', value: 'x', source: 'manual', asOf: '', ref: 'x' },
  ], NOW, makeId)
  check('받아 둔 후보: 모르는 사실은 버린다', r.factInbox.length === 2)
  check('받아 둔 후보: 확정하지 않는다', r.corporateNumber === '' && readFact(r, 'corporateNumber')!.status === 'missing')
  const p = pendingFacts(r)
  check('받아 둔 후보: 확인 필요로 나온다', p.length === 2 && p.every((x) => x.from === 'inbox'))
  const done = withFactDecisions(r, [{ id: p[0].id, action: 'accept' }], NOW)
  check('받아 둔 후보: 확인한 것은 빠지고 사실이 된다', done.factInbox.length === 1 && readFact(done, p[0].key)!.status === 'confirmed' && readFact(done, p[0].key)!.source !== 'manual')
  const again = withFactCandidates(done, [{ key: 'businessItem', value: '소프트웨어 개발', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:2' }], NOW, makeId)
  check('받아 둔 후보: 같은 사실의 새 후보가 옛 후보를 바꾼다', again.factInbox.filter((c) => c.key === 'businessItem').length === 1 && again.factInbox.find((c) => c.key === 'businessItem')?.value === '소프트웨어 개발')
}

/* ---- 사람이 적은 글 ---- */
{
  check('금액 읽기: 12억 5,000만 · 12.5억 · 8000만원 · 1,250,000,000 · -3억', parseWonInput('12억 5,000만') === 1250000000 && parseWonInput('12.5억') === 1250000000 && parseWonInput('8000만원') === 80000000 && parseWonInput('1,250,000,000') === 1250000000 && parseWonInput('-3억') === -300000000)
  check('금액 읽기: 글이 섞이면 짐작하지 않는다', parseWonInput('약 12억쯤') === null && parseWonInput('모름') === null && parseWonInput('') === null)
  check('날짜 읽기: 2019.03.02 · 2019-03-02 · 모르는 글은 null', normalizeFactInput('establishedAt', '2019.03.02') === '2019-03-02' && normalizeFactInput('establishedAt', '2019-03-02') === '2019-03-02' && normalizeFactInput('establishedAt', '작년쯤') === null)
  const e = withProfileFieldEdit(base, 'employeeCount', '8', NOW)
  check('업체 칸 고치기: 사실이면 직접 적음 · 적어 둠', e.employeeCount === '8' && e.factMeta.employeeCount.source === 'manual' && e.factMeta.employeeCount.status === 'entered')
  const h = withProfileFieldEdit(base, 'homepage', 'a.kr', NOW)
  check('업체 칸 고치기: 사실이 아닌 칸은 값만', h.homepage === 'a.kr' && !h.factMeta.homepage)
  check('출처 한 줄: 직접 적은 평범한 값은 조용히', factNoteFor(e, 'employeeCount') === null)
  const c = withFactValue(base, 'employeeCount', '8', { source: 'payrollRoster', status: 'confirmed', now: NOW })
  check('출처 한 줄: 자료로 확인한 값은 보인다', factNoteFor(c, 'employeeCount')?.text === '4대보험 명부 · 확인됨' && factNoteFor(c, 'employeeCount')?.confirmed === true)
}

/* ---- D-129: 인증서 · 확인서 → 회사 기본 정보 '인증서' 칸 ---- */
{
  const LAB = `연구개발전담부서 인정서
  업체명 : 한솔테크(주)
  인정번호 : 2024-1234
  인정일 : 2024년 3월 5일
  위 기업의 연구개발전담부서를 인정합니다.
  한국산업기술진흥협회장`
  const c = parseCertificateDocument(LAB)
  check('인정서: 이름 · 번호 · 날짜 · 기관', c?.name === '연구개발전담부서' && c.number === '2024-1234' && c.date === '2024-03-05' && c.issuer === '한국산업기술진흥협회', JSON.stringify(c))
  check('인정서: 칸 값 한 줄', certificateValue(c!) === '인정번호 2024-1234 · 인정일 2024-03-05 · 한국산업기술진흥협회', certificateValue(c!))
  const VEN = '벤처기업확인서\n확인번호 제 20240101-01 호\n유효기간 : 2024.01.10 ~ 2027.01.09\n벤처기업협회'
  const v = parseCertificateDocument(VEN)
  check('벤처확인서: 번호 · 유효기간 · 기관', v?.name === '벤처기업' && v.number === '20240101-01' && v.date === '2024-01-10' && v.validUntil === '2027-01-09' && v.issuer === '벤처기업협회', JSON.stringify(v))
  const PAT = '특 허 증\n특허 제 10-1234567 호\n등록일 2023. 7. 1.\n특허청장'
  const pt = parseCertificateDocument(PAT)
  check('특허증: 등록번호 · 등록일', pt?.name === '특허' && pt.number === '10-1234567' && pt.date === '2023-07-01', JSON.stringify(pt))
  check('모르는 서류는 null — 짐작하지 않는다', parseCertificateDocument('견적서\n금액 1,000,000원\n2024년 1월 1일') === null)

  const cand = factCandidatesFromDocText('customdoc_lab', LAB, 'doc:x')
  check('후보: 인증서 묶음 칸으로 간다(cf:연구개발전담부서)', cand.length === 1 && cand[0].key === 'cf:연구개발전담부서' && cand[0].group === 'credential' && cand[0].source === 'certificate')
  const r1 = withDocFacts(base, 'customdoc_lab', LAB, NOW, makeId).record
  const p1 = pendingFacts(r1)
  check('후보: 확인 필요로 나오고 칸은 아직 없다', p1.some((x) => x.key === 'cf:연구개발전담부서') && !r1.customFields.some((f) => f.label === '연구개발전담부서'))
  const done = withFactDecisions(r1, p1.filter((x) => x.key.startsWith('cf:')).map((x) => ({ id: x.id, action: 'accept' as const })), NOW)
  const field = done.customFields.find((f) => f.label === '연구개발전담부서')
  check('확인: 인증서 묶음에 칸이 생긴다', field?.group === 'credential' && field.value.includes('2024-1234'), JSON.stringify(field))
  // 같은 인증서를 또 올려도 칸이 늘지 않고 묻지도 않는다
  const again = withDocFacts(done, 'customdoc_lab', LAB, '2026-09-28T00:00:00.000Z', makeId).record
  check('같은 인증서 다시: 묻지 않는다', !pendingFacts(again).some((x) => x.key === 'cf:연구개발전담부서'))
  // 번호가 바뀐 새 인정서 → 같은 칸을 고치자고 묻는다(칸은 하나)
  const NEW = LAB.replace('2024-1234', '2025-9999')
  const r3 = withDocFacts(done, 'customdoc_lab', NEW, '2026-09-28T01:00:00.000Z', makeId).record
  const p3 = pendingFacts(r3).find((x) => x.key === 'cf:연구개발전담부서')
  check('새 번호: 지금 값과 함께 묻는다', !!p3 && p3.current.includes('2024-1234') && p3.value.includes('2025-9999'))
  const r4 = withFactDecisions(r3, [{ id: p3!.id, action: 'accept' }], NOW)
  check('새 번호 확인: 칸은 하나 · 값만 바뀐다', r4.customFields.filter((f) => f.label === '연구개발전담부서').length === 1 && r4.customFields.find((f) => f.label === '연구개발전담부서')!.value.includes('2025-9999'))
  const biz = factCandidatesFromDocText('businessRegistration', '사업자등록증\n등록번호 : 214-88-01234\n상호 : 주식회사 대한정밀', 'doc:b')
  check('사업자등록증: 공통 사실 후보(번호 · 회사명)', biz.some((x) => x.key === 'businessNumber' && x.value === '214-88-01234') && biz.some((x) => x.key === 'companyName'))
  check('미리보기 종류: pdf · 사진 · HWP 는 못 봄', previewKindOf('a.PDF') === 'pdf' && previewKindOf('사진.jpeg') === 'image' && previewKindOf('계약서.hwp') === null && previewKindOf('자료.zip') === null)
  const g = normalizeClientOps({ id: 'g', companyName: 'x', representativeGender: 'female' } as Partial<ClientOpsRecord>)
  const g2 = normalizeClientOps({ id: 'g2', companyName: 'x', representativeGender: '여자' } as unknown as Partial<ClientOpsRecord>)
  check('대표자 성별: 고른 값만 · 모르는 글은 비운다', g.representativeGender === 'female' && g2.representativeGender === '' && base.representativeGender === '')
}

/* ---- D-136 크레탑 → 사실: 정확한 원 · 확인 필요는 후보로 만들지 않는다 ---- */
{
  const withCp = (corePreview: Record<string, unknown>, companyInfo: Record<string, unknown> = {}): ClientOpsRecord => {
    const r = withCretop(base)
    return { ...r, toolResults: [{ ...r.toolResults[0], data: { companyInfo, corePreview } }] }
  }
  const val = (r: ClientOpsRecord, k: string) => cretopFacts(r).find((c) => c.key === k)?.value
  const exact = withCp({ revenue: { value: 6703634, unit: '천원', eok: 67.04, year: 2024 }, netIncome: { value: 92443, unit: '천원', eok: 0.92, year: 2024 } })
  check('D-136 크레탑: 천원 → 원 정확히(억 반올림 X) — 6,703,634천원 = 6,703,634,000원', val(exact, 'revenue') === '6703634000' && val(exact, 'netIncome') === '92443000', `${val(exact, 'revenue')} ${val(exact, 'netIncome')}`)
  const won = withCp({ revenue: { value: 6703634000, unit: '원', eok: 67.04, year: 2024 } })
  check('D-136 크레탑: 원 단위 그대로', val(won, 'revenue') === '6703634000')
  const flagged = withCp({
    revenue: { value: null, unit: '백만원', eok: null, year: 2024, latestMissing: true, needsCheck: true },
    operatingProfit: { value: 6703634, unit: '백만원', eok: 67036.34, year: 2024, needsCheck: true, unitAssumed: true },
    netIncome: { value: 92, unit: '백만원', eok: 0.92, year: null },
    totalAssets: { value: 5716, unit: '백만원', eok: 57.16, year: 2024 },
  })
  check('D-136 크레탑: 최신 연도 빈칸 · 확인 필요(단위 추정 · 범위 밖) · 연도 모름은 후보로 만들지 않는다', val(flagged, 'revenue') === undefined && val(flagged, 'operatingProfit') === undefined && val(flagged, 'netIncome') === undefined && val(flagged, 'totalAssets') === '5716000000')
  check('D-136 크레탑: 확인 필요 칸은 확인 목록에도 안 뜬다', !pendingFacts(flagged).some((p) => ['revenue', 'operatingProfit', 'netIncome'].includes(p.key)))
  const legacyEok = withCp({ revenue: { eok: 12.34, year: 2025 } })
  check('D-136 크레탑: 예전 결과(단위 없이 억만) → 억 × 1억', val(legacyEok, 'revenue') === '1234000000')
  const yearOnly = withCp({}, { companyName: '연도만(주)', established: '2011', employees: '1234' })
  check('D-136 크레탑: 연도만 있는 설립일은 사실 후보로 만들지 않는다 · 직원 1234', val(yearOnly, 'establishedAt') === undefined && val(yearOnly, 'employeeCount') === '1234')
}

/* ---- 저장 모양 · 예전 기록 ---- */
{
  const old = normalizeClientOps({ id: 'old', companyName: '옛회사' } as Partial<ClientOpsRecord>)
  check('예전 기록: 빈 사실 창고(기존 데이터 영향 0)', Object.keys(old.factMeta).length === 0 && Object.keys(old.factValues).length === 0 && old.factInbox.length === 0)
  const weird = normalizeClientOps({ id: 'w', companyName: 'x', factMeta: { revenue: { source: 'hack', status: 'nope' } }, factValues: { revenue: 123, a: ' ' }, factInbox: [{ key: 'revenue' }] } as unknown as Partial<ClientOpsRecord>)
  check('이상한 값: 출처 · 상태는 안전하게, 숫자 값 · 빈 후보는 버린다', weird.factMeta.revenue.source === 'manual' && weird.factMeta.revenue.status === 'entered' && Object.keys(weird.factValues).length === 0 && weird.factInbox.length === 0)
  const kept = normalizeClientOps(JSON.parse(JSON.stringify(withFactValue(base, 'certifications', '벤처 · 이노비즈', { now: NOW }))))
  check('저장 뒤 다시 읽어도 그대로', kept.factValues.certifications === '벤처 · 이노비즈' && kept.factMeta.certifications.source === 'manual')
}

// D-144: 서류 올리기 — 확실한 것은 바로, 애매한 것은 까닭을 붙여 묻는다
{
  const BIZ = `사업자등록증
(법인사업자)
등록번호 : 124-81-00998
법인명(단체명) : 주식회사 한빛테크
대표자 : 김한빛
개업연월일 : 2019 년 03 월 02 일
법인등록번호 : 110111-1234567
사업장 소재지 : 경기도 파주시 문산읍 돈유1로 12
업태 : 제조업
종목 : 전자부품`
  const empty = normalizeClientOps({ id: 'af1', companyName: '한빛테크', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  let n = 0
  const mk = () => `id${++n}`
  const pdf = autoFillFromDocs(empty, [{ key: 'businessRegistration', fileName: '사업자등록증.pdf', text: BIZ, method: 'pdf_text', docSure: true }], '2026-10-02T00:00:00.000Z', mk)
  check('자동 입력: PDF 글자 + 확실한 서류 → 빈 칸은 바로 들어감', pdf.record.businessNumber.replace(/\D/g, '') === '1248100998' && pdf.record.establishedAt === '2019-03-02' && pdf.record.businessAddress.includes('파주시'), JSON.stringify({ e: pdf.entered.map((f) => f.key), f: pdf.flagged.map((f) => f.key + ':' + f.note) }))
  check('자동 입력: 바로 넣은 것은 확인함에 남지 않음', pendingFacts(pdf.record).filter((p) => p.from === 'inbox').length === pdf.flagged.length)
  check('자동 입력: 넣은 값은 출처 사업자등록증', pdf.record.factMeta.businessNumber?.source === 'businessRegistration')
  const ocr = autoFillFromDocs(empty, [{ key: 'businessRegistration', fileName: '사업자.jpg', text: BIZ, method: 'ocr', docSure: true }], '2026-10-02T00:00:00.000Z', mk)
  check('사진(OCR): 사업자번호는 검증 숫자가 맞으면 바로', ocr.entered.some((f) => f.key === 'businessNumber'))
  check('사진(OCR): 나머지는 바로 넣지 않고 까닭과 함께 확인', ocr.record.establishedAt === '' && ocr.flagged.some((f) => f.key === 'establishedAt' && f.note === NOTE_OCR) && pendingFacts(ocr.record).some((p) => p.key === 'establishedAt' && p.note === NOTE_OCR))
  const bad = autoFillFromDocs(empty, [{ key: 'businessRegistration', fileName: 'a.pdf', text: BIZ.replace('124-81-00998', '124-81-00999'), method: 'pdf_text', docSure: true }], '2026-10-02T00:00:00.000Z', mk)
  check('검증 숫자가 틀린 사업자번호는 넣지 않고 묻는다', bad.record.businessNumber === '' && bad.flagged.some((f) => f.key === 'businessNumber'), JSON.stringify(bad.flagged))
  const had = { ...empty, businessAddress: '서울특별시 강남구 테헤란로 1' }
  const conflict = autoFillFromDocs(had, [{ key: 'businessRegistration', fileName: 'a.pdf', text: BIZ, method: 'pdf_text', docSure: true }], '2026-10-02T00:00:00.000Z', mk)
  check('이미 다른 값이 있으면 덮지 않고 "지금 값과 다름"', conflict.record.businessAddress.startsWith('서울') && conflict.flagged.some((f) => f.key === 'businessAddress' && f.note === NOTE_CONFLICT))
  const unsure = autoFillFromDocs(empty, [{ key: 'businessRegistration', fileName: 'a.pdf', text: BIZ, method: 'pdf_text', docSure: false }], '2026-10-02T00:00:00.000Z', mk)
  check('서류 종류가 애매하면 전부 확인', unsure.entered.length === 0 && unsure.flagged.length > 0)
  const again = normalizeClientOps(JSON.parse(JSON.stringify(ocr.record)))
  check('까닭(note)은 저장 뒤에도 남는다', again.factInbox.some((c) => c.note === NOTE_OCR))

  // 크레탑 · 명부 가리기
  check('크레탑 보고서 알아봄', looksLikeCretop({ key: 'cretopReport', fileName: 'x.pdf', text: 'a'.repeat(400) }) && looksLikeCretop({ key: 'custom', fileName: '크레탑.pdf', text: `CRETOP 기업종합보고서 ${'가'.repeat(900)}` }))
  check('명부 알아봄(주민번호 모양 둘 이상 + 가입자)', looksLikeRoster({ key: 'custom', fileName: '명부.pdf', text: '사업장 가입자 명부 홍길동 900101-1 김영희 950505-2' }) && !looksLikeRoster({ key: 'custom', fileName: 'a.pdf', text: '사업자등록증 900101-1' }))
  const metas = DOCUMENTS
  check('종류 판별: 크레탑 보고서 · 4대보험 명부', classifyDocument({ text: 'CRETOP 기업종합보고서 한국평가데이터 신용등급', fileName: 'r.pdf' }, metas).key === 'cretopReport' && classifyDocument({ text: '4대보험 사업장 가입자 명부 자격취득일 고용보험', fileName: 'm.pdf' }, metas).key === 'payrollRoster')
  check('종류 판별: 주주명부 파일 이름은 4대보험 명부로 가지 않음', classifyDocument({ text: '', fileName: '주주명부.pdf' }, metas).key !== 'payrollRoster')

  // 맞춤 추천 — 모듈 판정
  const full = pdf.record
  const ins = buildInsights(full, '2026-10-02', [])
  const keys = ins.map((i) => i.key)
  check('맞춤 추천: 모든 모듈 판정(지원사업 · 정책자금 · 고용 · 창업감면 · 연구소 · 크레탑 · 절세)', ['grants', 'policy-funding', 'employment', 'startup-tax', 'labcare', 'cretop', 'tax'].every((k) => keys.includes(k)), keys.join())
  const pf = ins.find((i) => i.key === 'policy-funding')
  check('맞춤 추천: 사업자등록증만으로 정책자금 판정이 나옴(설립일 · 업종)', !!pf && pf.tone !== 'need' && /진행 가능성/.test(pf.headline), pf?.headline)
  const st = ins.find((i) => i.key === 'startup-tax')
  check('맞춤 추천: 창업 7년 → 창업감면 기간 끝남', st?.tone === 'no', st?.headline)
  const none = buildInsights(empty, '2026-10-02', [])
  check('맞춤 추천: 정보가 없으면 짐작하지 않고 무엇이 필요한지', none.find((i) => i.key === 'policy-funding')?.tone === 'need' && (none.find((i) => i.key === 'policy-funding')?.missing.length ?? 0) > 0)
  check('맞춤 추천: 요금제에 없는 모듈은 빠짐', !buildInsights(full, '2026-10-02', [], (k) => k !== 'labcare').some((i) => i.key === 'labcare'))
  check('맞춤 추천: 좋은 것 먼저', ins.findIndex((i) => i.tone === 'need') === -1 || ins.findIndex((i) => i.tone === 'good' || i.tone === 'maybe') < ins.findIndex((i) => i.tone === 'need') || !ins.some((i) => i.tone === 'good' || i.tone === 'maybe'))
  const steps = recommendNextSteps(none, 2)
  check('다음 행동: 확인할 정보가 맨 앞 · 빠진 서류 받기', steps[0]?.id === 'facts' && steps.some((s) => s.id === 'docs'), JSON.stringify(steps.map((s) => s.text)))
  const broken = { ...full, taxProfile: null as unknown as Record<string, string> }
  check('맞춤 추천: 한 모듈이 실패해도 나머지는 나옴', buildInsights(broken, '2026-10-02', []).length >= 6)
}

console.log(`\ncustomer-facts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
