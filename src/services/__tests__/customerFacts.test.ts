/**
 * 고객 사실 창고 시험 (D-128) — 자료는 한 번, 확인은 최소, 고객 정보는 하나, 모듈은 다시 쓴다.
 *  - 사실의 자리: 업체 칸이 있으면 그 칸, 없으면 factValues 한 곳(복제 없음)
 *  - 출처 · 상태: 예전 값은 '적어 둠', 자료에서 확인하면 '확인됨', 예상은 '예상값'
 *  - 자료 → 후보: 크레탑 결과 · 받아 둔 후보는 확인 전에는 사실이 아니다(모듈도 안 쓴다)
 *  - 모두 확인 · 틀린 것만 고치기 · 틀림(다시 안 묻기) · 나중에(그대로 남음)
 *  - 모듈 어댑터(clientFacts)가 후보를 쓰지 않는다 · 예상값은 표시된다
 * 실행: npm run test:facts
 */

import { mergeHeadcountTrend, readWithholdingReport, withholdingValue, yearOverYear } from '../withholdingReport'
import { fullYearFromReturns, mergeVatTrend, readVatReturn, vatReturnValue, vatYearOverYear, vatYoyText } from '../vatReturnDoc'
import { readSiteReport } from '../siteReportDoc'
import { normalizeClientOps, withCustomDocument, withDocument, withDocUploadLog, withoutCustomDocument } from '../clientOpsService'
import { buildDecisions, undoDecision, withDecisionAnswer, isImportantFactKey } from '../decisions'
import { docUploadLogOf, batchOfLog, analyzeUploadedDocs } from '../docAutoAnalyze'
import { newestOf, otherCellSuggestion, withDedupedShelf } from '../docShelf'
import { NOTE_RECHECK, sameAddress, customFactValue, researchLabOf, withProfileFieldTyped, withRecheckFacts } from '../customerFacts'
import { fitContext } from '../scenarioFit'
import { allDocumentMetas } from '../clientOpsDocuments'
import { OTHER_DOC_LABEL, documentTitle, findIssuedDate, findValidUntil, knownDocValidMonths, placeDocument, titleFromFileName } from '../docClassify'
import { smeSizeOf } from '../certDocParser'
import { documentStatus, documentsWithExpiry } from '../clientOpsAlerts'
import { docShelfSummary, dupShelfBases, filePortalDocument, isSystemFile, moveDocTo, moveTargets, shelfBaseOf, shelfCellOf } from '../docShelf'
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
import { clientFacts, ventureConfirmedAt, ventureValidOn } from '../../tools/shared/clientPrefill'
import { policyBonus, policyDocs, policyEvidence, policyHiring, policyRecordBonus } from '../policyEvidence'
import { continuingOf, looksLikeWorkRules, readRetireRule, retireRuleLine } from '../workRules'
import { ceoWageReceipt, looksLikePayrollLedger, looksLikeWageReceipt, monthlyPayOf, readLedgerCeoPay, readWageReceipts } from '../wageReceipt'
import { credentialsOf } from '../grants/grantProfile'
import { latestFullYear, looksLikeVatCert, readVatCert, sameMonthsLastYear, vatSummary, vatTrendOf } from '../vatDoc'
import { policyApplyAsk, policyApplyMessage } from '../policyApply'
import { requestFollowUpText } from '../recoRequest'
import { runDiagnosis } from '../../tools/policyFunding/diagnosis'
import { policyInputFromFacts } from '../../tools/policyFunding/clientInput'
import { certificateValue, parseCertificateDocument } from '../certDocParser'
import { readIncomeCert } from '../incomeDoc'
import { looksLikeTaxReturn, readTaxReturn, refundOpen, reliefFactValue, reliefYearsOf } from '../taxReturnDoc'
import { employmentRefund, labRefund, labYearOf, pastStartupRefund, reliefYears, startupRefund } from '../clientInsights'
import { officerTerms, officerTermsOf, officerTermsValue, readDirectorTermYears, readRegistryTax } from '../registryTax'
import { buildClientSchedule } from '../clientOpsSchedule'
import { creditBandOf, creditScoreValue, looksLikeCreditReport, lowestScoreOf, readCreditScore } from '../creditScoreDoc'
import { pagesLabel, splitBundle } from '../docBundle'
import { looksLikeIdCard, readIdCard } from '../idCardDoc'
import { factCandidatesFromDocText, withDocFacts } from '../docFacts'
import { isBizRegCertificate } from '../koreanDocParser'
import { previewKindOf } from '../../lib/filePreview'
import type { ClientOpsRecord } from '../../types/clientOps'
import { NOTE_CONFLICT, NOTE_OCR, autoFillFromDocs } from '../docAutoFill'
import { bizNoChecksumOk } from '../bizNoRead'
import { pdfItemsToText } from '../pdfTextLines'
import { filesFromDrop, folderOfPath, relativePathOf } from '../../lib/dropFiles'
import { crumbsOf, docFolderTree, fileKindOf, folderAt } from '../docFolders'
import { parseFinancialStatement } from '../finStatementParser'
import { readShareholderDoc } from '../shareholderDoc'
import { fixAmountNoise, joinSpacedHangul } from '../ocrNumbers'
import { looksLikeCretop, looksLikeRoster } from '../docAutoAnalyze'
import { buildInsights, cardRecoChips, insightChanges, isPick, missingForPicks, recoScore, recommendNextSteps, topPicks, type Insight } from '../clientInsights'
import { buildDiagnosis, customerText, diagnosisKakao, diagnosisNote, givenOf, sinceLines, withDiagnosisGiven } from '../clientDiagnosis'
import { sortClients } from '../clientOpsSort'
import { recoRequestMessage, requestItemsFrom } from '../recoRequest'
import { manwonText, policyDocsLine, smeConfirmed } from '../clientInsights'
import { loanPlan, retirePlan, salaryOrDividend, shareValueOf, viewProfile } from '../taxPlan'
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
  const biz = factCandidatesFromDocText('businessRegistration', '사업자등록증\n등록번호 : 214-88-01232\n상호 : 주식회사 대한정밀', 'doc:b')
  check('사업자등록증: 공통 사실 후보(번호 · 회사명)', biz.some((x) => x.key === 'businessNumber' && x.value === '214-88-01232') && biz.some((x) => x.key === 'companyName'))
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

  // D-352 맞춤 진단서 한 장 — 같은 판정 · 같은 순서 · 고객 말로
  const dg = buildDiagnosis(full, ins, '2026-10-02')
  check('D-352 진단서 — 먼저 제안할 것 = 맨 위 제안과 같은 모듈 · 같은 순서 · 나머지 모듈도 전부 한 줄 · 회사 한눈에(업종 · 설립)', dg.picks.map((p) => p.key).join() === topPicks(ins).map((p) => p.key).join() && dg.picks.length + dg.others.length === ins.length && dg.snapshot.some((x) => x.label === '설립') && dg.snapshot.some((x) => x.label === '업종'), JSON.stringify([dg.picks.map((p) => p.key), dg.snapshot]))
  const dgText = JSON.stringify(dg)
  check('D-352 고객에게 드리는 종이 — 화면 안내 말(올리면 · 판정해요) · 내부 표시(★) 없음 · 지금은 어려운 것은 맨 뒤', !/올리면|판정해요|★/.test(dgText) && dg.others.every((o, i, a) => i === 0 || !(a[i - 1].tone === 'no' && o.tone !== 'no')), [dgText.match(/.{0,50}(올리면|판정해요|★).{0,30}/g), dg.others.map((o) => o.tone)])
  const dn = buildDiagnosis(empty, none, '2026-10-02')
  check('D-352 정보가 없으면 — 제안 0 · 보내 주실 자료(어디서 떼는지 · 어느 진단에) · 다음 순서 첫 줄이 자료 요청', dn.picks.length === 0 && dn.requests.length > 0 && dn.requests.every((r) => r.for.length > 0) && dn.steps[0].includes('자료'), JSON.stringify([dn.requests, dn.steps]))
  const kt = diagnosisKakao(dg, '미래AI랩 김팀장')
  check('D-352 카톡 요약 — 회사 이름 · 먼저 제안드릴 것 · 서명 · 빈 줄 셋 없음', kt.startsWith(`[${dg.companyName}] 맞춤 진단 요약`) && (dg.picks.length === 0 || kt.includes('■ 먼저 제안드릴 것')) && kt.endsWith('미래AI랩 김팀장') && !/\n{3,}/.test(kt), kt)
  check('D-352 고객 말로 — ★ 세무사 표시 · 신고 누락 안내는 빼고', customerText('연구소가 있어요 · 신고 때 빠졌으면 지난 5년 경정청구 확인(★ 세무사)') === '연구소가 있어요')
  // D-363 진단서 드린 기록 — 같은 날 두 번 눌러도 한 줄 · 다음에 열면 '지난번 뒤 달라진 것'(판정 · 받은 자료)
  const g1 = withDiagnosisGiven(empty, givenOf(dn, 'print', '2026-09-20T01:00:00.000Z'))
  const g2 = withDiagnosisGiven(g1, givenOf(dn, 'print', '2026-09-20T05:00:00.000Z'))
  check('D-363 드린 기록 — 같은 날 같은 방법은 한 줄(활동 기록도 한 줄) · 먼저 제안 · 요청 자료 수', g2.diagnosisGiven?.length === 1 && g2.activity.filter((a) => a.text.startsWith('맞춤 진단서 드림')).length === 1 && g2.activity[0].text.includes(`요청한 자료 ${dn.requests.length}가지`), JSON.stringify([g2.diagnosisGiven?.length, g2.activity.map((a) => a.text)]))
  const g3 = withDiagnosisGiven(g2, givenOf(dn, 'kakao', '2026-09-20T06:00:00.000Z'))
  check('D-363 같은 날이라도 카톡 요약은 따로 한 줄', g3.diagnosisGiven?.length === 2 && g3.diagnosisGiven[0].how === 'kakao')
  const later = buildDiagnosis({ ...full, diagnosisGiven: g3.diagnosisGiven } as typeof full, ins, '2026-10-02')
  const pfChange = later.since?.changed.find((c) => c.key === 'policy-funding')
  check('D-363 지난번(9/20, 자료가 없던 때) 뒤 — 정책자금 자료 필요 → 나아짐 · 받은 자료(그때 요청 · 지금은 필요 없음)', later.since?.date === '2026-09-20' && !!pfChange && pfChange.from === '자료 필요' && pfChange.better && later.since.received.length > 0 && later.since.received.every((r) => !later.requests.some((q) => q.label === r)), JSON.stringify(later.since))
  check('D-363 나아진 것이 먼저 · 카톡 요약에도 "지난 진단 뒤 달라진 것"', later.since!.changed.every((c, i, a) => i === 0 || !(c.better && !a[i - 1].better)) && diagnosisKakao(later).includes('■ 지난 진단(2026-09-20) 뒤 달라진 것') && sinceLines(later.since).some((x) => x.startsWith('받은 자료: ')), diagnosisKakao(later))
  check('D-363 오늘 드린 것만 있으면 견줄 것 없음(처음과 같음)', buildDiagnosis({ ...full, diagnosisGiven: [{ ...g3.diagnosisGiven![0], at: '2026-10-02T03:00:00.000Z' }] } as typeof full, ins, '2026-10-02').since === null && dg.since === null)
  // D-366 '먼저 제안할 것' 한 줄 — 마지막으로 드린 것(오늘 것 포함)과 견줌
  const note1 = diagnosisNote({ ...full, diagnosisGiven: g3.diagnosisGiven } as typeof full, ins, '2026-10-02')
  check('D-366 드린 뒤 판정이 바뀌면 "9/20 진단서 드린 뒤 달라짐 — 판정 바뀐 것 n · 받은 자료 n · 다시 드릴 때예요"', note1?.state === 'changed' && /^9\/20 진단서 드린 뒤 달라짐 — 판정 바뀐 것 \d+ · 받은 자료 \d+ · 다시 드릴 때예요$/.test(note1.text), JSON.stringify(note1))
  const fresh = withDiagnosisGiven(full, givenOf(dg, 'print', '2026-10-02T03:00:00.000Z'))
  const note2 = diagnosisNote(fresh, ins, '2026-10-02')
  check('D-366 오늘 드리고 그대로면 "오늘 진단서 드림(인쇄 · PDF) — 그 뒤 판정 그대로" · 드린 적 없으면 줄 없음', note2?.state === 'today' && note2.text === '오늘 진단서 드림(인쇄 · PDF) — 그 뒤 판정 그대로' && diagnosisNote(full, ins, '2026-10-02') === null, JSON.stringify(note2))
  check('D-363 기록 모양 지킴 — 저장했다 다시 읽어도 그대로 · 모양이 틀린 줄은 버림', JSON.stringify(normalizeClientOps({ ...g3, diagnosisGiven: [...g3.diagnosisGiven!, { id: 1 }, 'x'] } as never).diagnosisGiven) === JSON.stringify(g3.diagnosisGiven))
  check('맞춤 추천: 요금제에 없는 모듈은 빠짐', !buildInsights(full, '2026-10-02', [], (k) => k !== 'labcare').some((i) => i.key === 'labcare'))
  // D-215: 직원 수를 모르면 정책자금은 1~4명(소상공인)으로 계산된다 — 가정이라고 알리고 '좋음' 으로 단정하지 않는다
  const noEmp = { ...full, employeeCount: '' } as typeof full
  const pfNo = buildInsights(noEmp, '2026-10-02', []).find((i) => i.key === 'policy-funding')
  check('D-215 정책자금: 직원 수 모름 → 모자란 것에 직원 수 · 가정 문구 · 좋음 아님', !!pfNo && pfNo.missing.some((m) => m.startsWith('직원 수')) && /소상공인으로 가정/.test(pfNo.detail) && pfNo.tone !== 'good', JSON.stringify(pfNo))
  const withEmp = { ...full, employeeCount: '25' } as typeof full
  const pfYes = buildInsights(withEmp, '2026-10-02', []).find((i) => i.key === 'policy-funding')
  check('D-215 정책자금: 직원 수를 알면 가정 문구 없음', !!pfYes && !pfYes.missing.some((m) => m.startsWith('직원 수')) && !/소상공인으로 가정/.test(pfYes.detail), JSON.stringify(pfYes?.missing))
  // D-215: 명부 진단 뒤에 회차 일정을 붙여도 고용지원금 카드는 명부 판정을 보여 준다
  const rosterTr = { id: 'tr1', toolKey: 'employment', title: '고용지원금 명부 진단', verdict: 'candidates', verdictLabel: '후보 지원금 2건', summary: '고용지원금 명부 진단\n· 청년 1명', data: { tab: 'roster', subsidyTotal: 12_000_000 }, deadlines: [], createdAt: '2026-10-01T00:00:00Z', publishedUpdateId: null }
  const schedTr = { id: 'tr2', toolKey: 'employment', title: '고용지원금 · 회차 일정 · 김청년', verdict: null, verdictLabel: '', summary: '', data: { tab: 'schedule' }, deadlines: [], createdAt: '2026-10-02T00:00:00Z', publishedUpdateId: null }
  const emRec = { ...full, toolResults: [schedTr, rosterTr] } as unknown as typeof full
  const em = buildInsights(emRec, '2026-10-02', []).find((i) => i.key === 'employment')
  check('D-215 고용지원금 카드: 회차 일정이 더 최근이어도 명부 판정(후보 2건)을 보여 줌', em?.tone === 'good' && em.headline === '후보 지원금 2건', JSON.stringify(em))
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
  const RULE = `임원퇴직금지급규정\n제3조(지급배수) 대표이사 3배, 이사 2배`
  const p4b = placeDocument({ text: RULE, fileName: 'scan_007.pdf' }, metas)
  const LOCAL = `지방세 납세증명서\n납세자 : 샤인디자인\n위 납세자는 지방세 체납액이 없음을 증명합니다.\n발급일 2026년 10월 20일`
  const NATIONAL = `납세증명서\n(국세)\n위의 납세자는 국세 체납액이 없음을 증명합니다.`
  const p4c = placeDocument({ text: LOCAL, fileName: 'scan_010.pdf' }, metas)
  const p4d = placeDocument({ text: NATIONAL, fileName: 'scan_011.pdf' }, metas)
  const p4e = placeDocument({ text: LOCAL, fileName: '지방세 납세증명서.pdf' }, metas)
  check('D-306 제목: 지방세 납세증명서는 국세 납세증명서 칸이 아니라 자기 칸(파일 이름이 스캔이어도)', p4c.label === '지방세 납세증명서' && p4e.label === '지방세 납세증명서' && p4d.label === '납세증명서', JSON.stringify([p4c.label, p4d.label, p4e.label]))
  check('D-304 제목: 임원퇴직금지급규정 → 기타가 아니라 그 이름의 새 칸', p4b.kind === 'new' && p4b.label === '임원퇴직금지급규정', JSON.stringify(p4b))
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
  // D-305 가지급금(주임종 채권) · 미처분이익잉여금 · 전기 순이익
  const FIN2 = ['재무상태표', '(단위 : 원)', '제 7(당)기 2025년 12월 31일 현재', '가지급금 30,000,000 25,000,000', '주.임.종 단기채권 5,000,000 0', '단기대여금 9,000,000 0', '자산총계 3,200,000,000 2,900,000,000', 'Ⅲ. 이익잉여금 820,000,000 700,000,000', '1. 미처분이익잉여금 800,000,000 690,000,000', '손익계산서', 'Ⅹ. 당기순이익 150,000,000 120,000,000', '재무상태표(비교)', '가지급금 30,000,000 25,000,000'].join('\n')
  const f2 = parseFinancialStatement(FIN2)
  check('D-305 재무제표: 가지급금 + 주임종 채권(일반 단기대여금은 빼고 · 같은 과목 두 번은 한 번)', f2.loanBalance === 35_000_000, JSON.stringify(f2))
  check('D-305 재무제표: 미처분이익잉여금(이익잉여금 합계 아님) · 전기 순이익', f2.retainedEarnings === 800_000_000 && f2.netIncomePrev === 120_000_000 && f2.netIncome === 150_000_000, JSON.stringify(f2))
  check('D-305 재무제표: 당기순손실 줄은 전기 부호를 몰라 전기 순이익을 내지 않음', fv.netIncomePrev === undefined, JSON.stringify(fv))
  check('D-305 재무제표: 미처리결손금은 음수', parseFinancialStatement('재무상태표\n미처분이익잉여금(미처리결손금) (40,000,000) (10,000,000)').retainedEarnings === -40_000_000)
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
  // D-212: 못 올린 파일도 기록에 — 창을 닫아도 맞춤 추천에 '다시 올리기' 로 남는다
  const withFail = docUploadLogOf(filled, { ...summary, failed: [{ fileName: '등기부등본.pdf', reason: '파일이 너무 큽니다(30MB 넘음)' }] }, 'upF')
  const round = normalizeClientOps(JSON.parse(JSON.stringify(withDocUploadLog(filled, withFail))))
  check('D-212 못 올린 파일: 기록에 남고 · 저장했다 읽어도 그대로 · 화면 모양에도', round.docUploads?.[0].failed?.[0].fileName === '등기부등본.pdf' && batchOfLog(round.docUploads![0]).failed?.[0].reason.startsWith('파일이 너무 큽니다') === true, JSON.stringify(round.docUploads?.[0].failed))
  check('D-212 못 올린 것이 없으면 칸도 없음(예전 기록 모양 그대로)', !('failed' in log) && !('failed' in batchOfLog(log)))
  const junkFail = normalizeClientOps({ id: 'uf', companyName: 'x', docUploads: [{ id: 'up9', at: NOW, files: 0, placed: [], entered: [], flagged: [], warnings: [], failed: [{ fileName: 'a.pdf', reason: 'r' }, 'bad', { reason: 'no name' }] }] } as never)
  check('D-212 못 올린 파일 기록: 이상한 줄은 버림', junkFail.docUploads?.[0].failed?.length === 1)
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
  // D-255: 검증 숫자가 틀린 번호는 칸에 넣지 않는다(숫자 하나 틀리면 치명적) — 비워 두고 고를 후보(검증 맞는 것)만
  check('D-255 검증 숫자가 틀린 사업자번호 → 칸 비움 · 후보(검증 맞음) · 읽힌 글자 보임', badNo.guess.businessNumber?.value === '' && (badNo.guess.businessNumber?.choices?.length ?? 0) > 0 && badNo.guess.businessNumber!.choices!.every((c) => bizNoChecksumOk(c)) && /124-81-00999/.test(badNo.guess.businessNumber?.note ?? ''), JSON.stringify(badNo.guess.businessNumber))
  const filledBad = applyNewClientGuess({ companyName: '', contactName: '', contactPhone: '', businessNumber: '' }, badNo.guess, {})
  check('D-255 등록 창 — 후보만 있으면 번호 칸은 비어 있음', filledBad.form.businessNumber === '' && filledBad.filled.businessNumber?.value === '')
  const pickOne = applyNewClientGuess({ companyName: '', contactName: '', contactPhone: '', businessNumber: badNo.guess.businessNumber!.choices![0] }, badNo.guess, filledBad.filled, new Set(['businessNumber']))
  check('D-255 후보 하나를 고르면 확인됨(까닭 없음)', pickOne.filled.businessNumber?.note === '' && pickOne.form.businessNumber === badNo.guess.businessNumber!.choices![0])
  // 스캔 사업자등록증이 흐려 번호가 애매해도 — 크레탑(PDF 글자)이 같은 후보를 말하면 그걸로 바로
  const scanBad = BIZ.replace('124-81-00998', '124-81-00999') + '\n[번호 다시 읽기]'
  const cross = guessNewClientFromDocs(
    [{ fileName: '사업자.jpg', text: scanBad, method: 'ocr' }, { fileName: '크레탑.pdf', text: 'x'.repeat(900), method: 'pdf_text' }],
    [{ fileName: '크레탑.pdf', method: 'pdf_text', name: '미래바이오랩', bizNo: '1248100998', ceo: '이대표' }],
  )
  check('D-255 스캔 번호 애매 + 크레탑 번호가 후보에 있음 → 크레탑 번호로 · 까닭 없음', cross.guess.businessNumber?.value === '124-81-00998' && cross.guess.businessNumber?.note === '', JSON.stringify(cross.guess.businessNumber))
  const badCret = guessNewClientFromDocs([{ fileName: '크레탑.pdf', text: 'x'.repeat(900), method: 'pdf_text' }], [{ fileName: '크레탑.pdf', method: 'pdf_text', name: '한빛정밀', bizNo: '2148735291', ceo: '김한빛' }])
  check('D-255 크레탑 번호도 검증 숫자가 틀리면 넣지 않고 후보', badCret.guess.businessNumber?.value === '' && (badCret.guess.businessNumber?.choices?.length ?? 0) > 0, JSON.stringify(badCret.guess.businessNumber))
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
  const cret = guessNewClientFromDocs([{ fileName: '크레탑.pdf', text: 'x'.repeat(900), method: 'pdf_text' }], [{ fileName: '크레탑.pdf', method: 'pdf_text', name: '한빛정밀', bizNo: '2148735297', ceo: '김한빛' }])
  check('D-187 크레탑 보고서 → 업체명 · 대표자 · 사업자번호(하이픈 넣어서)', cret.guess.companyName?.value === '한빛정밀' && cret.guess.contactName?.value === '김한빛' && cret.guess.businessNumber?.value === '214-87-35297' && cret.files[0]?.docLabel === '크레탑 보고서', JSON.stringify(cret.guess))
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

