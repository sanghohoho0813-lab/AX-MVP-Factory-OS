/**
 * 고객 사실 창고 시험 (D-128) — 자료는 한 번, 확인은 최소, 고객 정보는 하나, 모듈은 다시 쓴다.
 *  - 사실의 자리: 업체 칸이 있으면 그 칸, 없으면 factValues 한 곳(복제 없음)
 *  - 출처 · 상태: 예전 값은 '적어 둠', 자료에서 확인하면 '확인됨', 예상은 '예상값'
 *  - 자료 → 후보: 크레탑 결과 · 받아 둔 후보는 확인 전에는 사실이 아니다(모듈도 안 쓴다)
 *  - 모두 확인 · 틀린 것만 고치기 · 틀림(다시 안 묻기) · 나중에(그대로 남음)
 *  - 모듈 어댑터(clientFacts)가 후보를 쓰지 않는다 · 예상값은 표시된다
 * 실행: npm run test:facts
 */

import { normalizeClientOps, withCustomDocument, withDocument, withDocUploadLog, withoutCustomDocument } from '../clientOpsService'
import { buildDecisions, undoDecision, withDecisionAnswer, isImportantFactKey } from '../decisions'
import { docUploadLogOf, batchOfLog } from '../docAutoAnalyze'
import { newestOf, otherCellSuggestion, withDedupedShelf } from '../docShelf'
import { NOTE_RECHECK, withProfileFieldTyped, withRecheckFacts } from '../customerFacts'
import { allDocumentMetas } from '../clientOpsDocuments'
import { OTHER_DOC_LABEL, documentTitle, findIssuedDate, findValidUntil, knownDocValidMonths, placeDocument, titleFromFileName } from '../docClassify'
import { smeSizeOf } from '../certDocParser'
import { documentStatus, documentsWithExpiry } from '../clientOpsAlerts'
import { docShelfSummary, filePortalDocument, isSystemFile, moveDocTo, moveTargets, shelfCellOf } from '../docShelf'
import { applyResort, cellForPlacement, resortDecision, withFactRefs, withoutDocumentFile } from '../docPlacementApply'
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
import { pdfItemsToText } from '../pdfTextLines'
import { filesFromDrop, folderOfPath, relativePathOf } from '../../lib/dropFiles'
import { crumbsOf, docFolderTree, fileKindOf, folderAt } from '../docFolders'
import { parseFinancialStatement } from '../finStatementParser'
import { looksLikeCretop, looksLikeRoster } from '../docAutoAnalyze'
import { buildInsights, cardRecoChips, isPick, missingForPicks, recoScore, recommendNextSteps, topPicks, type Insight } from '../clientInsights'
import { sortClients } from '../clientOpsSort'
import { recoRequestMessage, requestItemsFrom } from '../recoRequest'
import { manwonText } from '../clientInsights'
import { ADVISOR_GROUPS, ALL_QUESTIONS, answerFor, answerText, matchQuestion } from '../clientAdvisor'
import { classifyDocument } from '../docClassify'
import { NOTE_BIZNO_CHECK, NOTE_DIFFERS, NOTE_FROM_PHOTO, applyNewClientGuess, guessNewClientFromDocs, looksLikeCretopForNewClient } from '../newClientFromDocs'
import { handDocsTo, peekHandedDocs, takeHandedDocs } from '../docHandoff'
import { SECTION_HINT_COUNT, SECTION_HINT_KEYS, hintFor } from '../../content/sectionHints'
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

  // D-145: 맞춤 상담 — 목차 질문마다 이 회사 기록으로 답한다(규칙 · LLM 없음)
  check('상담 목차: 다섯 묶음 · 묶음마다 2~3개(무분별하게 많지 않게)', ADVISOR_GROUPS.length === 5 && ADVISOR_GROUPS.every((g) => g.questions.length >= 2 && g.questions.length <= 3) && ALL_QUESTIONS.length <= 15)
  const ctxFull = { record: full, today: '2026-10-02', notices: [] }
  const ctxEmpty = { record: empty, today: '2026-10-02', notices: [] }
  const allOk = ALL_QUESTIONS.every((qq) => {
    const a1 = answerFor(qq.id, ctxFull)
    const a2 = answerFor(qq.id, ctxEmpty)
    return a1.title !== '' && a2.title !== '' && (a1.verdict !== null || a1.steps.length > 0) && (a2.verdict !== null || a2.steps.length > 0)
  })
  check('상담: 모든 질문이 정보 있는/없는 업체 둘 다 답한다(오류 없음)', allOk)
  const pol = answerFor('policy', ctxFull)
  check('상담 · 정책자금: 사업자등록증만으로 추천 기관 순위 · 준비 서류', pol.steps.some((x) => /1순위/.test(x)) && pol.docs.length > 0 && /진행 가능성/.test(pol.verdict?.text ?? ''), JSON.stringify(pol.steps))
  check('상담 · 정책자금: 정보 없으면 짐작하지 않고 필요한 것', answerFor('policy', ctxEmpty).verdict?.tone === 'need' && answerFor('policy', ctxEmpty).missing.length > 0)
  check('상담 · 연구소: 창업 3년 넘은 소기업 → 연구전담요원 3명', /3명/.test(answerFor('lab', ctxFull).verdict?.text ?? ''), answerFor('lab', ctxFull).verdict?.text)
  check('상담 · 물어볼 것: 빠진 정보가 많을수록 질문이 많다', answerFor('ask', ctxEmpty).steps.length > answerFor('ask', ctxFull).steps.length)
  check('상담 · 제안 문구: 복사할 글에 회사 이름', answerFor('pitch', ctxFull).copyText.includes('한빛테크') || answerFor('pitch', ctxFull).copyText.includes('주식회사'))
  check('직접 묻기: "정책자금 어디에 신청해" → 정책자금', matchQuestion('정책자금 어디에 신청해?').best?.id === 'policy')
  check('직접 묻기: "청년 직원 지원금" → 고용지원금', matchQuestion('청년 직원 뽑으면 지원금 있어?').best?.id === 'employment')
  check('직접 묻기: "배당이랑 급여" → 급여 · 배당', matchQuestion('배당이랑 급여 중에 뭐가 나아').best?.id === 'salary')
  const fb = answerText('오늘 날씨 어때', ctxFull)
  check('직접 묻기: 정해 둔 답이 없으면 짐작하지 않고 비슷한 질문 · AI 자리 안내', fb.questionId === null && fb.suggestions.length > 0 && fb.steps.some((x) => x.includes('AI')))
  const broken = { ...full, taxProfile: null as unknown as Record<string, string> }
  check('맞춤 추천: 한 모듈이 실패해도 나머지는 나옴', buildInsights(broken, '2026-10-02', []).length >= 6)
}