// D-232: 판정 넓히기 — 절세 · 연구소 · 통합고용세액공제도 엔진이 계산한 금액(짐작 없음)
{
  const T = '2026-10-18'
  const NOW232 = '2026-10-18T00:00:00.000Z'
  const base = normalizeClientOps({ id: 'w232', companyName: '넓힘정밀', establishedAt: '2016-03-02', businessCategory: '제조업', businessAddress: '경기도 화성시 동탄대로 1', contactName: '박대표', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const withTax = (tp: Record<string, string>) => normalizeClientOps({ ...base, taxProfile: tp } as never)
  const taxOf = (r: ClientOpsRecord) => buildInsights(r, T, []).find((i) => i.key === 'tax')

  const loanRec = withTax({ loanBalance: '3억', monthlySalary: '1000만' })
  const loan = taxOf(loanRec)
  const lp = loanPlan(viewProfile({ loanBalance: '3억', monthlySalary: '1000만' }))
  check('D-232 절세: 가지급금 3억 → 가능성 높음 · "해마다 약 n 손해"(07 가지급금 계산기 값 그대로)', loan?.tone === 'good' && lp.ok && lp.yearLoss > 0 && loan?.amount === `해마다 약 ${manwonText(lp.yearLoss)} 손해`, JSON.stringify({ loan, year: lp.yearLoss }))
  check('D-232 절세: 가지급금 → 가지급금 정리 상황 예시로 열림 · 다음 행동 한 줄', !!loan?.openPath.includes('preset=tax-loan') && loan?.action === '가지급금 정리 — 갚는 가장 싼 길 찾기')

  const retRec = withTax({ monthlySalary: '1000만' })
  const ret = taxOf(retRec)
  const rp = retirePlan(viewProfile({ monthlySalary: '1000만', ceoStartDate: '2016-03-02' }), T)
  check('D-232 절세: 대표 급여 + 설립일 → 퇴직금 한도(02 · 03 계산기) · 검토해 볼 만함', ret?.tone === 'maybe' && rp.ok && ret?.amount === `퇴직금 한도 약 ${manwonText(rp.limit)}` && !!ret?.openPath.includes('preset=tax-retire'), JSON.stringify({ ret, limit: rp.limit }))
  check('D-232 절세: 취임일을 설립일로 본 것은 가정이라고 밝힘', !!ret?.detail.includes('취임일은 설립일로 보고 계산'), ret?.detail)
  const retOwn = taxOf(withTax({ monthlySalary: '1000만', ceoStartDate: '2020-01-01' }))
  check('D-232 절세: 취임일을 직접 적었으면 가정 표시 없음', !!retOwn && !retOwn.detail.includes('설립일로'), retOwn?.detail)

  check('D-232 절세: 둘 다 되면 새는 돈(가지급금) 먼저 · 퇴직금은 "그 밖에"', !!loan?.headline.startsWith('가지급금') && !!loan?.detail.includes('그 밖에 · 퇴직금 한도 약'), loan?.detail)
  check('D-232 절세: 세무사 검토 문구', !!loan?.detail.includes('실행 전 세무사 검토'))

  const shareOnly = normalizeClientOps({ ...base, shareholderRegister: [{ id: 'h1', name: '박대표', relation: 'ceo', shares: 10000, acquirePrice: 5000 }] } as never)
  const so = taxOf(shareOnly)
  // D-238: 계산해 낸 것 없이 주주명부만 있으면(대표 급여 모름) '검토해 볼 만함' 이 아니라 '정보가 더 필요해요' — 먼저 제안할 것에 오르지 않는다
  check('D-232 절세: 계산할 숫자가 없으면 금액을 짐작하지 않음(금액 없음) · D-238 대표 급여를 모르면 정보가 더 필요해요', so?.tone === 'need' && so?.amount === undefined && !!so?.headline.includes('대표 급여를 알면') && !!so?.missing.includes('대표 급여') && !topPicks([so!]).length, JSON.stringify(so))
  {
    // D-238: 주주명부 · 대표 급여가 다 있는데 계산해 낼 것(가지급금 · 배당 가능한 이익)이 없으면 예전처럼 검토해 볼 만함
    const both = normalizeClientOps({ ...base, shareholderRegister: [{ id: 'h1', name: '박대표', relation: 'ceo', shares: 10000, acquirePrice: 5000 }], establishedAt: '', taxProfile: { monthlySalary: '500만' } } as never)
    const b = taxOf(both)
    check('D-238 절세: 주주명부 · 대표 급여가 다 있으면 계산 거리가 없어도 검토해 볼 만함', b?.tone === 'maybe' || (b?.amount ?? '') !== '', JSON.stringify(b))
    // D-238 지난 결과 — 정책자금 진단을 붙여 둔 업체는 판정 카드에 '지난번 무엇 · 언제'
    const tr = (toolKey: string, verdictLabel: string) => ({ id: `t-${toolKey}`, toolKey, title: `${toolKey} 결과`, verdict: null, verdictLabel, summary: '', data: null, deadlines: [], createdAt: '2026-10-15T01:00:00.000Z', publishedUpdateId: null })
    const done = normalizeClientOps({ ...base, toolResults: [tr('policy-funding', '진행 가능성 높음 · 중진공'), tr('cretop', '재무 안정')] } as never)
    const ins = buildInsights(done, T, [])
    const pf = ins.find((i) => i.key === 'policy-funding')
    const ct = ins.find((i) => i.key === 'cretop')
    check('D-238 지난 결과: 정책자금 진단을 붙였으면 판정에 지난번 결과 · 날짜', pf?.last?.label === '진행 가능성 높음 · 중진공' && pf?.last?.at === '2026-10-15T01:00:00.000Z', JSON.stringify(pf?.last))
    check('D-238 지난 결과: 판정 글이 이미 그 결과(크레탑)면 같은 말을 두 번 쓰지 않음', ct?.headline === '재무 안정' && ct?.last === undefined, JSON.stringify(ct))
    check('D-238 지난 결과: 붙인 결과가 없으면 없음', buildInsights(base, T, []).every((i) => i.last === undefined))
  }
  const loanNoSalary = taxOf(withTax({ loanBalance: '1억' }))
  check('D-232 절세: 대표 급여를 모르면 가지급금 손해가 작게 나온다고 알림 · 받을 것에 대표 급여', !!loanNoSalary?.detail.includes('대표 급여를 모르면') && !!loanNoSalary?.missing.includes('대표 급여'), JSON.stringify(loanNoSalary))
  check('D-232 고객 관리 카드 띠(계산 건너뜀)도 같은 판정 색 — 가지급금이면 가능성 높음', cardRecoChips(loanRec, T, 0).find((c) => c.key === 'tax')?.tone === 'good' && cardRecoChips(retRec, T, 0).find((c) => c.key === 'tax')?.tone === 'maybe')

  const labRec = withFactValue(base, 'researchLab', '기업부설연구소(2024 인정)', { source: 'meeting', status: 'entered', now: NOW232 })
  const lab = buildInsights(labRec, T, []).find((i) => i.key === 'labcare')
  check('D-232 연구소: 연구소가 있으면 "연구개발비 세액공제를 챙겼는지" — 검토해 볼 만함 · 세액공제 계산으로 열림', lab?.tone === 'maybe' && !!lab?.openPath.startsWith('/tools/labcare/tax') && lab?.amount === undefined, JSON.stringify(lab))
  const labCalc = normalizeClientOps({ ...labRec, toolResults: [{ id: 'tr-lab', toolKey: 'labcare', title: '세액공제 예상', verdict: null, verdictLabel: '연간 약 2,500만원', summary: '', data: { kind: 'tax', estimate: { annual: 25_000_000 } }, deadlines: [], createdAt: NOW232, publishedUpdateId: null }] } as never)
  const lab2 = buildInsights(labCalc, T, []).find((i) => i.key === 'labcare')
  check('D-232 연구소: 연구소 + 세액공제 계산이 붙어 있으면 그 금액 · 가능성 높음 · 경정청구 안내', lab2?.tone === 'good' && lab2?.amount === '세액공제 연간 약 2,500만원' && !!lab2?.detail.includes('경정청구'), JSON.stringify(lab2))

  const roster = (data: Record<string, unknown>, verdict: string) => ({ id: 'tr-emp', toolKey: 'employment', title: '4대보험 명부 진단', verdict, verdictLabel: verdict === 'candidates' ? '후보 지원금 2건 · 확인 항목 1' : '후보 지원금 0건 · 확인 항목 0', summary: '[4대보험 명부 진단] 8명', data: { tab: 'roster', ...data }, deadlines: [], createdAt: NOW232, publishedUpdateId: null })
  const credRec = normalizeClientOps({ ...base, toolResults: [roster({ estimate: { computable: true, creditTotal: 23_000_000, incTotal: 2 }, counts: { newHireCount: 3 } }, 'none')] } as never)
  const cred = buildInsights(credRec, T, []).find((i) => i.key === 'employment')
  check('D-232 고용: 지원금 후보가 없어도 통합고용세액공제를 계산해 뒀으면 그 금액 · 검토해 볼 만함', cred?.tone === 'maybe' && cred?.amount === '세액공제 약 2,300만원(1차 추정)' && !!cred?.headline.includes('통합고용세액공제'), JSON.stringify(cred))
  const hiresRec = normalizeClientOps({ ...base, toolResults: [roster({ subsidyTotal: 14_400_000, counts: { newHireCount: 3 } }, 'candidates')] } as never)
  const hires = buildInsights(hiresRec, T, []).find((i) => i.key === 'employment')
  check('D-232 고용: 세액공제를 아직 안 했으면 금액 없이 "새로 들어온 직원 3명 — 전년 직원 수를 넣으면" 안내(지원금 금액은 그대로)', hires?.tone === 'good' && hires?.amount === '최대 1,440만원 검토(1차 추정)' && !!hires?.detail.includes('새로 들어온 직원 3명'), JSON.stringify(hires))
  const noneRec = normalizeClientOps({ ...base, toolResults: [roster({}, 'none')] } as never)
  check('D-232 고용: 후보도 세액공제도 새 직원도 없으면 예전처럼 "지금은 어려움"', buildInsights(noneRec, T, []).find((i) => i.key === 'employment')?.tone === 'no')

  // D-302 서류 올리기가 붙인 '명부 날짜로 센 인원' → 볼 때마다 지금 주소 · 규모로 세액공제
  const hc = (prev: number, prevY: number, cur: number, curY: number, basis = 'history') => ({ asOf: '2026-09-20', prev: { year: 2025, total: prev, youth: prevY, actualMonths: 12 }, cur: { year: 2026, total: cur, youth: curY, actualMonths: 8 }, basis, counted: 3, excluded: { rel: 0, noEi: 0, noHire: 0, lostNoDate: 0 } })
  const local = normalizeClientOps({ ...base, businessAddress: '충청북도 청주시 흥덕구 1' } as never)
  const up = (r: unknown, data: Record<string, unknown>, verdict = 'none') => normalizeClientOps({ ...(r as object), toolResults: [roster(data, verdict)] } as never)
  const e1 = buildInsights(up(local, { headcount: hc(2, 0, 3, 1) }), T, []).find((i) => i.key === 'employment')
  // D-319 2026년에 늘어난 인원 → 2026 개편표(지방 중소 청년 등 1년 차 1,000만)
  check('D-302 · D-319 고용: 명부 날짜 인원만으로 세액공제 — 지방 중소 청년 1 × 1년 차 1,000만 · 검토해 볼 만함', e1?.tone === 'maybe' && e1?.amount === '세액공제 1년 차 약 1,000만원 · 3년 약 4,900만원(1차 추정)' && !!e1?.detail.includes('2025년 평균 2명 → 2026년 예상 3명') && !!e1?.detail.includes('명부 날짜로 셈'), JSON.stringify(e1))
  check('D-302 고용: 중소기업 확인이 없으면 가정을 같이(★)', !!e1?.detail.includes('중소기업으로 보고'), e1?.detail)
  const e2 = buildInsights(up(local, { headcount: hc(2, 0, 3, 1, 'current'), subsidyTotal: 14_400_000 }, 'candidates'), T, []).find((i) => i.key === 'employment')
  check('D-302 고용: 지원금 후보 + 세액공제 금액 같이 · 지금 직원만 있는 명부면 "작년에 그만둔 사람" 주의', e2?.tone === 'good' && e2?.amount === '최대 1,440만원 검토(1차 추정) + 세액공제 1년 차 약 1,000만원 · 3년 약 4,900만원' && !!e2?.detail.includes('작년에 그만둔 사람'), JSON.stringify(e2))
  const e3 = buildInsights(up(local, { headcount: hc(3, 1, 2, 1) }), T, []).find((i) => i.key === 'employment')
  check('D-302 고용: 작년보다 줄면 공제 없음 · 추징 확인 안내 · 지금은 어려움', e3?.tone === 'no' && e3?.amount === undefined && !!e3?.detail.includes('추징'), JSON.stringify(e3))
  const e4 = buildInsights(up(local, { headcount: hc(2, 0, 2, 0) }), T, []).find((i) => i.key === 'employment')
  check('D-302 · D-319 고용: 같으면 "청년 등 1명 늘면 1년 차 약 1,000만원(유지하면 2년 차 1,900만원 · 3년 차 2,000만원)"', e4?.tone === 'no' && !!e4?.detail.includes('1명 늘면 1년 차 약 1,000만원(유지하면 2년 차 1,900만원 · 3년 차 2,000만원)'), JSON.stringify(e4))
  const metro = normalizeClientOps({ ...base, businessAddress: '서울특별시 강남구 1' } as never)
  check('D-302 · D-319 · D-330 고용: 서울이면 수도권 단가(2026 개편 1년 차 700만 · 3년 700+1,600+1,700)', buildInsights(up(metro, { headcount: hc(2, 0, 3, 1) }), T, []).find((i) => i.key === 'employment')?.amount === '세액공제 1년 차 약 700만원 · 3년 약 4,000만원(1차 추정)')
  // 2025년에 늘어난 인원(명부 비교가 2024 → 2025)은 옛 표 그대로
  const hc25 = { asOf: '2025-12-20', prev: { year: 2024, total: 2, youth: 0, actualMonths: 12 }, cur: { year: 2025, total: 3, youth: 1, actualMonths: 12 }, basis: 'history', counted: 3, excluded: { rel: 0, noEi: 0, noHire: 0, lostNoDate: 0 } }
  check('D-319 고용: 2025년에 늘어난 인원은 옛 표(지방 1,550만)', buildInsights(up(local, { headcount: hc25 }), T, []).find((i) => i.key === 'employment')?.amount === '세액공제 약 1,550만원(1차 추정)')
  const typedFirst = buildInsights(up(local, { headcount: hc(2, 0, 3, 1), estimate: { computable: true, creditTotal: 23_000_000, incTotal: 2 } }), T, []).find((i) => i.key === 'employment')
  check('D-302 고용: 명부 화면에서 사람이 넣어 계산한 값이 먼저', typedFirst?.amount === '세액공제 약 2,300만원(1차 추정)', JSON.stringify(typedFirst))
  const big = withFactValue(local, 'employeeCount', '320', { source: 'meeting', status: 'entered', now: NOW232 })
  check('D-302 고용: 직원 300명 이상인데 중소기업 확인이 없으면 단가를 정하지 않음(금액 없음)', buildInsights(up(big, { headcount: hc(2, 0, 3, 1) }), T, []).find((i) => i.key === 'employment')?.amount === undefined)
  check('D-302 고용: 모양이 깨진 인원 기록은 무시', buildInsights(up(local, { headcount: { prev: 1 } }), T, []).find((i) => i.key === 'employment')?.amount === undefined)
}

// D-233: 판정 넓히기 마무리 — 절세 급여 vs 배당(세후 1억 · 상황 예시 '대표가 1억 가져오기' 와 같은 경로 식)
{
  const T = '2026-10-18'
  const holders = [{ id: 'h1', name: '오대표', relation: 'ceo', shares: 8000, acquirePrice: 5000 }, { id: 'h2', name: '오배우', relation: 'spouse', shares: 2000, acquirePrice: 5000 }]
  // 설립일이 없으면 퇴직금(취임일)이 계산되지 않아 급여 vs 배당이 맨 앞
  const base = normalizeClientOps({ id: 'w233', companyName: '견줌산업', businessCategory: '제조업', businessAddress: '충청북도 청주시 흥덕구 1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
  const rec = (tp: Record<string, string>, reg: unknown[] = holders) => normalizeClientOps({ ...base, taxProfile: tp, shareholderRegister: reg } as never)
  const taxOf = (r: ClientOpsRecord) => buildInsights(r, T, []).find((i) => i.key === 'tax')
  const tp = { monthlySalary: '1000만', retainedEarnings: '15억', par: '5000' }
  const p = viewProfile(tp)
  const sd = salaryOrDividend(p, holders as never, shareValueOf(p, holders as never), 100_000_000, T)
  const gap = Math.abs(sd.salary.netBurden - sd.dividend.netBurden)
  const cheaper = sd.dividend.netBurden < sd.salary.netBurden ? '배당' : '급여'
  const pay = taxOf(rec(tp))
  check('D-233 절세: 월 급여 · 주주명부 · 배당 가능한 이익 → 세후 1억이면 급여 vs 배당 어느 쪽이 덜 내는지 · 금액(01 · 03 식 그대로)',
    sd.salary.ok && sd.dividend.ok && gap >= 1_000_000 && pay?.tone === 'maybe' && pay?.headline === `대표가 1억 더 가져간다면 — ${cheaper} 쪽이 세금이 덜 나와요` && pay?.amount === `세후 1억 기준 약 ${manwonText(gap)} 덜 냄`,
    JSON.stringify({ pay, s: sd.salary.netBurden, d: sd.dividend.netBurden }))
  check('D-233 절세: 두 순부담을 같이 보여 주고 · 주식 · 퇴직금까지 견주면 더 싼 길이 있을 수 있다고 밝힘 · 1억 가져오기 설계로 열림',
    !!pay?.detail.includes(`급여 올리기 순부담 ${manwonText(sd.salary.netBurden)}`) && !!pay?.detail.includes(`배당 순부담 ${manwonText(sd.dividend.netBurden)}`) && !!pay?.detail.includes('주식 · 퇴직금까지') && !!pay?.openPath.includes('preset=tax-cash-1e'), pay?.detail)
  const both = taxOf(rec({ ...tp, ceoStartDate: '2015-01-01' }))
  check('D-233 절세: 퇴직금도 되면 퇴직금이 앞(D-232 그대로) · 급여 vs 배당은 "그 밖에" 한 줄로', !!both?.headline.startsWith('대표 퇴직금') && !!both?.detail.includes(`세후 1억이면 ${cheaper === '배당' ? '배당이' : '급여가'} 약 ${manwonText(gap)} 덜 냄`) && !both?.detail.includes('급여이'), both?.detail)
  const noRe = taxOf(rec({ monthlySalary: '1000만' }))
  check('D-233 절세: 배당 가능한 이익을 모르면 급여 vs 배당을 짐작하지 않음', !noRe?.amount?.includes('세후 1억') && !noRe?.headline.includes('1억'), JSON.stringify(noRe))
  const noHolders = taxOf(rec(tp, []))
  check('D-233 절세: 주주명부가 없으면 급여 vs 배당을 짐작하지 않음', !noHolders?.headline.includes('1억') && !!noHolders?.missing.includes('주주명부'), JSON.stringify(noHolders))
  const noSalary = taxOf(rec({ retainedEarnings: '15억' }))
  check('D-233 절세: 대표 급여를 모르면 급여 vs 배당을 짐작하지 않음', !noSalary?.headline.includes('1억') && !!noSalary?.missing.includes('대표 급여'), JSON.stringify(noSalary))
  check('D-233 고객 관리 카드 띠(계산 건너뜀) — 급여 vs 배당 계산을 하지 않아도 판정 색은 그대로', cardRecoChips(rec(tp), T, 0).find((c) => c.key === 'tax')?.tone === 'maybe')
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

// D-303 주주명부 올리기 → 주주표 · 발행주식 총수 · 1주 액면가 · 주주·임원 구성 / 관계를 모르는 주주는 확인할 것에서 골라 받는다
await (async () => {
  const T = '\t'
  const text = [
    '주 주 명 부',
    '발행주식의 총수: 10,000주 / 1주의 금액: 5,000원',
    ['번호', '주주명', '주민등록번호', '주소', '주식수', '지분율', '비고'].join(T),
    ['1', '이대표', '750101-1234567', '부산광역시 해운대구 센텀로 77', '6,000', '60%', '대표이사'].join(T),
    ['2', '김배우', '780202-2345678', '부산광역시 해운대구 센텀로 77', '2,500', '25%', '배우자'].join(T),
    ['3', '박친구', '800303-1456789', '경기도 성남시 분당구 45', '1,500', '15%', ''].join(T),
    ['합계', '', '', '', '10,000', '100%', ''].join(T),
  ].join('\n')
  const doc = { key: 'customdoc_sh', fileName: '주주명부_2026.xlsx', text, method: 'xlsx' as const, docSure: true }
  let n = 0
  const ctx = { now: NOW, today: '2026-10-28', makeId: () => `h${++n}` }
  const base = normalizeClientOps({ id: 'sh303', companyName: '주주테스트(주)', representativeName: '이대표', businessAddress: '서울특별시 중구 세종대로 1', createdAt: NOW, updatedAt: NOW })
  const out = await analyzeUploadedDocs(base, [doc], ctx)
  const r = out.record
  check('D-303 주주명부 → 주주표 3명 · 관계(대표 · 배우자 · 기타)', r.shareholderRegister.map((h) => `${h.name}:${h.shares}:${h.relation}`).join(',') === '이대표:6000:ceo,김배우:2500:spouse,박친구:1500:other', JSON.stringify(r.shareholderRegister))
  check('D-303 발행주식 총수 · 1주 액면가 · 주주·임원 구성 한 줄', r.taxProfile.totalShares === '10000' && r.taxProfile.par === '5000' && r.shareholders === '이대표 60% · 김배우 25% · 박친구 15%', JSON.stringify({ tp: r.taxProfile, s: r.shareholders }))
  check('D-303 바로 넣은 정보에 주주명부 · 총수 · 액면가', ['주주명부', '발행주식 총수', '1주 액면가'].every((l) => out.summary.entered.some((e) => e.label === l)), JSON.stringify(out.summary.entered))
  check('D-303 주민번호 · 주주 주소는 기록에 없음 · 회사 주소는 그대로(주주 주소를 회사 주소로 읽지 않음)', !JSON.stringify(r).includes('1234567') && !JSON.stringify(r).includes('센텀로') && r.businessAddress === '서울특별시 중구 세종대로 1' && !(r.factInbox ?? []).some((c) => c.key === 'businessAddress'))

  const ds = buildDecisions(r, '2026-10-28', [])
  const q = ds.filter((d) => d.effect.type === 'holder-relation')
  check('D-303 확인할 것: 관계를 모르는 박친구만 묻는다 · 고르기(배우자 · 자녀 …)', q.length === 1 && q[0].title.includes('박친구') && !!q[0].choices?.some((c) => c.label === '배우자') && q[0].choiceLabel === '관계', JSON.stringify(q.map((d) => d.title)))
  check('D-303 절세 설계를 못 쓰는 사람에게는 묻지 않음', !buildDecisions(r, '2026-10-28', [], (k) => k !== 'tax').some((d) => d.effect.type === 'holder-relation'))
  const d0 = q[0]
  const picked = withDecisionAnswer(r, { ...d0, effect: { type: 'holder-relation', rowId: (d0.effect as { rowId: string }).rowId, relation: 'child' } }, 'yes', [], NOW)
  check('D-303 [이 관계로] 자녀 → 주주표에 · 다시 묻지 않음', picked.shareholderRegister.find((h) => h.name === '박친구')?.relation === 'child' && !buildDecisions(picked, '2026-10-28', []).some((d) => d.effect.type === 'holder-relation'))
  check('D-303 고르지 않은 [맞아요] 는 아무것도 바꾸지 않고 다시 묻는다', withDecisionAnswer(r, d0, 'yes', [], NOW) === r)
  const said = withDecisionAnswer(r, d0, 'no', [], NOW)
  check('D-303 [관계 없음] — 기타 그대로 · 다시 묻지 않음', said.shareholderRegister.find((h) => h.name === '박친구')?.relation === 'other' && !buildDecisions(said, '2026-10-28', []).some((d) => d.effect.type === 'holder-relation'))
  const back = undoDecision(picked, r, picked, d0.id)
  check('D-303 되돌리기 — 관계도 기타로', back.shareholderRegister.find((h) => h.name === '박친구')?.relation === 'other' && !(back.decided ?? {})[d0.id])

  // 이미 적힌 주주표가 다르면 덮지 않는다 · 검산이 안 맞으면 바로 넣지 않는다
  const filled = normalizeClientOps({ ...base, shareholderRegister: [{ id: 'x1', name: '이대표', relation: 'ceo', shares: 10000, acquirePrice: 0 }] } as never)
  const kept = await analyzeUploadedDocs(filled, [doc], ctx)
  check('D-303 이미 다른 주주표 → 덮지 않고 확인 필요로', kept.record.shareholderRegister.length === 1 && kept.summary.flagged.some((f) => f.label === '주주명부' && f.note.includes('지금 적힌 주주표와 달라')), JSON.stringify(kept.summary.flagged))
  const same = await analyzeUploadedDocs(r, [doc], ctx)
  check('D-303 같은 주주명부를 다시 올리면 조용히(넣은 것도 확인할 것도 없음)', !same.summary.flagged.some((f) => f.label === '주주명부') && !same.summary.entered.some((e) => e.label === '주주명부'))
  const off = text.replace('1,500', '500')
  const unsure = await analyzeUploadedDocs(base, [{ ...doc, text: off }], ctx)
  check('D-303 합(9,000) ≠ 총수(10,000) → 바로 넣지 않고 까닭과 함께 확인 필요', unsure.record.shareholderRegister.length === 0 && unsure.summary.flagged.some((f) => f.label === '주주명부' && f.note.includes('발행주식 총수')), JSON.stringify(unsure.summary.flagged))
})()

// D-304 등기부등본 · 정관 올리기 → 절세 현황(대표 취임일 · 1주 액면가 · 발행주식 총수 · 지급배수) — 빈 칸만, 다르거나 확실하지 않으면 확인 필요
await (async () => {
  const reg = [
    '등기사항전부증명서(말소사항 포함)',
    '상호 주식회사 가나테크',
    '1주의 금액 금 5,000 원',
    '발행할 주식의 총수 100,000 주',
    '발행주식의 총수 20,000 주',
    '보통주식 20,000 주 금 100,000,000 원',
    '임원에 관한 사항',
    '대표이사 박지훈 801231-1******',
    '2015 년 07 월 21 일 취임 2015 년 07 월 23 일 등기',
    '2018 년 07 월 21 일 중임 2018 년 07 월 25 일 등기',
    '회사성립연월일 2015 년 07 월 21 일',
  ].join('\n')
  const rule = ['임원퇴직금지급규정', '제3조 임원의 퇴직금 지급배수는 다음과 같다. 대표이사 3배, 이사 2배'].join('\n')
  let n = 0
  const ctx = { now: NOW, today: '2026-10-28', makeId: () => `r${++n}` }
  const base = normalizeClientOps({ id: 'rg304', companyName: '주식회사 가나테크', representativeName: '박지훈', createdAt: NOW, updatedAt: NOW })
  const docs = [
    { key: 'corporateRegistry', fileName: '등기부등본.pdf', text: reg, method: 'pdf_text' as const, docSure: true },
    { key: 'customdoc_rule', fileName: '임원퇴직금지급규정.hwp', text: rule, method: 'hwp' as const, docSure: true },
  ]
  const out = await analyzeUploadedDocs(base, docs, ctx)
  const tp = out.record.taxProfile
  check('D-304 등기부 → 대표 취임일 2015-07-21 · 1주 액면가 5,000 · 발행주식 총수 20,000 / 규정 → 지급배수 3', tp.ceoStartDate === '2015-07-21' && tp.par === '5000' && tp.totalShares === '20000' && tp.retireMult === '3', JSON.stringify(tp))
  check('D-304 바로 넣은 정보에 넷 다(취임일엔 등기부 근거)', ['대표 취임일', '1주 액면가', '발행주식 총수', '퇴직금 배수'].every((l) => out.summary.entered.some((e) => e.label === l)) && !!out.summary.entered.find((e) => e.label === '대표 취임일')?.display.includes('퇴직금 기산일(등기부'), JSON.stringify(out.summary.entered.map((e) => `${e.label}=${e.display}`)))
  check('D-304 주민번호는 기록에 없음', !JSON.stringify(out.record).includes('801231-1'))
  const had = normalizeClientOps({ ...base, taxProfile: { totalShares: '10000' } } as never)
  const kept = await analyzeUploadedDocs(had, docs, ctx)
  check('D-304 이미 다른 총수(10,000)가 있으면 덮지 않고 확인 필요', kept.record.taxProfile.totalShares === '10000' && kept.summary.flagged.some((f) => f.label === '발행주식 총수' && f.note.includes('지금 적힌 값(10000)')), JSON.stringify(kept.summary.flagged))
  const nowOnly = reg.replace('2015 년 07 월 21 일 취임 2015 년 07 월 23 일 등기\n', '').replace('보통주식 20,000 주 금 100,000,000 원', '')
  const cur = await analyzeUploadedDocs(base, [{ ...docs[0], text: nowOnly }], ctx)
  check('D-304 중임 날짜만(현재 유효사항) → 취임일 넣지 않고 까닭(말소사항 포함 등기부) · 자본금 없으면 총수도 확인 필요', !cur.record.taxProfile.ceoStartDate && cur.summary.flagged.some((f) => f.label.startsWith('대표 취임일') && f.note.includes('말소사항')) && !cur.record.taxProfile.totalShares && cur.summary.flagged.some((f) => f.label === '발행주식 총수'), JSON.stringify(cur.summary.flagged))
  // 주주명부와 함께 — 같은 값이면 조용히(겹쳐 묻지 않음)
  const T = '\t'
  const sh = ['주주명부', '발행주식의 총수: 20,000주 / 1주의 금액: 5,000원', ['주주명', '주식수', '비고'].join(T), ['박지훈', '20,000', '대표이사'].join(T), ['합계', '20,000', ''].join(T)].join('\n')
  const both = await analyzeUploadedDocs(base, [...docs, { key: 'customdoc_sh', fileName: '주주명부.xlsx', text: sh, method: 'xlsx' as const, docSure: true }], ctx)
  check('D-304 주주명부와 등기부가 같은 총수 · 액면가 → 한 번만 넣고 확인 필요 없음', both.record.taxProfile.totalShares === '20000' && !both.summary.flagged.some((f) => f.label === '발행주식 총수' || f.label === '1주 액면가') && both.record.shareholderRegister.length === 1, JSON.stringify(both.summary.flagged))
})()

// D-305 재무제표 올리기 → 절세 현황(가지급금 잔액 · 배당 가능한 이익 · 직전 연도 순이익) — 빈 칸만 · 결손이면 까닭
await (async () => {
  const FIN = ['표준재무제표증명', '(단위 : 천원)', '제 7(당)기 2025년 12월 31일 현재', '가지급금 30,000 25,000', '자산총계 3,200,000 2,900,000', '미처분이익잉여금 800,000 690,000', 'Ⅹ. 당기순이익 150,000 120,000'].join('\n')
  let n = 0
  const ctx = { now: NOW, today: '2026-10-28', makeId: () => `f${++n}` }
  const base = normalizeClientOps({ id: 'fs305', companyName: '재무테스트(주)', createdAt: NOW, updatedAt: NOW })
  const out = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: '표준재무제표증명.pdf', text: FIN, method: 'pdf_text' as const, docSure: true }], ctx)
  const tp = out.record.taxProfile
  check('D-305 재무제표 → 가지급금 3천만 · 배당 가능한 이익 8억 · 직전 연도(2024) 순이익 1.2억 · 매출 등 회사 정보도 그대로', tp.loanBalance === '30000000' && tp.retainedEarnings === '800000000' && tp.vInc1 === '120000000' && out.summary.entered.some((e) => e.key === 'netIncome'), JSON.stringify(tp))
  check('D-305 바로 넣은 정보 글: 연도와 함께', out.summary.entered.some((e) => e.label === '가지급금' && e.display === '2025년 말 3,000만원') && out.summary.entered.some((e) => e.label === '전년 순이익' && e.display === '2024년 1억 2,000만원') && out.summary.entered.some((e) => e.label === '배당 가능 이익' && e.display.startsWith('2025년 말 8억원')), JSON.stringify(out.summary.entered.map((e) => `${e.label}=${e.display}`)))
  const had = normalizeClientOps({ ...base, taxProfile: { loanBalance: '50000000' } } as never)
  const kept = await analyzeUploadedDocs(had, [{ key: 'financialStatements', fileName: '표준재무제표증명.pdf', text: FIN, method: 'pdf_text' as const, docSure: true }], ctx)
  check('D-305 이미 적힌 가지급금(5천만)과 다르면 덮지 않고 확인 필요', kept.record.taxProfile.loanBalance === '50000000' && kept.summary.flagged.some((f) => f.label === '가지급금'), JSON.stringify(kept.summary.flagged))
  const loss = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FIN.replace('미처분이익잉여금 800,000 690,000', '미처분이익잉여금(미처리결손금) (40,000) (10,000)'), method: 'pdf_text' as const, docSure: true }], ctx)
  check('D-305 미처리결손금 → 배당 가능한 이익은 넣지 않고 까닭(결손)', !loss.record.taxProfile.retainedEarnings && loss.summary.flagged.some((f) => f.label === '배당 가능 이익' && f.note.includes('결손')), JSON.stringify(loss.summary.flagged))
})()

// D-334 명부 올리기 → 고령자 계속고용 최대 금액이 업체 주소 지역으로(비수도권 월 40만 × 36 = 1,440만 · 수도권 1,080만)
await (async () => {
  const ROSTER = ['4대보험 사업장 가입자 명부', ['성명', '주민등록번호', '자격취득일'].join('\t'), ['장계속', '650101-1234567', '2015-03-01'].join('\t')].join('\n')
  let n = 0
  const ctx = { now: NOW, today: '2026-10-28', makeId: () => `s${++n}` }
  const run = async (addr: string) => {
    const base = normalizeClientOps({ id: 'sc334', companyName: '계속테스트(주)', businessAddress: addr, createdAt: NOW, updatedAt: NOW })
    const out = await analyzeUploadedDocs(base, [{ key: 'payrollRoster', fileName: '가입자명부.xlsx', text: ROSTER, method: 'xlsx' as const, docSure: true }], ctx)
    const tr = out.record.toolResults.find((t) => t.toolKey === 'employment')
    return { total: (tr?.data as { subsidyTotal?: number } | null)?.subsidyTotal ?? 0, summary: tr?.summary ?? '' }
  }
  const local = await run('충청북도 청주시 흥덕구 오송읍 1')
  const metro = await run('서울특별시 중구 세종대로 1')
  const none = await run('')
  // 예전에 붙인 명부 결과(저장 합계 1,440만 = 청년도약 720 + 계속고용 720 옛 금액)도 저장된 후보 수로 지금 금액을 다시 센다
  const oldTr = (addr: string) => normalizeClientOps({ id: 'sc334b', companyName: '옛결과(주)', businessAddress: addr, createdAt: NOW, updatedAt: NOW, toolResults: [{ id: 'tr-old', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'candidates', verdictLabel: '후보 지원금 2건 · 확인 항목 0', summary: '[4대보험 명부 진단] 2명', data: { tab: 'roster', subsidyTotal: 14_400_000, subsidySummary: [{ key: 'youth_jump', name: '청년도약', candidateCount: 1, level: 'check' }, { key: 'senior_continue', name: '계속고용', candidateCount: 1, level: 'check' }, { key: 'parental', name: '육아', candidateCount: 0, level: 'more' }] }, deadlines: [], createdAt: NOW, publishedUpdateId: null }] } as never)
  const amt = (addr: string) => buildInsights(oldTr(addr), '2026-10-28', []).find((i) => i.key === 'employment')?.amount ?? ''
  check('D-334 옛 명부 결과 → 지금 금액으로(비수도권 720 + 1,440 = 2,160만 · 수도권 1,800만 · 주소 모르면 저장 값과 수도권 중 큰 쪽 1,800만)', amt('충청북도 청주시 1').startsWith('최대 2,160만원') && amt('서울특별시 중구 1').startsWith('최대 1,800만원') && amt('').startsWith('최대 1,800만원'), [amt('충청북도 청주시 1'), amt('서울특별시 중구 1'), amt('')].join(' | '))
  check('D-334 명부 → 비수도권 업체는 계속고용 1,440만 · 수도권 1,080만 · 주소 모르면 수도권 금액', local.total === 14_400_000 && metro.total === 10_800_000 && none.total === 10_800_000 && local.summary.includes('최대 1,440만원'), `${local.total} ${metro.total} ${none.total}`)
})()

// D-306 정책자금 판정의 '미확인' 을 서류함으로 — 납세증명서(국세 · 지방세) · 4대보험 완납증명서 → 체납 없음 · 자본잠식 → 부채비율 높음
{
  const T = '2026-10-28'
  let base = normalizeClientOps({ id: 'pe306', companyName: '증명테크(주)', businessCategory: '제조업', businessItem: '금속 가공', businessAddress: '충청북도 청주시 흥덕구 1', establishedAt: '2019-03-02', employeeCount: '12', createdAt: NOW, updatedAt: NOW } as never)
  base = withFactValue(base, 'revenue', '2400000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  const addDoc = (r: ReturnType<typeof normalizeClientOps>, label: string, issuedAt: string) => {
    const next = withCustomDocument(r, { label })
    const key = next.customDocuments[next.customDocuments.length - 1].key
    return withDocument(next, key, { received: true, fileName: `${label}.pdf`, issuedAt })
  }
  const facts = (r: ReturnType<typeof normalizeClientOps>) => clientFacts(r, new Date(`${T}T00:00:00`))
  const none = policyEvidence(base, facts(base), T)
  check('D-306 서류 없음 → 체납 미확인 그대로 · 받을 서류 셋', !none.input.taxArrears && !none.input.insuranceArrears && none.want.join(',') === '국세 납세증명서,지방세 납세증명서,4대보험 완납증명서', JSON.stringify(none))
  let all = addDoc(base, '납세증명서', '2026-10-10')
  all = addDoc(all, '지방세 납세증명서', '2026-10-12')
  all = addDoc(all, '4대보험 완납증명서', '2026-10-15')
  const ev = policyEvidence(all, facts(all), T)
  check('D-306 국세 · 지방세 납세증명서 + 4대보험 완납증명서(90일 안) → 체납 없음 둘 다 · 근거 한 줄', ev.input.taxArrears === '없음' && ev.input.insuranceArrears === '없음' && ev.want.length === 0 && ev.notes.some((n) => n.includes('국세 10/10 · 지방세 10/12')), JSON.stringify(ev))
  const only = addDoc(base, '납세증명서', '2026-10-10')
  const ev1 = policyEvidence(only, facts(only), T)
  check('D-306 국세만 있으면 세금 체납은 미확인 그대로 · 지방세 받기', !ev1.input.taxArrears && ev1.want.includes('지방세 납세증명서') && !ev1.want.includes('국세 납세증명서'), JSON.stringify(ev1))
  const old = addDoc(addDoc(base, '납세증명서', '2026-05-01'), '지방세 납세증명서', '2026-05-01')
  const ev2 = policyEvidence(old, facts(old), T)
  check('D-306 90일 넘은 납세증명서는 쓰지 않음 · 새로 받으라고', !ev2.input.taxArrears && ev2.notes.some((n) => n.includes('오래됐어요')), JSON.stringify(ev2))
  // 엔진: 미확인이면 '체납 여부 확인' 이 확인할 것에 남는다 → 서류가 있으면 빠진다
  const inp = policyInputFromFacts(facts(all)).input
  const before = runDiagnosis(inp)
  const after = runDiagnosis({ ...inp, ...ev.input })
  const arrearsCheck = (r: ReturnType<typeof runDiagnosis>) => (r.headline?.checks ?? []).some((c) => /체납/.test(c))
  check('D-306 엔진: 서류 전엔 "체납 여부 확인" → 서류 뒤엔 없음', arrearsCheck(before) && !arrearsCheck(after), JSON.stringify({ b: before.headline?.checks, a: after.headline?.checks }))
  const insBefore = buildInsights(base, T, []).find((i) => i.key === 'policy-funding')
  const insAfter = buildInsights(all, T, []).find((i) => i.key === 'policy-funding')
  check('D-306 맞춤 추천 정책자금: 서류 전엔 "체납 확인 — …" 칩 · 서류 뒤엔 근거 한 줄 · 칩 없음', !!insBefore?.missing.some((m) => m.startsWith('체납 확인')) && !insAfter?.missing.some((m) => m.startsWith('체납 확인')) && !!insAfter?.detail.includes('세금 체납 없음'), JSON.stringify({ b: insBefore?.missing, a: insAfter?.detail }))
  check('D-306 상담 · 물어볼 것: 납세증명서 · 완납증명서를 받아 두면 체납 질문 빠짐', answerFor('ask', { record: base, today: T, notices: [] }).steps.some((x) => x.includes('체납')) && !answerFor('ask', { record: all, today: T, notices: [] }).steps.some((x) => x.includes('체납')))
  check('D-306 상담 · 정책자금: 서류 근거가 사실 줄에', answerFor('policy', { record: all, today: T, notices: [] }).facts.some((x) => x.startsWith('서류: 세금 체납 없음')))
  // 자본잠식 — 자산 ≤ 부채
  let neg = withFactValue(base, 'totalAssets', '500000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  neg = withFactValue(neg, 'totalLiabilities', '620000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  const ev3 = policyEvidence(neg, facts(neg), T)
  check('D-306 자산 5억 ≤ 부채 6.2억 → 부채비율 높음(자본잠식) · 근거', ev3.input.debtRatioStatus === '높음' && ev3.notes.some((n) => n.startsWith('자본잠식')), JSON.stringify(ev3))
  let pos = withFactValue(base, 'totalAssets', '900000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  pos = withFactValue(pos, 'totalLiabilities', '600000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  check('D-306 자본이 있으면 부채비율은 짐작하지 않음(미확인 그대로)', policyEvidence(pos, facts(pos), T).input.debtRatioStatus === undefined)
  const req = requestItemsFrom([{ key: 'policy-funding', label: '정책자금', tone: 'need', headline: '', detail: '', missing: ['체납 확인 — 국세 납세증명서 · 4대보험 완납증명서'], openPath: '', openLabel: '', action: null }])
  check('D-306 요청 문구: "체납 확인 — …" 은 4대보험 명부가 아니라 납세증명서 · 완납증명서로', req.items.length === 1 && req.items[0].label.includes('납세증명서') && req.items[0].where.includes('위택스'), JSON.stringify(req))
}

// D-307 정책자금 가점 — 업체 기록의 인증 · 특허 · 연구소(올린 인증서 포함, 만료는 빼고) → 추천 기관이 달라진다
{
  const T = '2026-10-28'
  let base = normalizeClientOps({ id: 'pb307', companyName: '가점테크(주)', businessCategory: '제조업', businessItem: '정밀 금속 가공', businessAddress: '충청북도 청주시 흥덕구 1', establishedAt: '2019-03-02', employeeCount: '12', createdAt: NOW, updatedAt: NOW } as never)
  base = withFactValue(base, 'revenue', '2400000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  check('D-307 가점 없음 → 빈 목록', policyBonus(base, T).items.length === 0)
  let rich = withFactValue(base, 'certifications', '벤처기업, 이노비즈', { source: 'meeting', status: 'entered', now: NOW })
  rich = withFactValue(rich, 'patents', '특허 2건(제10-1234567호 외)', { source: 'meeting', status: 'entered', now: NOW })
  rich = withFactValue(rich, 'researchLab', '기업부설연구소(2024 인정)', { source: 'meeting', status: 'entered', now: NOW })
  const b = policyBonus(rich, T)
  check('D-307 회사 정보 글 → 특허 · 연구소 · 벤처 · 이노비즈', ['특허 보유', '기업부설연구소 보유', '벤처기업', '이노비즈'].every((x) => b.items.includes(x as never)) && b.items.length === 4, JSON.stringify(b))
  const certRec = normalizeClientOps({ ...base, factValues: { ...base.factValues, 'cf:메인비즈': '확인번호 M-1 · 확인일 2024-01-02 · 2027-01-01까지', 'cf:여성기업': '확인일 2022-01-01 · 2025-01-01까지' } } as never)
  const c = policyBonus(certRec, T)
  check('D-307 올린 인증서: 메인비즈(유효) 넣고 · 여성기업(만료) 빼고 알림', c.items.includes('메인비즈') && !c.items.includes('여성기업') && c.expired.some((x) => x.startsWith('여성기업(2025-01-01')), JSON.stringify(c))
  const stale = normalizeClientOps({ ...rich, factValues: { ...rich.factValues, 'cf:벤처기업': '확인일 2021-01-01 · 2024-01-01까지' } } as never)
  check('D-307 인증서가 만료면 회사 정보 글에 "벤처" 가 있어도 뺌', !policyBonus(stale, T).items.includes('벤처기업'))
  const renewed = normalizeClientOps({ ...stale, factValues: { ...stale.factValues, 'cf:벤처기업 (2)': '확인일 2025-01-01 · 2028-01-01까지' } } as never)
  check('D-307 옛 확인서가 만료여도 다시 받은 확인서(2)가 유효하면 벤처 가점 그대로', policyBonus(renewed, T).items.includes('벤처기업') && !policyBonus(renewed, T).expired.length, JSON.stringify(policyBonus(renewed, T)))
  const noLab = withFactValue(base, 'researchLab', '없음', { source: 'meeting', status: 'entered', now: NOW })
  const deptOnly = withFactValue(base, 'researchLab', '연구개발전담부서', { source: 'meeting', status: 'entered', now: NOW })
  check('D-307 연구소 "없음" · 전담부서만이면 연구소 가점 아님', !policyBonus(noLab, T).items.includes('기업부설연구소 보유') && !policyBonus(deptOnly, T).items.includes('기업부설연구소 보유'))
  const facts2 = (r: ReturnType<typeof normalizeClientOps>) => clientFacts(r, new Date(`${T}T00:00:00`))
  const inp = policyInputFromFacts(facts2(rich)).input
  const plain = runDiagnosis(inp)
  const withBonus = runDiagnosis({ ...inp, ...policyEvidence(rich, facts2(rich), T).input })
  const names = (r: ReturnType<typeof runDiagnosis>) => r.agencies.map((a) => a.name).join(',')
  check('D-307 엔진: 가점을 넘기면 추천 기관이 달라진다(기술 · 특허 쪽)', names(plain) !== names(withBonus) && withBonus.agencies.slice(0, 3).some((a) => /기술보증|기보/.test(a.name)), JSON.stringify({ plain: names(plain), bonus: names(withBonus) }))
  const ins = buildInsights(rich, T, []).find((i) => i.key === 'policy-funding')
  check('D-307 맞춤 추천 정책자금: "가점 특허, 연구소, 벤처기업, 이노비즈" 근거가 맨 앞', !!ins?.detail.includes('가점 특허, 연구소, 벤처기업, 이노비즈'), ins?.detail)
}

// D-310 정책자금 고용 — 4대보험 명부 진단(작년 평균 → 올해 · 청년) → 강점 '고용증가' · 청년 고용 '있음' → 고용창출 자금 · 중진공
{
  const T = '2026-10-28'
  const facts = (r: ReturnType<typeof normalizeClientOps>) => clientFacts(r, new Date(`${T}T00:00:00`))
  let base = normalizeClientOps({ id: 'ph310', companyName: '고용테크(주)', businessCategory: '서비스업', businessItem: '소프트웨어 개발', businessAddress: '대전광역시 유성구 1', establishedAt: '2021-03-02', employeeCount: '6', createdAt: NOW, updatedAt: NOW } as never)
  base = withFactValue(base, 'revenue', '400000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  const roster = (headcount: unknown, youthCount: number, createdAt = '2026-10-01T09:00:00.000Z') =>
    normalizeClientOps({ ...base, toolResults: [{ id: 'tr-r', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'candidates', verdictLabel: '', summary: '', data: { tab: 'roster', headcount, counts: { youthCount, newHireCount: 1 } }, deadlines: [], createdAt, publishedUpdateId: null }] } as never)
  const hc = (prev: number, cur: number, basis = 'history', asOf = '2026-10-01') => ({ asOf, prev: { year: 2025, total: prev, youth: 1, actualMonths: 12 }, cur: { year: 2026, total: cur, youth: 2, actualMonths: 10 }, basis, counted: 7, excluded: { rel: 0, noEi: 0, noHire: 0, lostNoDate: 0 } })
  check('D-310 명부 없음 → 고용 신호 없음', policyHiring(base, T) === null && policyEvidence(base, facts(base), T).input.strengths === undefined)
  const grew = roster(hc(5, 6.5), 2)
  const h = policyHiring(grew, T)
  check('D-310 작년 평균 5명 → 올해 6.5명 · 청년 2명 → 고용 증가', !!h?.grew && h.youth === 2 && h.line === '고용 증가(2025년 평균 5명 → 2026년 예상 6.5명, 청년 2명) — 고용창출 자금 대상', JSON.stringify(h))
  const ev = policyEvidence(grew, facts(grew), T)
  check('D-310 진단 입력: 강점 고용증가 · 청년 고용 있음', JSON.stringify(ev.input.strengths) === '["고용증가"]' && ev.input.youthEmployment === '있음', JSON.stringify(ev.input))
  check('D-310 근거 줄: 고용 증가가 체납 안내보다 앞(카드에 보이게)', ev.notes[0]?.startsWith('고용 증가('), JSON.stringify(ev.notes))
  const fell = policyHiring(roster(hc(8, 6), 0), T)
  check('D-310 줄었으면 고용 증가 아님 · 고용 유지 조건 확인 안내', !!fell && !fell.grew && fell.line.startsWith('직원이 줄었어요(2025년 평균 8명 → 2026년 예상 6명)'), JSON.stringify(fell))
  check('D-310 줄었으면 강점을 넣지 않음', policyEvidence(roster(hc(8, 6), 0), facts(base), T).input.strengths === undefined)
  const stale = policyHiring(roster(hc(5, 7, 'history', '2025-06-30'), 2, '2025-06-30T09:00:00.000Z'), T)
  check('D-310 명부가 400일 넘으면 쓰지 않고 새로 받으라고', !!stale && !stale.grew && stale.youth === 0 && stale.line.includes('1년 넘었어요'), JSON.stringify(stale))
  check('D-310 지금 직원만 있는 명부면 그렇다고 붙임', policyHiring(roster(hc(5, 6.5, 'current'), 0), T)?.line.includes('지금 직원만 있는 명부') === true)
  check('D-310 인원 기록이 없는 옛 결과 · 청년만 있으면 청년 고용 있음', policyHiring(roster(undefined, 3), T)?.line === '청년 직원 3명(4대보험 명부)' && policyEvidence(roster(undefined, 3), facts(base), T).input.youthEmployment === '있음')
  const inp = policyInputFromFacts(facts(grew)).input
  const plain = runDiagnosis(inp)
  const withHire = runDiagnosis({ ...inp, ...ev.input })
  const rankOf = (r: ReturnType<typeof runDiagnosis>) => r.agencies.findIndex((a) => /중소벤처기업진흥공단/.test(a.name))
  const tracks = (r: ReturnType<typeof runDiagnosis>) => (r.specialTracks ?? []).map((t) => t.name)
  check('D-310 엔진: 고용 증가를 넘기면 고용창출 자금이 나오고 중진공이 앞으로', tracks(withHire).includes('고용창출') && !tracks(plain).includes('고용창출') && (rankOf(plain) === -1 || rankOf(withHire) < rankOf(plain)), JSON.stringify({ plain: plain.agencies.map((a) => a.name), hire: withHire.agencies.map((a) => a.name) }))
  const ins = buildInsights(grew, T, []).find((i) => i.key === 'policy-funding')
  check('D-310 맞춤 추천 정책자금: 고용 증가 근거가 보인다', !!ins?.detail.includes('고용 증가(2025년 평균 5명 → 2026년 예상 6.5명'), ins?.detail)
}

// D-311 부가세 과세표준증명 → 해마다 매출 · 정책자금 준비 서류 ↔ 서류함
{
  const T = '2026-10-28'
  const facts = (r: ReturnType<typeof normalizeClientOps>) => clientFacts(r, new Date(`${T}T00:00:00`))
  // 개인(반기 확정) — 머리의 조회 기간 · 사업자번호 · 주민번호는 행이 아니다 · 2025년 2기는 수정신고가 이긴다
  const IND = [
    '발급번호 : 1234-567-8901-234',
    '부가가치세 과세표준증명',
    '상호(법인명) 미래상사 사업자등록번호 123-45-67890',
    '성명(대표자) 홍길동 주민(법인)등록번호 800101-1******',
    '과세기간 2024년 01월 01일 ~ 2026년 06월 30일',
    '과세기간 신고구분 신고일 과세표준 납부할세액',
    '2024.01.01~2024.06.30 확정 2024.07.25 100,000,000 5,000,000',
    '2024.07.01~2024.12.31 확정 2025.01.24 140,000,000 7,000,000',
    '2025.01.01~2025.06.30 확정 2025.07.25 130,000,000 6,500,000',
    '2025.07.01~2025.12.31 확정 2026.01.25 150,000,000 7,500,000',
    '2025.07.01~2025.12.31 수정신고 2026.03.10 154,000,000 7,700,000',
    '2026.01.01~2026.06.30 확정 2026.07.25 156,000,000 7,800,000',
  ].join('\n')
  const v = readVatCert(IND)
  check('D-311 부가세: 반기 행 5개(머리 조회 기간 · 번호는 행 아님) · 같은 기간은 수정신고', !!v && v.periods.length === 5 && v.periods.find((p) => p.from === '2025-07')?.base === 154_000_000, JSON.stringify(v?.periods))
  check('D-311 부가세: 해마다 — 2024 2.4억(다 참) · 2025 2.84억(다 참) · 2026 6개월', JSON.stringify(v?.years.map((y) => [y.year, y.total, y.months, y.full])) === '[[2024,240000000,12,true],[2025,284000000,12,true],[2026,156000000,6,false]]', JSON.stringify(v?.years))
  check('D-311 부가세: 가장 최근 다 찬 해 2025 · 작년 같은 기간 1.3억', latestFullYear(v!)?.year === 2025 && JSON.stringify(sameMonthsLastYear(v!, 2026)) === '{"cur":156000000,"prev":130000000,"months":6}')
  const line = vatSummary(v!, formatWon)
  check('D-311 부가세 요약 한 줄: 2025년 · 2024년보다 +18% · 2026년 6개월 · 작년 같은 기간보다 +20%', line === '2025년 2억 8,400만원(부가세 과세표준 · 2024년보다 +18%) · 2026년 6개월 1억 5,600만원(작년 같은 기간보다 +20%)', line)
  // 법인(분기 — 예정 · 확정 석 달씩) · 기수만 적힌 줄
  const CORP = ['부가가치세 과세표준증명', '(단위 : 원)', '2025년 1기 예정 2025-04-25 50,000,000', '2025년 1기 확정 2025-07-25 60,000,000', '2025년 2기 예정 2025-10-27 55,000,000', '2025년 2기 확정 2026-01-26 65,000,000'].join('\n')
  const c = readVatCert(CORP)
  check('D-311 부가세(법인 · 기수만): 예정이 있으면 확정은 뒤 석 달 → 2025 2.3억 다 참', JSON.stringify(c?.periods.map((p) => `${p.from}~${p.to}`)) === '["2025-01~2025-03","2025-04~2025-06","2025-07~2025-09","2025-10~2025-12"]' && c?.years[0]?.total === 230_000_000 && c.years[0].full, JSON.stringify(c?.periods))
  const OVER = ['부가가치세 과세표준증명', '2025.01.01~2025.03.31 예정 2025.04.25 50,000,000', '2025.01.01~2025.06.30 확정 2025.07.25 110,000,000', '2025.07.01~2025.12.31 확정 2026.01.25 120,000,000'].join('\n')
  const o = readVatCert(OVER)
  check('D-311 부가세: 예정(1~3월) + 확정(1~6월)이 겹치면 다 찬 해 아님(사람 확인)', !!o && o.years[0].overlap && !o.years[0].full && latestFullYear(o) === null, JSON.stringify(o?.years))
  check('D-311 부가세: 재무제표 · 서류 목록 글은 부가세 서류 아님', !looksLikeVatCert('재무상태표\n자산총계 1,000,000') && readVatCert('준비 서류: 사업자등록증, 부가세 과세표준증명원, 재무제표') === null)
  const EX = ['면세사업자 수입금액증명', '2024.01.01~2024.12.31 2025.02.10 88,000,000', '2025.01.01~2025.12.31 2026.02.10 99,000,000'].join('\n')
  const ex = readVatCert(EX)
  check('D-311 면세 수입금액증명: 해마다 그대로 · 이름 "면세 수입금액"', ex?.kind === 'exempt' && latestFullYear(ex)?.total === 99_000_000 && vatSummary(ex, formatWon).includes('면세 수입금액 · 2024년보다 +13%'), vatSummary(ex!, formatWon))

  // 분류 — 스캔 이름이어도 제목으로 '부가세 과세표준증명' 칸
  const base0 = normalizeClientOps({ id: 'vat311', companyName: '미래상사', businessCategory: '도소매', businessItem: '화장품', businessAddress: '대전광역시 서구 1', establishedAt: '2019-05-02', employeeCount: '3', createdAt: NOW, updatedAt: NOW } as never)
  const pl = placeDocument({ text: IND, fileName: 'scan_201.pdf' }, allDocumentMetas(base0))
  check('D-311 분류: 스캔 이름 → 새 칸 "부가세 과세표준증명"(확실)', pl.kind === 'new' && pl.label === '부가세 과세표준증명' && pl.sure, JSON.stringify(pl))
  check('D-311 분류: 새 칸 유효기간 1개월', knownDocValidMonths('부가세 과세표준증명') === 1)
  check('D-311 발급일: 과세기간(~ 의 앞 · 끝)은 발급일이 아님 · 아래 발급 날짜는 발급일', findIssuedDate(IND) === null && findIssuedDate(`${IND}\n위와 같이 증명합니다.\n2026년 10월 20일\n대전세무서장`) === '2026-10-20')

  // 올리기 → 매출이 비어 있으면 가장 최근 다 찬 해(2025) · 출처 부가세 과세표준증명 · 요약 줄
  let n = 0
  const ctx = { now: NOW, today: T, makeId: () => `v${++n}` }
  const doc = { key: 'customdoc_vat', fileName: 'scan_201.pdf', text: IND, method: 'pdf' as const, docSure: true }
  const out = await analyzeUploadedDocs(base0, [doc], ctx)
  const rev = readFact(out.record, 'revenue')
  check('D-311 올리기: 매출 2.84억 · 2025 · 부가세 과세표준증명', rev?.value === '284000000' && rev.asOf === '2025' && rev.source === 'vatCertificate' && rev.sourceLabel.startsWith('부가세 과세표준증명 2025'), JSON.stringify(rev))
  const ent = out.summary.entered.find((e) => e.key === 'revenue')
  check('D-311 올리기: 바로 넣은 정보에 해마다 · 전년 대비 한 줄', ent?.display === line, JSON.stringify(out.summary.entered))
  // 재무제표 2025 매출이 이미 있으면 묻지도 바꾸지도 않는다 · 2024 값이면 더 최근 해라 묻는다
  const fs25 = withFactValue(base0, 'revenue', '300000000', { source: 'financialStatements', status: 'confirmed', asOf: '2025', now: NOW })
  const keep = await analyzeUploadedDocs(fs25, [doc], ctx)
  check('D-311 재무제표 2025 매출이 있으면 그대로 · 확인할 것 없음', readFact(keep.record, 'revenue')?.value === '300000000' && !keep.summary.flagged.some((f) => f.key === 'revenue') && !pendingFacts(keep.record).some((p) => p.key === 'revenue'), JSON.stringify(keep.summary.flagged))
  const fs24 = withFactValue(base0, 'revenue', '250000000', { source: 'financialStatements', status: 'confirmed', asOf: '2024', now: NOW })
  const ask = await analyzeUploadedDocs(fs24, [doc], ctx)
  check('D-311 재무제표 2024 값이면 덮지 않고 2025 값을 물음', readFact(ask.record, 'revenue')?.value === '250000000' && pendingFacts(ask.record).some((p) => p.key === 'revenue' && p.value === '284000000'), JSON.stringify(pendingFacts(ask.record).map((p) => [p.key, p.value])))
  const overOut = await analyzeUploadedDocs(base0, [{ ...doc, text: OVER }], ctx)
  check('D-311 기간이 겹치면 매출은 넣지 않고 확인할 정보로', !readFact(overOut.record, 'revenue')?.value && overOut.summary.flagged.some((f) => f.key === 'revenue' && f.note.includes('겹쳐')), JSON.stringify(overOut.summary.flagged))

  // 준비 서류 ↔ 서류함 — 받은 것만 · 기한 지난 것은 빼고 알림 · 컨설팅 계약서는 거래처 계약서가 아님
  let r = withDocument(base0, 'businessRegistration', { received: true, issuedAt: '2026-01-02', fileName: '사업자등록증.pdf' })
  r = withCustomDocument(r, { label: '부가세 과세표준증명', validMonths: 1 })
  const vk = r.customDocuments[r.customDocuments.length - 1].key
  r = withDocument(r, vk, { received: true, issuedAt: '2026-10-20', fileName: 'scan_201.pdf' })
  r = withCustomDocument(r, { label: '납세증명서', validMonths: 1 })
  const nk = r.customDocuments[r.customDocuments.length - 1].key
  r = withDocument(r, nk, { received: true, issuedAt: '2026-07-01', fileName: '납세.pdf' })
  r = withCustomDocument(r, { label: '컨설팅 계약서' })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-01', fileName: '계약.pdf' })
  r = withCustomDocument(r, { label: '사업장 임대차계약서' })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2025-03-01', fileName: '임대차.pdf' })
  r = withCustomDocument(r, { label: '사업계획서' })
  const pd = policyDocs(r, T)
  check('D-311 준비 서류: 사업자등록증 · 부가세 · 임대차 · (빈 사업계획서 칸은 아님) · 컨설팅 계약서는 거래처 계약 아님', JSON.stringify([...pd.have].sort()) === '["bizReg","lease","vat"]', JSON.stringify(pd))
  // 기한(1개월)이 지난 부가세 증명 — 준비 서류에서 빼고 알림 · 다시 받은 '(2)' 가 있으면 그대로
  let old = withCustomDocument(base0, { label: '부가세 과세표준증명', validMonths: 1 })
  old = withDocument(old, old.customDocuments[0].key, { received: true, issuedAt: '2026-08-01', fileName: 'vat_old.pdf' })
  const po = policyDocs(old, T)
  check('D-311 준비 서류: 기한 지난 부가세 증명은 빼고 알림', !po.have.includes('vat') && po.expired.join() === '부가세 과세표준증명', JSON.stringify(po))
  check('D-311 진단 근거: "기한 지난 서류: 부가세 과세표준증명 — 새로 받기"', policyEvidence(old, facts(old), T).notes.includes('기한 지난 서류: 부가세 과세표준증명 — 새로 받기'))
  let renewed = withCustomDocument(old, { label: '부가세 과세표준증명 (2)', validMonths: 1 })
  renewed = withDocument(renewed, renewed.customDocuments[1].key, { received: true, issuedAt: '2026-10-21', fileName: 'vat_new.pdf' })
  const pr = policyDocs(renewed, T)
  check('D-311 준비 서류: 다시 받은 (2) 가 기한 안이면 확보 · 알림 없음', pr.have.includes('vat') && pr.expired.length === 0, JSON.stringify(pr))
  const ev = policyEvidence(r, facts(r), T)
  check('D-311 진단 입력 haveDocs', JSON.stringify([...(ev.input.haveDocs ?? [])].sort()) === '["bizReg","lease","vat"]', JSON.stringify(ev))
  const inp = { ...policyInputFromFacts(facts(r)).input, ...ev.input }
  const checks = runDiagnosis(inp).documentChecks ?? []
  const st = (l: string) => checks.find((x) => x.label.startsWith(l))?.status
  check('D-311 엔진 자료 체크: 서류함에 있는 사업자등록증 · 부가세 과세표준증명원 = 확보 · 사업계획서 = 요청 필요', st('사업자등록증') === '확보' && st('부가세과세표준증명원') === '확보' && st('사업계획서') === '요청 필요', JSON.stringify(checks))
  const plain = runDiagnosis(policyInputFromFacts(facts(r)).input).documentChecks ?? []
  check('D-311 엔진: 서류함을 넘기기 전에는 사업자등록증도 요청 필요였다', plain.find((x) => x.label.startsWith('사업자등록증'))?.status === '요청 필요')
  check('D-311 준비 서류 줄: "준비 서류 3/12 — 아직 …" 꼴 · 괄호 설명은 뺌', /^준비 서류 \d+\/\d+ — 아직 [^()]+$/.test(policyDocsLine(checks, true)) && policyDocsLine(checks, false) === '' && policyDocsLine([{ label: '사업자등록증', status: '확보' }], true) === '준비 서류 1/1 — 다 있어요', policyDocsLine(checks, true))
  const ins = buildInsights(r, T, []).find((i) => i.key === 'policy-funding')
  check('D-311 맞춤 추천 정책자금: 준비 서류 줄이 보인다', !!ins?.detail.includes('준비 서류 '), ins?.detail)
  check('D-311 서류함이 비면 준비 서류 줄 없음', !(buildInsights(base0, T, []).find((i) => i.key === 'policy-funding')?.detail ?? '').includes('준비 서류'))
}

// D-313 정책자금 신청 서류 요청 문구 — 서류함에 없는 것만 · 사업계획서는 저희가 · 체납 증명은 없는 것만
{
  const T = '2026-10-28'
  const checks = [
    { label: '표준재무제표 (3개년)', status: '요청 필요' },
    { label: '국세/지방세 납세증명서', status: '요청 필요' },
    { label: '사업계획서', status: '요청 필요' },
    { label: '대표자 신분증', status: '요청 필요' },
    { label: '새로 생긴 서류 (예시)', status: '요청 필요' },
    { label: '사업자등록증', status: '확보' },
  ]
  const ask = policyApplyAsk(checks, ['국세 납세증명서', '4대보험 완납증명서'])
  check('D-313 받을 것: 재무제표 · 없는 체납 증명만 · 신분증(뒷자리 가림) · 모르는 이름은 괄호 빼고 · 확보는 뺌', JSON.stringify(ask.items.map((i) => i.label)) === '["표준재무제표증명(최근 3년)","국세 납세증명서 · 4대보험 완납증명서","대표자 신분증 사본","새로 생긴 서류"]' && ask.items[2].where.includes('뒷자리는 가리고'), JSON.stringify(ask))
  check('D-313 사업계획서는 고객에게 달라고 하지 않음(저희가)', JSON.stringify(ask.ours) === '["사업계획서"]')
  const rec = { representativeName: '홍길동', contactName: '', companyName: '미래상사' }
  const msg = policyApplyMessage(rec, ask, '중소벤처기업진흥공단')
  check('D-313 문구: 대표님 · 회사 · 추천 기관 · 번호 · 어디서 · 사업계획서는 저희가', msg.startsWith('안녕하세요, 홍길동 대표님.') && msg.includes('미래상사 정책자금(중소벤처기업진흥공단) 신청을 준비하려고 합니다.') && msg.includes('1. 표준재무제표증명(최근 3년)\n   - 홈택스') && msg.includes('※ 사업계획서는 저희가 대표님과 통화로 함께 씁니다.') && !/AI/.test(msg), msg)
  check('D-313 받을 것이 없으면 빈 문구', policyApplyMessage(rec, { items: [], ours: ['사업계획서'] }, 'x') === '')
  // 맞춤 추천 카드 — 판정이 났으면 request · 서류함에 있는 사업자등록증 · 부가세는 문구에 없음
  let r = normalizeClientOps({ id: 'pa313', companyName: '미래상사', representativeName: '홍길동', businessCategory: '도소매', businessItem: '화장품', businessAddress: '대전광역시 서구 1', establishedAt: '2019-05-02', employeeCount: '3', createdAt: NOW, updatedAt: NOW } as never)
  r = withFactValue(r, 'revenue', '284000000', { source: 'vatCertificate', status: 'entered', asOf: '2025', now: NOW })
  r = withDocument(r, 'businessRegistration', { received: true, issuedAt: '2026-01-02', fileName: '사업자등록증.pdf' })
  r = withCustomDocument(r, { label: '부가세 과세표준증명', validMonths: 1 })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-20', fileName: 'vat.pdf' })
  const ins = buildInsights(r, T, []).find((i) => i.key === 'policy-funding')!
  check('D-313 카드: 판정이 나면 아직 받을 서류 요청(정책자금 신청 서류 요청 문구)', !!ins.request && ins.request.title === '정책자금 신청 서류 요청 문구' && ins.request.label === `아직 받을 서류 ${ins.request.count}가지 요청 문구` && ins.request.count > 3, JSON.stringify(ins.request))
  check('D-313 카드 문구: 서류함에 있는 사업자등록증 · 부가세 과세표준증명은 빼고 · 재무제표 · 납세증명은 넣음', !!ins.request && !ins.request.text.includes('사업자등록증 사본') && !ins.request.text.includes('부가가치세 과세표준증명') && ins.request.text.includes('표준재무제표증명') && ins.request.text.includes('국세 납세증명서'), ins.request?.text)
  const fresh = normalizeClientOps({ id: 'pa313b', companyName: '빈회사', createdAt: NOW, updatedAt: NOW } as never)
  check('D-313 판정 전(정보 부족)이면 요청 문구 없음', !buildInsights(fresh, T, []).find((i) => i.key === 'policy-funding')?.request)
}

// D-314 보낸 요청 문구 → 할 일 한 줄(세 가지 요청 문구 모양 모두)
{
  const pol = '안녕하세요, 홍길동 대표님.\n\n1. 표준재무제표증명(최근 3년)\n   - 홈택스\n2. 국세 납세증명서 · 4대보험 완납증명서\n   - 홈택스\n3. 대표자 신분증 사본\n   - 가림\n\n※ 사업계획서는 저희가'
  check('D-314 정책자금 신청 서류 문구 → "자료 받았는지 확인 — 표준재무제표증명(최근 3년) · 국세 납세증명서 · 4대보험 완납증명서 외 1가지"', requestFollowUpText(pol) === '자료 받았는지 확인 — 표준재무제표증명(최근 3년) · 국세 납세증명서 · 4대보험 완납증명서 외 1가지', requestFollowUpText(pol))
  const reco = '1. 4대보험 사업장 가입자 명부 — 고용지원금 확인용\n   - 4insure'
  check('D-314 받을 자료 문구(— 무엇 확인용) → 이름만', requestFollowUpText(reco) === '자료 받았는지 확인 — 4대보험 사업장 가입자 명부')
  const svc = '1. 사업자등록증 (기존 서류는 유효기간이 지나 새 발급본이 필요합니다)\n   - 홈택스\n2. 법인등기부등본\n   - 인터넷등기소'
  check('D-314 서류 요청 문구(유효기간 꼬리) → 이름만', requestFollowUpText(svc) === '자료 받았는지 확인 — 사업자등록증 · 법인등기부등본')
  check('D-314 받을 것이 없는 문구 → 빈 글(단추 없음)', requestFollowUpText('안녕하세요, 대표님. 현재 추가로 받을 서류는 없습니다.') === '')
}

/* ---- D-333 부가세 과세표준증명 → 회사 정보 '매출 추이' → 정책자금 매출 성장세 ---- */
{
  const T = '2026-10-28'
  const vatText = [
    '부가가치세 과세표준증명',
    '상호(법인명) 미래상사 사업자등록번호 123-45-67890',
    '과세기간 신고구분 신고일 과세표준 납부할세액',
    '2024.01.01~2024.06.30 확정 2024.07.25 100,000,000 5,000,000',
    '2024.07.01~2024.12.31 확정 2025.01.24 140,000,000 7,000,000',
    '2025.01.01~2025.06.30 확정 2025.07.25 130,000,000 6,500,000',
    '2025.07.01~2025.12.31 확정 2026.01.25 154,000,000 7,700,000',
    '2026.01.01~2026.06.30 확정 2026.07.25 156,000,000 7,800,000',
  ].join('\n')
  const found = factCandidatesFromDocText('vatCertificate' as never, vatText, 'doc:t')
  const trend = found.find((c) => c.key === 'cf:매출 추이')
  check('D-333 부가세 증명(2년 다 참) → 매출 + 회사 정보 매출 추이 한 줄(2024년보다 +18% · 작년 같은 기간 +20%)', !!trend && trend.value.includes('2025년') && trend.value.includes('2024년보다 +18%') && trend.value.includes('작년 같은 기간보다 +20%') && found.some((c) => c.key === 'revenue' && c.value === '284000000'), JSON.stringify(found.map((c) => `${c.key}=${c.value}`)))
  check('D-333 매출 추이 줄 → 3년 추세 증가 · 작년 같은 기간 비슷/감소 읽기', vatTrendOf('2025년 12억(부가세 과세표준 · 2024년보다 +20%)').trend3y === '증가' && vatTrendOf('… · 2026년 6개월 5억(작년 같은 기간보다 -2%)').thisYear === '비슷' && vatTrendOf('2025년 10억(부가세 과세표준 · 2024년보다 -8%)').trend3y === '감소')
  const rec = normalizeClientOps({ id: 'pe333', companyName: '증명테크(주)', businessCategory: '제조업', businessItem: '금속 가공', businessAddress: '충청북도 청주시 흥덕구 1', establishedAt: '2018-03-02', employeeCount: '12', factValues: { 'cf:매출 추이': trend?.value ?? '' }, createdAt: NOW, updatedAt: NOW } as never)
  const ev = policyEvidence(rec, clientFacts(rec, new Date(`${T}T00:00:00`)), T)
  check('D-333 정책자금 근거 — 매출 추이 증가 → 3년 추세 증가 · 앞줄 "매출 증가(…)"', ev.input.revenueTrend3y === '증가' && ev.notes[0]?.startsWith('매출 증가('), JSON.stringify({ i: ev.input.revenueTrend3y, n: ev.notes.slice(0, 2) }))
}

// D-338 진짜 저장 경로 — 서류를 올리면 인증서 · 매출 추이는 회사 정보 칸(customFields)에. 정책자금 가점 · 성장세 · 창업벤처가 그 칸을 읽는다
//        (예전 시험은 factValues 에 직접 넣어 통과했고, 실제로 올린 서류는 가점 · 성장세에서 빠졌다)
await (async () => {
  const T = '2026-10-28'
  const vat = [
    '부가가치세 과세표준증명', '상호(법인명) 저장테크(주) 사업자등록번호 123-45-67890', '과세기간 신고구분 신고일 과세표준 납부할세액',
    '2024.01.01~2024.06.30 확정 2024.07.25 100,000,000 5,000,000', '2024.07.01~2024.12.31 확정 2025.01.24 140,000,000 7,000,000',
    '2025.01.01~2025.06.30 확정 2025.07.25 130,000,000 6,500,000', '2025.07.01~2025.12.31 확정 2026.01.25 154,000,000 7,700,000',
    '2026.01.01~2026.06.30 확정 2026.07.25 156,000,000 7,800,000',
  ].join('\n')
  const ven = ['벤처기업확인서', '확인번호 : 20240501-01', '기업명 : 저장테크(주)', '유효기간 : 2024.05.01 ~ 2027.04.30', '벤처기업확인기관장'].join('\n')
  let n = 0
  const ctx = { now: NOW, today: T, makeId: () => `v${++n}` }
  const base = normalizeClientOps({ id: 'st338', companyName: '저장테크(주)', businessCategory: '제조업', businessItem: '금속 가공', businessAddress: '충청북도 청주시 흥덕구 1', establishedAt: '2022-03-02', employeeCount: '12', createdAt: NOW, updatedAt: NOW })
  const out = await analyzeUploadedDocs(base, [
    { key: 'customdoc_vat', fileName: '부가세과세표준증명.pdf', text: vat, method: 'pdf_text' as const, docSure: true },
    { key: 'customdoc_ven', fileName: '벤처기업확인서.pdf', text: ven, method: 'pdf_text' as const, docSure: true },
  ], ctx)
  const r = out.record
  const labels = r.customFields.map((f) => f.label)
  check('D-338 올린 서류 → 회사 정보 칸(매출 추이 · 벤처기업) · factValues 의 cf: 에는 없음', labels.some((l) => l.includes('매출 추이')) && labels.some((l) => l.includes('벤처기업')) && !Object.keys(r.factValues ?? {}).some((k) => k.startsWith('cf:')), JSON.stringify({ labels, fv: Object.keys(r.factValues ?? {}) }))
  check('D-338 정책자금 가점에 벤처기업(칸에서 읽음)', policyBonus(r, T).items.includes('벤처기업'), JSON.stringify(policyBonus(r, T)))
  const ev = policyEvidence(r, clientFacts(r, new Date(`${T}T00:00:00`)), T)
  check('D-338 정책자금 매출 성장세(칸의 매출 추이) → 3년 추세 증가', ev.input.revenueTrend3y === '증가' && ev.notes.some((x) => x.startsWith('매출 증가(')), JSON.stringify({ i: ev.input.revenueTrend3y, n: ev.notes.slice(0, 3) }))
  check('D-338 창업벤처 · 연구소 — 벤처 확인일 · 유효(칸에서 읽음)', ventureConfirmedAt(r) !== '' && ventureValidOn(r, T), `${ventureConfirmedAt(r)} ${ventureValidOn(r, T)}`)
  check('D-338 지원사업 맞춤 인증에도 벤처(칸에서 읽음)', credentialsOf(r, T).certs.includes('venture'), JSON.stringify(credentialsOf(r, T)))
})()

// D-339 취업규칙 → 정년 · 계속고용 → 맞춤 추천 고용 카드에 계속고용장려금 기회(만 60세 이상 직원이 있을 때)
await (async () => {
  const head = '취업규칙\n제1장 총칙\n제20조(근로시간) 1일 8시간 · 1주 40시간\n'
  const rehire = head + '제50조(정년) ① 직원의 정년은 만 60세로 한다. ② 정년에 도달한 직원 중 회사가 필요하다고 인정하는 자는 촉탁직으로 재고용할 수 있다.'
  const none = head + '제50조(정년) 직원의 정년은 만 60세로 하며, 정년에 도달한 날이 속하는 달의 말일에 퇴직한다.'
  const r1 = readRetireRule(rehire)
  const r2 = readRetireRule(none)
  const r3 = readRetireRule(head + '제50조(정년) 직원의 정년은 만 63세로 한다.')
  const r4 = readRetireRule(head + '제50조(정년) 회사는 정년을 두지 아니한다.')
  check('D-339 취업규칙 읽기: 60세 · 재고용 / 60세 · 조항 없음 / 63세 연장 / 정년 폐지', r1?.age === 60 && r1.continuing === 'rehire' && r2?.age === 60 && r2.continuing === null && r3?.continuing === 'extend' && r4?.continuing === 'abolish', JSON.stringify([r1, r2, r3, r4]))
  check('D-339 칸 글 → 제도 있음 · 없음', continuingOf(retireRuleLine(r1!)) === 'yes' && continuingOf(retireRuleLine(r2!)) === 'no' && continuingOf(retireRuleLine(r3!)) === 'yes' && continuingOf(retireRuleLine(r4!)) === 'yes' && continuingOf('') === null)
  const far = head + '제50조(정년) 직원의 정년은 만 60세로 한다.' + ' 제51조(휴직) 업무 외 질병으로 휴직할 수 있다. 제52조(포상) 회사는 우수 직원을 포상한다. 제53조(징계) 징계의 종류는 견책 · 감봉 · 정직 · 해고로 한다. 제54조(교육) 회사는 직무 교육을 한다. 제60조(경력 인정) 퇴직한 직원을 재고용하는 경우 이전 근속기간은 합산하지 않는다.'
  check('D-339 정년 조항과 먼 다른 조항의 "재고용" 은 정년 재고용으로 읽지 않음', readRetireRule(far)?.continuing === null, JSON.stringify(readRetireRule(far)))
  check('D-339 취업규칙이 아닌 글은 읽지 않음(근로계약서 · 정관)', !looksLikeWorkRules('근로계약서\n정년 60세') && !looksLikeWorkRules('정관\n제1조 상호') && looksLikeWorkRules(rehire))
  const ROSTER = ['4대보험 사업장 가입자 명부', ['성명', '주민등록번호', '자격취득일'].join('\t'), ['장정년', '650101-1234567', '2015-03-01'].join('\t')].join('\n')
  let n = 0
  const ctx = { now: NOW, today: '2026-10-28', makeId: () => `w${++n}` }
  const base = normalizeClientOps({ id: 'wr339', companyName: '규칙테크(주)', businessAddress: '충청북도 청주시 흥덕구 1', createdAt: NOW, updatedAt: NOW })
  const run = async (rules: string | null) => {
    const docs = [{ key: 'payrollRoster', fileName: '가입자명부.xlsx', text: ROSTER, method: 'xlsx' as const, docSure: true }]
    if (rules) docs.push({ key: 'customdoc_wr', fileName: '취업규칙.pdf', text: rules, method: 'pdf_text' as never, docSure: true })
    const out = await analyzeUploadedDocs(base, docs, ctx)
    return { rec: out.record, emp: buildInsights(out.record, '2026-10-28', []).find((i) => i.key === 'employment')?.detail ?? '' }
  }
  const a = await run(none)
  const b = await run(rehire)
  const c = await run(null)
  check('D-339 취업규칙 올리면 회사 정보 "정년 · 계속고용" 칸(출처 취업규칙)', a.rec.customFields.some((f) => f.label === '정년 · 계속고용' && f.value.startsWith('정년 60세 · 정년 뒤 재고용 · 연장 조항 없음')), JSON.stringify(a.rec.customFields))
  check('D-339 고용 카드: 조항 없음 → "넣고 1년 운영하면 계속고용장려금(1명 최대 1,440만원)" · 있음 → 후보 · 안 올림 → 취업규칙 올리라고', a.emp.includes('정년 뒤 재고용 조항이 없어요') && a.emp.includes('1,440만원') && b.emp.includes('계속고용 제도 있음') && c.emp.includes('취업규칙(정년 · 재고용 조항)을 올리면'), [a.emp, b.emp, c.emp].join(' || ').slice(0, 900))
})()

// D-340 연구소 — 회사 정보 글 · 올린 인정서(기업부설연구소 · 연구개발전담부서 칸) 둘 다 · '없음' 글은 연구소가 아님
{
  const base = normalizeClientOps({ id: 'lab340', companyName: '연구테크(주)', employeeCount: '12', createdAt: NOW, updatedAt: NOW })
  const withCert = normalizeClientOps({ ...base, customFields: [{ id: 'l1', group: 'credential', label: '기업부설연구소', value: '인정번호 2024-1 · 인정일 2024-01-02' }] } as never)
  const saysNone = withFactValue(base, 'researchLab', '없음', { source: 'meeting', status: 'entered', now: NOW })
  const saysLab = withFactValue(base, 'researchLab', '기업부설연구소(2024 인정)', { source: 'meeting', status: 'entered', now: NOW })
  check('D-340 연구소: 올린 인정서 → 있음 · 글 → 그 글 · "없음" 글 → 없음', researchLabOf(withCert).startsWith('기업부설연구소(') && researchLabOf(saysLab) === '기업부설연구소(2024 인정)' && researchLabOf(saysNone) === '' && researchLabOf(base) === '', [researchLabOf(withCert), researchLabOf(saysNone)].join(' | '))
  const T = '2026-10-28'
  check('D-340 상황 예시 · 맞춤 추천이 올린 인정서를 연구소로 본다(설립 권유 안 함)', fitContext(withCert, T).hasLab && !fitContext(saysNone, T).hasLab && (buildInsights(withCert, T, []).find((i) => i.key === 'labcare')?.headline ?? '').includes('연구소(전담부서)가 있어요'), buildInsights(withCert, T, []).find((i) => i.key === 'labcare')?.headline)
}

// D-342 근로소득 원천징수영수증 → 대표 월 급여(총급여 ÷ 근무한 달 수) — 대표 본인 것만 · 빈 칸만 · 다르면 확인 · 명부 · 회사 정보로 읽지 않음
await (async () => {
  const page = (who: string, rrn: string, period: string, pay: string, exempt: string, total: string | null) =>
    [
      '■ 소득세법 시행규칙 [별지 제24호서식(1)] <개정 2024. 3. 22.>',
      '거주구분 거주자1 /비거주자2',
      '세대주 여부 세대주1, 세대원2',
      '[ √ ]근로소득 원천징수영수증',
      '[ ]근로소득 지급명세서',
      '([√]소득자 보관용 [ ]발행자 보관용 [ ]발행자 보고용)',
      '징수의무자 ① 법인명(상 호) 주식회사 가나테크 ② 대 표 자(성 명) 박지훈',
      '③ 사업자등록번호 123-45-67890 ⑤ 소 재 지(주소) 서울특별시 강남구 테헤란로 1',
      `소득자 ⑥ 성 명 ${who} ⑦ 주 민 등 록 번 호(외국인등록번호) ${rrn}`,
      '⑧ 주 소 경기도 성남시 분당구 2',
      '구 분 주(현) 종(전) 종(전) ⑯-1 납세조합 합 계',
      '⑨ 근 무 처 명 주식회사 가나테크',
      `⑪ 근무기간 ${period} ~ ~`,
      `⑬ 급 여 ${pay} ${pay}`,
      '⑭ 상 여',
      `⑯ 계 ${pay} ${pay}`,
      `⑳ 비과세소득 계 ${exempt}`,
      '국민연금보험료 건강보험료(노인장기요양보험료 포함) 고용보험료',
      total ? `㉑ 총 급 여 (⑯, 다만 외국인단일세율 적용시 연간 근로소득) ${total}` : '',
      '㉒ 근 로 소 득 공 제 12,930,000',
      '인적공제 관계코드 성 명 내ㆍ외국인 주민등록번호',
      '0 박지훈 1 801231-1****** 3 김영희 1 820505-2******',
      '작성방법: 총급여액이 7,000만원 이하인 경우 ...',
    ]
      .filter(Boolean)
      .join('\n')
  const ceo = page('박지훈', '801231-1******', '2025.01.01~2025.12.31', '96,000,000', '2,400,000', '93,600,000')
  const r1 = readWageReceipts(ceo)
  check('D-342 영수증 판별 · 소득자(대표자 성명 칸 아님) · 총급여 ㉑ · 12개월 → 월 780만', looksLikeWageReceipt(ceo) && r1.length === 1 && r1[0].name === '박지훈' && r1[0].payerCeo === '박지훈' && r1[0].totalPay === 93_600_000 && r1[0].months === 12 && r1[0].year === 2025 && monthlyPayOf(r1[0]) === 7_800_000, JSON.stringify(r1))
  const p1only = readWageReceipts(page('박지훈', '801231-1******', '2025.01.01~2025.12.31', '96,000,000', '2,400,000', null))
  check('D-342 1쪽만(㉑ 없음) → ⑯ 계 − 비과세 계 = 9,360만 · 안내 글의 "7,000만원" 은 금액 아님', p1only[0]?.totalPay === 93_600_000, JSON.stringify(p1only))
  // D-417 스캔 영수증 — 마침표 금액 · 한 글자씩 띄운 이름
  const scan = readWageReceipts(page('박 지 훈', '801231-1******', '2025.01.01~2025.12.31', '96.000.000', '2.400.000', '93.600.000'))
  check('D-417 스캔 영수증("박 지 훈" · "93.600.000") → 박지훈 · 총급여 9,360만 · 월 780만(예전: 못 읽음)', scan.length === 1 && scan[0].name === '박지훈' && scan[0].totalPay === 93_600_000 && monthlyPayOf(scan[0]) === 7_800_000, JSON.stringify(scan))
  const mid = readWageReceipts(page('박지훈', '801231-1******', '2025.04.01~2025.12.31', '54,000,000', '0', '54,000,000'))
  check('D-342 4월 취임(근무기간 9개월) → 5,400만 ÷ 9 = 월 600만', mid[0]?.months === 9 && monthlyPayOf(mid[0]) === 6_000_000, JSON.stringify(mid))
  const bundle = [page('김민수', '950101-1******', '2025.01.01~2025.12.31', '42,000,000', '2,400,000', '39,600,000'), ceo].join('\n')
  const rb = readWageReceipts(bundle)
  check('D-342 여러 사람 묶음 → 사람마다 · 대표 이름으로 대표 것만 · 이름을 몰라도 같은 장의 대표자와 같은 사람', rb.length === 2 && ceoWageReceipt(rb, '박 지훈')?.totalPay === 93_600_000 && ceoWageReceipt(rb, '')?.name === '박지훈' && ceoWageReceipt(rb.slice(0, 1), '') === null, JSON.stringify(rb))

  let n = 0
  const ctx = { now: NOW, today: '2026-10-29', makeId: () => `wg${++n}` }
  const base = normalizeClientOps({ id: 'wg342', companyName: '주식회사 가나테크', representativeName: '박지훈', createdAt: NOW, updatedAt: NOW })
  const doc = { key: 'customdoc_wage', fileName: 'scan_002.pdf', text: bundle, method: 'pdf_text' as const, docSure: true }
  const out = await analyzeUploadedDocs(base, [doc], ctx)
  const e = out.summary.entered.find((x) => x.label === '대표 월 급여')
  check('D-342 올리면 절세 현황 대표 월 급여 7,800,000 · 바로 넣은 정보에 근거(2025년 총급여 ÷ 12개월)', out.record.taxProfile.monthlySalary === '7800000' && !!e && e.display.includes('월 780만원') && e.display.includes('2025년 총급여 9,360만원 ÷ 12개월'), JSON.stringify(out.summary.entered))
  const js = JSON.stringify(out.record)
  check('D-342 주민번호 · 주소 · 직원 급여는 기록에 없음 · 명부(고용 진단)로 읽지 않음 · 회사 정보 후보 없음', !js.includes('801231') && !js.includes('950101') && !js.includes('분당구') && !js.includes('39,600,000') && out.summary.roster === null && !out.record.toolResults?.some((t) => t.toolKey === 'employment') && !(out.record.factCandidates ?? []).length, js.slice(0, 300))
  const same = await analyzeUploadedDocs(normalizeClientOps({ ...base, taxProfile: { monthlySalary: '780만' } } as never), [doc], ctx)
  const other = await analyzeUploadedDocs(normalizeClientOps({ ...base, taxProfile: { monthlySalary: '500만' } } as never), [doc], ctx)
  check('D-342 이미 같은 금액("780만") → 조용히 · 다른 금액 → 덮지 않고 확인 필요', !same.summary.flagged.length && !same.summary.entered.length && other.record.taxProfile.monthlySalary === '500만' && other.summary.flagged.some((f) => f.label === '대표 월 급여' && f.note.includes('지금 적힌 값(500만)')), JSON.stringify([same.summary, other.summary.flagged]))
  const staff = await analyzeUploadedDocs(base, [{ ...doc, text: page('김민수', '950101-1******', '2025.01.01~2025.12.31', '42,000,000', '2,400,000', '39,600,000').replace('② 대 표 자(성 명) 박지훈', '② 대 표 자(성 명) 박지훈') }], ctx)
  check('D-342 직원 영수증만 → 대표 급여로 쓰지 않음(조용히)', !staff.record.taxProfile.monthlySalary && !staff.summary.flagged.length, JSON.stringify(staff.summary))
  // 맞춤 추천 — 등기부(취임일)와 함께면 퇴직금 한도가 계산되고 '대표 급여' 를 더 묻지 않는다
  const withStart = normalizeClientOps({ ...out.record, taxProfile: { ...out.record.taxProfile, ceoStartDate: '2015-07-21' } } as never)
  const tax = buildInsights(withStart, '2026-10-29', []).find((i) => i.key === 'tax')
  const taxBefore = buildInsights(normalizeClientOps({ ...base, taxProfile: { ceoStartDate: '2015-07-21' } } as never), '2026-10-29', []).find((i) => i.key === 'tax')
  const beforeAll = buildInsights(normalizeClientOps({ ...base, taxProfile: { ceoStartDate: '2015-07-21' } } as never), '2026-10-29', [])
  const afterAll = buildInsights(withStart, '2026-10-29', [])
  const opened = insightChanges(beforeAll, afterAll)
  check('D-345 이번 서류로 새로 판정: 절세 설계(정보 필요 → 판정) · 원래 판정 나던 모듈 · 아직 정보 필요한 모듈은 빠짐', opened.some((i) => i.key === 'tax') && opened.every((i) => { const prev = beforeAll.find((b) => b.key === i.key)?.tone ?? 'need'; return (i.tone !== 'need' && prev === 'need') || (i.tone === 'good' && prev !== 'good') }) && insightChanges(afterAll, afterAll).length === 0, JSON.stringify(opened.map((i) => `${i.key}:${i.tone}`)))
  check('D-345 올리기 전 기록(before)은 업체 기록의 올리기 기록에 남지 않음', !!out.summary.before && !('before' in docUploadLogOf(out.record, out.summary, 'u1')))
  check('D-342 맞춤 추천 절세: 영수증 전 "대표 급여" 필요 → 뒤 퇴직금 한도 계산 · 더 묻지 않음', !!taxBefore?.missing.includes('대표 급여') && !!tax && !tax.missing.includes('대표 급여') && tax.headline.includes('퇴직금'), JSON.stringify([taxBefore?.missing, tax?.headline, tax?.missing]))
  // 서류함 칸 — 제목('[ √ ]' 표시가 붙어도) · 취업규칙
  const metas = allDocumentMetas(base)
  const pw = placeDocument({ text: ceo, fileName: 'scan_002.pdf' }, metas)
  const pr = placeDocument({ text: '주식회사 가나테크 취업규칙\n제1장 총칙\n제1조(목적) 이 규칙은 근로조건을 정한다.', fileName: 'scan_003.pdf' }, metas)
  const pn = placeDocument({ text: '', fileName: '2025_근로소득원천징수영수증_박지훈.pdf' }, metas)
  check('D-342 서류함: 원천징수영수증 · 취업규칙 → 기타가 아니라 그 이름의 칸(파일 이름만이어도)', pw.label === '근로소득 원천징수영수증' && pw.sure && pr.label === '취업규칙' && pn.label === '근로소득 원천징수영수증', JSON.stringify([pw, pr, pn]))
  check('D-342 제목 찾기: "본 규칙" 은 제목 아님', documentTitle('본 규칙\n취업규칙') === '취업규칙')
  // 급여대장(엑셀) — 대표 줄 과세 급여 · 영수증과 함께면 이번 달 급여대장이 먼저
  const T = '\t'
  const ledger = [
    '2026년 9월분 급여대장',
    ['사번', '성명', '직위', '기본급', '식대', '지급합계', '비과세', '과세급여', '국민연금', '실지급액'].join(T),
    ['1', '박지훈', '대표이사', '8,000,000', '200,000', '8,200,000', '200,000', '8,000,000', '277,650', '7,100,000'].join(T),
    ['2', '김민수', '과장', '3,300,000', '200,000', '3,500,000', '200,000', '3,300,000', '148,500', '3,050,000'].join(T),
    ['', '합계', '', '11,300,000', '400,000', '11,700,000', '400,000', '11,300,000', '426,150', '10,150,000'].join(T),
  ].join('\n')
  const noTax = ledger.replace(`${T}비과세${T}과세급여`, `${T}공제1${T}공제2`)
  check('D-342 급여대장 판별 · 대표 줄 과세 급여 800만 · 달 2026-09 · 이름 몰라도 직위 "대표" · 과세 칸 없으면 지급합계', looksLikePayrollLedger(ledger) && readLedgerCeoPay(ledger, '박지훈')?.monthly === 8_000_000 && readLedgerCeoPay(ledger, '')?.month === '2026-09' && readLedgerCeoPay(ledger, '')?.name === '박지훈' && readLedgerCeoPay(noTax, '박지훈')?.monthly === 8_200_000 && readLedgerCeoPay(noTax, '박지훈')?.taxable === false && readLedgerCeoPay(ledger, '최없음') === null, JSON.stringify([readLedgerCeoPay(ledger, ''), readLedgerCeoPay(noTax, '박지훈')]))
  const both = await analyzeUploadedDocs(base, [doc, { key: 'customdoc_pay', fileName: '급여대장_9월.xlsx', text: ledger, method: 'xlsx' as const, docSure: true }], ctx)
  check('D-342 영수증 + 급여대장 → 이번 달 급여대장 800만(작년 영수증은 다시 묻지 않음) · 직원 급여는 기록에 없음', both.record.taxProfile.monthlySalary === '8000000' && !both.summary.flagged.length && !!both.summary.entered.find((x) => x.label === '대표 월 급여')?.display.includes('2026년 9월 급여대장 과세 급여') && !JSON.stringify(both.record).includes('3,300,000'), JSON.stringify([both.summary.entered, both.summary.flagged]))
  check('D-342 서류함: 급여대장 → 그 이름의 칸', placeDocument({ text: ledger, fileName: 'book1.xlsx' }, metas).label === '급여대장', JSON.stringify(placeDocument({ text: ledger, fileName: 'book1.xlsx' }, metas)))
  const legacySme = normalizeClientOps({ ...base, factValues: { 'cf:중소기업 확인서': '소기업 · 유효기간 2026-04-01 ~ 2027-03-31' } } as never)
  check('D-342 중소기업 확인: 예전 "cf:" 값으로 남은 확인서 칸도 확인으로', smeConfirmed(legacySme) && !smeConfirmed(base))
  const req = requestItemsFrom([{ key: 'tax', label: '절세 설계', tone: 'need', headline: '', detail: '', missing: ['대표 급여'], openPath: '', openLabel: '', action: null } as Insight]).items
  check('D-342 자료 요청: 대표 급여 → 원천징수영수증(올리면 바로 채워짐)', req[0]?.label === '대표님 근로소득 원천징수영수증(작년 것)' && req[0].where.includes('바로 채워집니다'), JSON.stringify(req))
})()

// D-344 홈택스 사업자등록증명 — 표 모양(쌍점 없이 '이름표 값 이름표 값') · '개업일' · 어느 칸에 올렸든 사업자등록증처럼 읽는다
await (async () => {
  const cert = (bizNo: string, rrn: string) =>
    [
      '발급번호 : 1234-567-8901-234',
      '사 업 자 등 록 증 명',
      '처리기간 즉시',
      `상호(법인명) 주식회사 가나테크 사업자등록번호 ${bizNo}`,
      `성명(대표자) 박지훈 주민(법인)등록번호 ${rrn}`,
      '사업장소재지 서울특별시 강남구 테헤란로 123, 4층',
      '개업일 2015년 07월 21일 사업자등록일 2015년 07월 23일',
      '업태 정보통신업 종목 응용 소프트웨어 개발 및 공급업',
      '공동사업자',
      '사용목적 금융기관 제출용',
      '위와 같이 사업자등록을 하였음을 증명합니다.',
      '2026년 10월 20일',
      '강남세무서장',
    ].join('\n')
  const corp = cert('123-81-67899', '110111-0123456')
  const val = (list: { key: string; value: string }[], k: string) => list.find((c) => c.key === k)?.value
  const f = factCandidatesFromDocText('customdoc_bizcert', corp, 'r')
  check('D-344 사업자등록증명(새 칸에 올림) → 회사명(번호 안 붙음) · 번호 · 대표 · 개업일 · 주소 · 업태 · 종목', isBizRegCertificate(corp) && val(f, 'companyName') === '주식회사 가나테크' && val(f, 'businessNumber') === '123-81-67899' && !f.find((c) => c.key === 'businessNumber')?.note && val(f, 'representativeName') === '박지훈' && val(f, 'establishedAt') === '2015-07-21' && val(f, 'businessAddress') === '서울특별시 강남구 테헤란로 123, 4층' && val(f, 'businessCategory') === '정보통신업' && val(f, 'businessItem') === '응용 소프트웨어 개발 및 공급업', JSON.stringify(f))
  const indiv = factCandidatesFromDocText('customdoc_bizcert', cert('214-05-01239', '800101-1234567'), 'r')
  check('D-344 개인사업자 증명의 주민(법인)등록번호는 어디에도 남지 않음(법인번호 · 생년월일로도)', !JSON.stringify(indiv).includes('800101') && !indiv.some((c) => c.key === 'corporateNumber') && val(indiv, 'businessNumber') === '214-05-01239', JSON.stringify(indiv))
  const form = ['정책자금 융자 신청서', '제출 서류', '사업자등록증명 1부', '상호 : 다른회사', '업태 : 도매업'].join('\n')
  check('D-344 신청서 본문의 "사업자등록증명 1부" 는 사업자등록증명이 아님(회사 정보로 안 읽음)', !isBizRegCertificate(form) && factCandidatesFromDocText('customdoc_form', form, 'r').length === 0)
  const nc = guessNewClientFromDocs([{ fileName: 'scan_01.pdf', text: corp, method: 'pdf_text' }])
  check('D-344 새 업체 등록 창: 사업자등록증명 하나로 업체명 · 대표자 · 사업자번호(파일마다 "사업자등록증명")', nc.guess.companyName?.value === '주식회사 가나테크' && nc.guess.contactName?.value === '박지훈' && nc.guess.businessNumber?.value === '123-81-67899' && nc.files[0]?.docLabel === '사업자등록증명', JSON.stringify([nc.guess, nc.files]))
  const base = normalizeClientOps({ id: 'bc344', companyName: '', createdAt: NOW, updatedAt: NOW })
  const metas = allDocumentMetas(base)
  const pc = placeDocument({ text: corp, fileName: 'scan_01.pdf' }, metas)
  check('D-344 서류함: "사업자등록증명" 칸(사업자등록증 칸을 덮지 않음) · 유효 1개월 · 발급일 2026-10-20', pc.kind === 'new' && pc.label === '사업자등록증명' && pc.sure && pc.issuedAt === '2026-10-20' && knownDocValidMonths('사업자등록증명') === 1, JSON.stringify(pc))
  let n = 0
  const out = await analyzeUploadedDocs(base, [{ key: 'customdoc_bizcert', fileName: 'scan_01.pdf', text: corp, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-29', makeId: () => `bc${++n}` })
  check('D-344 서류 올리기: 빈 업체에 회사명 · 번호 · 개업일 · 주소가 들어감', readFact(out.record, 'companyName')?.value === '주식회사 가나테크' && readFact(out.record, 'businessNumber')?.value.replace(/\D/g, '') === '1238167899' && readFact(out.record, 'establishedAt')?.value === '2015-07-21' && (readFact(out.record, 'businessAddress')?.value ?? '').includes('테헤란로 123'), JSON.stringify([out.summary.entered, out.summary.flagged]))
})()

// D-371 서류 칸 잘못 가던 것 — 건물 등기부 → 법인 등기부 칸 · 이노비즈/메인비즈 확인서 → 중소기업확인서 칸 · 임대차 기간 끝날 → 발급일
await (async () => {
  const base = normalizeClientOps({ id: 'dc371', companyName: '주식회사 미래', createdAt: NOW, updatedAt: NOW })
  const metas = allDocumentMetas(base)
  const estate = ['등기사항전부증명서(말소사항 포함) - 건물', '고유번호 1101-2010-012345', '【 표 제 부 】 ( 건물의 표시 )', '표시번호 접 수 소재지번 및 건물번호', '1 2010년3월2일 서울특별시 강남구 역삼동 123 철근콘크리트조', '【 갑 구 】 ( 소유권에 관한 사항 )', '1 소유권보존 2010년3월2일 소유자 주식회사미래 110111-1234567', '【 을 구 】 ( 소유권 이외의 권리에 관한 사항 )', '1 근저당권설정 채권최고액 금300,000,000원', '발행일 2026/10/20'].join('\n')
  const pe = placeDocument({ text: estate, fileName: 'scan.pdf' }, metas)
  check('D-371 건물 등기부 → "부동산 등기사항증명서" 새 칸(법인 등기부 칸 아님)', pe.kind === 'new' && pe.label === '부동산 등기사항증명서', JSON.stringify(pe))
  const estate2 = estate.replace(' - 건물', '').replace('( 건물의 표시 )', '( 1동의 건물의 표시 )')
  const pe2 = placeDocument({ text: estate2, fileName: 'scan.pdf' }, metas)
  check('D-371 제목 줄에 "건물" 이 없어도 표제부 · 소유권이 있으면 부동산 등기부', pe2.kind === 'new' && pe2.label === '부동산 등기사항증명서', JSON.stringify(pe2))
  const ce = classifyDocument({ text: estate.split('\n').slice(1).join('\n'), fileName: 'a.pdf' }, DOCUMENTS)
  check('D-371 제목 없이 낱말만 — 법인 등기부 아님 · 부동산 등기부로 제안', ce.key !== 'corporateRegistry' && ce.suggestedLabel === '부동산 등기사항증명서', JSON.stringify(ce))
  const corp = ['등기사항전부증명서(말소사항 포함)', '등기번호 012345', '상 호 주식회사 미래', '본 점 서울특별시 강남구', '1주의 금액 금 5,000 원', '임원에 관한 사항', '대표이사 홍길동', '회사성립연월일 2015년 03월 02일', '발행일 2026/10/20'].join('\n')
  const pc = placeDocument({ text: corp, fileName: 'scan.pdf' }, metas)
  check('D-371 법인 등기부는 그대로 법인 등기부 칸(확실)', pc.kind === 'existing' && pc.key === 'corporateRegistry' && pc.sure, JSON.stringify(pc))
  let n = 0
  const out = await analyzeUploadedDocs(base, [{ key: 'customdoc_estate', fileName: 'scan.pdf', text: estate, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `dc${++n}` })
  check('D-371 건물 등기부는 회사 정보 · 절세 현황으로 읽지 않음(법인번호 · 주소 · 1주 금액 0)', !readFact(out.record, 'corporateNumber')?.value && !readFact(out.record, 'businessAddress')?.value && !out.summary.entered.length && !out.summary.flagged.length, JSON.stringify([out.summary.entered, out.summary.flagged]))
  const inno = ['제 R-2024-1234 호', '주식회사 미래는 기술혁신형 중소기업(INNO-BIZ)으로 확인되었음을 증명합니다', '유효기간 2024. 05. 01 ~ 2027. 04. 30', '중소벤처기업부장관'].join('\n')
  const pi = placeDocument({ text: inno, fileName: 'scan.pdf' }, metas)
  check('D-371 이노비즈 확인서(제목 줄 없이) → 중소기업확인서 칸 아님 · "이노비즈 확인서" · 유효 3년 · 끝 2027-04-30', pi.kind === 'new' && pi.label === '이노비즈 확인서' && pi.validUntil === '2027-04-30' && knownDocValidMonths('이노비즈 확인서') === 36, JSON.stringify(pi))
  const main = placeDocument({ text: ['경영혁신형 중소기업(MAIN-BIZ) 확인서', '업체명 주식회사 미래', '유효기간 2025.01.01 ~ 2028.12.31', '중소벤처기업부장관'].join('\n'), fileName: 'scan.pdf' }, metas)
  check('D-371 "경영혁신형 중소기업 확인서" → "메인비즈 확인서" 칸', main.kind === 'new' && main.label === '메인비즈 확인서', JSON.stringify(main))
  const sme = placeDocument({ text: ['중소기업 확인서', '기업명 주식회사 미래', '기업규모 소기업', '유효기간 2026.04.01 ~ 2027.03.31', '중소벤처기업부'].join('\n'), fileName: 'scan.pdf' }, metas)
  check('D-371 진짜 중소기업 확인서는 그대로 중소기업확인서 칸', sme.kind === 'existing' && sme.key === 'smeCertificate', JSON.stringify(sme))
  const lease = ['부동산(상가) 임대차 계약서', '임대인과 임차인 쌍방은 아래 표시 부동산에 관하여 임대차계약을 체결한다.', '보증금 금 일억원정 차임 금 오백만원정(매월)', '임대차 기간 2025년 1월 1일부터 2027년 12월 31일까지'].join('\n')
  const pl = placeDocument({ text: lease, fileName: 'scan.pdf' }, metas)
  check('D-371 임대차계약서 → "임대차계약서" 칸 · 계약 끝날(2027-12-31)을 발급일로 읽지 않음', pl.kind === 'new' && pl.label === '임대차계약서' && pl.issuedAt === null, JSON.stringify(pl))
  check('D-371 "A부터 B까지" 밖의 날짜는 그대로 발급일', findIssuedDate(`${lease}\n2024년 12월 20일\n임대인 홍길동`) === '2024-12-20')
  let r = withCustomDocument(base, { label: '부동산 등기사항증명서' })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-20', fileName: '건물.pdf' })
  r = withCustomDocument(r, { label: '이노비즈 확인서', validMonths: 36 })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2024-05-01', fileName: '이노.pdf' })
  r = withCustomDocument(r, { label: '금융거래확인서' })
  r = withDocument(r, r.customDocuments[r.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-01', fileName: '금융.pdf' })
  const pd = policyDocs(r, '2026-10-31')
  check('D-371 정책자금 준비 서류: 건물 등기부 → 사업장 건물 등기 확보 · 법인 등기부는 아님 · 이노비즈 → 보유 인증서 · 금융거래확인서 → 대출 내역', pd.have.includes('ownDeed') && !pd.have.includes('corpRegistry') && pd.have.includes('bizCert') && pd.have.includes('loanStatus'), JSON.stringify(pd))
})()

// D-373 개인사업자 소득금액증명 → 매출 · 순이익 · 매출 추이 · 정책자금 재무 서류 / 인증서 번호에 사업자번호 안 들어감 / 취임 한 번만
await (async () => {
  const INC = ['소득금액 증명', '(종합소득세 신고자용)', '성명 홍길동 주민등록번호 800101-1******', '(단위 : 원)', '귀속연도 사업자등록번호 상호 소득구분 수입금액 필요경비 소득금액', '2025 214-05-01239 미래상사 사업소득 240,000,000 180,000,000 60,000,000', '2024 214-05-01239 미래상사 사업소득 200,000,000 160,000,000 40,000,000', '위와 같이 소득금액을 증명합니다.', '2026년 10월 20일', '강남세무서장'].join('\n')
  const ir = readIncomeCert(INC)
  check('D-373 소득금액증명 표(수입 · 경비 · 소득) → 해마다 · 검산 맞음 · 사업자번호 · 주민번호는 금액 아님', JSON.stringify(ir) === '{"years":[{"year":2024,"revenue":200000000,"income":40000000,"rows":1},{"year":2025,"revenue":240000000,"income":60000000,"rows":1}],"sure":true}', JSON.stringify(ir))
  const ir2 = readIncomeCert(['소득금액증명원', '(단위 : 천원)', '귀속연도 2025', '사업소득 240,000 60,000'].join('\n'))
  check('D-373 귀속연도가 위 줄 · 금액 둘(수입 · 소득) · 단위 천원', ir2?.years[0]?.year === 2025 && ir2.years[0].revenue === 240_000_000 && ir2.years[0].income === 60_000_000 && ir2.sure, JSON.stringify(ir2))
  check('D-373 근로소득 줄만 있으면(법인 대표 개인 증명) 읽지 않음', readIncomeCert(['소득금액증명', '2025 근로소득 주식회사미래 84,000,000 70,000,000'].join('\n')) === null)
  const bad = readIncomeCert(['소득금액증명', '2025 사업소득 240,000,000 180,000,000 70,000,000'].join('\n'))
  check('D-373 검산이 안 맞으면 확실하지 않음', bad?.sure === false, JSON.stringify(bad))
  const base = normalizeClientOps({ id: 'ic373', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  const pl = placeDocument({ text: INC, fileName: 'scan_07.pdf' }, allDocumentMetas(base))
  check('D-373 서류함: "소득금액증명" 칸 · 유효 1개월 · 발급일 2026-10-20', pl.kind === 'new' && pl.label === '소득금액증명' && pl.issuedAt === '2026-10-20' && knownDocValidMonths('소득금액증명') === 1, JSON.stringify(pl))
  const VAT = ['부가가치세 과세표준증명', '과세기간 신고구분 신고일 과세표준', '2024.01.01~2024.06.30 확정 2024.07.25 95,000,000', '2024.07.01~2024.12.31 확정 2025.01.24 100,000,000', '2025.01.01~2025.06.30 확정 2025.07.25 115,000,000', '2025.07.01~2025.12.31 확정 2026.01.25 120,000,000'].join('\n')
  const doc = (key: string, text: string) => ({ key, fileName: `${key}.pdf`, text, method: 'pdf_text' as const, docSure: true })
  let n = 0
  const ctx = { now: NOW, today: '2026-10-31', makeId: () => `ic${++n}` }
  const a = await analyzeUploadedDocs(base, [doc('customdoc_inc', INC)], ctx)
  check('D-373 소득금액증명만: 매출 2.4억 · 순이익 6천만 · 매출 추이(2024년보다 +20%) 바로 · 묻지 않음', readFact(a.record, 'revenue')?.value === '240000000' && readFact(a.record, 'netIncome')?.value === '60000000' && customFactValue(a.record, '매출 추이').includes('2024년보다 +20%') && a.summary.flagged.length === 0, JSON.stringify([a.summary.entered, a.summary.flagged]))
  const b = await analyzeUploadedDocs(base, [doc('customdoc_vat', VAT), doc('customdoc_inc', INC)], ctx)
  check('D-373 부가세 + 소득금액증명 함께: 매출은 먼저 읽은 부가세 · 순이익은 소득금액 · 질문 0', readFact(b.record, 'revenue')?.value === '235000000' && readFact(b.record, 'netIncome')?.value === '60000000' && b.summary.flagged.length === 0, JSON.stringify(b.summary.flagged))
  const c = await analyzeUploadedDocs(base, [doc('customdoc_inc', INC), doc('customdoc_vat', VAT)], ctx)
  check('D-373 순서를 바꿔도 질문 0(부가세 매출 · 매출 추이가 소득금액증명 값에 밀림)', readFact(c.record, 'revenue')?.value === '240000000' && c.summary.flagged.length === 0, JSON.stringify(c.summary.flagged))
  const d = await analyzeUploadedDocs(base, [doc('customdoc_bad', ['소득금액증명', '2025 사업소득 240,000,000 180,000,000 70,000,000'].join('\n'))], ctx)
  check('D-373 검산이 안 맞으면 바로 넣지 않고 확인할 것으로(까닭)', !readFact(d.record, 'revenue')?.value && d.summary.flagged.some((f) => f.key === 'revenue' && /검산/.test(f.note)), JSON.stringify(d.summary.flagged))
  const slot = (r: ReturnType<typeof normalizeClientOps>) => {
    let x = withCustomDocument(r, { label: '소득금액증명', validMonths: 1 })
    x = withDocument(x, x.customDocuments[x.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-20', fileName: '소득.pdf' })
    return x
  }
  const ind = slot(normalizeClientOps({ id: 'ic373i', companyName: '미래상사', businessNumber: '214-05-01239', createdAt: NOW, updatedAt: NOW }))
  const corp = slot(normalizeClientOps({ id: 'ic373c', companyName: '(주)미래', businessNumber: '124-81-00998', createdAt: NOW, updatedAt: NOW }))
  check('D-373 정책자금 준비 서류: 개인사업자 소득금액증명 → 재무 서류 확보 · 법인은 아님(대표 개인 증명)', policyDocs(ind, '2026-10-31').have.includes('financial') && !policyDocs(corp, '2026-10-31').have.includes('financial'))
  const sme = parseCertificateDocument(['중소기업 확인서', '기업명 주식회사 미래바이오랩', '사업자등록번호 124-81-00998', '기업규모 소기업', '유효기간 2026.04.01 ~ 2027.03.31', '중소벤처기업부'].join('\n'))
  check('D-373 중소기업 확인서 확인번호 칸에 사업자등록번호가 들어가지 않음', sme?.number === '' && sme.size === '소기업', JSON.stringify(sme))
  const reg = readRegistryTax(['등기사항전부증명서(말소사항 포함)', '1주의 금액 금 5,000 원', '임원에 관한 사항', '사내이사 이대표 750101-******* 2021 년 03 월 02 일 취임', '대표이사 이대표 750101-******* 경기도 파주시 2021 년 03 월 02 일 취임', '회사성립연월일 2021 년 03 월 02 일'].join('\n'), '이대표')
  check('D-373 대표 취임일 설명 — 같은 날 취임을 두 번 쓰지 않음', reg?.ceoStart === '2021-03-02' && reg.ceoStartNote === '2021-03-02 취임', JSON.stringify(reg))
})()

// D-378 세무조정계산서 · 법인세 · 종합소득세 신고서 → 받은 공제 · 감면 → 신고서에 빠진 공제(경정청구 5년)
await (async () => {
  const TR1 = ['법인세 과세표준 및 세액신고서', '사업연도 2025.01.01 ~ 2025.12.31', '법인명 주식회사 미래테크 사업자등록번호 124-81-00998', '공제감면세액 및 추가납부세액합계표(갑)', '구분 근거법조항 코드 대상세액 감면(공제)세액', '연구·인력개발비에 대한 세액공제 조특법 제10조 13L', '창업중소기업 등에 대한 세액감면 조특법 제6조 11A', '중소기업에 대한 특별세액감면 조특법 제7조 112 8,500,000', '통합고용세액공제 조특법 제29조의8 1C1', '통합투자세액공제 조특법 제24조 13W 0', '최저한세 적용대상 공제감면세액 8,500,000', '표준재무상태표', '자산총계 3,000,000,000 부채총계 1,200,000,000'].join('\n')
  const r1 = readTaxReturn(TR1)
  check('D-378 법인세 신고서: 사업연도 2025 · 금액 있는 줄만 받음(특별세액감면 850만) · 빈 줄 · 0 · 조문 · 코드는 아님', r1?.kind === 'corp' && r1.year === 2025 && r1.items.length === 1 && r1.items[0].group === 'smeSpecial' && r1.items[0].amount === 8_500_000 && r1.sectionSeen, JSON.stringify(r1))
  const TR2 = ['세무조정계산서', '사업연도 2025년 1월 1일 ~ 2025년 12월 31일', '세액공제조정명세서(3)', '연구·인력개발비에 대한', '세액공제 10조 12,000,000 12,000,000', '통합고용세액공제 29조의8 15,400,000', '근로소득을 증대시킨 기업에 대한 세액공제 3,000,000'].join('\n')
  const r2 = readTaxReturn(TR2)
  check('D-378 이름이 두 줄로 나뉘어도 · 같은 금액 두 칸은 하나로 · 모르는 공제는 목록 밖', r2?.year === 2025 && r2.items.map((i) => `${i.group}:${i.amount}`).sort().join() === 'employment:15400000,rnd:12000000', JSON.stringify(r2))
  const TR3 = ['종합소득세ㆍ농어촌특별세ㆍ지방소득세 과세표준확정신고 및 납부계산서', '2025년 귀속', '세액감면 신청서', '창업중소기업 세액감면 3,200,000'].join('\n')
  const r3 = readTaxReturn(TR3)
  check('D-378 개인사업자 종합소득세 신고서 → 2025 귀속 · 창업감면 320만', r3?.kind === 'personal' && r3.year === 2025 && r3.items[0]?.group === 'startup' && r3.items[0].amount === 3_200_000, JSON.stringify(r3))
  const front = readTaxReturn(['법인세 과세표준 및 세액신고서', '사업연도 2025.01.01 ~ 2025.12.31', '법인명 주식회사 미래테크'].join('\n'))
  check('D-378 첫 장만(공제 · 감면 칸 없음) → 칸을 만들지 않음("없음" 이라고 적지 않음)', !!front && !front.sectionSeen && factCandidatesFromDocText('customdoc_tr', ['법인세 과세표준 및 세액신고서', '사업연도 2025.01.01 ~ 2025.12.31', '법인명 주식회사 미래테크'].join('\n'), 'r').length === 0)
  const total = readTaxReturn(['법인세 과세표준 및 세액신고서', '사업연도 2025.01.01 ~ 2025.12.31', '공제감면세액 8,500,000'].join('\n'))
  const totalVal = total ? reliefFactValue(total, (n) => `${n}`) : ''
  check('D-378 이름 없이 합계만 있으면 "없음" 이 아님 — 어떤 공제인지 서식에서 · 판정에 안 씀', /어떤 공제인지/.test(totalVal) && reliefYearsOf([['cf:받은 공제 · 감면 2025년', totalVal]], 'cf:').length === 0, totalVal)
  check('D-378 소득금액증명 · 과세표준증명은 신고서가 아님', !looksLikeTaxReturn(['소득금액 증명', '(종합소득세 신고자용)', '종합소득세 과세표준확정신고 기준'].join('\n')) && !looksLikeTaxReturn('부가가치세 과세표준증명'))
  const base = normalizeClientOps({ id: 'tr378', companyName: '미래테크', businessNumber: '124-81-00998', createdAt: NOW, updatedAt: NOW })
  const pl = placeDocument({ text: TR1, fileName: 'scan_11.pdf' }, allDocumentMetas(base))
  check('D-378 서류함: 표준재무제표가 같이 있어도 "세무조정계산서" 칸(재무제표 아님)', pl.kind === 'new' && pl.label === '세무조정계산서', JSON.stringify(pl))
  const pl3 = placeDocument({ text: TR3, fileName: 'scan_12.pdf' }, allDocumentMetas(base))
  check('D-378 서류함: 종합소득세 신고서 칸', pl3.kind === 'new' && pl3.label === '종합소득세 신고서', JSON.stringify(pl3))
  const doc = (key: string, text: string) => ({ key, fileName: `${key}.pdf`, text, method: 'pdf_text' as const, docSure: true })
  let n = 0
  const a = await analyzeUploadedDocs(base, [doc('customdoc_tr', TR1)], { now: NOW, today: '2026-10-31', makeId: () => `tr${++n}` })
  check('D-378 올리기 한 번 → 회사 정보 "받은 공제 · 감면 2025년" 바로(묻지 않음)', customFactValue(a.record, '받은 공제 · 감면 2025년') === '중소기업 특별세액감면 850만원(법인세 신고서)' && a.summary.flagged.length === 0, JSON.stringify([customFactValue(a.record, '받은 공제 · 감면 2025년'), a.summary.flagged]))
  check('D-378 경정청구 기한: 법인 2020년분은 2026-03-31 끝 · 2021년분은 아직 · 개인 2020년분은 2026-05-31', !refundOpen(2020, '2026-10-31') && refundOpen(2021, '2026-10-31') && refundOpen(2020, '2026-05-31', 'personal') && !refundOpen(2020, '2026-06-01', 'personal'))
  const rec = (relief: string) => normalizeClientOps({ ...base, businessAddress: '서울특별시 강남구 테헤란로 1', customFields: [{ id: 'rl', group: 'identity', label: '받은 공제 · 감면 2025년', value: relief }] } as never)
  const none = rec('법인세 신고서에 공제 · 감면 없음')
  const facts = clientFacts(none, new Date('2026-10-31T00:00:00'))
  const ry = reliefYears(none, facts, '2026-10-31')
  check('D-378 회사 정보 칸 → 2025년 · 받은 것 없음', ry.length === 1 && ry[0].year === 2025 && ry[0].none, JSON.stringify(ry))
  const past = { asOf: '2025-12-31', prev: { year: 2024, total: 3, youth: 0, actualMonths: 12 }, cur: { year: 2025, total: 5, youth: 1, actualMonths: 12 }, basis: 'history' as const, counted: 6, excluded: { rel: 0, noEi: 0, noHire: 0, lostNoDate: 0 } }
  const e1 = employmentRefund(none, facts, ry, past)
  check('D-378 고용: 2025년 3 → 5명 늘었는데 신고서에 통합고용 없음 → 경정청구 금액(그해 단가)', e1.won > 0 && e1.year === 2025 && e1.line.startsWith('2025년 평균 3 → 5명으로 늘었는데 2025년 법인세 신고서에 통합고용세액공제가 없어요 — 경정청구 검토 약'), JSON.stringify(e1))
  const flat = { ...past, cur: { ...past.cur, total: 3, youth: 0 } }
  check('D-378 고용: 인원이 그대로면 말하지 않음(맞게 안 받은 것) · 명부가 없으면 "늘었다면"', employmentRefund(none, facts, ry, flat).line === '' && /그해 직원이 늘었다면 경정청구 검토/.test(employmentRefund(none, facts, ry, null).line))
  const got = rec('통합고용세액공제 1,540만원 · 연구 · 인력개발비 세액공제 1,200만원(법인세 신고서)')
  const ryGot = reliefYears(got, facts, '2026-10-31')
  check('D-378 받은 해는 "받고 있어요"(금액 · 경정청구 아님)', /받고 있어요/.test(employmentRefund(got, facts, ryGot, past).line) && employmentRefund(got, facts, ryGot, past).won === 0)
  check('D-378 연구소 인정일 해 · 유효기간 날짜는 빼고', labYearOf('기업부설연구소(인정번호 2021-1 · 인정일 2021-03-02)') === 2021 && labYearOf('2027-12-31까지 · 인정일 2022-05-01') === 2022 && labYearOf('있음') === null)
  const lr = labRefund('기업부설연구소(인정일 2021-03-02)', facts, ry)
  check('D-378 연구소: 2021년부터 있는데 2025년 신고서에 연구 · 인력개발비 없음 → 분명 · 경정청구', lr.sure && lr.line.startsWith('2021년부터 연구소가 있는데 2025년 법인세 신고서에 연구 · 인력개발비 세액공제가 없어요'), JSON.stringify(lr))
  check('D-378 연구소: 2026년에 생긴 연구소는 2025년 신고서와 상관없음 · 받았으면 챙기고 있어요', labRefund('인정일 2026-02-01', facts, ry).line === '' && labRefund('인정일 2021-03-02', facts, ryGot).claimed)
  const sr = startupRefund('2023-04-01', facts, ry)
  const ryS = reliefYearsOf([['cf:받은 공제 · 감면 2025년', '중소기업 특별세액감면 850만원(법인세 신고서)']], 'cf:')
  check('D-378 창업감면: 감면 기간 안 해 신고서에 없음 → 경정청구 검토 · 특별세액감면을 받았으면 큰 쪽 확인 · 기간 밖 해는 말하지 않음', /2025년 법인세 신고서에 창업중소기업 세액감면이 없어요 — 그해 세금을 냈다면 경정청구/.test(sr.line) && /특별세액감면은 받음/.test(startupRefund('2023-04-01', facts, ryS).line) && startupRefund('2015-04-01', facts, ry).line === '')
  // 맞춤 추천 카드까지 — 연구소 인정서 + 신고서(연구개발비 없음) → 연구소 '가능성 높음' 맨 앞 줄
  const labRec = normalizeClientOps({ ...none, customFields: [...none.customFields, { id: 'lb', group: 'credential', label: '기업부설연구소', value: '인정번호 2021-1 · 인정일 2021-03-02' }] } as never)
  const labCard = buildInsights(labRec, '2026-10-31', []).find((i) => i.key === 'labcare')
  check('D-378 맞춤 추천 연구소: 신고서에 연구개발비 없음 → 가능성 높음 · 첫 줄이 경정청구 · 다음 행동', labCard?.tone === 'good' && labCard.detail.startsWith('2021년부터 연구소가 있는데') && /경정청구/.test(labCard.action ?? ''), JSON.stringify(labCard))
  check('D-384 고객 관리 카드 추천 띠: "연구소 · 경정청구"(일반 창업감면 카드의 "경정청구 확인" 은 아님)', cardRecoChips(labRec, '2026-10-31', 0).some((c) => c.label === '연구소 · 경정청구' && c.tone === 'good') && !cardRecoChips(labRec, '2026-10-31', 0).some((c) => c.key === 'startup-tax' && /경정청구/.test(c.label)), JSON.stringify(cardRecoChips(labRec, '2026-10-31', 0)))
  // 명부(그해 늘어난 인원 기록) + 신고서(통합고용 없음) → 고용지원금 카드 금액 · 가능성 높음
  const roster = { id: 'tr-emp378', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'none', verdictLabel: '후보 지원금 0건', summary: '[4대보험 명부 진단] 6명', data: { tab: 'roster', headcount: { ...past, asOf: '2026-10-31', prev: past.cur, cur: { year: 2026, total: 5, youth: 1, actualMonths: 9 } }, headcountPast: past }, deadlines: [], createdAt: NOW, publishedUpdateId: null }
  const empRec = normalizeClientOps({ ...none, toolResults: [roster] } as never)
  const empCard = buildInsights(empRec, '2026-10-31', []).find((i) => i.key === 'employment')
  check('D-378 맞춤 추천 고용: 그해 늘었는데 신고서에 없음 → 가능성 높음 · 제목 · 금액 "경정청구 약 … (2025년분)"', empCard?.tone === 'good' && /2025년 신고서에 통합고용세액공제가 빠졌어요/.test(empCard.headline) && /경정청구 약 .+\(2025년분\)/.test(empCard.amount ?? ''), JSON.stringify(empCard))
  check('D-378 정책자금 준비 서류: 세무조정계산서 칸 → 재무 서류 확보', (() => {
    let x = withCustomDocument(base, { label: '세무조정계산서' })
    x = withDocument(x, x.customDocuments[x.customDocuments.length - 1].key, { received: true, issuedAt: '2026-03-31', fileName: '세무조정.pdf' })
    return policyDocs(x, '2026-10-31').have.includes('financial')
  })())
})()

// D-379 창업 5년 지난 업체의 지난 감면 기간 경정청구 · 상담 '놓친 세액공제 · 경정청구 있나?'
{
  const T = '2026-10-31'
  const mkRec = (relief: string | null, extra: Record<string, unknown> = {}) => normalizeClientOps({ id: 'st379', companyName: '대전정밀(주)', businessNumber: '124-81-00998', corporateNumber: '160111-0123456', establishedAt: '2020-06-01', representativeBirth: '1992-03-01', businessCategory: '제조업', businessItem: '전자부품', businessAddress: '대전광역시 유성구 대학로 99', createdAt: NOW, updatedAt: NOW, customFields: relief ? [{ id: 'rl', group: 'identity', label: '받은 공제 · 감면 2023년', value: relief }] : [], ...extra } as never)
  const none = mkRec('법인세 신고서에 공제 · 감면 없음')
  const f = clientFacts(none, new Date(`${T}T00:00:00`))
  const past = pastStartupRefund(none, f, T)
  check('D-379 창업 6년 업체 · 2023년 신고서에 창업감면 없음 → 그해(2023-12-31)로 다시 판정 → 대상이었음 · 경정청구', !!past && past.year === 2023 && /2023년 법인세 신고서에 창업중소기업 세액감면이 없어요 — 그해 감면 대상이었을 수 있어요\(창업 형태 확인\): 경정청구/.test(past.line) && /100%/.test(past.rate), JSON.stringify(past))
  const card = buildInsights(none, T, []).find((i) => i.key === 'startup-tax')
  check('D-379 맞춤 추천 창업감면: 감면 기간은 끝났지만 2023년분 경정청구 검토 · 검토해 볼 만함 · 다음 행동', card?.tone === 'maybe' && /감면 기간은 끝났지만 2023년분/.test(card.headline) && /경정청구/.test(card.action ?? ''), JSON.stringify(card))
  const got = mkRec('창업중소기업 세액감면 1,200만원(법인세 신고서)')
  check('D-379 그해 감면을 받았으면 예전대로 "기간 끝남"', buildInsights(got, T, []).find((i) => i.key === 'startup-tax')?.tone === 'no')
  check('D-379 신고서가 없으면 예전대로 "기간 끝남"', buildInsights(mkRec(null), T, []).find((i) => i.key === 'startup-tax')?.tone === 'no')
  const old = normalizeClientOps({ ...none, customFields: [{ id: 'rl', group: 'identity', label: '받은 공제 · 감면 2019년', value: '법인세 신고서에 공제 · 감면 없음' }] } as never)
  check('D-379 감면 기간 밖(설립 전) · 경정청구 기한 지난 해는 말하지 않음', pastStartupRefund(old, f, T) === null)
  const noBirth = mkRec('법인세 신고서에 공제 · 감면 없음', { representativeBirth: '' })
  check('D-379 대표 생년월일을 모르면 판정하지 않음(청년 감면율)', pastStartupRefund(noBirth, clientFacts(noBirth, new Date(`${T}T00:00:00`)), T) === null)
  const mk2 = (key: string, tone: Insight['tone']): Insight => ({ key, label: key, tone, headline: '', detail: '', missing: [], openPath: '', openLabel: '', action: null })
  const ch = insightChanges([mk2('labcare', 'maybe'), mk2('tax', 'need'), mk2('grants', 'good'), mk2('cretop', 'maybe')], [mk2('labcare', 'good'), mk2('tax', 'maybe'), mk2('grants', 'good'), mk2('cretop', 'no')])
  check('D-379 이번 서류로 새로 판정: 검토해 볼 만함 → 가능성 높음도(연구소 경정청구) · 정보 필요 → 판정 · 그대로 · 내려간 것은 빠짐', ch.map((i) => i.key).join() === 'labcare,tax', JSON.stringify(ch.map((i) => i.key)))
  // 상담 질문
  const q1 = matchQuestion('작년 법인세 신고서에서 빠진 공제 경정청구 되나요')
  check('D-379 상담: 직접 친 "신고서 빠진 공제 경정청구" → 놓친 세액공제 질문(법인세 낱말이 있어도)', q1.best?.id === 'refund', JSON.stringify(q1.best))
  const a1 = answerFor('refund', { record: none, today: T, notices: [] })
  check('D-379 상담 답: 2023년 신고서 내용 · 빠진 공제 2가지(고용 "늘었다면" · 창업감면) · 경정청구 기한 줄 · 복사 글', a1.facts[0] === '2023년: 법인세 신고서에 공제 · 감면 없음' && /빠진 공제 2가지/.test(a1.verdict?.text ?? '') && a1.steps[1]?.endsWith('경정청구 검토(5년 안 · ★ 세무사)') && a1.steps.some((x) => /5년 안/.test(x)) && /놓친 세액공제 1차 검토/.test(a1.copyText), JSON.stringify(a1))
  const a0 = answerFor('refund', { record: mkRec(null), today: T, notices: [] })
  check('D-379 상담 답: 신고서가 없으면 무엇을 올리면 되는지(세무조정계산서 5년)', a0.verdict?.tone === 'need' && a0.docs.some((d) => /최근 5년 세무조정계산서/.test(d)), JSON.stringify(a0))
}

// D-380 등기부 → 지금 임원의 이번 임기(3년) → 회사 정보 '임원 임기' · 달력 '중임 등기'
{
  const REG = ['등기사항전부증명서(말소사항 포함)', '상호 주식회사 가나테크', '임원에 관한 사항',
    '사내이사 박지훈 801231-1******', '2020 년 03 월 02 일 취임 2020 년 03 월 05 일 등기', '2023 년 03 월 02 일 중임 2023 년 03 월 06 일 등기',
    '대표이사 박지훈 801231-1******', '2020 년 03 월 02 일 취임', '2023 년 03 월 02 일 중임',
    '사내이사 이영희 850505-2******', '2021 년 05 월 10 일 취임', '2024 년 05 월 10 일 사임',
    '감사 최감사 700101-1******', '2024 년 03 월 25 일 취임',
    '회사성립연월일 2020 년 03 월 02 일'].join('\n')
  const terms = officerTerms(REG)
  check('D-380 임원 임기: 마지막 중임부터 3년 · 대표이사 · 사내이사 같은 사람은 대표이사 하나 · 사임한 사람은 빠짐 · 끝나는 날 순서', JSON.stringify(terms.map((t) => `${t.role}:${t.name}:${t.start}:${t.ends}`)) === '["대표이사:박지훈:2023-03-02:2026-03-02","감사:최감사:2024-03-25:2027-03-25"]', JSON.stringify(terms))
  const val = officerTermsValue(terms)
  check('D-380 회사 정보 글 → 다시 읽기(사람마다 끝나는 날)', val === '대표이사 박지훈 2023-03-02 중임 · 3년이면 2026-03-02 만료 / 감사 최감사 2024-03-25 취임 · 3년이면 2027-03-25 만료' && JSON.stringify(officerTermsOf(val)) === '[{"role":"대표이사","name":"박지훈","start":"2023-03-02","ends":"2026-03-02"},{"role":"감사","name":"최감사","start":"2024-03-25","ends":"2027-03-25"}]', val)
  const cand = factCandidatesFromDocText('corporateRegistry', REG, 'r').find((c) => c.key === 'cf:임원 임기')
  check('D-380 등기부 올리기 → "임원 임기" 칸 후보(사람 묶음)', cand?.value === val && cand.group === 'people', JSON.stringify(cand))
  const rec = normalizeClientOps({ id: 'of380', companyName: '주식회사 가나테크', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 'ot', group: 'people', label: '임원 임기', value: val }] } as never)
  const ev = buildClientSchedule(rec, '2026-02-20').filter((e) => e.id.includes(':officer:'))
  check('D-380 달력 · 오늘: 임기 만료날 "임원 임기 만료 — 대표이사 박지훈 중임 등기" · 업무 마감 · 2주 안 · 과태료', ev.length === 2 && ev[0].date === '2026-03-02' && ev[0].kind === 'task' && ev[0].title === '임원 임기 만료 — 대표이사 박지훈 중임 등기' && /2주 안/.test(ev[0].detail) && ev[0].daysLeft === 10, JSON.stringify(ev))
  check('D-380 한 달 넘게 지난 만료날은 내려놓음(옛 등기부일 수 있어)', buildClientSchedule(rec, '2026-04-15').filter((e) => e.id.includes(':officer:')).length === 1)
  check('D-380 임원 칸이 없는 등기부는 칸을 만들지 않음', !factCandidatesFromDocText('corporateRegistry', ['등기사항전부증명서', '상호 주식회사 가나', '1주의 금액 금 5,000 원'].join('\n'), 'r').some((c) => c.key === 'cf:임원 임기'))
}

// D-381 대표 신용점수 조회서 → 회사 정보 '대표 신용점수' → 정책자금 대표 신용(엔진 '미확인' 감점이 사라짐)
await (async () => {
  const NICE = ['NICE지키미 신용정보 조회서', '조회일 2026.10.20', '성명 김대표 생년월일 1978.05.10', '나의 신용점수 812 점', '(1,000점 만점)', '신용점수 산출 기준일 2026.10.19', '대출 2건 · 연체 없음'].join('\n')
  const r1 = readCreditScore(NICE)
  check('D-381 NICE 조회서: 812점 · 1,000점 만점 · 날짜 · 생년월일은 점수 아님', JSON.stringify(r1) === '{"scores":[{"bureau":"NICE","score":812}],"date":"2026-10-20"}', JSON.stringify(r1))
  const BOTH = ['신용정보 조회 결과', 'NICE 신용점수 : 812점', 'KCB(올크레딧) 신용점수 : 845점'].join('\n')
  const r2 = readCreditScore(BOTH)
  check('D-381 NICE · KCB 둘 다 → 둘 다 남기고 낮은 쪽으로 판정', !!r2 && creditScoreValue(r2) === 'NICE 812점 · KCB 845점' && lowestScoreOf(creditScoreValue(r2)) === 812 && creditBandOf(812) === '800점대' && creditBandOf(599) === '600점 미만' && creditBandOf(900) === '900점 이상', JSON.stringify(r2))
  check('D-381 신용점수 낱말이 없는 서류 · 기업신용등급(크레탑)은 조회서 아님', !looksLikeCreditReport('사업자등록증 NICE 상호') && readCreditScore('CRETOP 기업종합보고서 기업신용등급 BB+') === null)
  const base = normalizeClientOps({ id: 'cs381', companyName: '대전정밀(주)', businessNumber: '124-81-00998', establishedAt: '2019-03-02', businessCategory: '제조업', businessItem: '전자부품', businessAddress: '대전광역시 유성구 대학로 99', employeeCount: '8', createdAt: NOW, updatedAt: NOW } as never)
  const pl = placeDocument({ text: NICE, fileName: 'scan_381.pdf' }, allDocumentMetas(base))
  check('D-381 서류함: "대표 신용점수 조회" 칸 · 확실(바로 넣기) · 유효 1개월', pl.kind === 'new' && pl.label === '대표 신용점수 조회' && pl.sure && knownDocValidMonths('대표 신용점수 조회') === 1, JSON.stringify(pl))
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'customdoc_cs', fileName: 'nice.pdf', text: NICE, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `cs${++n}` })
  check('D-381 · D-388 올리기 한 번 → "대표 신용점수" NICE 812점 · 조회일 바로(묻지 않음)', customFactValue(a.record, '대표 신용점수') === 'NICE 812점 · 2026-10-20 조회' && a.summary.flagged.length === 0, JSON.stringify([customFactValue(a.record, '대표 신용점수'), a.summary.flagged]))
  const facts = clientFacts(a.record, new Date('2026-10-31T00:00:00'))
  const ev = policyEvidence(a.record, facts, '2026-10-31')
  check('D-381 정책자금 근거: 대표 신용 800점대 · 앞줄 "대표 신용 NICE 812점"', ev.input.creditBand === '800점대' && ev.notes[0]?.startsWith('대표 신용 NICE 812점'), JSON.stringify(ev))
  const before = runDiagnosis({ ...policyInputFromFacts(clientFacts(base, new Date('2026-10-31T00:00:00'))).input, ...policyEvidence(base, clientFacts(base, new Date('2026-10-31T00:00:00')), '2026-10-31').input })
  const after = runDiagnosis({ ...policyInputFromFacts(facts).input, ...ev.input })
  check('D-381 엔진: 800점대면 위험 점수가 내려감(신용 좋음 · 같은 엔진)', (after.risk?.score ?? 0) < (before.risk?.score ?? 0), JSON.stringify({ b: before.risk?.score, a: after.risk?.score }))
  const low = normalizeClientOps({ ...base, customFields: [{ id: 'cs', group: 'people', label: '대표 신용점수', value: '580' }] } as never)
  const evLow = policyEvidence(low, clientFacts(low, new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-381 사람이 "580" 만 적어도 → 600점 미만 · 일반 기관은 어려워요(뒤 줄)', evLow.input.creditBand === '600점 미만' && evLow.notes.some((x) => /580 — 일반 기관은 어려워요/.test(x)), JSON.stringify(evLow.notes))
  check('D-381 점수를 모르면 체납 확인 목록에 끼지 않음(예전 그대로)', !policyEvidence(base, clientFacts(base, new Date('2026-10-31T00:00:00')), '2026-10-31').want.some((w) => /신용/.test(w)))
})()

// D-382 정관 이사 임기 → 중임 등기 날짜 다시 세기 · 옛 명부 안내
{
  const ART = ['정 관', '제1조(상호) 이 회사는 주식회사 가나테크라 한다.', '제30조(이사의 임기) 이사의 임기는 취임 후 2년으로 한다.', '제35조(감사의 임기) 감사의 임기는 취임 후 3년 내의 최종의 결산기에 관한 정기주주총회 종결시까지로 한다.'].join('\n')
  check('D-382 정관: 이사 임기 2년 · 감사 조항은 이사 임기가 아님 · 정관이 아니면 안 읽음', readDirectorTermYears(ART) === 2 && readDirectorTermYears('이사의 임기는 2년') === null && readDirectorTermYears(['정 관', '이사의 임기는 2년', '이사의 임기는 3년'].join('\n')) === null)
  const cand = factCandidatesFromDocText('customdoc_art', ART, 'r').find((c) => c.key === 'cf:이사 임기(정관)')
  check('D-382 정관 올리기 → "이사 임기(정관)" 2년 칸 후보(출처 정관)', cand?.value === '2년' && cand.source === 'articles', JSON.stringify(cand))
  const val = '대표이사 박지훈 2024-03-02 중임 · 3년이면 2027-03-02 만료 / 감사 최감사 2024-03-25 취임 · 3년이면 2027-03-25 만료'
  const rec = normalizeClientOps({ id: 'of382', companyName: '주식회사 가나테크', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 'ot', group: 'people', label: '임원 임기', value: val }, { id: 'it', group: 'people', label: '이사 임기(정관)', value: '2년' }] } as never)
  const ev = buildClientSchedule(rec, '2026-02-20').filter((e) => e.id.includes(':officer:'))
  check('D-382 정관 2년 → 대표이사 중임 등기 2026-03-02(이사만 · 감사는 그대로 2027-03-25) · 설명에 정관 임기 2년', ev.length === 2 && ev[0].date === '2026-03-02' && /정관 임기 2년/.test(ev[0].detail) && ev[1].date === '2027-03-25' && /정관 임기 확인/.test(ev[1].detail), JSON.stringify(ev.map((e) => [e.date, e.detail])))
  const base = normalizeClientOps({ id: 'er382', companyName: '대전정밀(주)', businessNumber: '124-81-00998', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 'rl', group: 'identity', label: '받은 공제 · 감면 2025년', value: '법인세 신고서에 공제 · 감면 없음' }] } as never)
  const f = clientFacts(base, new Date('2026-10-31T00:00:00'))
  const ry = reliefYears(base, f, '2026-10-31')
  check('D-382 옛 명부(그해 인원 기록 없음)면 "명부를 다시 올리면 그해 금액까지" · 명부가 없으면 그 말 없음', /명부를 다시 올리면 그해 금액까지/.test(employmentRefund(base, f, ry, null, true).line) && !/명부를 다시/.test(employmentRefund(base, f, ry, null).line))
}

// D-382 상담 '물어볼 것' 대표 신용점수 · D-383 업체 기록이 말해 주는 정책자금 가점
{
  const T = '2026-10-31'
  const base = normalizeClientOps({ id: 'pb383', companyName: '청년정밀(주)', businessNumber: '124-81-00998', establishedAt: '2022-03-02', representativeBirth: '1992-06-01', businessCategory: '제조업', businessItem: '전자부품', businessAddress: '대전광역시 유성구 대학로 99', employeeCount: '6', createdAt: NOW, updatedAt: NOW } as never)
  const ask = answerFor('ask', { record: base, today: T, notices: [] })
  check('D-382 상담 물어볼 것: 신용점수를 모르면 "대표님 신용점수가 대략 몇 점인가요?"', ask.steps.some((x) => /대표님 신용점수가 대략 몇 점/.test(x)), JSON.stringify(ask.steps))
  const knows = normalizeClientOps({ ...base, customFields: [{ id: 'cs', group: 'people', label: '대표 신용점수', value: 'NICE 812점' }] } as never)
  check('D-382 신용점수를 알면 묻지 않음', !answerFor('ask', { record: knows, today: T, notices: [] }).steps.some((x) => /신용점수/.test(x)))
  const f = clientFacts(base, new Date(`${T}T00:00:00`))
  check('D-383 대표 만 34세 → "만39세 이하 청년기업" 가점(만 39세 미만)', policyRecordBonus(base, f).includes('만39세 이하 청년기업') && !policyRecordBonus(normalizeClientOps({ ...base, representativeBirth: '1987-01-01' } as never), clientFacts(normalizeClientOps({ ...base, representativeBirth: '1987-01-01' } as never), new Date(`${T}T00:00:00`))).includes('만39세 이하 청년기업'))
  const grown = normalizeClientOps({ ...base, netIncome: '', factValues: { netIncome: '66000000' }, factMeta: { netIncome: { source: 'financialStatements', status: 'entered', asOf: '2025', updatedAt: NOW } }, taxProfile: { vInc1: '50000000' }, customFields: [{ id: 'tr', group: 'identity', label: '매출 추이', value: '2025년 12억(부가세 과세표준 · 2024년보다 +15%)' }] } as never)
  const fg = clientFacts(grown, new Date(`${T}T00:00:00`))
  check('D-383 매출 +15% · 순이익 5천만 → 6,600만(+32%) → "매출 또는 영업이익 10% 이상 증가"', policyRecordBonus(grown, fg).includes('매출 또는 영업이익 10% 이상 증가'), JSON.stringify({ b: policyRecordBonus(grown, fg), ni: fg.netIncome }))
  const flatNi = normalizeClientOps({ ...grown, taxProfile: { vInc1: '65000000' } } as never)
  check('D-383 순이익이 10% 안 늘었으면 그 가점 없음(매출만 늘어도)', !policyRecordBonus(flatNi, clientFacts(flatNi, new Date(`${T}T00:00:00`))).includes('매출 또는 영업이익 10% 이상 증가'))
  const yj = normalizeClientOps({ ...base, toolResults: [{ id: 'sch', toolKey: 'employment', title: '고용지원금 · 회차 일정 · 김청년', verdict: null, verdictLabel: '', summary: '', data: { tab: 'schedule', programId: 'youth_jump' }, deadlines: [], createdAt: NOW, publishedUpdateId: null }] } as never)
  check('D-383 청년일자리도약 회차 일정이 붙어 있으면 "고용지원금 참여"', policyRecordBonus(yj, f).includes('고용지원금 참여') && !policyRecordBonus(base, f).includes('고용지원금 참여'))
  let ex = withCustomDocument(base, { label: '수출실적증명' })
  ex = withDocument(ex, ex.customDocuments[ex.customDocuments.length - 1].key, { received: true, issuedAt: '2026-10-01', fileName: '수출.pdf' })
  check('D-383 서류함 수출실적증명 → "수출 실적"', policyRecordBonus(ex, f).includes('수출 실적') && !policyRecordBonus(base, f).includes('수출 실적'))
  const ev = policyEvidence(yj, f, T)
  check('D-383 정책자금 근거: 가점 줄에 청년기업 · 청년 고용지원금 참여 · 엔진 가점 선택지에 들어감', ev.input.bonusItems?.includes('만39세 이하 청년기업') && ev.input.bonusItems.includes('고용지원금 참여') && ev.notes.some((x) => /가점 .*청년기업\(대표 만 39세 미만\).*청년 고용지원금 참여/.test(x)), JSON.stringify(ev.notes))
  check('D-383 진단서 "보유" 칸은 인증서만(청년기업은 보유가 아님)', !policyBonus(yj, T).items.includes('만39세 이하 청년기업' as never))
}

// D-386 여러 서류를 한 PDF 로 합쳐 보냈으면 — 쪽마다 제목을 보고 서류별로 나눠 읽는다
await (async () => {
  const BIZ = ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2023 년 01 월 10 일', '사업장 소재지 : 경기도 파주시 탄현면 평화로 3', '업태 : 제조업', '종목 : 바이오 시약'].join('\n')
  const REG1 = ['등기사항전부증명서(현재 유효사항)', '상호 주식회사 미래바이오랩', '1주의 금액 금 5,000 원', '발행주식의 총수 20,000 주', '보통주식 20,000 주 금 100,000,000 원'].join('\n')
  const REG2 = ['임원에 관한 사항', '사내이사 이대표 750101-*******', '2024 년 01 월 10 일 중임', '회사성립연월일 2023 년 01 월 10 일'].join('\n')
  const NICE = ['NICE지키미 신용정보 조회서', '나의 신용점수 812 점', '(1,000점 만점)'].join('\n')
  const all = [BIZ, REG1, REG2, NICE].join('\n\f\n')
  const base = normalizeClientOps({ id: 'bd386', companyName: '미래바이오랩', createdAt: NOW, updatedAt: NOW })
  const parts = splitBundle(all, allDocumentMetas(base))
  check('D-386 합친 PDF 4쪽 → 사업자등록증(1쪽) · 등기부(2~3쪽 — 제목 없는 쪽은 앞 서류에) · 신용점수 조회(4쪽)', !!parts && parts.map((x) => `${x.placement.label}:${pagesLabel(x)}`).join() === '사업자등록증:1쪽,법인등기부등본:2~3쪽,대표 신용점수 조회:4쪽', JSON.stringify(parts?.map((x) => [x.placement.label, x.from, x.to])))
  check('D-386 쪽 나눔이 없거나 한 서류(등기부 여러 쪽)면 나누지 않음', splitBundle(BIZ, allDocumentMetas(base)) === null && splitBundle([REG1, REG2].join('\n\f\n'), allDocumentMetas(base)) === null)
  let n = 0
  const docs = (parts ?? []).map((x) => ({ key: x.placement.kind === 'existing' ? x.placement.key : 'customdoc_x', fileName: `합본.pdf ${pagesLabel(x)}`, text: x.text, method: 'pdf_text' as const, docSure: x.placement.sure }))
  const a = await analyzeUploadedDocs(base, docs, { now: NOW, today: '2026-10-31', makeId: () => `bd${++n}` })
  check('D-386 나눠 읽으면 서류마다 정보가 섞이지 않고 다 들어감 — 사업자번호 · 개업일 · 임원 임기 · 신용점수', a.record.businessNumber === '124-81-00998' && a.record.establishedAt === '2023-01-10' && customFactValue(a.record, '임원 임기').includes('2024-01-10 중임') && customFactValue(a.record, '대표 신용점수') === 'NICE 812점', JSON.stringify([a.record.businessNumber, a.record.establishedAt, customFactValue(a.record, '임원 임기'), customFactValue(a.record, '대표 신용점수'), a.summary.flagged.map((f) => f.label)]))
})()

// D-387 상담 '이 회사 한눈에' — 서류로 읽은 대표 신용 · 임원 임기 · 최근 신고서 공제
{
  const r = normalizeClientOps({ id: 'sm387', companyName: '요약정밀(주)', createdAt: NOW, updatedAt: NOW, customFields: [
    { id: 'a', group: 'people', label: '대표 신용점수', value: 'NICE 812점' },
    { id: 'b', group: 'people', label: '임원 임기', value: '대표이사 김대표 2024-11-20 중임 · 3년이면 2027-11-20 만료 / 감사 최감사 2025-03-25 취임 · 3년이면 2028-03-25 만료' },
    { id: 'c', group: 'identity', label: '받은 공제 · 감면 2024년', value: '법인세 신고서에 공제 · 감면 없음' },
    { id: 'd', group: 'identity', label: '받은 공제 · 감면 2025년', value: '통합고용세액공제 1,540만원(법인세 신고서)' },
  ] } as never)
  const a = answerFor('summary', { record: r, today: '2026-10-31', notices: [] })
  check('D-387 요약: 대표 신용 NICE 812점 · 임원 임기(첫 사람) · 2025년 신고서 줄(최근 해)', a.facts.includes('대표 신용 NICE 812점') && a.facts.includes('임원 임기 대표이사 김대표 2024-11-20 중임 · 3년이면 2027-11-20 만료') && a.facts.includes('2025년 신고서 — 통합고용세액공제 1,540만원(법인세 신고서)'), JSON.stringify(a.facts))
}

// D-388 신용점수 조회일 — 날짜 숫자는 점수가 아님 · 석 달 넘은 조회는 새로 확인
{
  check('D-388 칸 글의 날짜(2026-10-20)는 점수로 안 읽음 · 사람이 쓴 "812" 그대로', lowestScoreOf('NICE 812점 · 2026-10-20 조회') === 812 && lowestScoreOf('812') === 812 && lowestScoreOf('2026-10-20 조회') === null)
  const mk = (v: string) => normalizeClientOps({ id: 'cs388', companyName: '대전정밀(주)', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 'cs', group: 'people', label: '대표 신용점수', value: v }] } as never)
  const old = mk('NICE 812점 · 2026-06-01 조회')
  const evOld = policyEvidence(old, clientFacts(old, new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-388 6/1 조회(석 달 넘음) → 근거 줄에 "석 달 넘었어요, 새로 확인" · 판정은 그 점수로', evOld.input.creditBand === '800점대' && evOld.notes.some((x) => x === '대표 신용 NICE 812점 · 6/1 조회 — 석 달 넘었어요, 새로 확인'), JSON.stringify(evOld.notes))
  const fresh = mk('NICE 812점 · 2026-10-20 조회')
  check('D-388 최근 조회면 날짜 줄 없이 "대표 신용 NICE 812점"', policyEvidence(fresh, clientFacts(fresh, new Date('2026-10-31T00:00:00')), '2026-10-31').notes.includes('대표 신용 NICE 812점'))
}

// D-389 대표 신분증 사본 → 대표 생년월일 · 이름(주민등록번호는 남기지 않음)
await (async () => {
  const ID = ['주민등록증', '홍길동(洪吉童)', '900315-1234567', '서울특별시 강남구 테헤란로 1', '2015. 3. 2.', '서울특별시 강남구청장'].join('\n')
  check('D-389 주민등록증 → 1990-03-15 · 홍길동(한자 · 주소 · 구청장은 이름 아님)', JSON.stringify(readIdCard(ID)) === '{"birth":"1990-03-15","name":"홍길동"}', JSON.stringify(readIdCard(ID)))
  const DL = ['자동차운전면허증', '1종보통', '11-15-123456-70', '김영희 020707-4123456', '경기도 성남시 분당구'].join('\n')
  check('D-389 운전면허증 · 2000년대생(성별 4) → 2002-07-07 · 김영희', JSON.stringify(readIdCard(DL)) === '{"birth":"2002-07-07","name":"김영희"}', JSON.stringify(readIdCard(DL)))
  check('D-389 본문에 "신분증 사본 제출" 이 있는 신청서는 신분증이 아님', !looksLikeIdCard(['지원사업 신청서', '대표자 성명 홍길동', '제출 서류: 사업자등록증, 신분증 사본'].join('\n')))
  const base = normalizeClientOps({ id: 'id389', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  const cands = factCandidatesFromDocText('representativeId', ID, 'r')
  check('D-389 후보는 생년월일 · 이름 둘뿐 — 주민등록번호 · 주소는 후보 어디에도 없음', cands.map((c) => c.key).join() === 'representativeBirth,representativeName' && !JSON.stringify(cands).includes('1234567') && !JSON.stringify(cands).includes('테헤란로'), JSON.stringify(cands))
  let n = 0
  const ocr = await analyzeUploadedDocs(base, [{ key: 'representativeId', fileName: 'id.jpg', text: ID, method: 'ocr' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `id${++n}` })
  check('D-389 사진(OCR)이면 바로 넣지 않고 확인할 것(생년월일 · 이름 — 사진 글자라 한 번 확인)', !ocr.record.representativeBirth && ocr.summary.flagged.some((f) => f.key === 'representativeBirth' && f.note === NOTE_OCR) && !JSON.stringify(ocr.record).includes('900315-1234567'), JSON.stringify(ocr.summary.flagged))
  const pdf = await analyzeUploadedDocs(base, [{ key: 'representativeId', fileName: 'id.pdf', text: ID, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `id${++n}` })
  check('D-389 글자 PDF 면 생년월일 바로 · 기록 어디에도 주민등록번호 없음', pdf.record.representativeBirth === '1990-03-15' && !JSON.stringify(pdf.record).includes('1234567'), JSON.stringify([pdf.record.representativeBirth, pdf.summary.flagged]))
})()

// D-390 세무조정계산서 안의 표준재무상태표 · 표준손익계산서 → 매출 · 순이익 · 자산 · 부채(그 부분부터)
await (async () => {
  const TR = ['법인세 과세표준 및 세액신고서', '사업연도 2025.01.01 ~ 2025.12.31', '공제감면세액 및 추가납부세액합계표(갑)', '중소기업에 대한 특별세액감면 조특법 제7조 112 8,500,000',
    '수입금액조정명세서', '매출액 9,999,999,999', // 앞쪽 명세서의 매출액 — 읽지 않아야 한다
    '표준재무상태표', '(단위 : 원)', '자산총계 3,000,000,000', '부채총계 1,200,000,000', '표준손익계산서', '매출액 2,400,000,000', '영업이익 300,000,000', '당기순이익 220,000,000 180,000,000'].join('\n')
  const cands = factCandidatesFromDocText('customdoc_tr', TR, 'r')
  const v = (k: string) => cands.find((c) => c.key === k)?.value
  check('D-390 세무조정계산서 → 받은 공제 · 감면 + 표준재무제표 매출 24억(앞 명세서 99억 아님) · 영업이익 · 순이익 · 자산 · 부채 · 2025', v('revenue') === '2400000000' && v('operatingProfit') === '300000000' && v('netIncome') === '220000000' && v('totalAssets') === '3000000000' && v('totalLiabilities') === '1200000000' && cands.find((c) => c.key === 'revenue')?.asOf === '2025' && cands.some((c) => c.key === 'cf:받은 공제 · 감면 2025년'), JSON.stringify(cands.map((c) => [c.key, c.value, c.asOf])))
  check('D-390 표준재무제표가 없는 신고서는 매출 등을 만들지 않음', !factCandidatesFromDocText('customdoc_tr', TR.split('\n표준재무상태표')[0], 'r').some((c) => c.key === 'revenue'))
  const base = normalizeClientOps({ id: 'tr390', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'customdoc_tr', fileName: 'tr.pdf', text: TR, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `tr${++n}` })
  check('D-390 올리기 한 번 → 매출 · 순이익 바로(정책자금 · 절세가 쓴다) · 묻지 않음', readFact(a.record, 'revenue')?.value === '2400000000' && readFact(a.record, 'netIncome')?.value === '220000000' && a.summary.flagged.length === 0, JSON.stringify(a.summary.flagged))
})()

// D-390 작년 신고서를 올려도 올해 재무제표 숫자와 다르다고 묻지 않음 · D-391 원천징수이행상황신고서 → 직원 수 · 원천세 신고 인원
await (async () => {
  const TR = ['법인세 과세표준 및 세액신고서', '사업연도 2024.01.01 ~ 2024.12.31', '공제감면세액 및 추가납부세액합계표(갑)', '표준손익계산서', '매출액 2,000,000,000', '당기순이익 150,000,000']
  const fin25 = normalizeClientOps({ id: 'tr390b', companyName: '미래테크', createdAt: NOW, updatedAt: NOW, factValues: { revenue: '2400000000' }, factMeta: { revenue: { source: 'financialStatements', status: 'entered', asOf: '2025', updatedAt: NOW } } } as never)
  let n = 0
  const a = await analyzeUploadedDocs(fin25, [{ key: 'customdoc_tr', fileName: 'tr2024.pdf', text: TR.join('\n'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `tb${++n}` })
  check('D-390 2025 재무제표 매출이 있으면 2024 신고서 매출(20억)은 묻지 않고 그대로 24억', readFact(a.record, 'revenue')?.value === '2400000000' && !a.summary.flagged.some((f) => f.key === 'revenue'), JSON.stringify([readFact(a.record, 'revenue'), a.summary.flagged]))

  const WH = ['원천징수이행상황신고서', '① 신고구분 [√]매월 [ ]반기 [ ]수정 [ ]연말', '② 귀속연월 2026년 9월 ③ 지급연월 2026년 9월', '원천징수의무자 법인명(상호) 주식회사 미래테크 대표자(성명) 홍길동', '사업자(주민)등록번호 123-45-67890',
    '1. 원천징수 명세 및 납부세액', '소득자 소득구분 코드 인원 총지급액 소득세등', '근로소득 간이세액 A01 12 45,000,000 1,234,560', '중도퇴사 A02 1 3,000,000 0', '일용근로 A03 3 1,500,000 0', '가감계 A10 16 49,500,000 1,234,560', '사업소득 매월징수 A25 2 2,000,000 60,000'].join('\n')
  check('D-391 간이세액(A01) 줄만 — 12명 · 4,500만원 · 2026-09(중도퇴사 · 일용 · 가감계 · 사업소득은 아님)', JSON.stringify(readWithholdingReport(WH)) === '{"yearMonth":"2026-09","until":"","employees":12,"pay":45000000}', JSON.stringify(readWithholdingReport(WH)))
  check('D-391 본문에만 원천징수이행상황신고서가 있는 안내문은 아님 · 근로자 없는 달(A01 없음)은 읽지 않음', readWithholdingReport(['세무 일정 안내', '매월 10일까지 원천징수이행상황신고서를 제출하세요'].join('\n')) === null && readWithholdingReport(WH.replace(/근로소득 간이세액 A01 12 45,000,000 1,234,560\n/, '')) === null)
  const empty = normalizeClientOps({ id: 'wh391', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  const place = placeDocument({ text: WH, fileName: 'scan.pdf' }, allDocumentMetas(empty))
  check('D-391 서류함: "원천징수이행상황신고서" 칸(원천징수영수증 · 사업자등록증 칸 아님)', place.kind === 'new' && place.label === '원천징수이행상황신고서', JSON.stringify(place))
  const cands = factCandidatesFromDocText('customdoc_wh', WH, 'r')
  check('D-391 후보: 직원 수 12 · 원천세 신고 인원 — 회사 이름 · 번호 · 대표는 이 서류로 읽지 않음', cands.map((c) => c.key).join() === 'employeeCount,cf:원천세 신고 인원' && cands[1].value === '2026년 9월분 근로자 12명 · 총지급 4,500만원', JSON.stringify(cands))
  const b = await analyzeUploadedDocs(empty, [{ key: 'customdoc_wh', fileName: 'wh.pdf', text: WH, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `wh${++n}` })
  check('D-391 올리기 한 번 → 직원 수 12 바로 · 묻지 않음', b.record.employeeCount === '12' && b.summary.flagged.length === 0, JSON.stringify([b.record.employeeCount, b.summary.flagged]))
  const emp = buildInsights(b.record, '2026-10-31', []).find((i) => i.key === 'employment')
  check('D-391 고용지원금 카드(명부 없음) — "원천세 신고서 2026년 9월분 근로자 12명" · 두루누리는 10명 이상이라 없음', !!emp && emp.detail.includes('원천세 신고서 2026년 9월분 근로자 12명') && !emp.detail.includes('두루누리'), emp?.detail)
  const roster = normalizeClientOps({ ...empty, employeeCount: '10', factMeta: { employeeCount: { source: 'payrollRoster', status: 'entered', asOf: '2026-10-01', updatedAt: NOW } } } as never)
  const c = await analyzeUploadedDocs(roster, [{ key: 'customdoc_wh', fileName: 'wh.pdf', text: WH, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `wh${++n}` })
  const WH10 = WH.replace('귀속연월 2026년 9월', '귀속연월 2026년 10월').replace('A01 12 45,000,000', 'A01 13 47,000,000')
  const WH08 = WH.replace('귀속연월 2026년 9월', '귀속연월 2026년 8월').replace('A01 12 45,000,000', 'A01 11 41,000,000')
  const d = await analyzeUploadedDocs(b.record, [{ key: 'customdoc_wh2', fileName: 'wh10.pdf', text: WH10, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-11-12', makeId: () => `wh${++n}` })
  check('D-391 다음 달(10월) 신고서 → 직원 수 13 · 칸 "10월분" 으로 바로 바꿈 · 묻지 않음', d.record.employeeCount === '13' && customFactValue(d.record, '원천세 신고 인원').startsWith('2026년 10월분 근로자 13명') && d.summary.flagged.length === 0, JSON.stringify([d.record.employeeCount, customFactValue(d.record, '원천세 신고 인원'), d.summary.flagged]))
  const e = await analyzeUploadedDocs(d.record, [{ key: 'customdoc_wh3', fileName: 'wh08.pdf', text: WH08, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-11-12', makeId: () => `wh${++n}` })
  check('D-391 앞선 달(8월) 신고서를 나중에 올려도 최근 달 값 그대로 · 묻지 않음', e.record.employeeCount === '13' && customFactValue(e.record, '원천세 신고 인원').startsWith('2026년 10월분') && e.summary.flagged.length === 0, JSON.stringify([e.record.employeeCount, e.summary.flagged]))
  const CELLS = ['원천징수이행상황신고서', '귀속연월 2026년 9월', '지급연월 2026년 9월', '근로소득', '간이세액', 'A01', '12', '45,000,000', '1,234,560', '중도퇴사', 'A02', '1', '3,000,000'].join('\n')
  check('D-391 PDF 표 칸이 줄마다 따로 나와도(A01 / 12 / 45,000,000) 12명 · 4,500만원 · 인원 칸이 빈 A01 뒤 A02 숫자는 아님', JSON.stringify(readWithholdingReport(CELLS)) === '{"yearMonth":"2026-09","until":"","employees":12,"pay":45000000}' && readWithholdingReport(CELLS.replace('A01\n12\n45,000,000\n1,234,560\n', 'A01\n')) === null, JSON.stringify(readWithholdingReport(CELLS)))
  const HALF = WH.replace('[√]매월 [ ]반기', '[ ]매월 [√]반기').replace('귀속연월 2026년 9월 ③ 지급연월 2026년 9월', '귀속연월 2026년 1월 ③ 지급연월 2026년 6월')
  const hr = readWithholdingReport(HALF)
  check('D-391 반기 신고(귀속 1월 · 지급 6월) → "2026년 1~6월분(반기)"', hr?.until === '2026-06' && withholdingValue(hr!, formatWon).startsWith('2026년 1~6월분(반기) 근로자 12명'), JSON.stringify(hr))
  const ROSTER = ['4대보험 사업장 가입자 명부', ['성명', '주민등록번호', '자격취득일'].join('\t'), ...['가', '나', '다', '라', '마'].map((x, i) => [`김${x}${x}`, `90010${i + 1}-1234567`, '2024-03-01'].join('\t'))].join('\n')
  const r2 = await analyzeUploadedDocs(b.record, [{ key: 'payrollRoster', fileName: '가입자명부.xlsx', text: ROSTER, method: 'xlsx' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `wh${++n}` })
  check('D-391 원천세 인원(12)이 먼저 들어간 뒤 명부를 올리면 명부 재직 인원(5)으로 바꿈 · 출처 4대보험 명부', r2.record.employeeCount === '5' && readFact(r2.record, 'employeeCount')?.source === 'payrollRoster', JSON.stringify([r2.record.employeeCount, readFact(r2.record, 'employeeCount')?.source]))
  check('D-391 명부로 적힌 직원 수(10)가 있으면 그대로 · 다르다고 묻지 않음 · 원천세 신고 인원 칸은 들어감', c.record.employeeCount === '10' && c.summary.flagged.length === 0 && customFactValue(c.record, '원천세 신고 인원').includes('12명'), JSON.stringify([c.record.employeeCount, c.summary.flagged]))
})()

// D-392 사업자등록증 + 등기부를 함께 올려도 묻지 않음 — 주소 표기(서울특별시 = 서울) · 법인 설립일은 등기부 회사성립일
await (async () => {
  check('D-392 주소: 시 · 도 이름 · 괄호 동 · 쉼표가 달라도 같음 · 층만 더 붙어도 같음', sameAddress('서울특별시 강남구 테헤란로 123, 4층 (역삼동)', '서울 강남구 테헤란로 123 4층(역삼동)') && sameAddress('경기도 성남시 분당구 판교역로 1', '경기 성남시 분당구 판교역로 1, 2층 201호') && sameAddress('전라북도 전주시 완산구 효자로 10', '전북특별자치도 전주시 완산구 효자로 10'))
  check('D-392 주소: 건물 번호 · 구 · 도로명이 다르면 다름(12 ≠ 123)', !sameAddress('서울 강남구 테헤란로 12', '서울 강남구 테헤란로 123') && !sameAddress('서울 강남구 테헤란로 123', '서울 서초구 테헤란로 123') && !sameAddress('서울 강남구 테헤란로 123', '서울 강남구 봉은사로 123') && !sameAddress('서울 강남구 테헤란로 123', '서울 강남구 테헤란로 123 별관'))
  const BR = ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래테크', '대 표 자 : 김대표', '개업연월일 : 2019년 03월 04일', '법인등록번호 : 110111-1234567', '사업장소재지 : 서울특별시 강남구 테헤란로 123, 4층 (역삼동)', '업태 정보통신업 종목 응용소프트웨어 개발'].join('\n')
  const REG = ['등기사항전부증명서(현재 유효사항)', '상 호 주식회사 미래테크', '등록번호 110111-1234567', '본 점 서울 강남구 테헤란로 123 4층(역삼동)', '회사성립연월일 2019년 02월 27일', '대표이사 김대표 800101-1******'].join('\n')
  const empty = normalizeClientOps({ id: 'd392', companyName: '', createdAt: NOW, updatedAt: NOW })
  const br = { key: 'businessRegistration' as const, fileName: 'br.pdf', text: BR, method: 'pdf_text' as const, docSure: true }
  const reg = { key: 'corporateRegistry' as const, fileName: 'reg.pdf', text: REG, method: 'pdf_text' as const, docSure: true }
  let n = 0
  const a = await analyzeUploadedDocs(empty, [br, reg], { now: NOW, today: '2026-10-31', makeId: () => `d392a${++n}` })
  check('D-392 사업자등록증 → 등기부 순서: 묻는 것 0 · 설립일 = 등기부 2019-02-27 · 바로 넣은 것에 설립일 한 줄', a.summary.flagged.length === 0 && a.record.establishedAt === '2019-02-27' && a.summary.entered.filter((e) => e.key === 'establishedAt').length === 1, JSON.stringify([a.record.establishedAt, a.summary.flagged, a.summary.entered.filter((e) => e.key === 'establishedAt')]))
  const b = await analyzeUploadedDocs(empty, [reg, br], { now: NOW, today: '2026-10-31', makeId: () => `d392b${++n}` })
  check('D-392 등기부 → 사업자등록증 순서도 묻는 것 0 · 설립일 2019-02-27 · 주소는 처음 넣은 값 그대로', b.summary.flagged.length === 0 && b.record.establishedAt === '2019-02-27' && b.record.businessAddress === '서울 강남구 테헤란로 123 4층(역삼동)', JSON.stringify([b.record.establishedAt, b.record.businessAddress, b.summary.flagged]))
  const typed = normalizeClientOps({ ...empty, establishedAt: '2019-01-15', factMeta: { establishedAt: { source: 'manual', status: 'confirmed', asOf: '', updatedAt: NOW } } } as never)
  const c = await analyzeUploadedDocs(typed, [reg], { now: NOW, today: '2026-10-31', makeId: () => `d392c${++n}` })
  check('D-392 사람이 적은 설립일과 등기부가 다르면 그대로 묻는다(덮지 않음)', c.record.establishedAt === '2019-01-15' && c.summary.flagged.some((f) => f.key === 'establishedAt'), JSON.stringify([c.record.establishedAt, c.summary.flagged]))
})()

// D-394 크레탑 보고서(지난 결산 · 예전 직원 수)가 서류로 넣은 더 최근 값과 달라도 '확인할 것' 에 남지 않음
{
  const meta = (source: string, asOf: string) => ({ source, status: 'entered', asOf, confirmedAt: '', updatedAt: NOW })
  const cr = withCretop(base) // 크레탑: 2025 매출 12.34억 · 직원 12명 · 주소 '서울 강남구 테헤란로 1'
  const newer = normalizeClientOps({ ...cr, employeeCount: '15', businessAddress: '서울특별시 강남구 테헤란로 1, 3층', factValues: { revenue: '1500000000' }, factMeta: { revenue: meta('taxReturn', '2026'), employeeCount: meta('payrollRoster', '2026-10-01') } } as never)
  const keys = pendingFacts(newer).filter((p) => p.from === 'cretop').map((p) => p.key)
  check('D-394 2026 신고서 매출 · 명부 직원 수 · 같은 주소(서울특별시 = 서울 · 3층만 더)면 크레탑 2025 값은 묻지 않음', !keys.includes('revenue') && !keys.includes('employeeCount') && !keys.includes('businessAddress'), JSON.stringify(keys))
  const same = normalizeClientOps({ ...cr, factValues: { revenue: '1500000000' }, factMeta: { revenue: meta('financialStatements', '2025') } } as never)
  check('D-394 같은 해(2025)인데 크레탑 매출과 다르면 예전처럼 묻는다', pendingFacts(same).some((p) => p.from === 'cretop' && p.key === 'revenue'))
  const typed = normalizeClientOps({ ...cr, employeeCount: '20', factMeta: { employeeCount: meta('manual', '') } } as never)
  check('D-394 사람이 직접 적은 직원 수(20)와 크레탑(12)이 다르면 예전처럼 묻는다', pendingFacts(typed).some((p) => p.from === 'cretop' && p.key === 'employeeCount'))
}

// D-395 부가가치세 신고서 → 그 신고 기간 과세표준('부가세 신고 매출' 칸 · 한 해 매출 칸은 아님)
await (async () => {
  const VR = ['일반과세자 부가가치세 [ ]예정 [√]확정 [ ]기한후과세표준 신고서', '관리번호', '신고기간 2026년 제1기 ( 1월 1일 ~ 6월 30일 )', '상호(법인명) 미래상사 성명(대표자명) 홍길동 사업자등록번호 124-81-00998',
    '① 신고내용', '구분 금액 세율 세액', '과세 세금계산서 발급분 (1) 500,000,000 10/100 50,000,000', '과세 신용카드·현금영수증 발행분 (3) 100,000,000 10/100 10,000,000', '과세 기타(정규영수증 외 매출분) (4) 20,000,000 10/100 2,000,000', '영세율 세금계산서 발급분 (5) 0 0/100', '합계 (9) 620,000,000 ㉮ 62,000,000', '매입세액 세금계산서 수취분 일반매입 (10) 300,000,000 30,000,000'].join('\n')
  const r = readVatReturn(VR)
  check('D-395 신고서 → 2026년 1기 확정 · 1~6월 · 과세표준 합계(9) 6억 2,000만원(세액 · 매입은 아님)', !!r && r.year === 2026 && r.half === 1 && r.kind === '확정' && r.from === '2026-01' && r.to === '2026-06' && r.base === 620_000_000 && vatReturnValue(r, formatWon) === '2026년 1기 확정(1~6월) 과세표준 6억 2,000만원', JSON.stringify(r))
  check('D-395 과세표준증명 · 본문에만 "부가가치세 신고서" 가 있는 안내문은 신고서 아님', readVatReturn(['부가가치세 과세표준증명', '과세기간 2025.01.01 ~ 2025.12.31'].join('\n')) === null && readVatReturn(['세무 일정 안내', '7월 25일까지 부가가치세 확정 신고서를 내세요'].join('\n')) === null)
  check('D-395 동그라미 숫자 "합계 ⑨" 로 적힌 신고서도 6억 2,000만원', readVatReturn(VR.replace('합계 (9) 620,000,000', '합계 ⑨ 620,000,000'))?.base === 620_000_000)
  const pre = readVatReturn(VR.replace('[ ]예정 [√]확정', '[√]예정 [ ]확정').replace('( 1월 1일 ~ 6월 30일 )', '( 1월 1일 ~ 3월 31일 )').replace('합계 (9) 620,000,000', '합계 (9) 280,000,000'))
  check('D-395 예정 신고(1~3월) → 예정 · 2026-03 · 2억 8,000만원', !!pre && pre.kind === '예정' && pre.to === '2026-03' && pre.base === 280_000_000, JSON.stringify(pre))
  const empty = normalizeClientOps({ id: 'vr395', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  const place = placeDocument({ text: VR, fileName: 'scan.pdf' }, allDocumentMetas(empty))
  check('D-395 서류함: "부가가치세 신고서" 칸(부가세 과세표준증명 · 사업자등록증 칸 아님)', place.kind === 'new' && place.label === '부가가치세 신고서', JSON.stringify(place))
  const cands = factCandidatesFromDocText('customdoc_vr', VR, 'r')
  check('D-395 후보는 "부가세 신고 매출" 하나 — 한 해 매출 · 회사 이름 · 번호는 이 서류로 읽지 않음', cands.map((c) => c.key).join() === 'cf:부가세 신고 매출' && cands[0].source === 'vatReturn', JSON.stringify(cands))
  let n = 0
  const a = await analyzeUploadedDocs(empty, [{ key: 'customdoc_vr', fileName: 'vr.pdf', text: VR, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `vr${++n}` })
  const b = await analyzeUploadedDocs(a.record, [{ key: 'customdoc_vr2', fileName: 'vr-pre.pdf', text: VR.replace('[ ]예정 [√]확정', '[√]예정 [ ]확정').replace('( 1월 1일 ~ 6월 30일 )', '( 1월 1일 ~ 3월 31일 )'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `vr${++n}` })
  const sum = answerFor('summary', { record: a.record, today: '2026-10-31', notices: [] })
  check('D-395 상담 요약 "이 회사 한눈에" 에 부가세 신고 줄', sum.facts.some((x) => x.startsWith('부가세 신고 2026년 1기 확정(1~6월) 과세표준 6억 2,000만원')), JSON.stringify(sum.facts))
  check('D-395 올리기 → 칸 바로 · 묻지 않음 · 앞선 기간(예정) 신고서를 나중에 올려도 확정 값 그대로 · 상담 요약 한 줄', customFactValue(a.record, '부가세 신고 매출').startsWith('2026년 1기 확정') && a.summary.flagged.length === 0 && customFactValue(b.record, '부가세 신고 매출').startsWith('2026년 1기 확정') && b.summary.flagged.length === 0 && !a.record.factValues?.revenue, JSON.stringify([customFactValue(b.record, '부가세 신고 매출'), b.summary.flagged]))
})()

// D-396 같은 해 부가세 신고서 여러 장(1기 · 2기)을 함께 올리면 그해 매출(과세표준 합계)
await (async () => {
  const mk = (y: number, half: 1 | 2, kind: string, m1: number, m2: number, won: string) => [`일반과세자 부가가치세 ${kind === '예정' ? '[√]예정 [ ]확정' : '[ ]예정 [√]확정'} 신고서`, `신고기간 ${y}년 제${half}기 ( ${m1}월 1일 ~ ${m2}월 ${m2 === 6 || m2 === 9 ? 30 : 31}일 )`, '① 신고내용', `합계 (9) ${won} ㉮ 1,000,000`].join('\n')
  const H1 = mk(2025, 1, '확정', 1, 6, '500,000,000')
  const H2 = mk(2025, 2, '확정', 7, 12, '600,000,000')
  const reads = [H1, H2].map((t) => readVatReturn(t)!)
  check('D-396 1기(1~6월) + 2기(7~12월) → 2025년 11억 · 한 장만 · 겹치면 없음', JSON.stringify(fullYearFromReturns(reads)) === '{"year":2025,"total":1100000000,"count":2}' && fullYearFromReturns([reads[0]]) === null && fullYearFromReturns([reads[0], reads[0], readVatReturn(mk(2025, 1, '확정', 1, 9, '1'))!]) === null)
  const corp = [mk(2025, 1, '예정', 1, 3, '200,000,000'), mk(2025, 1, '확정', 4, 6, '300,000,000'), mk(2025, 2, '예정', 7, 9, '250,000,000'), mk(2025, 2, '확정', 10, 12, '350,000,000')].map((t) => readVatReturn(t)!)
  check('D-396 법인 예정 · 확정 네 장(석 달씩) → 2025년 11억', fullYearFromReturns(corp)?.total === 1_100_000_000)
  const empty = normalizeClientOps({ id: 'vr396', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const docs = [H1, H2].map((t, i) => ({ key: `customdoc_v${i}` as never, fileName: `vat${i}.pdf`, text: t, method: 'pdf_text' as const, docSure: true }))
  const a = await analyzeUploadedDocs(empty, docs, { now: NOW, today: '2026-10-31', makeId: () => `v6${++n}` })
  check('D-396 두 장 함께 올리면 매출 11억(2025) 바로 · 출처 부가세 신고서 · 바로 넣은 것에 "부가세 신고서 2장" · 묻지 않음', readFact(a.record, 'revenue')?.value === '1100000000' && readFact(a.record, 'revenue')?.source === 'vatReturn' && readFact(a.record, 'revenue')?.asOf === '2025' && a.summary.entered.some((e) => e.key === 'revenue' && e.fileName.startsWith('부가세 신고서 2장')) && a.summary.flagged.length === 0, JSON.stringify([readFact(a.record, 'revenue'), a.summary.flagged]))
  const fin = normalizeClientOps({ ...empty, factValues: { revenue: '1150000000' }, factMeta: { revenue: { source: 'financialStatements', status: 'entered', asOf: '2025', updatedAt: NOW } } } as never)
  const b = await analyzeUploadedDocs(fin, docs, { now: NOW, today: '2026-10-31', makeId: () => `v6${++n}` })
  check('D-396 같은 해 재무제표 매출이 있으면 신고서 합계는 묻지 않고 재무제표 값 그대로', readFact(b.record, 'revenue')?.value === '1150000000' && !b.summary.flagged.some((f) => f.key === 'revenue'), JSON.stringify(b.summary.flagged))
})()

// D-397 면세사업자 사업장현황신고서 → 그해 수입금액(매출)
await (async () => {
  const SR = ['사업장현황신고서', '( 2025 년 귀속 )', '① 상호 미래의원 ② 성명 홍길동 ③ 사업자등록번호 124-81-00998', '④ 전화번호 02-1234-5678', '기본사항 ⑤ 종업원수 12 ⑥ 차량 2',
    '❶ 수입금액(매출액) 명세', '업태 종목 업종코드 합계 수입금액 수입금액제외', '보건업 일반의원 851201 850,000,000 850,000,000 0', '합계 850,000,000 850,000,000 0',
    '❷ 수입금액 구성명세', '합계 850,000,000 계산서발행 120,000,000 신용카드 600,000,000'].join('\n')
  check('D-397 사업장현황신고서 → 2025년 수입금액 8억 5,000만원(앞 기본사항 · 업종코드 숫자는 아님)', JSON.stringify(readSiteReport(SR)) === '{"year":2025,"revenue":850000000,"employees":12}', JSON.stringify(readSiteReport(SR)))
  check('D-397 귀속 연도가 없으면 · 본문에만 낱말이 있는 안내문은 읽지 않음', readSiteReport(SR.replace('( 2025 년 귀속 )', '')) === null && readSiteReport(['세무 일정', '2월 10일까지 사업장현황신고서를 내세요', '수입금액 합계 1,000,000'].join('\n')) === null)
  const empty = normalizeClientOps({ id: 'sr397', companyName: '미래의원', createdAt: NOW, updatedAt: NOW })
  const place = placeDocument({ text: SR, fileName: 'scan.pdf' }, allDocumentMetas(empty))
  check('D-397 서류함: "사업장현황신고서" 칸', place.kind === 'new' && place.label === '사업장현황신고서', JSON.stringify(place))
  const cands = factCandidatesFromDocText('customdoc_sr', SR, 'r')
  check('D-397 후보는 매출(2025 · 출처 사업장현황신고서) · D-399 종업원수 12 — 상호 · 번호 · 전화는 이 서류로 읽지 않음', cands.map((c) => c.key).join() === 'revenue,employeeCount' && cands[0].value === '850000000' && cands[0].asOf === '2025' && cands[0].source === 'siteReport' && cands[1].value === '12', JSON.stringify(cands))
  let n = 0
  const a = await analyzeUploadedDocs(empty, [{ key: 'customdoc_sr', fileName: 'sr.pdf', text: SR, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `sr${++n}` })
  check('D-397 올리기 한 번 → 매출 8.5억 바로 · 묻지 않음', readFact(a.record, 'revenue')?.value === '850000000' && a.summary.flagged.length === 0, JSON.stringify(a.summary.flagged))
  const sumSr = answerFor('summary', { record: a.record, today: '2026-10-31', notices: [] })
  check('D-399 직원 수 12(비어 있었음) · 상담 요약 "직원 12명(사업장현황신고서 2025년)"', a.record.employeeCount === '12' && sumSr.facts.some((x) => x.includes('직원 12명(사업장현황신고서 2025년)')), JSON.stringify(sumSr.facts))
  const inc = normalizeClientOps({ ...empty, factValues: { revenue: '870000000' }, factMeta: { revenue: { source: 'incomeCertificate', status: 'entered', asOf: '2025', updatedAt: NOW } } } as never)
  const b = await analyzeUploadedDocs(inc, [{ key: 'customdoc_sr', fileName: 'sr.pdf', text: SR, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `sr${++n}` })
  check('D-397 같은 해 소득금액증명 매출이 있으면 묻지 않고 그 값 그대로', readFact(b.record, 'revenue')?.value === '870000000' && b.summary.flagged.length === 0, JSON.stringify(b.summary.flagged))
  const wh = normalizeClientOps({ ...empty, employeeCount: '9', factMeta: { employeeCount: { source: 'withholding', status: 'entered', asOf: '2026-09', updatedAt: NOW } } } as never)
  const c = await analyzeUploadedDocs(wh, [{ key: 'customdoc_sr', fileName: 'sr.pdf', text: SR, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `sr${++n}` })
  const sumWh = answerFor('summary', { record: c.record, today: '2026-10-31', notices: [] })
  check('D-399 원천세 신고서 직원 수(9)가 있으면 종업원수(12)로 바꾸지도 묻지도 않음 · 요약 "직원 9명(원천세 신고 9월분)"', c.record.employeeCount === '9' && !c.summary.flagged.some((f) => f.key === 'employeeCount') && sumWh.facts.some((x) => x.includes('직원 9명(원천세 신고 9월분)')), JSON.stringify([c.record.employeeCount, sumWh.facts]))
})()

// D-398 개인사업자에게 매출 자료를 달라고 할 때 — 표준재무제표증명이 아니라 소득금액증명(면세는 사업장현황신고서 · 과세는 부가세 과세표준증명도)
{
  const mk = (key: string, label: string, missing: string[]): Insight => ({ key, label, tone: 'need', headline: '', detail: '', missing, openPath: '', openLabel: '', action: null })
  const ins = [mk('cert-os', '기업인증', ['매출 · 재무']), mk('policy-funding', '정책자금', ['매출'])]
  const ind = requestItemsFrom(ins, { individual: true }).items
  const corp = requestItemsFrom(ins).items
  check('D-398 개인사업자: 매출 · 재무 → "소득금액증명(종합소득세 · 최근 해)" 하나 · 면세 · 과세 대안 안내 · 두 모듈 묶음', ind.length === 1 && ind[0].label === '소득금액증명(종합소득세 · 최근 해)' && ind[0].where.includes('사업장현황신고서') && ind[0].where.includes('부가세 과세표준증명') && ind[0].for.join() === '기업인증,정책자금', JSON.stringify(ind))
  check('D-398 법인은 그대로 "최근 재무제표(표준재무제표증명)"', corp.length === 1 && corp[0].label === '최근 재무제표(표준재무제표증명)', JSON.stringify(corp))
  const indRec = normalizeClientOps({ id: 'rq398', companyName: '미래상회', businessNumber: '124-01-00998', representativeName: '홍길동', createdAt: NOW, updatedAt: NOW })
  const msg = recoRequestMessage(indRec, ins)
  check('D-398 카톡 요청 문구도 개인사업자면 소득금액증명(사업자번호 가운데 01 = 개인)', msg.includes('소득금액증명(종합소득세 · 최근 해)') && !msg.includes('표준재무제표증명'), msg)
}

// D-400 상담 '대표님께 물어볼 것' — 직원 수 · 매출 질문에 받으면 바로 채워지는 서류
{
  const ind = normalizeClientOps({ id: 'ask400', companyName: '미래상회', businessNumber: '124-01-00998', createdAt: NOW, updatedAt: NOW })
  const corp = normalizeClientOps({ id: 'ask400c', companyName: '(주)미래테크', corporateNumber: '110111-1234567', createdAt: NOW, updatedAt: NOW })
  const a = answerFor('ask', { record: ind, today: '2026-10-31', notices: [] })
  const b = answerFor('ask', { record: corp, today: '2026-10-31', notices: [] })
  check('D-400 개인사업자: 직원 수 → 원천세 신고서 · 4대보험 명부 / 매출 → 소득금액증명 · 부가세 신고서 · 사업장현황신고서', a.steps.some((x) => x.includes('직원이 몇 명') && x.includes('원천세 신고서')) && a.steps.some((x) => x.includes('작년 매출') && x.includes('소득금액증명') && x.includes('사업장현황신고서')), JSON.stringify(a.steps))
  check('D-400 법인: 매출 → 재무제표 · 세무조정계산서', b.steps.some((x) => x.includes('작년 매출') && x.includes('재무제표 · 세무조정계산서')), JSON.stringify(b.steps))
}

// D-401 맞춤 진단서 '회사 한눈에' — 한 해 매출보다 최근 해의 부가세 신고서면 한 줄
{
  const meta = { source: 'financialStatements', status: 'entered', asOf: '2025', updatedAt: NOW }
  const mk = (vr: string, rev?: string) => normalizeClientOps({ id: 'dg401', companyName: '미래상사', createdAt: NOW, updatedAt: NOW, customFields: vr ? [{ id: 'v', group: 'identity', label: '부가세 신고 매출', value: vr }] : [], ...(rev ? { factValues: { revenue: rev }, factMeta: { revenue: meta } } : {}) } as never)
  const row = (r: ReturnType<typeof mk>) => buildDiagnosis(r, buildInsights(r, '2026-10-31', []), '2026-10-31').snapshot.find((x) => x.label === '부가세 신고')?.value
  check('D-401 2025 매출 + 2026년 1기 신고서 → "부가세 신고 · 2026년 1기 확정(1~6월) · 6억 2,000만원"', row(mk('2026년 1기 확정(1~6월) 과세표준 6억 2,000만원', '1100000000')) === '2026년 1기 확정(1~6월) · 6억 2,000만원', String(row(mk('2026년 1기 확정(1~6월) 과세표준 6억 2,000만원', '1100000000'))))
  check('D-401 같은 해(2025) 신고서면 한 해 매출로 충분 — 줄 없음 · 신고서가 없으면 줄 없음', row(mk('2025년 2기 확정(7~12월) 과세표준 6억원', '1100000000')) === undefined && row(mk('', '1100000000')) === undefined)
}

// D-402 원천세 신고서가 반년 넘게 지난 달 것이면 고용지원금 카드에 '최근 달 신고서로 다시'
{
  const mk = (asOf: string) => normalizeClientOps({ id: 'wh402', companyName: '미래테크', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 'w', group: 'people', label: '원천세 신고 인원', value: `${Number(asOf.slice(0, 4))}년 ${Number(asOf.slice(5))}월분 근로자 12명` }], factMeta: { 'cf:원천세 신고 인원': { source: 'withholding', status: 'confirmed', asOf, updatedAt: NOW } } } as never)
  const line = (asOf: string) => buildInsights(mk(asOf), '2026-10-31', []).find((i) => i.key === 'employment')?.detail ?? ''
  check('D-402 2026년 3월분(7달 전) → "반년 넘었어요, 최근 달 신고서로 다시" · 9월분은 없음', line('2026-03').includes('반년 넘었어요') && !line('2026-09').includes('반년 넘었어요') && line('2026-09').includes('원천세 신고서 2026년 9월분'), `${line('2026-03')} | ${line('2026-09')}`)
}

// D-403 원천세 신고서 여러 달 → '원천세 인원 추이' 칸 · 작년 같은 달과 비교
await (async () => {
  const wh = (ym: string, n: number) => ['원천징수이행상황신고서', `② 귀속연월 ${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월 ③ 지급연월 ${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`, `근로소득 간이세액 A01 ${n} ${(n * 3_000_000).toLocaleString('en-US')} 100,000`].join('\n')
  check('D-403 추이 합치기 — 같은 달은 새것 · 달 순서 · 한 달만이면 없음', mergeHeadcountTrend('2025-09 9명', [{ yearMonth: '2026-09', employees: 12 }, { yearMonth: '2025-09', employees: 10 }]) === '2025-09 10명 · 2026-09 12명' && mergeHeadcountTrend('', [{ yearMonth: '2026-09', employees: 12 }]) === '')
  check('D-403 작년 같은 달 찾기 — 2025-09 → 2026-09 · 없으면 null', JSON.stringify(yearOverYear('2025-09 9명 · 2026-08 11명 · 2026-09 12명')) === '{"now":{"ym":"2026-09","n":12},"before":{"ym":"2025-09","n":9}}' && yearOverYear('2026-08 11명 · 2026-09 12명') === null)
  const base = normalizeClientOps({ id: 'wh403', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'customdoc_w1', fileName: 'wh2509.pdf', text: wh('2025-09', 9), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `w3${++n}` })
  check('D-403 한 달만 올리면 추이 칸은 아직 없음', !customFactValue(a.record, '원천세 인원 추이'))
  const b = await analyzeUploadedDocs(a.record, [{ key: 'customdoc_w2', fileName: 'wh2609.pdf', text: wh('2026-09', 12), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `w3${++n}` })
  const emp = buildInsights(b.record, '2026-10-31', []).find((i) => i.key === 'employment')
  check('D-403 다음에 올해 9월분을 올리면 추이 "2025-09 9명 · 2026-09 12명" · 카드 "9명 → 12명(+3) — 늘었어요" · 묻지 않음', customFactValue(b.record, '원천세 인원 추이') === '2025-09 9명 · 2026-09 12명' && !!emp && emp.detail.includes('2025-09 9명 → 2026-09 12명(+3) — 늘었어요') && b.summary.flagged.length === 0, JSON.stringify([customFactValue(b.record, '원천세 인원 추이'), emp?.detail, b.summary.flagged]))
  const c = await analyzeUploadedDocs(base, [{ key: 'customdoc_w1', fileName: 'a.pdf', text: wh('2026-08', 11), method: 'pdf_text' as const, docSure: true }, { key: 'customdoc_w2', fileName: 'b.pdf', text: wh('2026-09', 12), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `w3${++n}` })
  check('D-403 두 달을 한 번에 올려도 추이 · 직원 수는 최근 달(12)', customFactValue(c.record, '원천세 인원 추이') === '2026-08 11명 · 2026-09 12명' && c.record.employeeCount === '12', JSON.stringify([customFactValue(c.record, '원천세 인원 추이'), c.record.employeeCount, c.summary.flagged]))
})()

// D-404 명부가 없으면 원천세 인원 추이(작년 같은 달 대비)로 정책자금 고용 증가
{
  const mk = (trend: string) => normalizeClientOps({ id: 'ph404', companyName: '미래테크', createdAt: NOW, updatedAt: NOW, customFields: [{ id: 't', group: 'people', label: '원천세 인원 추이', value: trend }] } as never)
  const up = policyHiring(mk('2025-09 9명 · 2026-09 12명'), '2026-10-31')
  const down = policyHiring(mk('2025-09 12명 · 2026-09 9명'), '2026-10-31')
  const old = policyHiring(mk('2024-09 9명 · 2025-09 12명'), '2026-10-31')
  check('D-404 늘었으면 고용 증가(원천세 신고 2025-09 9명 → 2026-09 12명) · 줄었으면 주의 · 1년 넘은 달이면 쓰지 않음 · 같은 달이 없으면 없음', !!up?.grew && up.line.startsWith('고용 증가(원천세 신고 2025-09 9명 → 2026-09 12명)') && !!down && !down.grew && down.line.startsWith('직원이 줄었어요') && old === null && policyHiring(mk('2026-08 11명 · 2026-09 12명'), '2026-10-31') === null, JSON.stringify([up, down, old]))
  const ev = policyEvidence(mk('2025-09 9명 · 2026-09 12명'), clientFacts(mk('2025-09 9명 · 2026-09 12명'), new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-404 정책자금 판정 입력에 고용증가 · 근거 줄 맨 앞', (ev.input.strengths ?? []).includes('고용증가') && ev.notes.some((n) => n.startsWith('고용 증가(원천세 신고')), JSON.stringify([ev.input.strengths, ev.notes]))
}

// D-405 부가세 신고서 두 해(같은 기간) → '부가세 신고 추이' · 작년 같은 기간 대비 → 정책자금 올해 추세 · 상담 · 진단서
await (async () => {
  const vr = (y: number, base: string) => ['일반과세자 부가가치세 [ ]예정 [√]확정 신고서', `신고기간 ${y}년 제1기 ( 1월 1일 ~ 6월 30일 )`, '① 신고내용', `합계 (9) ${base} ㉮ 1,000,000`].join('\n')
  check('D-405 추이 합치기 · 작년 같은 기간 +24% · 기간이 다르면 비교 안 함', mergeVatTrend('', [{ from: '2025-01', to: '2025-06', base: 500_000_000 }, { from: '2026-01', to: '2026-06', base: 620_000_000 }]) === '2025-01~06 500,000,000원 · 2026-01~06 620,000,000원' && vatYearOverYear('2025-01~06 500,000,000원 · 2026-01~06 620,000,000원')?.pct === 24 && vatYearOverYear('2025-07~12 500,000,000원 · 2026-01~06 620,000,000원') === null)
  check('D-405 정책자금 추이 읽기와 같은 말 — "2026년 1~6월 작년 같은 기간보다 +24%" → 전년보다 증가', vatYoyText({ cur: { from: '2026-01', to: '2026-06', base: 1 }, pct: 24 }) === '2026년 1~6월 작년 같은 기간보다 +24%' && vatTrendOf(vatYoyText({ cur: { from: '2026-01', to: '2026-06', base: 1 }, pct: 24 })).thisYear === '전년보다 증가')
  const base = normalizeClientOps({ id: 'vr405', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'customdoc_v1', fileName: 'vat2025.pdf', text: vr(2025, '500,000,000'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `v5${++n}` })
  check('D-405 한 해만 올리면 추이 칸 없음', !customFactValue(a.record, '부가세 신고 추이'))
  const b = await analyzeUploadedDocs(a.record, [{ key: 'customdoc_v2', fileName: 'vat2026.pdf', text: vr(2026, '620,000,000'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `v5${++n}` })
  check('D-405 다음 해 신고서 → 추이 "2025-01~06 500,000,000원 · 2026-01~06 620,000,000원" · 묻지 않음', customFactValue(b.record, '부가세 신고 추이') === '2025-01~06 500,000,000원 · 2026-01~06 620,000,000원' && b.summary.flagged.length === 0, JSON.stringify([customFactValue(b.record, '부가세 신고 추이'), b.summary.flagged]))
  const ev = policyEvidence(b.record, clientFacts(b.record, new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-405 정책자금: 매출 추이 칸이 없어도 올해 추세 "전년보다 증가" · 근거 줄', ev.input.thisYearTrend === '전년보다 증가' && ev.notes.some((x) => x.includes('작년 같은 기간보다 +24%')), JSON.stringify([ev.input.thisYearTrend, ev.notes]))
  const sum = answerFor('summary', { record: b.record, today: '2026-10-31', notices: [] })
  const dg = buildDiagnosis(b.record, buildInsights(b.record, '2026-10-31', []), '2026-10-31').snapshot.find((x) => x.label === '부가세 신고')?.value ?? ''
  check('D-405 상담 요약 · 진단서 회사 한눈에 "작년 같은 기간보다 +24%"', sum.facts.some((x) => x.includes('부가세 신고 2026년 1기') && x.includes('(작년 같은 기간보다 +24%)')) && dg.includes('작년 같은 기간보다 +24%'), JSON.stringify([sum.facts, dg]))
})()

// D-406 재무제표 · 세무조정계산서 매출액 줄의 전기 숫자 → '매출 추이'(정책자금 매출 성장세)
await (async () => {
  const FS = ['표준재무제표증명', '손익계산서', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '매출액 2,400,000,000 2,000,000,000', '영업이익 300,000,000 250,000,000', '당기순이익 220,000,000 180,000,000'].join('\n')
  const f = parseFinancialStatement(FS)
  check('D-406 매출액 줄 둘째 숫자 = 전기 20억', f.revenuePrev === 2_000_000_000 && f.revenue === 2_400_000_000, JSON.stringify(f))
  const cands = factCandidatesFromDocText('financialStatements', FS, 'r')
  const tr = cands.find((c) => c.key === 'cf:매출 추이')
  check('D-406 재무제표 → "2025년 24억원(재무제표 · 2024년보다 +20%)" · 정책자금 읽기 = 3년 추세 증가', tr?.value === '2025년 24억원(재무제표 · 2024년보다 +20%)' && vatTrendOf(tr?.value ?? '').trend3y === '증가', JSON.stringify(tr))
  const base = normalizeClientOps({ id: 'fs406', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `f6${++n}` })
  const ev = policyEvidence(a.record, clientFacts(a.record, new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-406 올리기 한 번 → 매출 추이 칸 · 정책자금 3년 추세 증가 · 묻지 않음', customFactValue(a.record, '매출 추이').includes('2024년보다 +20%') && ev.input.revenueTrend3y === '증가' && a.summary.flagged.length === 0, JSON.stringify([customFactValue(a.record, '매출 추이'), ev.input.revenueTrend3y, a.summary.flagged]))
  const vat = normalizeClientOps({ ...base, customFields: [{ id: 'mt', group: 'identity', label: '매출 추이', value: '2025년 25억원(부가세 과세표준 · 2024년보다 +18%)' }], factMeta: { 'cf:매출 추이': { source: 'vatCertificate', status: 'confirmed', asOf: '2025', updatedAt: NOW } } } as never)
  const b = await analyzeUploadedDocs(vat, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `f6${++n}` })
  check('D-406 과세표준증명의 매출 추이 줄이 있으면 그대로 · 묻지 않음', customFactValue(b.record, '매출 추이').includes('부가세 과세표준') && !b.summary.flagged.some((x) => x.key === 'cf:매출 추이'), JSON.stringify([customFactValue(b.record, '매출 추이'), b.summary.flagged]))
  const FS26 = FS.replace('2025년 12월 31일', '2026년 12월 31일').replace('매출액 2,400,000,000 2,000,000,000', '매출액 3,000,000,000 2,400,000,000')
  const c = await analyzeUploadedDocs(a.record, [{ key: 'financialStatements', fileName: 'fs26.pdf', text: FS26, method: 'pdf_text' as const, docSure: true }], { now: '2026-10-30T09:00:00.000Z', today: '2026-10-31', makeId: () => `f6${++n}` })
  check('D-406 다음 해 재무제표 → 매출 추이 · 매출 · 이익을 2026년 값으로 바로 바꿈(묻지 않음)', customFactValue(c.record, '매출 추이').startsWith('2026년 30억원(재무제표 · 2025년보다 +25%)') && readFact(c.record, 'revenue')?.value === '3000000000' && readFact(c.record, 'revenue')?.asOf === '2026' && c.summary.flagged.length === 0, JSON.stringify([customFactValue(c.record, '매출 추이'), readFact(c.record, 'revenue'), c.summary.flagged]))
  const typed = normalizeClientOps({ ...base, factValues: { revenue: '2100000000' }, factMeta: { revenue: { source: 'manual', status: 'confirmed', asOf: '', updatedAt: NOW } } } as never)
  const d = await analyzeUploadedDocs(typed, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `f6${++n}` })
  check('D-406 사람이 직접 적은 매출과 다르면 예전처럼 묻는다(덮지 않음)', readFact(d.record, 'revenue')?.value === '2100000000' && d.summary.flagged.some((x) => x.key === 'revenue'), JSON.stringify(d.summary.flagged))
})()

// D-407 면세사업자 사업장현황신고서를 해마다 올리면 '매출 추이'(재무제표 없는 병원 · 학원도 정책자금 매출 성장세)
await (async () => {
  const SR25 = ['사업장현황신고서', '( 2025 년 귀속 )', '① 상호 미래의원', '기본사항 ⑤ 종업원수 12', '❶ 수입금액(매출액) 명세', '합계 850,000,000 850,000,000 0'].join('\n')
  const SR24 = SR25.replace('2025 년 귀속', '2024 년 귀속').replace('합계 850,000,000 850,000,000', '합계 700,000,000 700,000,000')
  const base = normalizeClientOps({ id: 'sr407', companyName: '미래의원', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const up = (rec: typeof base, text: string, now: string) => analyzeUploadedDocs(rec, [{ key: 'customdoc_sr', fileName: 'sr.pdf', text, method: 'pdf_text' as const, docSure: true }], { now, today: '2026-10-31', makeId: () => `s7${++n}` })
  const a = await up(base, SR24, NOW)
  check('D-407 한 해만 있으면 추이 줄 없음(짐작하지 않음)', readFact(a.record, 'revenue')?.value === '700000000' && customFactValue(a.record, '매출 추이') === '', customFactValue(a.record, '매출 추이'))
  const b = await up(a.record, SR25, '2026-10-30T09:00:00.000Z')
  const tr = customFactValue(b.record, '매출 추이')
  const ev = policyEvidence(b.record, clientFacts(b.record, new Date('2026-10-31T00:00:00')), '2026-10-31')
  check('D-407 다음 해 신고서 → 매출 2025년 값으로 · "2025년 …(사업장현황신고서 · 2024년보다 +21%)" · 정책자금 3년 추세 증가 · 묻지 않음', readFact(b.record, 'revenue')?.value === '850000000' && tr.startsWith('2025년 ') && tr.includes('(사업장현황신고서 · 2024년보다 +21%)') && vatTrendOf(tr).trend3y === '증가' && ev.input.revenueTrend3y === '증가' && b.summary.flagged.length === 0, JSON.stringify([tr, ev.input.revenueTrend3y, b.summary.flagged]))
  const both = await analyzeUploadedDocs(base, [
    { key: 'customdoc_sr', fileName: 'sr25.pdf', text: SR25, method: 'pdf_text' as const, docSure: true },
    { key: 'customdoc_sr2', fileName: 'sr24.pdf', text: SR24, method: 'pdf_text' as const, docSure: true },
  ], { now: NOW, today: '2026-10-31', makeId: () => `s7${++n}` })
  check('D-407 두 해를 한 번에 올려도 같은 추이 줄', customFactValue(both.record, '매출 추이') === tr, JSON.stringify([customFactValue(both.record, '매출 추이'), both.summary.flagged]))
  const SR23 = SR25.replace('2025 년 귀속', '2023 년 귀속').replace('합계 850,000,000 850,000,000', '합계 600,000,000 600,000,000')
  const c = await up(b.record, SR23, '2026-10-30T10:00:00.000Z')
  check('D-407 더 옛날 해를 나중에 올려도 최근 두 해 줄 그대로 · 매출도 2025년 값 그대로', customFactValue(c.record, '매출 추이') === tr && readFact(c.record, 'revenue')?.value === '850000000', JSON.stringify([customFactValue(c.record, '매출 추이'), readFact(c.record, 'revenue')]))
  const FS = ['표준재무제표증명', '손익계산서', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '매출액 860,000,000 710,000,000', '당기순이익 90,000,000 70,000,000'].join('\n')
  const d = await analyzeUploadedDocs(b.record, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS, method: 'pdf_text' as const, docSure: true }], { now: '2026-10-30T11:00:00.000Z', today: '2026-10-31', makeId: () => `s7${++n}` })
  check('D-407 같은 해 재무제표가 오면 매출 추이는 재무제표 줄로(더 자세한 장부) · 추이는 묻지 않음', customFactValue(d.record, '매출 추이').includes('(재무제표 · 2024년보다 +21%)') && !d.summary.flagged.some((x) => x.key === 'cf:매출 추이'), JSON.stringify([customFactValue(d.record, '매출 추이'), d.summary.flagged]))
  const inc = normalizeClientOps({ ...a.record, customFields: [...a.record.customFields, { id: 'mt', group: 'identity', label: '매출 추이', value: '2025년 8억 6,000만원(소득금액증명 · 2024년보다 +22%)' }], factMeta: { ...(a.record.factMeta ?? {}), 'cf:매출 추이': { source: 'incomeCertificate', status: 'confirmed', asOf: '2025', updatedAt: NOW } } } as never)
  const e = await up(inc, SR25, '2026-10-30T12:00:00.000Z')
  check('D-407 소득금액증명으로 만든 추이 줄이 있으면 바꾸지 않음', customFactValue(e.record, '매출 추이').includes('소득금액증명'), customFactValue(e.record, '매출 추이'))
})()

// D-408 실제 업체처럼 서류를 한 묶음 올렸을 때 — 서류끼리 같은 해 '매출 추이' · 사업장현황신고서 두 해 · 업태/종목 더 자세한 글은 묻지 않는다
await (async () => {
  const T = {
    BR: ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래테크', '대 표 자 : 김대표', '개업연월일 : 2019년 03월 04일', '법인등록번호 : 110111-1234567', '사업장소재지 : 서울특별시 강남구 테헤란로 123, 4층 (역삼동)', '업태 정보통신업 종목 응용소프트웨어 개발'].join('\n'),
    REG: ['등기사항전부증명서(현재 유효사항)', '상 호 주식회사 미래테크', '등록번호 110111-1234567', '본 점 서울 강남구 테헤란로 123 4층(역삼동)', '1주의 금액 금 5,000 원', '발행주식의 총수 20,000 주', '보통주식 20,000 주 자본금의 액 금 100,000,000 원', '회사성립연월일 2019년 02월 27일', '임원에 관한 사항', '대표이사 김대표 800101-1******', '2025 년 02 월 27 일 중임'].join('\n'),
    FS: ['표준재무제표증명', '재무상태표', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '가지급금 30,000,000 25,000,000', '자산총계 3,200,000,000 2,900,000,000', '부채총계 1,400,000,000 1,300,000,000', '미처분이익잉여금 800,000,000 690,000,000', '손익계산서', '매출액 2,400,000,000 2,000,000,000', '영업이익 300,000,000 250,000,000', '당기순이익 220,000,000 180,000,000'].join('\n'),
    VC: ['부가가치세 과세표준증명', '과세기간 신고구분 신고일 과세표준', '2024.01.01~2024.06.30 확정 2024.07.25 950,000,000', '2024.07.01~2024.12.31 확정 2025.01.24 1,000,000,000', '2025.01.01~2025.06.30 확정 2025.07.25 1,150,000,000', '2025.07.01~2025.12.31 확정 2026.01.25 1,200,000,000'].join('\n'),
    WH: ['원천징수이행상황신고서', '① 신고구분 [√]매월 [ ]반기 [ ]수정 [ ]연말', '② 귀속연월 2026년 9월 ③ 지급연월 2026년 9월', '원천징수의무자 법인명(상호) 주식회사 미래테크 대표자(성명) 김대표', '1. 원천징수 명세 및 납부세액', '소득자 소득구분 코드 인원 총지급액 소득세등', '근로소득 간이세액 A01 12 45,000,000 1,234,560'].join('\n'),
    VR: ['일반과세자 부가가치세 [ ]예정 [√]확정 [ ]기한후과세표준 신고서', '신고기간 2026년 제1기 ( 1월 1일 ~ 6월 30일 )', '상호(법인명) 주식회사 미래테크 성명(대표자명) 김대표 사업자등록번호 124-81-00998', '합계 (9) 1,400,000,000 ㉮ 140,000,000'].join('\n'),
    ROSTER: ['4대보험 사업장 가입자 명부', ['성명', '주민등록번호', '자격취득일'].join('\t'), ...['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타'].map((x, i) => [`김${x}${x}`, `9${i % 10}0${(i % 9) + 1}01-1234567`, '2024-03-01'].join('\t'))].join('\n'),
    NICE: ['NICE지키미 신용정보 조회서', '조회일 2026.10.20', '성명 김대표 생년월일 1980.01.01', '나의 신용점수 812 점', '(1,000점 만점)'].join('\n'),
  }
  let n = 0
  const up = async (rec: ClientOpsRecord, docs: [string, string][], now: string) => {
    const metas = allDocumentMetas(rec)
    const read = docs.map(([fileName, text], i) => {
      const p = placeDocument({ text, fileName }, metas)
      return { key: p.kind === 'existing' ? p.key : `customdoc_${i}_${now.slice(11, 13)}`, fileName, text, method: 'pdf_text' as const, docSure: p.sure }
    })
    return analyzeUploadedDocs(rec, read, { now, today: '2026-10-31', makeId: () => `d8${++n}` })
  }
  const base = normalizeClientOps({ id: 'set408', companyName: '', createdAt: NOW, updatedAt: NOW })
  const set: [string, string][] = [['사업자등록증.pdf', T.BR], ['등기부.pdf', T.REG], ['재무제표.pdf', T.FS], ['과세표준증명.pdf', T.VC], ['원천세.pdf', T.WH], ['부가세신고서.pdf', T.VR], ['명부.xlsx', T.ROSTER], ['신용.pdf', T.NICE]]
  const a = await up(base, set, NOW)
  check('D-408 법인 서류 8장 한 번에 → 묻는 것은 진짜 확인할 대표 취임일 하나(중임 날짜만 있음) · 매출 추이는 묻지 않음', a.summary.flagged.map((f) => f.key).join() === 'taxProfile.ceoStartDate' && pendingFacts(a.record).length === 0 && customFactValue(a.record, '매출 추이').includes('(재무제표 · 2024년보다 +20%)'), JSON.stringify([a.summary.flagged.map((f) => f.key), pendingFacts(a.record).map((p) => p.key)]))
  const rev = await up(base, [...set].reverse(), NOW)
  check('D-408 순서를 거꾸로 올려도(과세표준증명이 먼저) 매출 추이를 묻지 않음', !rev.summary.flagged.some((f) => f.key === 'cf:매출 추이') && pendingFacts(rev.record).length === 0 && customFactValue(rev.record, '매출 추이') !== '', JSON.stringify(rev.summary.flagged.map((f) => f.key)))
  const fsOnly = await up(base, [['재무제표.pdf', T.FS]], NOW)
  const vcLater = await up(fsOnly.record, [['과세표준증명.pdf', T.VC]], '2026-10-31T03:00:00.000Z')
  check('D-408 재무제표를 먼저, 과세표준증명을 나중에 올려도 같은 해 추이는 묻지 않고 그대로', customFactValue(vcLater.record, '매출 추이').includes('재무제표') && vcLater.summary.flagged.length === 0, JSON.stringify([customFactValue(vcLater.record, '매출 추이'), vcLater.summary.flagged]))
  const VC26 = [...T.VC.split('\n'), '2026.01.01~2026.06.30 확정 2026.07.25 1,400,000,000', '2026.07.01~2026.12.31 확정 2027.01.25 1,500,000,000'].join('\n')
  const vc26 = await up(fsOnly.record, [['과세표준증명.pdf', VC26]], '2026-10-31T04:00:00.000Z')
  check('D-408 더 최근 해(2026) 과세표준증명 추이는 2025 재무제표 줄을 묻지 않고 바꿈', customFactValue(vc26.record, '매출 추이').startsWith('2026년') && !vc26.summary.flagged.some((f) => f.key === 'cf:매출 추이'), JSON.stringify([customFactValue(vc26.record, '매출 추이'), vc26.summary.flagged]))
  const CERT = ['사업자등록증명', '상호(법인명) 주식회사 미래테크 사업자등록번호 124-81-00998', '성명(대표자) 김대표', '개업일 2019-03-04', '사업장소재지 서울특별시 강남구 테헤란로 123, 4층(역삼동)', '업태 정보통신업 종목 응용소프트웨어 개발 및 공급업', '발급일 2026년 10월 30일'].join('\n')
  const b = await up(a.record, [['사업자등록증명.pdf', CERT]], '2026-10-31T05:00:00.000Z')
  check('D-408 사업자등록증명의 종목이 더 자세하면(지금 글을 다 담음) 묻지 않고 새 글로', b.record.businessItem === '응용소프트웨어 개발 및 공급업' && b.summary.flagged.length === 0, JSON.stringify([b.record.businessItem, b.summary.flagged]))
  const c = await up(b.record, [['사업자등록증.pdf', T.BR]], '2026-10-31T06:00:00.000Z')
  check('D-408 짧은 종목 글(사업자등록증)을 다시 올려도 긴 글 그대로 · 묻지 않음', c.record.businessItem === '응용소프트웨어 개발 및 공급업' && c.summary.flagged.length === 0, JSON.stringify([c.record.businessItem, c.summary.flagged]))
  const typed = normalizeClientOps({ ...base, businessItem: '소프트웨어' })
  const d = await up(typed, [['사업자등록증.pdf', T.BR]], NOW)
  check('D-408 사람이 적은 종목은 더 긴 글이 와도 예전처럼 묻는다', d.record.businessItem === '소프트웨어' && d.summary.flagged.some((f) => f.key === 'businessItem'), JSON.stringify([d.record.businessItem, d.summary.flagged]))
  const SR = (y: number, amt: string, emp: number) => ['사업장현황신고서', `( ${y} 년 귀속 )`, '① 상호 미래의원', `기본사항 ⑤ 종업원수 ${emp}`, '❶ 수입금액(매출액) 명세', `합계 ${amt} ${amt} 0`].join('\n')
  const e = await up(base, [['현황2024.pdf', SR(2024, '700,000,000', 10)], ['현황2025.pdf', SR(2025, '850,000,000', 12)]], NOW)
  check('D-408 사업장현황신고서 두 해를 한 번에(앞선 해가 먼저) → 직원 12 · 매출 2025년 값 · 묻지 않음', e.record.employeeCount === '12' && readFact(e.record, 'revenue')?.value === '850000000' && e.summary.flagged.length === 0, JSON.stringify([e.record.employeeCount, readFact(e.record, 'revenue'), e.summary.flagged]))
})()

// D-409 '최근 3개년 재무제표' 를 세 장 따로 올려도 — 앞선 해 값은 묻지 않고, 절세 현황은 가장 최근 해로 · 2년 전 순이익까지 · 다음 해 재무제표는 한 해 넘김
await (async () => {
  const FS = (y: number, rev: [string, string], ni: [string, string], assets: [string, string], loan: [string, string] = ['30,000,000', '25,000,000'], re: [string, string] = ['800,000,000', '690,000,000']) =>
    ['표준재무제표증명', '재무상태표', `제 ${y - 2018}(당)기 ${y}년 12월 31일 현재`, '(단위 : 원)', `가지급금 ${loan[0]} ${loan[1]}`, `자산총계 ${assets[0]} ${assets[1]}`, `미처분이익잉여금 ${re[0]} ${re[1]}`, '손익계산서', `매출액 ${rev[0]} ${rev[1]}`, `당기순이익 ${ni[0]} ${ni[1]}`].join('\n')
  const F25 = FS(2025, ['2,400,000,000', '2,000,000,000'], ['220,000,000', '180,000,000'], ['3,200,000,000', '2,900,000,000'])
  const F24 = FS(2024, ['2,000,000,000', '1,700,000,000'], ['180,000,000', '120,000,000'], ['2,900,000,000', '2,500,000,000'], ['25,000,000', '20,000,000'], ['690,000,000', '600,000,000'])
  const F23 = FS(2023, ['1,700,000,000', '1,500,000,000'], ['120,000,000', '90,000,000'], ['2,500,000,000', '2,200,000,000'], ['20,000,000', '10,000,000'], ['600,000,000', '500,000,000'])
  const p25 = parseFinancialStatement(F25)
  check('D-409 재무상태표 둘째 숫자 = 전기 말 가지급금 · 미처분이익잉여금', p25.loanBalancePrev === 25_000_000 && p25.retainedEarningsPrev === 690_000_000, JSON.stringify(p25))
  const pOne = parseFinancialStatement(F25.replace('가지급금 30,000,000 25,000,000', '가지급금 30,000,000\n주.임.종 단기채권 5,000,000 0'))
  check('D-409 가지급금 줄 하나라도 전기 숫자가 없으면 전기 합은 내지 않음(짐작 안 함)', pOne.loanBalance === 35_000_000 && pOne.loanBalancePrev === undefined, JSON.stringify(pOne))
  const base = normalizeClientOps({ id: 'fs409', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const doc = (text: string, i: number) => ({ key: i === 0 ? 'financialStatements' : `customdoc_fs${i}`, fileName: `fs${i}.pdf`, text, method: 'pdf_text' as const, docSure: true })
  const up = (rec: typeof base, texts: string[], now: string) => analyzeUploadedDocs(rec, texts.map(doc), { now, today: '2026-10-31', makeId: () => `f9${++n}` })
  const tp = (r: typeof base) => [r.taxProfile?.loanBalance, r.taxProfile?.retainedEarnings, r.taxProfile?.vInc1, r.taxProfile?.vInc0].join('/')
  const a = await up(base, [F25, F24, F23], NOW)
  check('D-409 세 장 한 번에(최근 해 먼저) → 묻는 것 0(예전 8) · 회사 정보 2025년 · 절세 현황 2025년 말 가지급금 3천만 · 배당 가능 8억 · 직전 연도 1.8억 · 2년 전 1.2억', a.summary.flagged.length === 0 && pendingFacts(a.record).length === 0 && readFact(a.record, 'revenue')?.asOf === '2025' && tp(a.record) === '30000000/800000000/180000000/120000000', JSON.stringify([a.summary.flagged.map((f) => f.key), tp(a.record)]))
  const b = await up(base, [F23, F24, F25], NOW)
  check('D-409 옛날 해 먼저 올려도 같은 값(예전에는 2023년 가지급금 · 2022년 순이익이 들어갔다)', b.summary.flagged.length === 0 && tp(b.record) === tp(a.record), JSON.stringify([b.summary.flagged.map((f) => f.key), tp(b.record)]))
  const c1 = await up(base, [F25], NOW)
  const c2 = await up(c1.record, [F24], '2026-10-31T03:00:00.000Z')
  check('D-409 2025 뒤에 2024 를 올리면 묻지 않고 2년 전 순이익만 채움', c2.summary.flagged.length === 0 && pendingFacts(c2.record).length === 0 && tp(c2.record) === '30000000/800000000/180000000/120000000' && readFact(c2.record, 'revenue')?.value === '2400000000', JSON.stringify([c2.summary.flagged, tp(c2.record)]))
  const F26 = FS(2026, ['3,000,000,000', '2,400,000,000'], ['300,000,000', '220,000,000'], ['3,600,000,000', '3,200,000,000'], ['40,000,000', '30,000,000'], ['1,000,000,000', '800,000,000'])
  const d = await up(c1.record, [F26], '2026-10-31T04:00:00.000Z')
  check('D-409 다음 해(2026) 재무제표 — 전기 숫자가 지금 값과 이어지면 묻지 않고 한 해 넘김(직전 2.2억 · 2년 전 1.8억 · 가지급금 4천만 · 배당 가능 10억)', d.summary.flagged.length === 0 && tp(d.record) === '40000000/1000000000/220000000/180000000', JSON.stringify([d.summary.flagged, tp(d.record)]))
  const F26x = FS(2026, ['3,000,000,000', '2,400,000,000'], ['300,000,000', '210,000,000'], ['3,600,000,000', '3,200,000,000'], ['40,000,000', '28,000,000'], ['1,000,000,000', '790,000,000'])
  const e = await up(c1.record, [F26x], '2026-10-31T05:00:00.000Z')
  check('D-409 전기 숫자가 지금 값과 안 이어지면(수정된 재무제표 · 사람이 고친 값) 예전처럼 절세 설계에서 확인', ['taxProfile.loanBalance', 'taxProfile.retainedEarnings', 'taxProfile.vInc1'].every((k) => e.summary.flagged.some((f) => f.key === k)) && tp(e.record) === '30000000/800000000/180000000/', JSON.stringify([e.summary.flagged.map((f) => f.key), tp(e.record)]))
})()

// D-410 등기부 두 가지(현재 유효사항 + 말소사항 포함)를 같이 · 따로 올려도 처음 취임일을 다시 묻지 않음
await (async () => {
  const HEAD = ['상 호 주식회사 가나테크', '등록번호 110111-1234567', '본 점 서울 강남구 테헤란로 123', '1주의 금액 금 5,000 원', '발행주식의 총수 20,000 주', '보통주식 20,000 주 자본금의 액 금 100,000,000 원', '회사성립연월일 2020 년 03 월 02 일', '임원에 관한 사항', '대표이사 박지훈 801231-1******']
  const CUR = ['등기사항전부증명서(현재 유효사항)', ...HEAD, '2026 년 03 월 02 일 중임'].join('\n')
  const ALL = ['등기사항전부증명서(말소사항 포함)', ...HEAD, '2020 년 03 월 02 일 취임', '2023 년 03 월 02 일 중임', '2026 년 03 월 02 일 중임'].join('\n')
  const base = normalizeClientOps({ id: 'reg410', companyName: '', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const up = (rec: typeof base, texts: string[], now: string) => analyzeUploadedDocs(rec, texts.map((text, i) => ({ key: i === 0 ? 'corporateRegistry' : `customdoc_reg${i}`, fileName: `reg${i}.pdf`, text, method: 'pdf_text' as const, docSure: true })), { now, today: '2026-10-31', makeId: () => `r0${++n}` })
  const a = await up(base, [CUR, ALL], NOW)
  const b = await up(base, [ALL, CUR], NOW)
  check('D-410 두 가지를 한 번에(어느 순서든) → 취임일 2020-03-02 · 묻지 않음(예전: 현재 유효사항의 "중임 날짜만 있어요")', a.record.taxProfile?.ceoStartDate === '2020-03-02' && b.record.taxProfile?.ceoStartDate === '2020-03-02' && a.summary.flagged.length === 0 && b.summary.flagged.length === 0, JSON.stringify([a.summary.flagged, b.summary.flagged]))
  const c = await up(base, [CUR], NOW)
  check('D-410 현재 유효사항만이면 예전처럼 확인(처음 취임일을 정말 모름)', c.summary.flagged.some((f) => f.key === 'taxProfile.ceoStartDate'), JSON.stringify(c.summary.flagged))
  const d = await up(b.record, [CUR], '2026-10-31T03:00:00.000Z')
  check('D-410 취임일을 안 뒤에 현재 유효사항을 다시 올려도 묻지 않고 그대로', d.record.taxProfile?.ceoStartDate === '2020-03-02' && d.summary.flagged.length === 0, JSON.stringify(d.summary.flagged))
})()

// D-411 해마다 · 기간마다 따로 내는 서류는 여러 장이 정상 — '겹쳐 있어요 · 최신 것만 남길까요?' 는 같은 기간일 때만
await (async () => {
  const T = '2026-10-31'
  const add = (r: ClientOpsRecord, label: string, st: { fileName: string; issuedAt?: string }) => {
    let x = withCustomDocument(r, { label, validMonths: null })
    const k = x.customDocuments[x.customDocuments.length - 1].key
    x = withDocument(x, k, { received: true, fileSize: 1, storagePath: `ws/p/${st.fileName}`, ...st })
    return x
  }
  let r = normalizeClientOps({ id: 'p411', companyName: '기간상사', status: 'active' })
  r = withDocument(r, 'financialStatements', { received: true, fileName: '재무제표_2025.pdf', fileSize: 1, storagePath: 'ws/p/fs25.pdf', issuedAt: '2025-12-31' })
  r = add(r, '최근 3개년 재무제표 (2)', { fileName: '재무제표_2024.pdf', issuedAt: '2024-12-31' })
  r = add(r, '최근 3개년 재무제표 (3)', { fileName: '재무제표_2023.pdf', issuedAt: '2023-12-31' })
  r = add(r, '원천징수이행상황신고서', { fileName: '원천세_9월.pdf' })
  r = add(r, '원천징수이행상황신고서 (2)', { fileName: '원천세_10월.pdf' })
  check('D-411 재무제표 세 해 · 원천세 두 달은 겹친 서류가 아님 → 최신 것만 남길까요? 를 묻지 않음 · 안내도 "함께 둠"', docShelfSummary(r, T, new Set()).dupGroups.length === 0 && !buildDecisions(r, T, []).some((d) => d.kind === 'shelf' && d.title.includes('겹쳐')) && dupShelfBases(r).size === 0, JSON.stringify(docShelfSummary(r, T, new Set()).dupGroups))
  const same = add(add(r, '최근 3개년 재무제표 (4)', { fileName: '재무제표_2025_다시.pdf', issuedAt: '2025-12-31' }), '원천징수이행상황신고서 (3)', { fileName: '원천세_10월.pdf' })
  const g = docShelfSummary(same, T, new Set()).dupGroups
  check('D-411 같은 해 재무제표 두 장 · 같은 파일 이름 원천세 두 장은 예전처럼 겹침(2묶음)', g.length === 2 && g.every((x) => x.length === 2) && dupShelfBases(same).has(shelfBaseOf('최근 3개년 재무제표')), JSON.stringify(g))
})()

// D-412 소득금액증명을 한 해씩 따로 떼어 올려도 매출 추이
await (async () => {
  const INC25 = ['소득금액 증명', '(종합소득세 신고자용)', '성명 홍길동', '(단위 : 원)', '귀속연도 사업자등록번호 상호 소득구분 수입금액 필요경비 소득금액', '2025 214-05-01239 미래상사 사업소득 240,000,000 180,000,000 60,000,000', '2026년 10월 20일', '송파세무서장'].join('\n')
  const INC24 = INC25.replace('2025 214', '2024 214').replace('240,000,000 180,000,000 60,000,000', '200,000,000 160,000,000 40,000,000')
  const base = normalizeClientOps({ id: 'inc412', companyName: '미래상사', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const up = (rec: typeof base, texts: string[], now: string) => analyzeUploadedDocs(rec, texts.map((text, i) => ({ key: `customdoc_inc${i}`, fileName: `inc${i}.pdf`, text, method: 'pdf_text' as const, docSure: true })), { now, today: '2026-10-31', makeId: () => `i2${++n}` })
  const want = '2025년 2억 4,000만원(소득금액증명 수입금액 · 2024년보다 +20%)'
  const a = await up(base, [INC25, INC24], NOW)
  const b = await up(base, [INC24, INC25], NOW)
  check('D-412 한 해씩 두 장을 한 번에(어느 순서든) → 매출 추이 · 매출 2025년 · 묻지 않음', customFactValue(a.record, '매출 추이') === want && customFactValue(b.record, '매출 추이') === want && readFact(a.record, 'revenue')?.value === '240000000' && a.summary.flagged.length === 0 && b.summary.flagged.length === 0, JSON.stringify([customFactValue(a.record, '매출 추이'), customFactValue(b.record, '매출 추이'), a.summary.flagged, b.summary.flagged]))
  const c1 = await up(base, [INC24], NOW)
  const c2 = await up(c1.record, [INC25], '2026-10-31T03:00:00.000Z')
  check('D-412 2024 한 장만이면 추이 없음 → 다음에 2025 한 장을 올리면 이어서 추이', customFactValue(c1.record, '매출 추이') === '' && customFactValue(c2.record, '매출 추이') === want && c2.summary.flagged.length === 0, JSON.stringify([customFactValue(c1.record, '매출 추이'), customFactValue(c2.record, '매출 추이'), c2.summary.flagged]))
})()

// D-413 여러 해 재무제표를 한 PDF 로 합쳐 올려도 가장 최근 해
await (async () => {
  const FS = (y: number, rev: string, ni: string, unit = '') => ['표준재무제표증명', ...(unit ? [unit] : []), `제 ${y - 2018}(당)기 ${y}년 12월 31일 현재`, '손익계산서', `매출액 ${rev}`, `당기순이익 ${ni}`].join('\n')
  const F25 = FS(2025, '2,400,000,000 2,000,000,000', '220,000,000 180,000,000')
  const F24 = FS(2024, '2,000,000,000 1,700,000,000', '180,000,000 120,000,000')
  const F23 = FS(2023, '1,700,000,000 1,500,000,000', '120,000,000 90,000,000')
  const old1 = parseFinancialStatement([F23, F24, F25].join('\n'))
  check('D-413 옛날 해가 앞인 합친 PDF → 2025년 매출 24억 · 순이익 2.2억(예전: 2023년 17억)', old1.year === '2025' && old1.revenue === 2_400_000_000 && old1.netIncome === 220_000_000 && old1.netIncomePrev === 180_000_000, JSON.stringify(old1))
  const one = parseFinancialStatement(['재무상태표', '제 7(당)기 2025년 12월 31일 현재', '제 6(전)기 2024년 12월 31일 현재', '(단위 : 원)', '자산총계 3,200,000,000 2,900,000,000', '손익계산서', '제 7(당)기 2025년 1월 1일부터 2025년 12월 31일까지', '매출액 2,400,000,000 2,000,000,000'].join('\n'))
  const nonCal = parseFinancialStatement(['재무상태표', '제 7(당)기 2025년 3월 31일 현재', '(단위 : 천원)', '자산총계 3,200,000 2,900,000', '손익계산서', '제 7(당)기 2024년 4월 1일부터 2025년 3월 31일까지', '매출액 2,400,000 2,000,000'].join('\n'))
  check('D-413 한 해 재무제표(전기 머리줄 · 3월 결산 손익계산서 기간)는 예전과 같이 전부 읽음', one.totalAssets === 3_200_000_000 && one.revenue === 2_400_000_000 && nonCal.totalAssets === 3_200_000_000 && nonCal.revenue === 2_400_000_000 && nonCal.year === '2025', JSON.stringify([one, nonCal]))
  const unitCarry = parseFinancialStatement([FS(2023, '1,700,000 1,500,000', '120,000 90,000', '(단위 : 천원)'), FS(2025, '2,400,000 2,000,000', '220,000 180,000')].join('\n'))
  check('D-413 최근 해 부분에 단위 줄이 없으면 파일의 단위(천원)로', unitCarry.revenue === 2_400_000_000, JSON.stringify(unitCarry))
  const base = normalizeClientOps({ id: 'fs413', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'fs_all.pdf', text: [F23, F24, F25].join('\n'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `f3${++n}` })
  check('D-413 합친 PDF 올리기 → 회사 정보 매출 2025년 24억 · 매출 추이 2025년 줄 · 직전 연도 순이익 1.8억', readFact(a.record, 'revenue')?.value === '2400000000' && readFact(a.record, 'revenue')?.asOf === '2025' && customFactValue(a.record, '매출 추이').startsWith('2025년') && a.record.taxProfile?.vInc1 === '180000000', JSON.stringify([readFact(a.record, 'revenue'), customFactValue(a.record, '매출 추이'), a.record.taxProfile]))
})()

// D-414 스캔본(OCR) 금액 잡음 — 쉼표가 마침표로 · 쉼표 뒤 빈칸 · 표 칸이 줄마다
await (async () => {
  check('D-414 고치는 것: 마침표 묶음 · 섞임 · 쉼표 뒤 빈칸', fixAmountNoise('매출액 2.400.000.000 2,000.000,000') === '매출액 2,400,000,000 2,000,000,000' && fixAmountNoise('2,400, 000,000원') === '2,400,000,000원', fixAmountNoise('매출액 2.400.000.000 2,000.000,000'))
  check('D-414 그대로 두는 것: 날짜 2025.07.25 · 소수 10.5 · 한 묶음 150.000 · 띄어 쓴 두 금액', fixAmountNoise('2025.07.25 10.5% 150.000 45,000,000 1,234,560') === '2025.07.25 10.5% 150.000 45,000,000 1,234,560', fixAmountNoise('2025.07.25 10.5% 150.000 45,000,000 1,234,560'))
  const FSN = ['표준재무제표증명', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '매출액 2,400, 000,000 2,000,000,000', '당기순이익 220.000.000 180.000.000', '자산총계', '3,200,000,000', '2,900,000,000'].join('\n')
  const f = parseFinancialStatement(FSN)
  check('D-414 재무제표 잡음(빈칸 · 마침표 · 표 칸 줄마다) → 매출 24억(예전 2,400원) · 순이익 2.2억 · 자산 32억', f.revenue === 2_400_000_000 && f.netIncome === 220_000_000 && f.totalAssets === 3_200_000_000, JSON.stringify(f))
  const vc = readVatCert(['부가가치세 과세표준증명', '2025.01.01~2025.06.30 확정 2025.07.25 1.150.000.000', '2025.07.01~2025.12.31 확정 2026.01.25 1.200.000.000'].join('\n'))
  const inc = readIncomeCert(['소득금액 증명', '(단위 : 원)', '귀속연도 사업자등록번호 상호 소득구분 수입금액 필요경비 소득금액', '2025 214-05-01239 미래상사 사업소득 240.000.000 180.000.000 60.000.000'].join('\n'))
  const wh = readWithholdingReport(['원천징수이행상황신고서', '귀속연월 202609 지급연월 202609', '간이세액 A01 12 45.000.000 1.234.560'].join('\n'))
  check('D-414 과세표준증명 · 소득금액증명 · 원천세 신고서(귀속연월 202609)도 같은 잡음을 고쳐 읽음', vc?.years[0]?.total === 2_350_000_000 && inc?.years[0]?.revenue === 240_000_000 && wh?.yearMonth === '2026-09' && wh?.pay === 45_000_000, JSON.stringify([vc?.years, inc?.years, wh]))
  const base = normalizeClientOps({ id: 'ocr414', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  const a = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'scan.jpg', text: FSN, method: 'ocr' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => 'o4' })
  const pr = pendingFacts(a.record).find((p) => p.key === 'revenue')
  check('D-414 스캔 재무제표 올리기 → 확인 후보 매출 24억(예전 2,400원) · 사진 글자라 한 번 확인(바로 넣지 않는 규칙 그대로)', pr?.value === '2400000000' && !!pr?.note, JSON.stringify(pr))
})()

// D-416 스캔 글자 — 등기부 · 주주명부의 한 글자씩 띄운 말 · '5.000 원' · 머리줄만 표인 주주명부
await (async () => {
  check('D-416 한 글자씩 띄운 말만 붙임(탭 칸 · 낱말 띄어쓰기는 그대로)', joinSpacedHangul('발 행 주 식 의 총 수 20,000 주\n박 지 훈\t15,000\n주식회사 미래테크') === '발행주식의총수 20,000 주\n박지훈\t15,000\n주식회사 미래테크', joinSpacedHangul('발 행 주 식 의 총 수 20,000 주\n박 지 훈\t15,000\n주식회사 미래테크'))
  check('D-416 한 묶음 + 원 · 주 → 쉼표("5.000 원" · "15.000주") · 소수 "10.5%" 그대로', fixAmountNoise('금 5.000 원 15.000주 10.5% 2025.07.25') === '금 5,000 원 15,000주 10.5% 2025.07.25', fixAmountNoise('금 5.000 원 15.000주 10.5% 2025.07.25'))
  const REG = ['등기사항전부증명서(말소사항 포함)', '상 호 주식회사 가나테크', '1 주 의 금 액 금 5.000 원', '발 행 주 식 의 총 수 20.000 주', '보통주식 20,000 주 자본금의 액 금 100.000.000 원', '임원에 관한 사항', '대표이사 박 지 훈 801231-1******', '2020 년 03 월 02 일 취 임'].join('\n')
  const rg = readRegistryTax(REG, '박지훈')
  check('D-416 스캔 등기부(띄운 말 · 마침표 금액) → 액면 5,000 · 총수 20,000 · 자본금 검산 · 취임일 2020-03-02(예전: 총수 · 취임일 못 읽음)', !!rg && rg.par === 5000 && rg.totalShares === 20000 && rg.sharesSure && rg.ceoStart === '2020-03-02' && rg.ceoStartSure, JSON.stringify(rg))
  const SH = ['주주명부', '발행주식의 총수: 20,000주 / 1주의 금액: 5,000원', ['주주명', '주식수', '비고'].join('\t'), '박 지 훈 15.000주 대표이사', '박 배 우 5.000주 배우자', '합계 20.000주'].join('\n')
  const sh = readShareholderDoc(SH, '박지훈')
  check('D-416 주주명부(머리줄만 표 · 띄운 이름 · "15.000주") → 박지훈 15,000 · 박배우 5,000 · 검산 맞음(예전: 주주 0명, 마침표면 15주로 잘못 읽고도 검산이 맞아 바로 넣을 뻔)', sh.sure && sh.holders.map((h) => `${h.name}:${h.shares}`).join() === '박지훈:15000,박배우:5000', JSON.stringify(sh))
})()

// D-417 스캔 세무조정계산서 — 띄운 공제 이름 · 마침표 금액
await (async () => {
  const TR = ['세무조정계산서', '사업연도 2025년 1월 1일 ~ 2025년 12월 31일', '세액공제조정명세서(3)', '통 합 고 용 세 액 공 제 29조의8 15.400.000', '연구·인력개발비에 대한', '세액공제 10조 12.000.000 12.000.000'].join('\n')
  const r = readTaxReturn(TR)
  const amt = (n: string) => r?.items.find((x) => x.name.includes(n))?.amount
  check('D-417 스캔 세무조정계산서 → 통합고용 1,540만 · 연구 · 인력개발비 1,200만(띄운 이름 · 마침표 금액)', amt('통합고용') === 15_400_000 && amt('연구') === 12_000_000, JSON.stringify(r?.items))
})()

// D-418 스캔 재무제표 · 소득금액증명 — 서류 안의 셈이 맞으면 '사진 글자라 확인' 없이 바로
await (async () => {
  const FS = (rev: string) => ['표준재무제표증명', '재무상태표', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '자산총계 3,200,000,000 2,900,000,000', '부채총계 1,400,000,000 1,300,000,000', '자본총계 1,800,000,000 1,600,000,000',
    '손익계산서', `매출액 ${rev} 2,000,000,000`, '매출원가 1,600,000,000 1,350,000,000', '매출총이익 800,000,000 650,000,000', '판매비와관리비 500,000,000 400,000,000', '영업이익 300,000,000 250,000,000',
    '법인세비용차감전순이익 280,000,000 230,000,000', '법인세비용 60,000,000 50,000,000', '당기순이익 220,000,000 180,000,000'].join('\n')
  const v = parseFinancialStatement(FS('2,400,000,000')).verified ?? []
  check('D-418 셈 확인: 매출 · 영업이익 · 순이익 · 자산 · 부채(당기 · 전기)', ['revenue', 'operatingProfit', 'netIncome', 'totalAssets', 'totalLiabilities', 'revenuePrev', 'netIncomePrev'].every((k) => v.includes(k)), JSON.stringify(v))
  const base = normalizeClientOps({ id: 'ocr418', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n = 0
  const up = (text: string, key = 'financialStatements') => analyzeUploadedDocs(base, [{ key, fileName: 'scan.jpg', text, method: 'ocr' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `o8${++n}` })
  const a = await up(FS('2,400,000,000'))
  check('D-418 셈이 맞는 스캔 재무제표 → 매출 · 영업이익 · 순이익 · 자산 · 부채 · 매출 추이 바로(묻는 것 0 — 예전 6개)', readFact(a.record, 'revenue')?.value === '2400000000' && readFact(a.record, 'totalLiabilities')?.value === '1400000000' && customFactValue(a.record, '매출 추이') !== '' && a.summary.flagged.length === 0, JSON.stringify(a.summary.flagged.map((f) => f.key)))
  const b = await up(FS('2,480,000,000'))
  check('D-418 매출을 한 글자 잘못 읽어 셈이 안 맞으면 매출 · 매출 추이는 예전처럼 "한 번 확인"(자산 · 순이익은 바로)', b.summary.flagged.some((f) => f.key === 'revenue') && readFact(b.record, 'revenue')?.value === '' && readFact(b.record, 'netIncome')?.value === '220000000', JSON.stringify([b.summary.flagged.map((f) => f.key), readFact(b.record, 'netIncome')?.value]))
  const INC = ['소득금액 증명', '(단위 : 원)', '귀속연도 사업자등록번호 상호 소득구분 수입금액 필요경비 소득금액', '2025 214-05-01239 미래상사 사업소득 240,000,000 180,000,000 60,000,000', '2024 214-05-01239 미래상사 사업소득 200,000,000 160,000,000 40,000,000'].join('\n')
  const c = await up(INC, 'customdoc_inc')
  check('D-418 검산이 맞는 스캔 소득금액증명 → 매출 · 순이익 · 매출 추이 바로', readFact(c.record, 'revenue')?.value === '240000000' && customFactValue(c.record, '매출 추이') !== '' && c.summary.flagged.length === 0, JSON.stringify(c.summary.flagged.map((f) => f.key)))
})()

// D-419 재무제표 연구개발비 → '연구개발비' 칸 · 정책자금 가점(5% 이상) · 연구소 카드(연구소가 없을 때)
await (async () => {
  const FS = ['표준재무제표증명', '손익계산서', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '매출액 2,400,000,000 2,000,000,000', '판매비와관리비 500,000,000 400,000,000', '경상연구개발비 132,000,000 90,000,000', '영업이익 300,000,000 250,000,000', '당기순이익 220,000,000 180,000,000', '재무상태표', '개발비 50,000,000 40,000,000'].join('\n')
  const f = parseFinancialStatement(FS)
  check('D-419 경상연구개발비 1.32억 읽음(무형자산 "개발비" 5천만은 아님)', f.rnd === 132_000_000, JSON.stringify(f))
  check('D-419 세액공제 줄("연구개발비에 대한 세액공제")은 연구개발비로 읽지 않음', parseFinancialStatement(['손익계산서', '(단위 : 원)', '연구개발비 세액공제 12,000,000'].join('\n')).rnd === undefined)
  const base = normalizeClientOps({ id: 'rnd419', companyName: '미래테크', createdAt: NOW, updatedAt: NOW })
  let n9 = 0
  const a = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS, method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `r9${++n9}` })
  const line = customFactValue(a.record, '연구개발비')
  check('D-419 올리기 → "연구개발비" 칸 "2025년 1억 3,200만원(재무제표 · 매출의 5.5%)"', line === '2025년 1억 3,200만원(재무제표 · 매출의 5.5%)', line)
  const bonus = policyRecordBonus(a.record, {})
  check('D-419 정책자금 가점 "연구개발비 비중 5% 이상"', bonus.includes('연구개발비 비중 5% 이상'), JSON.stringify(bonus))
  const lab = buildInsights(a.record, '2026-10-31', [], () => true).find((x) => x.key === 'labcare')
  check('D-419 연구소가 없으면 연구소 카드 "연구개발비를 쓰는데 … 연구소가 없어요 — 세액공제 대상"(검토해 볼 만함)', !!lab && lab.tone === 'maybe' && lab.headline.includes('연구개발비를 쓰는데') && lab.headline.includes('매출의 5.5%'), JSON.stringify(lab))
  const low = await analyzeUploadedDocs(base, [{ key: 'financialStatements', fileName: 'fs.pdf', text: FS.replace('경상연구개발비 132,000,000', '경상연구개발비 60,000,000'), method: 'pdf_text' as const, docSure: true }], { now: NOW, today: '2026-10-31', makeId: () => `r9${++n9}` })
  check('D-419 매출의 2.5%면 가점은 아님(연구소 카드는 그대로)', !policyRecordBonus(low.record, {}).includes('연구개발비 비중 5% 이상') && customFactValue(low.record, '연구개발비').includes('매출의 2.5%'), customFactValue(low.record, '연구개발비'))
})()

console.log(`\ncustomer-facts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