// D-146: 서류는 맨 위 제목으로 칸을 정한다 · 맞는 칸이 없으면 그 이름으로 새 칸 · 모르면 '기타 · 확인 필요' · 덮지 않는다
{
  const base = normalizeClientOps({ id: 'pl1', companyName: '샤인디자인', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const metas = allDocumentMetas(base)
  check('서류함: 대표자 휴대폰번호 칸이 없다', !metas.some((m) => m.key === 'representativePhone'))
  const oldPhone = normalizeClientOps({ id: 'pl0', companyName: 'x', documents: { representativePhone: { received: true, note: '대표님 010-1234-5678' } } as never })
  check('예전 서류함 휴대폰번호 → 개요 연락처로 보인다', oldPhone.contactPhone === '010-1234-5678', oldPhone.contactPhone)
  check('개요 연락처가 있으면 그대로', normalizeClientOps({ id: 'pl0', companyName: 'x', contactPhone: '010-9999-0000', documents: { representativePhone: { received: true, note: '010-1234-5678' } } as never }).contactPhone === '010-9999-0000')

  const GRAD = `졸 업 증 명 서\n성명 : 김샤인\n생년월일 : 1990. 01. 01\n위 사람은 본교 시각디자인학과를 졸업하였음을 증명합니다.\n2026년 9월 1일\n한국대학교 총장`
  const p1 = placeDocument({ text: GRAD, fileName: 'scan_001.pdf' }, metas)
  check('제목: 졸업증명서 → 신분증 칸이 아니라 새 칸 졸업증명서', p1.kind === 'new' && p1.label === '졸업증명서' && p1.sure, JSON.stringify(p1))
  const BIZ = `발급번호 1234-5678\n사 업 자 등 록 증\n(일반과세자)\n등록번호 : 124-81-00998\n상호 : 샤인디자인`
  const p2 = placeDocument({ text: BIZ, fileName: 'a.pdf' }, metas)
  check('제목: 띄어 쓴 사업자등록증 · 위에 발급번호 줄 → 사업자등록증 칸', p2.kind === 'existing' && p2.key === 'businessRegistration' && p2.sure, JSON.stringify(p2))
  const SME = `중소기업 확인서\n기업명 : 샤인디자인\n유효기간 : 2026-04-01 ~ 2027-03-31`
  const p3 = placeDocument({ text: SME, fileName: '확인서.pdf' }, metas)
  check('제목: 중소기업 확인서 → 그 칸', p3.kind === 'existing' && p3.key === 'smeCertificate')
  const p4 = placeDocument({ text: '이 파일은 무엇인지 알 수 없는 메모입니다 그냥 글자만 있어요', fileName: '메모.txt' }, metas)
  check('제목 없음 · 근거 없음 → 기타 · 확인 필요', p4.kind === 'new' && p4.label === OTHER_DOC_LABEL && !p4.sure, JSON.stringify(p4))
  const p5 = placeDocument({ text: '', fileName: '법인인감증명서_샤인.jpg' }, metas)
  check('글자 못 읽음 · 파일 이름에 서류 이름 → 그 이름(확실 아님)', p5.kind === 'new' && /인감증명서/.test(p5.label) && !p5.sure, JSON.stringify(p5))
  check('제목 찾기: 본문 문장은 제목이 아니다', documentTitle('위 사람은 본교를 졸업하였음을 증명합니다') === null)

  // 덮지 않는다 — 같은 칸이 두 번이면 '(2)' 칸
  const used = new Set<string>()
  const c1 = cellForPlacement(base, p2, used)
  const r1 = withDocument(c1.record, c1.key, { received: true, fileName: '사업자등록증_2025.pdf' })
  const c2 = cellForPlacement(r1, p2, used)
  check('겹치면 번호 칸: 두 번째 사업자등록증 → 사업자등록증 (2)', c1.key === 'businessRegistration' && c2.key !== 'businessRegistration' && c2.label === '사업자등록증 (2)' && c2.numbered, JSON.stringify({ k: c2.key, l: c2.label }))
  const c3 = cellForPlacement(c2.record, { kind: 'new', label: '졸업증명서', sure: true, reason: '', issuedAt: null }, used)
  const c4 = cellForPlacement(c3.record, { kind: 'new', label: '졸업증명서', sure: true, reason: '', issuedAt: null }, used)
  check('새 칸도 겹치면 번호: 졸업증명서 · 졸업증명서 (2)', c3.label === '졸업증명서' && c4.label === '졸업증명서 (2)' && c3.key !== c4.key)

  // 다시 분류 — 중소기업 확인서 칸의 졸업증명서와 기타 칸의 중소기업 확인서를 서로 바꾼다(번호 칸 없이)
  let tangled = withCustomDocument(base, { label: `${OTHER_DOC_LABEL} · 스캔3` })
  const otherKey = tangled.customDocuments[0].key
  tangled = withDocument(tangled, 'smeCertificate', { received: true, fileName: '졸업증명서.pdf', storagePath: 'w/c/sme/1', issuedAt: '2020-01-01' })
  tangled = withDocument(tangled, otherKey, { received: true, fileName: '스캔3.pdf', storagePath: 'w/c/o/2' })
  tangled = withDocument(tangled, 'representativeId', { received: true, fileName: '신분증.jpg', storagePath: 'w/c/id/3' })
  const tm = allDocumentMetas(tangled)
  const d1 = resortDecision('smeCertificate', '중소기업 확인서', '졸업증명서.pdf', placeDocument({ text: GRAD, fileName: '졸업증명서.pdf' }, tm))
  const d2 = resortDecision(otherKey, `${OTHER_DOC_LABEL} · 스캔3`, '스캔3.pdf', placeDocument({ text: SME, fileName: '스캔3.pdf' }, tm))
  const d3 = resortDecision('representativeId', '대표자 신분증 사본', '신분증.jpg', placeDocument({ text: '', fileName: '신분증.jpg' }, tm))
  const d4 = resortDecision('representativeId', '대표자 신분증 사본', 'IMG_0001.jpg', placeDocument({ text: '', fileName: 'IMG_0001.jpg' }, tm))
  check('다시 분류: 제목이 칸과 다르면 옮기자고 한다', d1.move && d2.move, JSON.stringify([d1.why, d2.why]))
  check('다시 분류: 맞는 칸 · 근거 없는 파일은 그대로', !d3.move && !d4.move, JSON.stringify([d3.why, d4.why]))
  const done = applyResort(tangled, [d1, d2], { withDoc: withDocument, withoutCustom: withoutCustomDocument })
  const sme = done.record.documents.smeCertificate
  const grad = allDocumentMetas(done.record).find((m) => m.label === '졸업증명서')
  check('다시 분류: 중소기업 확인서 칸에 진짜 확인서 · 졸업증명서는 새 칸', sme.fileName === '스캔3.pdf' && sme.storagePath === 'w/c/o/2' && !!grad && done.record.documents[grad.key].storagePath === 'w/c/sme/1', JSON.stringify(done.moved))
  check('다시 분류: 번호 칸이 생기지 않고 비어 버린 기타 칸은 없어짐', !allDocumentMetas(done.record).some((m) => /\(\d+\)$/.test(m.label) || m.label.startsWith(OTHER_DOC_LABEL)))
  check('다시 분류: 옮기지 않은 신분증은 그대로', done.record.documents.representativeId.storagePath === 'w/c/id/3')

  // 파일 지우기 — 번호 칸은 칸까지, 기본 칸은 '안 받음'
  const dupKey = c2.key
  const withDup = withDocument(c2.record, dupKey, { received: true, fileName: '사업자등록증_2026.pdf' })
  const rm1 = withoutDocumentFile(withDup, dupKey, { withDoc: withDocument, withoutCustom: withoutCustomDocument })
  check('파일 지우기: 번호 칸은 칸까지 없어짐', !allDocumentMetas(rm1).some((m) => m.key === dupKey) && rm1.documents.businessRegistration.fileName === '사업자등록증_2025.pdf')
  const rm2 = withoutDocumentFile(withDup, 'businessRegistration', { withDoc: withDocument, withoutCustom: withoutCustomDocument })
  check('파일 지우기: 기본 칸은 안 받음으로', !rm2.documents.businessRegistration.received && rm2.documents.businessRegistration.fileName === '' && allDocumentMetas(rm2).some((m) => m.key === 'businessRegistration'))
}

// D-147: 서류함 고도화 · 안정화 — 시스템 파일 · 알려진 서류 유효기간 · 손볼 것 요약 · 기타 칸 옮기기
{
  check('시스템 파일: Thumbs.db · desktop.ini · ~$임시 · .DS_Store · __MACOSX 는 서류가 아니다', isSystemFile({ name: 'Thumbs.db' }) && isSystemFile({ name: 'desktop.ini' }) && isSystemFile({ name: '~$사업계획서.docx' }) && isSystemFile({ name: '.DS_Store' }) && isSystemFile({ name: '사업자등록증.pdf', webkitRelativePath: '샤인/__MACOSX/사업자등록증.pdf' }))
  check('시스템 파일: 보통 서류는 통과', !isSystemFile({ name: '사업자등록증.pdf', webkitRelativePath: '샤인디자인/사업자등록증.pdf' }) && !isSystemFile({ name: 'thumbs_up.png' }))
  check('알려진 서류 유효기간: 인감 3 · 납세 1 · 벤처 36 · 모르면 없음', knownDocValidMonths('법인인감증명서') === 3 && knownDocValidMonths('납세증명서') === 1 && knownDocValidMonths('벤처기업확인서') === 36 && knownDocValidMonths('졸업증명서') === null && knownDocValidMonths('법인인감증명서 (2)') === 3)
  const base0 = normalizeClientOps({ id: 'sh1', companyName: '샤인디자인', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const seal = cellForPlacement(base0, { kind: 'new', label: '법인인감증명서', sure: true, reason: '', issuedAt: null }, new Set())
  const sealMeta = seal.record.customDocuments.find((d) => d.key === seal.key)
  check('새 칸(알려진 서류)에 유효기간이 함께 — 인감 3개월', sealMeta?.validMonths === 3, JSON.stringify(sealMeta))
  let withSeal = withDocument(seal.record, seal.key, { received: true, fileName: '인감.pdf', issuedAt: '2026-05-01' })
  check('새 칸 유효기간 → 발급 5개월 지난 인감은 만료', docShelfSummary(withSeal, '2026-10-02', new Set()).expired.includes(seal.key))

  // 손볼 것 요약
  let shelf = withCustomDocument(base0, { label: `${OTHER_DOC_LABEL} · 스캔3` })
  const otherKey = shelf.customDocuments.at(-1)!.key
  shelf = withDocument(shelf, otherKey, { received: true, fileName: '스캔3.pdf', storagePath: 'w/c/o/3' })
  shelf = withDocument(shelf, 'businessRegistration', { received: true, fileName: '사업자등록증_2025.pdf' })
  const dup = cellForPlacement(shelf, { kind: 'existing', key: 'businessRegistration', label: '사업자등록증', sure: true, reason: '', issuedAt: null }, new Set())
  shelf = withDocument(dup.record, dup.key, { received: true, fileName: '사업자등록증_최신.pdf' })
  const sum = docShelfSummary(shelf, '2026-10-02', new Set(['corporateRegistry']))
  check('요약: 기타 1 · 겹친 서류 1묶음(사업자등록증 둘) · 지금 필요한데 없음 1', sum.other.length === 1 && sum.other[0] === otherKey && sum.dupGroups.length === 1 && sum.dupGroups[0].length === 2 && sum.missingNow.join() === 'corporateRegistry', JSON.stringify(sum))

  // 기타 칸 옮기기
  const targets = moveTargets(shelf, otherKey)
  check('옮길 곳: 이 업체 칸(번호 · 기타 칸 빼고) + 칸 없는 알려진 서류', targets.some((t) => t.value === 'key:smeCertificate') && !targets.some((t) => /\(\d+\)$/.test(t.label) || t.label.startsWith(OTHER_DOC_LABEL)) && targets.some((t) => t.value === 'new:법인인감증명서'))
  const m1 = moveDocTo(shelf, otherKey, 'key:smeCertificate')
  check('옮기기: 기본 칸(중소기업 확인서)으로 · 기타 칸은 없어짐', !!m1 && m1.record.documents.smeCertificate.storagePath === 'w/c/o/3' && !allDocumentMetas(m1.record).some((m) => m.key === otherKey) && m1.to === '중소기업 확인서', JSON.stringify(m1?.to))
  const m2 = moveDocTo(shelf, otherKey, 'new:법인인감증명서')
  const m2meta = m2 ? allDocumentMetas(m2.record).find((m) => m.label === '법인인감증명서') : undefined
  check('옮기기: 새 칸(법인인감증명서) · 유효기간 3개월', !!m2meta && m2meta.validMonths === 3 && m2!.record.documents[m2meta.key].storagePath === 'w/c/o/3')
  const m3 = moveDocTo(shelf, otherKey, 'new:사업자 등록증')
  check('옮기기: 직접 적은 이름이 있는 칸과 같으면 그 칸 — 파일이 있으면 번호 칸', !!m3 && /^사업자등록증 \(\d\)$/.test(m3.to) && m3.record.documents.businessRegistration.fileName === '사업자등록증_2025.pdf', m3?.to)
  check('옮기기: 빈 이름 · 파일 없는 칸은 하지 않음', moveDocTo(shelf, otherKey, 'new:  ') === null && moveDocTo(shelf, 'corporateRegistry', 'key:smeCertificate') === null)
}

// D-148: 검토에서 찾은 것 — 띄어 쓴 파일 이름 · 목록 줄 · 정관 · 지방세 · 빈 새 칸 · 연락처 지우기 · 고객이 올린 파일
{
  const base0 = normalizeClientOps({ id: 'rv1', companyName: '샤인디자인', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const metas = allDocumentMetas(base0)
  const byName = (n: string) => placeDocument({ text: '', fileName: n }, metas)
  const a = byName('사업자 등록증.pdf'), b = byName('중소기업 확인서.pdf'), c = byName('등기사항 전부 증명서.pdf'), d = byName('샤인 졸업 증명서.jpg')
  check('띄어 쓴 파일 이름: 사업자 등록증 → 사업자등록증 칸(예전 "등록증" 칸)', a.kind === 'existing' && a.key === 'businessRegistration', JSON.stringify(a))
  check('띄어 쓴 파일 이름: 중소기업 확인서 · 등기사항 전부 증명서 → 그 칸', b.kind === 'existing' && b.key === 'smeCertificate' && c.kind === 'existing' && c.key === 'corporateRegistry', JSON.stringify([b, c]))
  check('띄어 쓴 파일 이름: 샤인 졸업 증명서 → 졸업증명서(끝말 "증명서" 만 남기지 않음)', d.kind === 'new' && d.label === '졸업증명서', JSON.stringify(d))
  check('끝말만 있는 파일 이름(확인서.pdf)은 제목으로 안 봄', titleFromFileName('확인서.pdf') === null)
  check('목록 줄 "1. 근로계약서" 는 제목이 아님', documentTitle('첨부 서류 목록\n1. 근로계약서\n2. 통장 사본') === null)
  check("'정 관' 두 글자 제목", documentTitle('정 관\n제1조 (상호) 이 회사는') === '정관')
  const lt = placeDocument({ text: '지방세 납세증명서\n납세자 : 샤인디자인', fileName: 'a.pdf' }, metas)
  check('지방세 납세증명서는 납세증명서와 다른 칸', lt.kind === 'new' && lt.label === '지방세 납세증명서', JSON.stringify(lt))
  const ins = placeDocument({ text: '4대사회보험 완납증명서\n사업장명 : 샤인디자인', fileName: 'b.pdf' }, metas)
  check('4대사회보험 완납증명서 → 알려진 이름(유효기간 1개월)', ins.kind === 'new' && ins.label === '4대보험 완납증명서' && knownDocValidMonths(ins.label) === 1, JSON.stringify(ins))

  // 빈 이름 새 칸 → 다른 칸에 덮지 않고 기타 칸
  let withSeal = withCustomDocument(base0, { label: '법인인감증명서' })
  const sealKey = withSeal.customDocuments.at(-1)!.key
  withSeal = withDocument(withSeal, sealKey, { received: true, fileName: '인감.pdf', storagePath: 'w/c/seal' })
  const blank = cellForPlacement(withSeal, { kind: 'new', label: '  ', sure: true, reason: '', issuedAt: null }, new Set())
  check('빈 이름 새 칸: 인감 칸을 덮지 않고 기타 · 확인 필요 칸', blank.key !== sealKey && blank.label.startsWith(OTHER_DOC_LABEL), JSON.stringify(blank.label))

  // 연락처 — 한 번만 옮기고, 지우면 다시 안 채움
  const legacy = { id: 'rv2', companyName: 'x', documents: { representativePhone: { received: true, note: '010-1234-5678' } } } as never
  const once = normalizeClientOps(legacy)
  check('예전 휴대폰번호는 한 번 연락처로', once.contactPhone === '010-1234-5678' && once.legacyPhoneMoved === true)
  const cleared = normalizeClientOps({ ...once, contactPhone: '' })
  check('연락처를 지우면 저장해도 다시 채우지 않음', cleared.contactPhone === '', cleared.contactPhone)

  // 고객이 올린 파일 → 서류함
  let shelf = withDocument(base0, 'businessRegistration', { received: true, fileName: '사업자등록증_2025.pdf', storagePath: 'w/c/biz/1' })
  const p1 = filePortalDocument(shelf, { documentType: 'businessRegistration', title: '사업자등록증', storagePath: 'w/portal/l1/2.pdf', fileName: '사업자등록증_최신.pdf', fileSize: 100 }, '')
  check('고객 파일: 요청 종류가 사업자등록증 · 이미 파일 있음 → 덮지 않고 사업자등록증 (2)', !!p1 && p1.label === '사업자등록증 (2)' && p1.record.documents.businessRegistration.storagePath === 'w/c/biz/1' && p1.record.documents[p1.key].storagePath === 'w/portal/l1/2.pdf', JSON.stringify(p1?.label))
  const p2 = filePortalDocument(shelf, { documentType: 'etc', title: '2025 재무제표', storagePath: 'w/portal/l1/3.png', fileName: 'IMG_2231.png', fileSize: 10 }, '')
  check('고객 파일: 종류 "기타" · 이름으로 모름 → 요청 제목 칸(2025 재무제표)', !!p2 && p2.label === '2025 재무제표', JSON.stringify(p2?.label))
  const p3 = filePortalDocument(shelf, { documentType: 'etc', title: '서류', storagePath: 'w/portal/l1/4.pdf', fileName: '스캔.pdf', fileSize: 10 }, '중소기업 확인서\n기업명 : 샤인디자인')
  check('고객 파일: 글자 제목이 있으면 그 칸(중소기업 확인서)', !!p3 && p3.key === 'smeCertificate', JSON.stringify(p3?.label))
  const again = p1 ? filePortalDocument(p1.record, { documentType: 'businessRegistration', title: '사업자등록증', storagePath: 'w/portal/l1/2.pdf', fileName: '사업자등록증_최신.pdf', fileSize: 100 }, '') : null
  check('고객 파일: 이미 넣은 파일은 또 넣지 않음(같은 칸 그대로)', !!again && again.key === p1!.key && again.record === p1!.record && shelfCellOf(p1!.record, 'w/portal/l1/2.pdf')?.label === '사업자등록증 (2)')
}

// D-149: 맞춤 추천 다음 행동 — 서류함 손볼 것
{
  const none = recommendNextSteps([], 0, { expired: 0, other: 0, dup: 0 })
  check('다음 행동: 서류함 손볼 것이 없으면 정리하기 없음', !none.some((s) => s.id === 'shelf'))
  const st = recommendNextSteps([], 2, { expired: 1, other: 2, dup: 1 })
  const shelfStep = st.find((s) => s.id === 'shelf')
  check('다음 행동: 확인할 정보 다음에 서류함 정리하기(만료 · 확인 · 겹친 서류) → 서류 탭', st[0].id === 'facts' && st[1]?.id === 'shelf' && !!shelfStep && /만료 1/.test(shelfStep.text) && /무슨 서류인지 확인 2/.test(shelfStep.text) && /겹친 서류 1묶음/.test(shelfStep.text) && shelfStep.href === '?tab=docs', JSON.stringify(st))
}

// D-168: 서류 자동 분류 정확도 — PDF 줄 살리기 · 두 신호 일치 · 검증 맞는 사업자번호 · 두 서류 같은 값 · 재무제표
{
  const it = (str: string, x: number, y: number, w: number, h = 12, eol = false) => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h, hasEOL: eol })
  const page = [
    it('발급번호 2026-001', 40, 800, 120, 9, true),
    ...'사업자등록증'.split('').map((c, i) => it(c, 200 + i * 18, 760, 14, 16)),
    it('(법인사업자)', 200, 740, 80, 10, true),
    it('등록번호', 40, 700, 50), it(':', 96, 700, 4), it('124-81-00998', 106, 700, 90, 12, true),
    it('상호', 40, 680, 26), it('샤인디자인 주식회사', 80, 680, 120),
  ]
  const txt = pdfItemsToText(page)
  const lines = txt.split('\n')
  check('PDF 줄: 높이가 바뀌면 줄을 바꾼다(한 쪽이 한 줄이 아니다)', lines.length === 5, JSON.stringify(lines))
  check('PDF 줄: 글자마다 조각인 제목이 한 줄로 붙는다', lines[1] === '사업자등록증', lines[1])
  check('PDF 줄: 벌어진 조각은 띄어 쓴다', lines[3] === '등록번호 : 124-81-00998' && lines[4] === '상호 샤인디자인 주식회사', `${lines[3]} / ${lines[4]}`)
  check('PDF 줄: 위치 없는 조각도 읽힌다', pdfItemsToText([{ str: '가' }, { str: '나', hasEOL: true }, { str: '다' }]) === '가 나\n다')
  check('PDF 줄 → 제목 사업자등록증', documentTitle(txt) === '사업자등록증', String(documentTitle(txt)))
  const metas2 = allDocumentMetas(normalizeClientOps({ id: 'cx', companyName: 'x' } as never))
  const placed = placeDocument({ text: txt, fileName: 'scan.pdf' }, metas2)
  check('PDF 줄 → 사업자등록증 칸 확실', placed.kind === 'existing' && placed.key === 'businessRegistration' && placed.sure, JSON.stringify(placed))
  // 예전처럼 한 줄로 이으면 제목을 못 찾았다
  check('(예전 방식) 한 줄로 이으면 제목을 못 찾는다', documentTitle(page.map((p) => p.str).join(' ')) === null)

  const OCRBIZ = '상 호 샤인디자인\n사업자 등록번호 124-81-00998\n대표자 김샤인'
  const ob = placeDocument({ text: OCRBIZ, fileName: 'IMG_2031.jpg' }, metas2)
  check('검증 맞는 사업자번호 + 등록번호 낱말 → 사업자등록증 확실(제목 없어도)', ob.kind === 'existing' && ob.key === 'businessRegistration' && ob.sure, JSON.stringify(ob))
  const tax = placeDocument({ text: '납 세 사 실 확 인\n사업자 등록번호 124-81-00998\n부가가치세 신고', fileName: 'IMG_1.jpg' }, metas2)
  check('사업자번호가 있어도 다른 서류 낱말(납세 · 신고)이면 사업자등록증으로 확실하지 않다', !(tax.kind === 'existing' && tax.key === 'businessRegistration' && tax.sure), JSON.stringify(tax))
  const bad = placeDocument({ text: OCRBIZ.replace('00998', '00999'), fileName: 'IMG_2031.jpg' }, metas2)
  check('검증이 틀린 번호면 확실로 올리지 않는다', !(bad.kind === 'existing' && bad.key === 'businessRegistration' && bad.sure), JSON.stringify(bad))
  const nameAgree = placeDocument({ text: '등록번호 124-81-00998 상호 샤인디자인 개업연월일 2019년 3월 2일 사업의 종류 업태 서비스', fileName: '사업자등록증_샤인.pdf' }, metas2)
  check('파일 이름 + 내용 낱말이 같은 서류 → 확실', nameAgree.kind === 'existing' && nameAgree.sure && /내용도 같은 서류/.test(nameAgree.reason), JSON.stringify(nameAgree))

  const mk2 = (() => { let n = 0; return () => `ag${(n += 1)}` })()
  const blank = normalizeClientOps({ id: 'ag', companyName: '' } as never)
  const one = autoFillFromDocs(blank, [{ key: 'businessRegistration', fileName: 'a.jpg', text: OCRBIZ, method: 'ocr', docSure: false }], '2026-10-07T00:00:00.000Z', mk2)
  check('서류 하나 · 종류 애매 → 사업자번호는 확인으로', !one.entered.some((e) => e.key === 'businessNumber'), JSON.stringify(one.entered))
  const two = autoFillFromDocs(
    blank,
    [
      { key: 'businessRegistration', fileName: 'a.jpg', text: OCRBIZ, method: 'ocr', docSure: false },
      { key: 'corporateRegistry', fileName: 'b.pdf', text: '등기사항전부증명서\n상호 샤인디자인\n등록번호 124-81-00998\n대표이사 김샤인', method: 'pdf_text', docSure: false },
    ],
    '2026-10-07T00:00:00.000Z',
    mk2,
  )
  check('두 서류가 같은 사업자번호 → 바로 채움', two.entered.some((e) => e.key === 'businessNumber'), JSON.stringify(two.entered.map((e) => e.key)))

  const FIN = '표준재무제표증명\n(단위 : 천원)\n제 7(당)기 2025년 12월 31일 현재\n자산총계 3,200,000 2,900,000\n부채총계 1,100,000 1,000,000\nⅠ. 매출액 5,400,000 4,800,000\nⅣ. 영업이익 420,000 380,000\nⅩ. 당기순손실 (35,000) 120,000'
  const fv = parseFinancialStatement(FIN)
  check('재무제표: 단위 천원 · 당기 값', fv.revenue === 5_400_000_000 && fv.operatingProfit === 420_000_000 && fv.totalAssets === 3_200_000_000 && fv.totalLiabilities === 1_100_000_000, JSON.stringify(fv))
  check('재무제표: 당기순손실 (35,000) → 음수 · 결산 연도 2025', fv.netIncome === -35_000_000 && fv.year === '2025', JSON.stringify(fv))
  check('재무제표: 영업손실 부호 없어도 음수', parseFinancialStatement('손익계산서\n영업손실 12,000,000').operatingProfit === -12_000_000)
  check('재무제표: 글자가 없으면 아무것도 안 냄', Object.keys(parseFinancialStatement('메모')).length === 0)
  const fin = autoFillFromDocs(blank, [{ key: 'financialStatements', fileName: '재무제표.pdf', text: FIN, method: 'pdf_text', docSure: true }], '2026-10-07T00:00:00.000Z', mk2)
  check('재무제표 올리기 → 매출 · 영업이익 · 순이익 · 자산 · 부채 바로 채움', ['revenue', 'operatingProfit', 'netIncome', 'totalAssets', 'totalLiabilities'].every((k) => fin.entered.some((e) => e.key === k)), JSON.stringify(fin.entered.map((e) => e.key)))
}

// D-168: 폴더 끌어다 놓기 — 하위 폴더까지 파일을 다 꺼낸다
await (async () => {
  const f = (name: string) => ({ isFile: true, isDirectory: false, name, file: (ok: (x: File) => void) => ok({ name, size: 10 } as File) })
  const dir = (name: string, kids: unknown[]) => ({ isFile: false, isDirectory: true, name, createReader: () => { let done = false; return { readEntries: (ok: (l: unknown[]) => void) => { ok(done ? [] : kids); done = true } } } })
  const tree = dir('샤인디자인', [f('사업자등록증.pdf'), dir('재무', [f('2025 재무제표.pdf'), f('2024 재무제표.pdf')]), f('정관.pdf')])
  const dt = { files: [{ name: '샤인디자인', size: 0 }], items: [{ kind: 'file', webkitGetAsEntry: () => tree }] } as unknown as DataTransfer
  const r = await filesFromDrop(dt)
  check('폴더 끌어다 놓기: 하위 폴더까지 파일 4개', r.files.length === 4 && r.folders === 1 && r.files.some((x) => x.name === '2024 재무제표.pdf'), JSON.stringify(r.files.map((x) => x.name)))
  const plain = { files: [{ name: 'a.pdf', size: 5 }], items: [{ kind: 'file', webkitGetAsEntry: () => f('a.pdf') }] } as unknown as DataTransfer
  check('파일만 놓으면 그대로', (await filesFromDrop(plain)).files.length === 1)
})()

// D-181: 로드맵 1단계 마무리 — 인증서 유효기간 → 서류 만료 · 대표 생년월일 · 중소기업 확인서 → 기업 규모
{
  const venture = ['벤처기업확인서', '확인번호 : 20240501-01', '기업명 : 한솔테크(주)', '유효기간 : 2024.05.01 ~ 2027.04.30', '벤처기업확인기관장'].join('\n')
  check('D-181 유효기간 끝: 범위면 ~ 뒤 날짜(점 표기)', findValidUntil(venture) === '2027-04-30', String(findValidUntil(venture)))
  check('D-181 유효기간 끝: 한글 날짜 · 줄이 바뀌어도', findValidUntil('유효기간\n2026년 4월 1일 ~ 2027년 3월 31일') === '2027-03-31' && findValidUntil('유효기간 : 2028-02-29 까지') === '2028-02-29')
  check('D-181 유효기간 끝: 없으면 짐작하지 않음', findValidUntil('사업자등록증\n개업연월일 2019년 3월 2일') === null && findValidUntil('') === null)
  const sme = ['중소기업 확인서', '기업명 : 한솔테크(주)', '구 분 : 소기업(소상공인)', '유효기간 : 2026년 4월 1일 ~ 2027년 3월 31일'].join('\n')
  check('D-181 발급일 버그: 라벨이 없을 때 유효기간 끝(2027-03-31)을 발급일로 잡지 않고 범위 시작(2026-04-01)', findIssuedDate(sme) === '2026-04-01', String(findIssuedDate(sme)))
  check('D-181 발급일: 유효기간 밖 날짜가 있으면 그것(발급 라벨 없음)', findIssuedDate(`${sme}\n2026년 4월 2일\n중소벤처기업부장관`) === '2026-04-02' && findIssuedDate(`${sme}\n발급일자 : 2026.04.03`) === '2026-04-03')
  const metas = allDocumentMetas(normalizeClientOps({ id: 'v1', companyName: '한솔테크(주)' }))
  const pv = placeDocument({ text: venture, fileName: 'scan.pdf' }, metas)
  check('D-181 서류 놓기: 벤처기업확인서 → 유효기간 끝을 같이 들고 온다', pv.validUntil === '2027-04-30')
  // 서류함: 찍힌 유효기간 끝이 있으면 그 날짜로 만료(발급일 + 개월 대신) — 개월이 없는 칸(이노비즈 같은)도 만료를 알린다
  const rec = normalizeClientOps({ id: 'v2', companyName: '한솔테크(주)' })
  const smeKey = metas.find((m) => /중소기업/.test(m.label))?.key
  if (smeKey) {
    const withPrinted = withDocument(rec, smeKey, { received: true, issuedAt: '2026-04-01', validUntil: '2027-03-31' })
    const withoutPrinted = withDocument(rec, smeKey, { received: true, issuedAt: '2026-04-01' })
    check('D-181 만료: 찍힌 유효기간 끝(2027-03-31)이 발급일 + 12개월보다 먼저', documentStatus(smeKey, withPrinted.documents[smeKey], '2026-10-11').expiresOn === '2027-03-31' && documentStatus(smeKey, withoutPrinted.documents[smeKey], '2026-10-11').expiresOn === '2027-04-01')
  } else check('D-181 만료: 중소기업 확인서 칸이 있다', false)
  const inno = withCustomDocument(rec, { label: '이노비즈 확인서', validMonths: null })
  const innoKey = inno.customDocuments[0].key
  const innoDone = withDocument(inno, innoKey, { received: true, issuedAt: '2024-03-15', validUntil: '2026-11-01', fileName: 'inno.pdf' })
  const exp = documentsWithExpiry(innoDone, '2026-10-11').find((x) => x.meta.key === innoKey)
  check('D-181 만료: 유효개월이 없는 칸도 찍힌 날짜로 만료 · 21일 남음(곧 만료)', exp?.view.expiresOn === '2026-11-01' && exp.view.daysLeft === 21 && exp.view.expiringSoon === true)
  check('D-181 만료: 찍힌 날짜가 없으면 예전처럼 만료 없음', documentsWithExpiry(withDocument(inno, innoKey, { received: true, issuedAt: '2024-03-15' }), '2026-10-11').every((x) => x.meta.key !== innoKey))
  // 다시 분류로 옮기면 유효기간 끝도 파일을 따라간다
  const moved = applyResort(innoDone, [{ fromKey: innoKey, fromLabel: '이노비즈 확인서', fileName: 'a.pdf', placement: { kind: 'new', label: '메인비즈 확인서', sure: true, reason: '', issuedAt: null }, move: true, why: '' } as never], { withDoc: withDocument, withoutCustom: withoutCustomDocument })
  const movedKey = moved.record.customDocuments.find((d) => d.label === '메인비즈 확인서')?.key
  check('D-181 다시 분류: 옮긴 칸에 유효기간 끝이 따라감', !!movedKey && moved.record.documents[movedKey]?.validUntil === '2026-11-01', JSON.stringify({ moved: moved.moved, labels: moved.record.customDocuments.map((d) => d.label), docs: Object.entries(moved.record.documents).filter(([k]) => k.startsWith('customdoc')) }))

  // 중소기업 확인서 → 기업 규모
  check('D-181 규모: 구분 · 기업규모 · 제목', smeSizeOf(sme) === '소기업(소상공인)' && smeSizeOf('중소기업 확인서\n기업규모 : 중기업') === '중기업' && smeSizeOf('중소기업(소상공인) 확인서\n기업명 : 가') === '소상공인' && smeSizeOf('구분 : 소기업') === '소기업')
  check('D-181 규모: 적혀 있지 않거나 "중소기업" 만 있으면 비운다(짐작하지 않음)', smeSizeOf('중소기업 확인서\n구분 : 중소기업') === '' && smeSizeOf('중소기업 확인서') === '')
  const cert = parseCertificateDocument(sme)
  check('D-181 규모: 확인서 읽기 → 회사 정보 칸 글 맨 앞에 규모', cert?.size === '소기업(소상공인)' && certificateValue(cert).startsWith('소기업(소상공인) · ') && certificateValue(cert).includes('2027-03-31까지'), cert ? certificateValue(cert) : 'null')
  check('D-181 규모: 다른 인증서에는 규모가 붙지 않음', parseCertificateDocument(venture)?.size === undefined)

  // 대표 생년월일 — 등기부(앞 6자리 날짜만) → 업로드 흐름 후보
  const reg = ['법인등기부등본', '상호 한솔테크 주식회사', '등록번호 110111-1234567', '대표이사 김대표 801231-1******', '회사성립연월일 2019년 03월 02일'].join('\n')
  const found = factCandidatesFromDocText('corporateRegistry', reg, 'doc:x')
  const birth = found.find((c) => c.key === 'representativeBirth')
  check('D-181 대표 생년월일: 등기부 → 후보 1980-12-31 · 주민등록번호 뒷자리는 어디에도 없음', birth?.value === '1980-12-31' && !JSON.stringify(found).includes('1******') && !JSON.stringify(found).includes('801231-1'), JSON.stringify(birth))
  const af = autoFillFromDocs(normalizeClientOps({ id: 'b1', companyName: '한솔테크(주)' }), [{ key: 'corporateRegistry', fileName: '등기부.pdf', text: reg, method: 'pdf_text', docSure: true }], '2026-10-11T00:00:00.000Z', (() => { let n = 0; return () => `bf${(n += 1)}` })())
  check('D-181 대표 생년월일: 확실한 등기부(PDF 글자)면 바로 입력', af.record.representativeBirth === '1980-12-31' && af.entered.some((e) => e.key === 'representativeBirth'), JSON.stringify({ rb: af.record.representativeBirth, entered: af.entered.map((e) => e.key), flagged: af.flagged.map((f) => `${f.key}:${f.note}`) }))
}

// D-183: '확인할 것' 한 곳 — 올리기 기록 · 바로 넣은 값 최종 확인 · 서류함 정리(기타 칸 · 겹친 서류)
{
  const T = '2026-10-12'
  const NOW = '2026-10-12T03:00:00.000Z'
  // 1) 올리기 기록 — 모양 · 최근 5번 · 이상한 값 버림
  const junk = normalizeClientOps({ id: 'u0', companyName: '기록상사', docUploads: [{ id: 'up1', at: NOW, files: 2, placed: [{ fileName: 'a.pdf', label: '사업자등록증', other: false, numbered: false }, 'x'], entered: [{ key: 'businessNumber', label: '사업자등록번호', display: '123-45-67890', value: '1234567890', fileName: 'a.pdf' }], flagged: [], warnings: ['w'] }, { at: NOW }, 'bad'] } as never)
  check('D-183 올리기 기록: 모양이 맞는 것만 남김(이상한 줄 · id 없는 기록 버림)', junk.docUploads?.length === 1 && junk.docUploads[0].placed.length === 1 && junk.docUploads[0].entered[0].value === '1234567890', JSON.stringify(junk.docUploads))
  let many = normalizeClientOps({ id: 'u1', companyName: '많이상사' })
  for (let i = 1; i <= 7; i += 1) many = withDocUploadLog(many, { id: `up${i}`, at: NOW, files: i, placed: [], entered: [], flagged: [], warnings: [] })
  check('D-183 올리기 기록: 최근 5번만 · 새것이 맨 앞', many.docUploads?.length === 5 && many.docUploads[0].id === 'up7' && many.docUploads[4].id === 'up3')
  check('D-183 올리기 기록: 저장했다 다시 읽어도 그대로', JSON.stringify(normalizeClientOps(JSON.parse(JSON.stringify(many))).docUploads) === JSON.stringify(many.docUploads))

  // 2) 바로 넣은 값 → 확인할 것 '바로 넣은 값 N개 — 맞나요?'
  const base = normalizeClientOps({ id: 'af1', companyName: '한솔테크(주)', status: 'active' })
  const filled = withFactValue(withFactValue(withFactValue(base, 'businessNumber', '1248100998', { source: 'businessRegistration', status: 'confirmed', now: NOW }), 'establishedAt', '2019-03-02', { source: 'businessRegistration', status: 'confirmed', now: NOW }), 'businessCategory', '제조업', { source: 'businessRegistration', status: 'confirmed', now: NOW })
  const summary = { files: 1, entered: [{ key: 'businessNumber', label: '사업자등록번호', display: '124-81-00998', fileName: '사업자등록증.pdf' }, { key: 'establishedAt', label: '설립일', display: '2019-03-02', fileName: '사업자등록증.pdf' }, { key: 'businessCategory', label: '업태', display: '제조업', fileName: '사업자등록증.pdf' }], flagged: [], cretop: null, roster: null, warnings: [], at: NOW, placed: [{ fileName: '사업자등록증.pdf', label: '사업자등록증', other: false, numbered: false }] }
  const log = docUploadLogOf(filled, summary, 'upA')
  check('D-183 올리기 기록: 바로 넣은 값은 저장된 값 그대로도 남긴다(번호는 숫자만)', log.entered[0].value === '1248100998' && log.entered[1].value === '2019-03-02', JSON.stringify(log.entered))
  check('D-183 올리기 기록 → 화면 모양(맞춤 추천 지난 올리기)', batchOfLog(log).files === 1 && batchOfLog(log).placed?.[0].label === '사업자등록증')
  const rec = withDocUploadLog(filled, log)
  const ds = buildDecisions(rec, T, [])
  const af = ds.find((d) => d.kind === 'autofill')
  check('D-183 바로 넣은 값: 중요한 값만(사업자번호 · 설립일) — 업태는 묻지 않음', !!af && af.title.startsWith('서류에서 읽어 바로 넣은 값 2개') && af.rows?.length === 2 && !af.rows.some((r) => r.label === '업태'), JSON.stringify(af?.rows))
  check('D-183 중요한 값: 신청에 쓰는 사실 + 대표 생년월일', isImportantFactKey('businessNumber') && isImportantFactKey('representativeBirth') && isImportantFactKey('revenue') && !isImportantFactKey('businessCategory') && !isImportantFactKey('netIncome'))
  const yes = withDecisionAnswer(rec, af!, 'yes', [], NOW)
  check('D-183 [모두 맞아요] → 값 그대로 · 다시 안 물음', yes.businessNumber === '1248100998' && yes.establishedAt === '2019-03-02' && !buildDecisions(yes, T, []).some((d) => d.kind === 'autofill'))
  const no = withDecisionAnswer(rec, af!, 'no', [], NOW)
  const pend = pendingFacts(no)
  check('D-183 [하나씩 다시 볼게요] → 두 값을 비우고 확인 후보로(까닭 · 출처 그대로)', no.businessNumber === '' && no.establishedAt === '' && no.businessCategory === '제조업' && pend.filter((p) => p.note === NOTE_RECHECK).map((p) => p.key).sort().join() === 'businessNumber,establishedAt' && pend.every((p) => p.source === 'businessRegistration'), JSON.stringify(pend.map((p) => [p.key, p.value, p.note, p.source])))
  const nds = buildDecisions(no, T, [])
  check('D-183 다시 확인 → 확인할 것에 하나씩 "맞나요?"(바로 넣은 값 줄은 사라짐)', nds.filter((d) => d.kind === 'fact').length === 2 && !nds.some((d) => d.kind === 'autofill'), nds.map((d) => `${d.kind}:${d.title}`).join(' | '))
  const back = undoDecision(no, rec, no, af!.id)
  check('D-183 [하나씩 다시 볼게요] 되돌리기 → 값 · 후보 원래대로', back.businessNumber === '1248100998' && back.establishedAt === '2019-03-02' && pendingFacts(back).length === 0)
  const changed = withFactValue(rec, 'establishedAt', '2019-04-01', { now: NOW })
  const afc = buildDecisions(changed, T, []).find((d) => d.kind === 'autofill')
  check('D-183 그 사이 사람이 고친 값은 묻지도 · 되돌리지도 않음', afc?.rows?.length === 1 && afc.rows[0].label === '사업자등록번호' && withRecheckFacts(changed, [{ key: 'establishedAt', value: '2019-03-02' }], 'x', NOW).establishedAt === '2019-04-01', JSON.stringify(afc?.rows))

  // 3) 서류함 — 기타 칸 파일을 파일 이름으로 옮기기
  const otherLabel = `${OTHER_DOC_LABEL} · 사업자등록증_한솔`
  let shelfRec = withCustomDocument(normalizeClientOps({ id: 'sh1', companyName: '서류상사', status: 'active' }), { label: otherLabel, validMonths: null })
  const otherKey = shelfRec.customDocuments[shelfRec.customDocuments.length - 1].key
  shelfRec = withDocument(shelfRec, otherKey, { received: true, fileName: '사업자등록증_한솔.pdf', fileSize: 1000, storagePath: 'ws/sh1/a.pdf' })
  const sug = otherCellSuggestion(shelfRec, otherKey)
  check('D-183 기타 칸: 파일 이름이 "사업자등록증" → 사업자등록증 칸 제안', sug?.value === 'key:businessRegistration', JSON.stringify(sug))
  const mv = buildDecisions(shelfRec, T, []).find((d) => d.kind === 'shelf')
  check('D-183 기타 칸 → 확인할 것 "\'사업자등록증_한솔.pdf\' — \'사업자등록증\' 칸으로 옮길까요?"', !!mv && mv.title.includes('사업자등록증_한솔.pdf') && mv.effect.type === 'shelf-move' && !mv.choices, mv?.title)
  const moved = withDecisionAnswer(shelfRec, mv!, 'yes', [], NOW)
  check('D-183 [옮기기] → 사업자등록증 칸에 그 파일 · 기타 칸은 없어짐 · 보관 경로 그대로', moved.documents.businessRegistration?.fileName === '사업자등록증_한솔.pdf' && moved.documents.businessRegistration?.storagePath === 'ws/sh1/a.pdf' && !moved.customDocuments.some((c) => c.key === otherKey))
  const mvBack = undoDecision(moved, shelfRec, moved, mv!.id)
  check('D-183 옮기기 되돌리기 → 기타 칸 그대로', mvBack.customDocuments.some((c) => c.key === otherKey) && !mvBack.documents.businessRegistration?.fileName)
  // 이름으로 모르는 파일 → 고르기
  let pickRec = withCustomDocument(normalizeClientOps({ id: 'sh2', companyName: '고르기상사', status: 'active' }), { label: `${OTHER_DOC_LABEL} · scan`, validMonths: null })
  const pickKey = pickRec.customDocuments[pickRec.customDocuments.length - 1].key
  pickRec = withDocument(pickRec, pickKey, { received: true, fileName: 'scan_0012.pdf', fileSize: 10, storagePath: 'ws/sh2/s.pdf' })
  const pk = buildDecisions(pickRec, T, []).find((d) => d.kind === 'shelf')
  check('D-183 이름으로 모르는 파일 → "무슨 서류인가요?" + 고를 칸 목록', !!pk && pk.title.includes('무슨 서류인가요') && (pk.choices?.length ?? 0) > 5 && !!pk.choices?.find((c) => c.value === 'key:corporateRegistry'), pk?.title)
  const picked = withDecisionAnswer(pickRec, { ...pk!, effect: { type: 'shelf-move', fromKey: pickKey, to: 'key:corporateRegistry' } }, 'yes', [], NOW)
  check('D-183 고른 칸(법인등기부등본)으로 옮김', picked.documents.corporateRegistry?.fileName === 'scan_0012.pdf' && !picked.customDocuments.some((c) => c.key === pickKey))
  const untouched = withDecisionAnswer(pickRec, pk!, 'yes', [], NOW)
  check('D-183 고르지 않고 누르면 아무것도 옮기지 않음', untouched.customDocuments.some((c) => c.key === pickKey))

  // 4) 겹친 서류 — 최신 것만(번호 없는 칸에), 나머지는 서류함에서만 빠짐
  let dup = normalizeClientOps({ id: 'dp1', companyName: '겹친상사', status: 'active' })
  dup = withDocument(dup, 'businessRegistration', { received: true, fileName: '사업자등록증_2023.pdf', fileSize: 1, storagePath: 'ws/dp1/old.pdf', issuedAt: '2023-01-05' })
  dup = withCustomDocument(dup, { label: '사업자등록증 (2)', validMonths: null })
  const k2 = dup.customDocuments[dup.customDocuments.length - 1].key
  dup = withDocument(dup, k2, { received: true, fileName: '사업자등록증_2026.pdf', fileSize: 2, storagePath: 'ws/dp1/new.pdf', issuedAt: '2026-09-01' })
  check('D-183 겹친 서류: 발급일이 늦은 것을 남긴다', newestOf(dup, ['businessRegistration', k2]) === k2)
  const dd = buildDecisions(dup, T, []).find((d) => d.kind === 'shelf')
  check('D-183 겹친 서류 → "사업자등록증 2개가 겹쳐 있어요 — 최신 것만 남길까요?" · 남길 파일 이름', !!dd && dd.title.startsWith('사업자등록증 2개가 겹쳐') && dd.why.includes('사업자등록증_2026.pdf') && dd.rows?.length === 2, dd?.title)
  const deduped = withDecisionAnswer(dup, dd!, 'yes', [], NOW)
  check('D-183 [최신 것만 남기기] → 사업자등록증 칸에 2026 파일 · (2) 칸 없어짐', deduped.documents.businessRegistration?.storagePath === 'ws/dp1/new.pdf' && deduped.documents.businessRegistration?.issuedAt === '2026-09-01' && !deduped.customDocuments.some((c) => c.key === k2))
  check('D-183 겹친 서류 정리 뒤 서류함에 겹친 것 0 · 다시 묻지 않음', docShelfSummary(deduped, T, new Set()).dupGroups.length === 0 && !buildDecisions(deduped, T, []).some((d) => d.kind === 'shelf'))
  const ddBack = undoDecision(deduped, dup, deduped, dd!.id)
  check('D-183 정리 되돌리기 → 두 칸 그대로', ddBack.documents.businessRegistration?.storagePath === 'ws/dp1/old.pdf' && ddBack.customDocuments.some((c) => c.key === k2))
  check('D-183 남길 것이 이미 번호 없는 칸이면 (2) 칸만 뺀다', withDedupedShelf(dup, ['businessRegistration', k2], 'businessRegistration').documents.businessRegistration?.storagePath === 'ws/dp1/old.pdf')
}

// D-187: 새 업체 등록 창 — 서류만 넣어도 업체명 · 대표자 · 사업자등록번호가 채워진다
{
  const BIZ = ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2023 년 01 월 10 일', '사업장 소재지 : 경기도 파주시 탄현면 평화로 3', '업태 : 제조업', '종목 : 바이오 시약'].join('\n')
  const REG = ['등기사항전부증명서(현재 유효사항)', '상 호 미래바이오랩', '등록번호 110111-1234567', '대표이사 이대표 801231-1******', '본 점 경기도 파주시 탄현면 평화로 3'].join('\n')
  const one = guessNewClientFromDocs([{ fileName: '사업자등록증.pdf', text: BIZ, method: 'pdf_text' }])
  check('D-187 사업자등록증 하나 → 업체명 · 대표자 · 사업자번호 채움(까닭 없음)', one.guess.companyName?.value === '미래바이오랩' && one.guess.contactName?.value === '이대표' && one.guess.businessNumber?.value === '124-81-00998' && !one.guess.companyName?.note && !one.guess.businessNumber?.note, JSON.stringify(one.guess))
  check('D-187 파일마다 무엇으로 읽었는지(사업자등록증 · 셋 찾음 · 칸 순서)', one.files[0]?.docLabel === '사업자등록증' && one.files[0]?.found.join() === 'companyName,contactName,businessNumber', JSON.stringify(one.files))
  check('D-187 휴대폰번호는 서류에서 채우지 않는다', !('contactPhone' in one.guess))
  const photo = guessNewClientFromDocs([{ fileName: '사업자.jpg', text: BIZ, method: 'ocr' }])
  check('D-187 사진(OCR) → 이름 · 대표자는 "한 번 봐 주세요", 검증 맞는 사업자번호는 그대로', photo.guess.companyName?.note === NOTE_FROM_PHOTO && photo.guess.contactName?.note === NOTE_FROM_PHOTO && photo.guess.businessNumber?.note === '')
  const badNo = guessNewClientFromDocs([{ fileName: 'a.pdf', text: BIZ.replace('124-81-00998', '124-81-00999'), method: 'pdf_text' }])
  check('D-187 검증 숫자가 틀린 사업자번호 → 채우되 "번호 검증이 맞지 않아요"', badNo.guess.businessNumber?.value === '124-81-00999' && badNo.guess.businessNumber?.note === NOTE_BIZNO_CHECK)
  const both = guessNewClientFromDocs([
    { fileName: '등기.pdf', text: REG, method: 'pdf_text' },
    { fileName: '사업자.jpg', text: BIZ, method: 'ocr' },
  ])
  check('D-187 사업자등록증이 등기보다 먼저(뒤에 넣어도)', both.guess.companyName?.fileName === '사업자.jpg', JSON.stringify(both.guess.companyName))
  check('D-187 두 서류가 같은 값이면 사진이어도 까닭 없음', both.guess.companyName?.note === '' && both.guess.contactName?.note === '', JSON.stringify(both.guess))
  const diff = guessNewClientFromDocs([
    { fileName: '사업자등록증.pdf', text: BIZ, method: 'pdf_text' },
    { fileName: '등기.pdf', text: REG.replace('미래바이오랩', '미래바이오'), method: 'pdf_text' },
  ])
  check('D-187 서류마다 이름이 다르면 사업자등록증 값 + "서류마다 달라요"', diff.guess.companyName?.value === '미래바이오랩' && diff.guess.companyName?.note === NOTE_DIFFERS)
  const cret = guessNewClientFromDocs([{ fileName: '크레탑.pdf', text: 'x'.repeat(900), method: 'pdf_text' }], [{ fileName: '크레탑.pdf', method: 'pdf_text', name: '한빛정밀', bizNo: '2148735291', ceo: '김한빛' }])
  check('D-187 크레탑 보고서 → 업체명 · 대표자 · 사업자번호(하이픈 넣어서)', cret.guess.companyName?.value === '한빛정밀' && cret.guess.contactName?.value === '김한빛' && cret.guess.businessNumber?.value === '214-87-35291' && cret.files[0]?.docLabel === '크레탑 보고서', JSON.stringify(cret.guess))
  const mixed = guessNewClientFromDocs([{ fileName: '사업자등록증.pdf', text: BIZ, method: 'pdf_text' }, { fileName: '크레탑.pdf', text: 'x'.repeat(900), method: 'pdf_text' }], [{ fileName: '크레탑.pdf', method: 'pdf_text', name: '미래바이오랩', bizNo: '124-81-00998', ceo: '이대표' }])
  check('D-187 사업자등록증 + 크레탑 같은 회사 → 사업자등록증 값 · 까닭 없음', mixed.guess.companyName?.fileName === '사업자등록증.pdf' && mixed.guess.businessNumber?.note === '')
  const memo = guessNewClientFromDocs([{ fileName: '메모.txt', text: '회의 메모 — 다음 주 화요일 다시 연락', method: 'text' }, { fileName: '빈.jpg', text: '', method: 'none' }])
  check('D-187 회사 정보가 없는 서류 → 아무 칸도 채우지 않음(서류함에는 넣음)', Object.keys(memo.guess).length === 0 && memo.files.length === 2)
  check('D-187 크레탑처럼 보이는 글(이름 · 글자 수)', looksLikeCretopForNewClient({ fileName: '크레탑_한빛.pdf', method: 'pdf_text', text: `기업종합보고서 ${'가'.repeat(900)}` }) && !looksLikeCretopForNewClient({ fileName: '사업자등록증.pdf', method: 'pdf_text', text: BIZ }))

  // 칸에 넣기 — 빈 칸만 · 사람이 적은 것은 덮지 않음 · 서류를 빼면 서류로 채운 것만 비움
  const blank = { companyName: '', contactName: '', contactPhone: '010-1234-5678', businessNumber: '' }
  const a1 = applyNewClientGuess(blank, one.guess, {})
  check('D-187 빈 칸 셋을 채우고 휴대폰은 그대로', a1.form.companyName === '미래바이오랩' && a1.form.contactName === '이대표' && a1.form.businessNumber === '124-81-00998' && a1.form.contactPhone === '010-1234-5678' && Object.keys(a1.filled).length === 3)
  const typed = { ...blank, companyName: '미래 바이오랩(주)' }
  const a2 = applyNewClientGuess(typed, one.guess, {})
  check('D-187 사람이 적은 이름이 같은 회사(띄어쓰기 · (주))면 그대로 두고 "서류에서" 표시', a2.form.companyName === '미래 바이오랩(주)' && a2.filled.companyName?.value === '미래 바이오랩(주)' && !a2.differs.companyName)
  const typed2 = { ...blank, companyName: '다른상사' }
  const a3 = applyNewClientGuess(typed2, one.guess, {})
  check('D-187 사람이 적은 값이 다르면 덮지 않고 "다름"', a3.form.companyName === '다른상사' && a3.differs.companyName?.value === '미래바이오랩')
  const a4 = applyNewClientGuess(a1.form, cret.guess, a1.filled)
  check('D-187 서류로 채운 그대로인 칸은 새 서류 값으로 바뀐다', a4.form.companyName === '한빛정밀')
  const a5 = applyNewClientGuess({ ...a1.form, contactName: '최담당' }, {}, a1.filled)
  check('D-187 서류를 빼면 서류로 채운 그대로인 칸만 비우고 고친 칸은 둔다', a5.form.companyName === '' && a5.form.businessNumber === '' && a5.form.contactName === '최담당' && a5.form.contactPhone === '010-1234-5678')

  const a6 = applyNewClientGuess({ ...blank, companyName: '' }, one.guess, {}, new Set(['companyName'] as const))
  check('D-187 사람이 지운 칸(손댄 칸)은 비어 있어도 저절로 채우지 않고 "다름" 으로만', a6.form.companyName === '' && a6.differs.companyName?.value === '미래바이오랩' && a6.form.businessNumber === '124-81-00998')
  const a7 = applyNewClientGuess(a1.form, {}, a1.filled, new Set(['businessNumber'] as const))
  check('D-187 서류를 빼도 손댄 칸은 비우지 않음', a7.form.businessNumber === '124-81-00998' && a7.form.companyName === '')

  // 넘기기 — 업체 id 앞으로 맡기고 한 번만 꺼낸다
  const f = new File(['x'], 'a.txt', { type: 'text/plain' })
  handDocsTo('new1', [{ file: f, text: 'x', method: 'text' }])
  handDocsTo('new1', [{ file: f }])
  handDocsTo('', [{ file: f }])
  handDocsTo('new2', [])
  check('D-187 넘기기: 같은 업체에 또 맡기면 뒤에 붙고 빈 것은 안 맡김', peekHandedDocs('new1').length === 2 && peekHandedDocs('').length === 0 && peekHandedDocs('new2').length === 0)
  const taken = takeHandedDocs('new1')
  check('D-187 넘기기: 한 번 꺼내면 다시 꺼내도 없음(두 번 올리지 않음)', taken.length === 2 && taken[0].text === 'x' && takeHandedDocs('new1').length === 0)
}

// D-190: 먼저 제안할 것 — 업체 상세 맨 위 3개 · 고객 관리 카드 추천 띠 · 추천 많은 순
{
  const mk = (key: string, tone: Insight['tone'], missing: string[] = []): Insight => ({ key, label: key, tone, headline: `${key} 판정`, detail: '', missing, openPath: `/tools/${key}`, openLabel: '열기', action: null })
  const list = [mk('a', 'good'), mk('b', 'maybe'), mk('c', 'done'), mk('d', 'maybe'), mk('e', 'need', ['명부', '크레탑']), mk('f', 'no'), mk('g', 'need', ['크레탑', '주주명부']), mk('h', 'good')]
  check('D-190 제안할 만한 것: 가능성 높음 · 검토해 볼 만함만(분석 있음 · 정보 더 필요 · 어려움은 아님)', isPick(mk('x', 'good')) && isPick(mk('x', 'maybe')) && !isPick(mk('x', 'done')) && !isPick(mk('x', 'need')) && !isPick(mk('x', 'no')))
  check('D-190 먼저 제안할 것: 많아야 3개 · 받은 순서 그대로', topPicks(list).map((i) => i.key).join() === 'a,b,d' && topPicks(list, 5).length === 4)
  check('D-190 먼저 제안할 것이 없으면 빈 목록', topPicks([mk('c', 'done'), mk('e', 'need')]).length === 0)
  check('D-190 아직 판정 못 한 모듈에 필요한 것 — 겹치지 않게 · 많아야 3개', missingForPicks(list).join() === '명부,크레탑,주주명부' && missingForPicks(list, 1).join() === '명부')
  check('D-190 추천 점수: 가능성 높음 2 · 검토해 볼 만함 1', recoScore([{ tone: 'good' }, { tone: 'maybe' }, { tone: 'good' }]) === 5 && recoScore([]) === 0)

  const T = '2026-10-13'
  const rec = normalizeClientOps({ id: 'reco1', companyName: '추천정밀', establishedAt: '2024-03-02', businessCategory: '제조업', businessItem: '정밀기계 부품', businessAddress: '경기도 화성시 동탄대로 1', representativeBirth: '1990-05-05', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const same = buildInsights(rec, T, [], (k) => k !== 'grants').filter(isPick).map((i) => i.label)
  const chips = cardRecoChips(rec, T, 3)
  check('D-190 카드 추천 띠: 맞는 지원사업 수가 있으면 맨 앞 "지원사업 3건"(가능성 높음)', chips[0]?.key === 'grants' && chips[0]?.label === '지원사업 3건' && chips[0]?.tone === 'good', JSON.stringify(chips))
  check('D-190 카드 추천 띠: 나머지는 맞춤 추천 판정과 같은 것(엔진 하나)', JSON.stringify(chips.slice(1).map((c) => c.label).sort()) === JSON.stringify([...same].sort()), JSON.stringify({ chips, same }))
  check('D-190 카드 추천 띠: 좋은 것 먼저', chips.every((c, i) => i === 0 || !(c.tone === 'good' && chips[i - 1].tone === 'maybe')))
  check('D-190 카드 추천 띠: 맞는 공고 0건이면 지원사업 칩 없음 · 요금제에 없으면 없음', !cardRecoChips(rec, T, 0).some((c) => c.key === 'grants') && !cardRecoChips(rec, T, 3, (k) => k !== 'grants').some((c) => c.key === 'grants'))
  check('D-190 카드 추천 띠: 판정 칩은 가능성 높음 · 검토해 볼 만함만', chips.every((c) => c.tone === 'good' || c.tone === 'maybe'))
  const empty = normalizeClientOps({ id: 'reco0', companyName: '빈업체', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  check('D-190 정보가 없으면 짐작해서 추천하지 않음(칩 0)', cardRecoChips(empty, T, 0).length === 0, JSON.stringify(cardRecoChips(empty, T, 0)))

  const a1 = { ...rec, id: 's1', companyName: '가나' }
  const a2 = { ...rec, id: 's2', companyName: '다라' }
  const a3 = { ...rec, id: 's3', companyName: '마바', status: 'completed' as const }
  const a4 = { ...rec, id: 's4', companyName: '사아' }
  const scores = new Map([['s1', 1], ['s2', 5], ['s3', 9], ['s4', 3]])
  check('D-190 추천 많은 순: 점수 높은 곳 위로 · 계약 끝난 곳은 점수가 높아도 맨 뒤', sortClients([a1, a2, a3, a4], 'reco', T, scores).map((r) => r.id).join() === 's2,s4,s1,s3')
  check('D-190 추천 많은 순: 점수를 아직 모르면 0점으로(멈추지 않음)', sortClients([a1, a2], 'reco', T).length === 2)
}

// D-191: 추천에 금액(엔진이 계산한 것만) · 빠진 자료 → 고객 요청 문구
{
  check('D-191 금액 글: 만원 · 억원 · 0이면 빈 글', manwonText(14_400_000) === '1,440만원' && manwonText(120_000_000) === '1.2억원' && manwonText(0) === '')
  const T = '2026-10-13'
  const base = normalizeClientOps({ id: 'amt1', companyName: '금액정밀', establishedAt: '2024-03-02', businessCategory: '제조업', businessAddress: '경기도 화성시 동탄대로 1', contactName: '박대표', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const roster = (data: Record<string, unknown>, summary: string) => ({ id: 'tr-emp', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'candidates', verdictLabel: '후보 지원금 2건 · 확인 항목 1', summary, data: { tab: 'roster', ...data }, deadlines: [], createdAt: '2026-10-10T00:00:00.000Z', publishedUpdateId: null })
  const withRoster = normalizeClientOps({ ...base, toolResults: [roster({ subsidyTotal: 14_400_000 }, '[4대보험 명부 진단] 8명')] } as never)
  const emp = buildInsights(withRoster, T, []).find((i) => i.key === 'employment')
  check('D-191 고용지원금: 명부 진단이 계산한 최대 지원금 → "최대 1,440만원 검토(1차 추정)"', emp?.tone === 'good' && emp?.amount === '최대 1,440만원 검토(1차 추정)', JSON.stringify(emp))
  const oldRoster = normalizeClientOps({ ...base, toolResults: [roster({}, '[4대보험 명부 진단] 8명\n조건 충족 시 최대 720만원 검토 가능성(1차 추정)')] } as never)
  check('D-191 고용지원금: 옛 결과(금액 칸 없음)는 요약 글의 "최대 n만원"', buildInsights(oldRoster, T, []).find((i) => i.key === 'employment')?.amount === '최대 720만원 검토(1차 추정)')
  const noAmt = normalizeClientOps({ ...base, toolResults: [roster({}, '[4대보험 명부 진단] 8명')] } as never)
  check('D-191 고용지원금: 금액을 모르면 짐작하지 않음(없음)', buildInsights(noAmt, T, []).find((i) => i.key === 'employment')?.amount === undefined)
  const lab = normalizeClientOps({ ...base, toolResults: [{ id: 'tr-lab', toolKey: 'labcare', title: '세액공제 예상', verdict: null, verdictLabel: '연간 약 2,500만원', summary: '연구개발비 1억', data: { kind: 'tax', estimate: { annual: 25_000_000 } }, deadlines: [], createdAt: '2026-10-10T00:00:00.000Z', publishedUpdateId: null }] } as never)
  check('D-191 연구소: 세액공제 계산이 붙어 있으면 "세액공제 연간 약 2,500만원"', buildInsights(lab, T, []).find((i) => i.key === 'labcare')?.amount === '세액공제 연간 약 2,500만원')
  check('D-191 정책자금 · 창업감면 · 절세는 금액을 지어내지 않음', buildInsights(withRoster, T, []).filter((i) => ['policy-funding', 'startup-tax', 'tax'].includes(i.key)).every((i) => i.amount === undefined))

  const mk = (key: string, label: string, tone: Insight['tone'], missing: string[]): Insight => ({ key, label, tone, headline: '', detail: '', missing, openPath: '', openLabel: '', action: null })
  const ins = [mk('employment', '고용지원금', 'need', ['4대보험 가입자 명부']), mk('cretop', '크레탑', 'need', ['크레탑 기업종합보고서']), mk('tax', '절세 설계', 'need', ['주주명부', '대표 급여']), mk('policy-funding', '정책자금', 'need', ['설립일', '업종']), mk('startup-tax', '창업감면', 'need', ['설립일(창업일)', '대표 생년월일']), mk('grants', '지원사업', 'good', ['직원 수'])]
  const r = requestItemsFrom(ins)
  check('D-191 요청 자료: 크레탑은 우리가 조회 — 고객 요청에서 빼고 따로', r.ours.join() === '크레탑 기업종합보고서' && !r.items.some((x) => /크레탑/.test(x.label)))
  const reg = r.items.find((x) => x.label === '사업자등록증 사본')
  check('D-191 요청 자료: 설립일 · 업종 · 창업일은 사업자등록증 하나로 묶고 어느 모듈 때문인지', !!reg && reg.for.join() === '정책자금,창업감면' && r.items.filter((x) => x.label === '사업자등록증 사본').length === 1, JSON.stringify(r.items))
  check('D-191 요청 자료: 판정이 이미 나온 모듈(지원사업)의 항목은 받지 않음', !r.items.some((x) => x.for.includes('지원사업')))
  const msg = recoRequestMessage(base, ins)
  check('D-191 요청 문구: 대표님 · 회사 이름 · 번호 · 어디서 떼는지 · 무엇 확인용', msg.startsWith('안녕하세요, 박대표 대표님.') && msg.includes('금액정밀에 맞는 지원 제도') && /1\. 4대보험 사업장 가입자 명부 — 고용지원금 확인용/.test(msg) && msg.includes('4insure.or.kr') && msg.includes('홈택스'), msg)
  check('D-191 요청 문구: 주민등록번호를 달라고 하지 않음 · 크레탑 없음', !/주민등록번호를 (보내|알려)/.test(msg) && msg.includes('주민등록번호는 받지 않습니다') && !msg.includes('크레탑'))
  const cert = requestItemsFrom([mk('cert-os', '기업인증', 'need', ['연구조직', '연구개발비', '매출 · 재무', '특허 등록 여부'])]).items
  check('D-191 기업인증 빠진 항목도 고객이 알아듣는 서류 이름 · 어디서(연구소 인정서 · 연구개발비 · 재무제표 · 특허)', cert.map((x) => x.label).join() === '연구소(전담부서) 인정서,연구개발비 · 하고 있는 연구 내용,최근 재무제표(표준재무제표증명),특허 · 상표 등록 현황' && cert.every((x) => x.where !== ''), JSON.stringify(cert))
  check('D-191 받을 것이 없으면 빈 문구(단추 없음)', recoRequestMessage(base, [mk('grants', '지원사업', 'good', [])]) === '')
}

/* D-192 목차 설명 사전 — 목차 이름(숫자가 붙어도)으로 찾는다 */
{
  check('D-192 목차 설명: 이름 그대로 찾는다', (hintFor('맞는 지원사업') ?? '').includes('공고'))
  check('D-192 목차 설명: 꼬리가 붙어도(— 맞나요? · 숫자) 앞부분으로 찾는다', hintFor('프로그램이 준비했어요 — 맞나요?') === hintFor('프로그램이 준비했어요') && !!hintFor('안부 챙길 계약 고객 3'))
  check('D-192 목차 설명: 모르는 목차 · 빈 글자는 설명 없음', hintFor('없는 목차') === undefined && hintFor('') === undefined && hintFor(undefined) === undefined)
  check("D-192 목차 설명: '회사 기본 정보' 는 '조각마다 따로 복사' 를 말한다", (hintFor('회사 기본 정보') ?? '').includes('조각마다'))
  check('D-192 목차 설명: 사전이 비어 있지 않고 설명마다 두 줄 안(110자 이하)', SECTION_HINT_COUNT >= 60 && SECTION_HINT_KEYS.every((k) => (hintFor(k) ?? '').length <= 110), String(SECTION_HINT_COUNT))
}

/* ---------------- D-204 서류함 폴더로 보기 ---------------- */
{
  check('D-204 경로 → 폴더: 파일 이름 빼기 · 시스템 폴더(__MACOSX · 숨김) 빼기 · 깊이 6 · 칸마다 40자', folderOfPath('비원미래/정관 개정_260410/정관.pdf') === '비원미래/정관 개정_260410' && folderOfPath('정관.pdf') === '' && folderOfPath('a/__MACOSX/.git/b/x.pdf') === 'a/b' && folderOfPath('1/2/3/4/5/6/7/8/x.pdf') === '1/2/3/4/5/6' && folderOfPath(`${'가'.repeat(50)}/x.pdf`).length === 40)
  check('D-204 파일 하나(폴더 아님) → 경로 없음', relativePathOf(new File(['x'], '사업자등록증.pdf')) === '')
  let r = normalizeClientOps({ id: 'fd', companyName: '비원미래' } as Partial<ClientOpsRecord>)
  r = withDocument(r, 'businessRegistration', { received: true, fileName: '사업자등록증.pdf', fileSize: 10, storagePath: 'w/fd/b/1.pdf', folderPath: '비원미래' })
  r = withDocument(r, 'corporateRegistry', { received: true, fileName: '법인등기부등본 캡쳐.png', fileSize: 10, storagePath: 'w/fd/c/2.png', folderPath: '비원미래/정관 개정_260410' })
  r = withDocument(r, 'financialStatements', { received: true, fileName: '2025년 재무제표.pdf', fileSize: 10, storagePath: 'w/fd/f/3.pdf', folderPath: '비원미래/재무' })
  r = withDocument(r, 'payrollRoster', { received: true, fileName: '4대보험 명부.xlsx', fileSize: 10, storagePath: 'w/fd/p/4.xlsx' })
  r = withDocument(r, 'smeCertificate', { received: true, issuedAt: '2026-01-01' })
  const tree = docFolderTree(normalizeClientOps(JSON.parse(JSON.stringify(r))))
  check('D-204 폴더 나무 — 맨 위: 폴더 1(비원미래) + 폴더 없이 올린 파일 1 · 파일 없는 칸은 안 나옴 · 전체 4', tree.folders.map((f) => f.name).join() === '비원미래' && tree.files.map((f) => f.fileName).join() === '4대보험 명부.xlsx' && tree.total === 4, tree)
  const b = folderAt(tree, '비원미래')
  check('D-204 비원미래 안 — 하위 폴더 2(이름 순: 재무 · 정관…) · 파일 1 · 아래 파일 3', b?.folders.map((f) => f.name).join('|') === '재무|정관 개정_260410' && b?.files.length === 1 && b?.total === 3, b)
  check('D-204 폴더 경로로 찾기 · 없는 폴더는 null · 빵 부스러기', folderAt(tree, '비원미래/재무')?.files[0]?.label === allDocumentMetas(r).find((m) => m.key === 'financialStatements')?.label && folderAt(tree, '없음') === null && crumbsOf('비원미래/재무').map((c) => c.name).join('>') === '서류함>비원미래>재무')
  check('D-204 파일 종류 — PDF · 사진 · 엑셀 · 한글 · 워드 · 압축 · 모름', ['a.PDF', 'b.jpeg', 'c.xlsx', 'd.hwp', 'e.docx', 'f.zip', 'g.xyz'].map(fileKindOf).join() === 'pdf,image,excel,hwp,word,zip,other')
  // 칸을 옮겨도(다시 분류) 폴더 경로가 따라감 · 파일을 지우면 경로도 지워짐
  const moved = moveDocTo(r, 'corporateRegistry', 'new:정관')
  const toKey = moved ? Object.entries(moved.record.documents).find(([, v]) => v?.fileName === '법인등기부등본 캡쳐.png')?.[0] : undefined
  check('D-204 다른 칸으로 옮겨도 폴더 경로가 파일을 따라감', !!toKey && moved?.record.documents[toKey as never]?.folderPath === '비원미래/정관 개정_260410', toKey)
  const gone = withoutDocumentFile(r, 'financialStatements', { withDoc: withDocument, withoutCustom: withoutCustomDocument })
  check('D-204 파일을 빼면 폴더 경로도 지워져 폴더 보기에서 빠짐', (gone.documents.financialStatements.folderPath ?? '') === '' && !folderAt(docFolderTree(gone), '비원미래/재무'))
}

/* ---------------- D-209 서류함 안정화(점검 결과) ---------------- */
{
  const ops = { withDoc: withDocument, withoutCustom: withoutCustomDocument }
  const fc = (id: string, ref: string) => ({ id, key: 'businessNumber', value: '111-22-33333', source: 'businessRegistration', asOf: '', ref, foundAt: '' }) as never
  let r = normalizeClientOps({ id: 'd209', companyName: '안정정밀' } as Partial<ClientOpsRecord>)
  r = withDocument(r, 'businessRegistration', { received: true, fileName: '사업자등록증.pdf', fileSize: 10, storagePath: 'w/d/b/1.pdf' })
  const up1 = r.documents.businessRegistration.uploadedAt
  r = withDocument(r, 'businessRegistration', { note: '원본 확인함' })
  check('D209-1 올린 때(uploadedAt) — 메모를 고쳐도 그대로 · 저장했다 읽어도 남음', !!up1 && r.documents.businessRegistration.uploadedAt === up1 && normalizeClientOps(JSON.parse(JSON.stringify(r))).documents.businessRegistration.uploadedAt === up1, r.documents.businessRegistration)
  check('D209-2 폴더 보기 파일의 올린 때 = uploadedAt(고친 때가 아님)', docFolderTree(r).files[0]?.uploadedAt === up1)
  // 기본 칸의 번호 칸도 유효기간
  const r2 = withDocument(r, 'corporateRegistry', { received: true, fileName: '등기1.pdf', fileSize: 1, storagePath: 'w/d/c/1.pdf' })
  const cell = cellForPlacement(r2, { kind: 'existing', key: 'corporateRegistry', label: '법인등기부등본', sure: true, reason: '', issuedAt: null }, new Set())
  const nm = allDocumentMetas(cell.record).find((m) => m.key === cell.key)
  check('D209-3 "법인등기부등본 (2)" 칸도 기본 칸처럼 유효기간 3개월(만료 알림이 걸림)', cell.numbered && nm?.validMonths === 3, { label: nm?.label, vm: nm?.validMonths })
  // 직접 만든 칸 이름만 고치면 유효기간 그대로
  let r3 = withCustomDocument(r, { label: '법인인감증명서', validMonths: 3 })
  const cd = r3.customDocuments[r3.customDocuments.length - 1]
  r3 = withCustomDocument(r3, { id: cd.id, label: '법인 인감증명서' })
  check('D209-4 직접 만든 칸 이름만 고치면 유효기간 3개월 그대로(예전: 비워짐)', r3.customDocuments.find((d) => d.id === cd.id)?.validMonths === 3 && r3.customDocuments.find((d) => d.id === cd.id)?.label === '법인 인감증명서')
  // 파일을 빼면 유효기간 끝 · 올린 때 · 그 파일의 확인할 정보도
  let r4 = withDocument(r, 'smeCertificate', { received: true, fileName: 'sme.pdf', fileSize: 1, storagePath: 'w/d/s/1.pdf', validUntil: '2027-03-31', issuedAt: '2026-04-01' })
  r4 = { ...r4, factInbox: [fc('f1', 'doc:smeCertificate:2026-10-16T00:00:00.000Z:0'), fc('f2', 'doc:businessRegistration:2026-10-16T00:00:00.000Z:0'), fc('f3', 'cretop:abc:businessNumber')] }
  const g = withoutDocumentFile(r4, 'smeCertificate', ops)
  check('D209-5 파일을 빼면 유효기간 끝 · 올린 때도 지움 · 그 파일에서 읽은 "확인할 정보" 만 빠짐', g.documents.smeCertificate.validUntil === undefined && g.documents.smeCertificate.uploadedAt === undefined && g.factInbox.map((c) => c.id).join() === 'f2,f3', g.factInbox.map((c) => c.id))
  const re = withDocument(g, 'smeCertificate', { received: true, fileName: 'sme2.pdf', fileSize: 1, storagePath: 'w/d/s/2.pdf' })
  check('D209-6 그 칸에 다시 올려도 옛 만료일을 물려받지 않음', re.documents.smeCertificate.validUntil === undefined && !!re.documents.smeCertificate.uploadedAt)
  const sw = withFactRefs(r4, { smeCertificate: 'businessRegistration', businessRegistration: 'smeCertificate' })
  check('D209-7 두 칸을 서로 바꿔도 "확인할 정보" 출처가 섞이지 않음 · 크레탑 것은 그대로', sw.factInbox.find((c) => c.id === 'f1')?.ref.startsWith('doc:businessRegistration:') === true && sw.factInbox.find((c) => c.id === 'f2')?.ref.startsWith('doc:smeCertificate:') === true && sw.factInbox.find((c) => c.id === 'f3')?.ref === 'cretop:abc:businessNumber')
  // 최신 것만 남기기 — 발급일을 한쪽만 알면 늦게 올린 파일
  let r5 = normalizeClientOps({ id: 'n209', companyName: '겹침상사' } as Partial<ClientOpsRecord>)
  r5 = withDocument(r5, 'businessRegistration', { received: true, fileName: 'old.pdf', fileSize: 1, storagePath: 'w/n/o.pdf', issuedAt: '2025-01-01', uploadedAt: '2026-01-01T00:00:00.000Z' })
  const c2 = cellForPlacement(r5, { kind: 'existing', key: 'businessRegistration', label: '사업자등록증', sure: true, reason: '', issuedAt: null }, new Set())
  r5 = withDocument(c2.record, c2.key, { received: true, fileName: 'new.pdf', fileSize: 1, storagePath: 'w/n/n.pdf', uploadedAt: '2026-10-01T00:00:00.000Z' })
  check('D209-8 "최신 것만 남기기" — 발급일을 한쪽만 알면 늦게 올린 파일을 남김(예전: 발급일 있는 옛 파일)', newestOf(r5, ['businessRegistration', c2.key]) === c2.key)
  r5 = { ...r5, factInbox: [fc('old', 'doc:businessRegistration:t:0'), fc('new', `doc:${c2.key}:t:0`)] }
  const dd = withDedupedShelf(r5, ['businessRegistration', c2.key], c2.key)
  check('D209-9 겹친 서류 정리 — 남긴 파일은 기본 칸 · 올린 때 그대로 · 그 파일의 확인할 정보는 기본 칸으로 · 뺀 옛 파일 것은 빠짐', dd.documents.businessRegistration.fileName === 'new.pdf' && dd.documents.businessRegistration.uploadedAt === '2026-10-01T00:00:00.000Z' && dd.factInbox.map((c) => `${c.id}@${c.ref.split(':')[1]}`).join() === 'new@businessRegistration', dd.factInbox)
  // 다시 분류(옮기기) — 올린 때 · 확인할 정보가 파일을 따라감
  const mv = moveDocTo({ ...r4, factInbox: [fc('m1', 'doc:smeCertificate:t:0')] }, 'smeCertificate', 'new:벤처기업확인서')
  const mvKey = mv ? Object.entries(mv.record.documents).find(([, v]) => v?.fileName === 'sme.pdf')?.[0] : undefined
  check('D209-10 다른 칸으로 옮기면 올린 때 · 확인할 정보도 따라감', !!mvKey && mv?.record.documents[mvKey as never]?.uploadedAt === r4.documents.smeCertificate.uploadedAt && mv?.record.factInbox[0]?.ref.startsWith(`doc:${mvKey}:`) === true, { mvKey, inbox: mv?.record.factInbox })
}

// D-210 — '확인할 것' 다시 묻는 날은 로컬 날짜로 · 업체 정보 수정 칸은 출처를 '직접 적음' 으로
{
  const prevTz = process.env.TZ
  process.env.TZ = 'Asia/Seoul'
  const base = normalizeClientOps({
    id: 'd210m',
    companyName: '돈받을상사',
    status: 'active',
    fees: [{ id: 'f1', serviceKey: null, kind: 'deposit', label: '계약금', amount: 1_000_000, agentFee: null, agentName: '', agentPaidAt: null, dueDate: '2026-10-01', receivedAt: null, note: '' }],
  } as never)
  const moneyId = buildDecisions(base, '2026-10-16', []).find((d) => d.kind === 'money')?.id ?? ''
  // 한국 10/16 오전 8:30 에 '나중에' — UTC 로는 10/15
  const answered = { ...base, decided: { [moneyId]: { a: 'no' as const, at: '2026-10-15T23:30:00.000Z' } } }
  const day13 = buildDecisions(answered, '2026-10-29', []).some((d) => d.id === moneyId)
  const day14 = buildDecisions(answered, '2026-10-30', []).some((d) => d.id === moneyId)
  check('D210-1 받을 돈 "나중에" — 한국 날짜로 14일 뒤에 다시 묻는다(하루 일찍 묻지 않음)', moneyId !== '' && !day13 && day14, `${moneyId} ${day13} ${day14}`)
  if (prevTz === undefined) delete process.env.TZ
  else process.env.TZ = prevTz

  const fromDoc = { ...normalizeClientOps({ id: 'd210f', companyName: '서류상사' } as never), businessNumber: '124-81-00998', factMeta: { businessNumber: { source: 'businessRegistration', status: 'confirmed', asOf: '', confirmedAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' } } } as ClientOpsRecord
  const typed = withProfileFieldTyped(fromDoc, 'businessNumber', '124-81-00999', '2026-10-16T01:00:00.000Z')
  check('D210-2 서류로 확인된 번호를 손으로 고치면 출처가 "직접 적음" 으로(확인됨이 남지 않음)', typed.businessNumber === '124-81-00999' && typed.factMeta?.businessNumber?.source === 'manual' && typed.factMeta?.businessNumber?.status === 'entered')
  const spaced = withProfileFieldTyped(fromDoc, 'businessAddress', '서울 강남구 ', '2026-10-16T01:00:00.000Z')
  check('D210-3 칠 때마다 저장해도 빈칸이 잘리지 않음(주소를 띄어 쓸 수 있음)', spaced.businessAddress === '서울 강남구 ')
  check('D210-4 같은 값이면 그대로(확인됨 유지)', withProfileFieldTyped(fromDoc, 'businessNumber', '124-81-00998', 'x') === fromDoc)
  const cleared = withProfileFieldTyped(fromDoc, 'businessNumber', '', 'x')
  check('D210-5 비우면 출처도 지움', cleared.businessNumber === '' && cleared.factMeta?.businessNumber === undefined)
  check('D210-6 사실이 아닌 칸(담당자 이름)은 값만', withProfileFieldTyped(fromDoc, 'contactName', '김 담당', 'x').contactName === '김 담당')

  // 예전 서류 읽기가 개인사업자의 주민등록번호를 법인등록번호 칸에 넣은 기록 — 묻고(번호는 안 보임) · [지우기] 면 칸과 후보를 함께 비움
  const rrnRec = { ...normalizeClientOps({ id: 'd210r', companyName: '가나상회' } as never), businessNumber: '123-45-67891', corporateNumber: '800101-1234567', factInbox: [{ id: 'fi1', key: 'corporateNumber', value: '800101-1234567', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:x:0', foundAt: '2026-10-01T00:00:00.000Z' }] } as ClientOpsRecord
  const rrnDs = buildDecisions(rrnRec, '2026-10-16', [])
  const ask = rrnDs.find((d) => d.effect.type === 'clear-corp-number')
  check('D210-7 개인사업자 + 법인등록번호 칸 13자리 → 지울지 묻는다(맨 위) · 번호는 화면 글에 없음', !!ask && rrnDs[0] === ask && !`${ask.title}${ask.why}`.includes('1234567'), JSON.stringify(ask?.title))
  check('D210-8 같은 번호를 "맞나요?" 로 띄우지 않는다', !rrnDs.some((d) => d.effect.type === 'fact' && d.title.includes('800101')))
  const cleared2 = withDecisionAnswer(rrnRec, ask!, 'yes', [], '2026-10-16T01:00:00.000Z')
  check('D210-9 [지우기] → 칸 · 확인할 정보 후보 모두 비움 · 다시 묻지 않음', cleared2.corporateNumber === '' && !cleared2.factInbox.some((c) => c.key === 'corporateNumber') && !buildDecisions(cleared2, '2026-10-16', []).some((d) => d.effect.type === 'clear-corp-number'))
  const kept2 = withDecisionAnswer(rrnRec, ask!, 'no', [], '2026-10-16T01:00:00.000Z')
  check('D210-10 [법인번호가 맞아요] → 그대로 · 다시 묻지 않음(30일 뒤에도)', kept2.corporateNumber === '800101-1234567' && !buildDecisions(kept2, '2026-11-20', []).some((d) => d.effect.type === 'clear-corp-number'))
  const corpRec = { ...rrnRec, businessNumber: '124-81-00998', corporateNumber: '110111-0085450', factInbox: [] } as ClientOpsRecord
  check('D210-11 법인 사업자번호면 묻지 않는다', !buildDecisions(corpRec, '2026-10-16', []).some((d) => d.effect.type === 'clear-corp-number'))
  const namedCorp = { ...rrnRec, companyName: '한솔테크(주)', corporateNumber: '134511-0022334', factInbox: [] } as ClientOpsRecord
  check('D210-12 사업자번호를 잘못 적은 법인((주) 이름)은 묻지 않는다(헛경보 없음)', !buildDecisions(namedCorp, '2026-10-16', []).some((d) => d.effect.type === 'clear-corp-number'))
  const validCorpNo = { ...rrnRec, corporateNumber: '110111-0085450', factInbox: [] } as ClientOpsRecord
  check('D210-13 법인번호 검증 숫자가 맞는 번호는 묻지 않는다', !buildDecisions(validCorpNo, '2026-10-16', []).some((d) => d.effect.type === 'clear-corp-number'))
}

console.log(`\ncustomer-facts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
