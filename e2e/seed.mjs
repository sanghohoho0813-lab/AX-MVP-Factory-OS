/**
 * 화면 감사·QA 용 시드 데이터.
 *
 * 실제 운영과 비슷한 밀도로 채운다 — 빈 화면은 UI 문제를 감춘다.
 * 브라우저 localStorage 에 그대로 넣는 모양이라 앱의 normalize 가 나머지를 채운다.
 */

const TODAY = '2026-09-04'

function d(offset) {
  const t = new Date(Date.UTC(2026, 8, 4))
  t.setUTCDate(t.getUTCDate() + offset)
  return t.toISOString().slice(0, 10)
}

const clients = [
  {
    id: 'cli_hansol',
    companyName: '한솔테크(주)',
    contactName: '김대표',
    contactPhone: '010-2345-6789',
    businessNumber: '123-45-67890',
    industry: '소프트웨어 개발',
    status: 'active',
    nextAction: '벤처인증 신청서 최종 검토 후 제출',
    nextActionDueDate: d(1),
    services: {
      incorporation: { status: 'done', completedAt: '2026-03-02T00:00:00.000Z' },
      businessScope: { status: 'done' },
      patent: { status: 'in_progress', dueDate: d(-2), note: '명세서 초안 검토 중' },
      venture: { status: 'in_progress', dueDate: d(1) },
      ax: { status: 'waiting_client', note: '현업 인터뷰 일정 회신 대기' },
      policyFund: { status: 'not_started' },
    },
    documents: {
      businessLicense: { received: true, issuedAt: d(-40), fileName: '사업자등록증.pdf' },
      representativeId: { received: true, issuedAt: d(-40) },
    },
    fees: [
      { id: 'fee1', kind: 'deposit', label: '계약금', amount: 3_000_000, dueDate: d(-12), receivedAt: d(-10) },
      { id: 'fee2', kind: 'success', label: '성공보수', amount: 5_500_000, dueDate: d(-3), receivedAt: null },
    ],
    fundingApplications: [
      { id: 'fa1', programName: '창업성장기술개발사업', status: 'preparing', applyDueDate: d(6), amount: 200_000_000 },
    ],
  },
  {
    id: 'cli_daum',
    companyName: '다움에너지',
    contactName: '박대표',
    contactPhone: '010-9876-5432',
    industry: '신재생에너지',
    status: 'active',
    nextAction: '정책자금 서류 보완',
    nextActionDueDate: d(3),
    services: {
      incorporation: { status: 'done' },
      businessScope: { status: 'waiting_client' },
      patent: { status: 'not_started' },
      venture: { status: 'on_hold' },
      ax: { status: 'not_started' },
      policyFund: { status: 'in_progress', dueDate: d(3) },
    },
    documents: { businessLicense: { received: true, issuedAt: d(-200) } },
    fees: [{ id: 'fee3', kind: 'deposit', label: '계약금', amount: 2_000_000, dueDate: d(2), receivedAt: null }],
    fundingApplications: [
      { id: 'fa2', programName: '중소기업 정책자금(운전)', status: 'submitted', applyDueDate: d(-5), amount: 300_000_000 },
      { id: 'fa3', programName: '지역혁신 바우처', status: 'watching', applyDueDate: d(11) },
    ],
  },
  {
    id: 'cli_mirae',
    companyName: '미래바이오랩',
    contactName: '이대표',
    industry: '바이오·의료',
    status: 'waiting',
    nextAction: '특허 출원 명세서 회신 대기',
    nextActionDueDate: d(8),
    services: {
      incorporation: { status: 'done' },
      businessScope: { status: 'not_started' },
      patent: { status: 'waiting_client', dueDate: d(8) },
      venture: { status: 'not_started' },
      ax: { status: 'in_progress' },
      policyFund: { status: 'not_started' },
    },
    fees: [],
  },
  {
    id: 'cli_seon',
    companyName: '선한식품',
    contactName: '최대표',
    industry: '식품 제조',
    status: 'active',
    nextAction: '업종 추가 등기 신청',
    nextActionDueDate: d(0),
    services: {
      incorporation: { status: 'done' },
      businessScope: { status: 'in_progress', dueDate: d(0) },
      patent: { status: 'on_hold' },
      venture: { status: 'not_started' },
      ax: { status: 'not_started' },
      policyFund: { status: 'waiting_client' },
    },
    fees: [{ id: 'fee4', kind: 'interim', label: '중도금', amount: 1_500_000, dueDate: d(9), receivedAt: null }],
  },
  {
    id: 'cli_wooil',
    companyName: '우일산업',
    contactName: '정대표',
    industry: '기계 부품',
    status: 'active',
    nextAction: '',
    services: {
      incorporation: { status: 'done' },
      businessScope: { status: 'done' },
      patent: { status: 'done' },
      venture: { status: 'done' },
      ax: { status: 'waiting_client' },
      policyFund: { status: 'on_hold' },
    },
    fees: [],
  },
]

const journal = [
  { id: 'j1', entryDate: TODAY, entryType: 'call', content: '한솔테크 김대표 통화 — 벤처인증 서류 내일 오전까지 회신 주기로 함.', clientId: 'cli_hansol', pinned: true },
  { id: 'j2', entryDate: TODAY, entryType: 'blocker', content: '다움에너지 정책자금 — 부채비율 기준 미달로 보완 필요. 재무제표 재작성 검토.', clientId: 'cli_daum', dueDate: d(2) },
  { id: 'j3', entryDate: d(-1), entryType: 'decision', content: '미래바이오랩 특허는 PCT 대신 국내 우선 출원으로 진행하기로 결정.', clientId: 'cli_mirae' },
  { id: 'j4', entryDate: d(-1), entryType: 'follow_up', content: '선한식품 업종추가 등기 신청서 준비 — 법무사 확인 필요', clientId: 'cli_seon', dueDate: d(1) },
  { id: 'j5', entryDate: d(-2), entryType: 'win', content: '우일산업 벤처인증 최종 승인. 성공보수 청구 준비.', clientId: 'cli_wooil' },
  { id: 'j6', entryDate: d(-3), entryType: 'idea', content: '업체별 정책자금 캘린더를 분기 단위로 미리 만들어 두면 신청 누락이 줄 것 같다.' },
]

/** 이벤트함이 비어 있으면 화면 문제를 볼 수 없어 샘플을 함께 넣는다 */
const events = [
  {
    id: 'ev1', eventType: 'customer_request_created', sourceType: 'demo_request', sourceId: 'r1',
    dedupeKey: 'demo_request:r1:customer_request_created', priority: 'high', status: 'new',
    operationsClientId: 'cli_hansol',
    payload: { company_name: '한솔테크(주)', request_type: 'status', title: '벤처인증 진행 상황이 궁금합니다' },
    occurredAt: '2026-09-04T02:10:00.000Z', receivedAt: '2026-09-04T02:10:00.000Z',
  },
  {
    id: 'ev2', eventType: 'document_uploaded', sourceType: 'demo_doc', sourceId: 'd1',
    dedupeKey: 'demo_doc:d1:document_uploaded', priority: 'medium', status: 'linked',
    operationsClientId: 'cli_hansol',
    payload: { company_name: '한솔테크(주)', title: '사업자등록증', file_name: '사업자등록증.pdf' },
    occurredAt: '2026-09-03T08:30:00.000Z', receivedAt: '2026-09-03T08:30:00.000Z',
  },
  {
    id: 'ev3', eventType: 'service_order_created', sourceType: 'demo_order', sourceId: 'o1',
    dedupeKey: 'demo_order:o1:service_order_created', priority: 'high', status: 'new',
    payload: { company_name: '새길바이오', order_number: 'SO-2026-0042', product_slug: 'venture-certification', buyer_name: '한대표', status: 'payment_confirmed' },
    occurredAt: '2026-09-02T23:05:00.000Z', receivedAt: '2026-09-02T23:05:00.000Z',
  },
]

/** 컨설팅 작업실 — 화면 검사(짜부라짐·스크린샷)용 프로젝트 하나. 특허는 출원 중, 핵심 줄기 일부 채움. */
const fact = (value, status = 'confirmed', source = '등기부등본') => ({ value, status, source, asOfDate: '2026-09-01', note: '', updatedAt: '2026-09-01T00:00:00.000Z' })
const consultingProjects = [
  {
    id: 'proj_hansol', workspaceId: null, clientId: 'cli_hansol', clientName: '한솔테크(주)', moduleKey: 'patent_venture_mvp',
    title: '작업지연 위험분석 특허 · 벤처인증', status: 'active', currentStage: 'S3',
    stages: { S0: { status: 'completed' }, S1: { status: 'completed' }, S2: { status: 'completed' }, S3: { status: 'in_progress' } },
    factsheet: {
      companyName: fact('한솔테크(주)'), representative: fact('김대표'), establishedAt: fact('2019-03-02'), headOffice: fact('경기도 남양주시 진접읍 해밀예당1로 1'),
      businessNumber: fact('123-45-67890'), industry: fact('소프트웨어 개발'), mainProducts: fact('제조 현장 작업지시·공정관리 프로그램', 'unverified', '인터뷰'),
      employees: fact('7', 'confirmed', '4대보험 명부'), revenue3y: fact('2023 8.2억 / 2024 9.1억 / 2025 10.4억', 'confirmed', '재무제표'),
      customers: fact('거래처 23곳', 'confirmed', '거래명세서'), coreProblem: fact('작업지시가 카톡·엑셀에 흩어져 납기 지연을 늦게 안다', 'confirmed', '대표자 인터뷰'),
      currentMethod: fact('공정 담당자가 매일 아침 엑셀을 열어 눈으로 확인', 'confirmed', '대표자 인터뷰'), coreTech: fact('작업지시·공정 데이터 기반 작업지연 위험분석 및 우선순위 추천', 'confirmed', '기술기획'),
      som: fact('수도권 사업체 2,800개 × 3% × 360만원 = 3.0억', 'planned', '통계청 사업체조사'),
    },
    coreThread: { fieldProblem: '납기 지연을 늦게 안다', existingMethod: '엑셀·카톡 수기 확인', coreTech: '작업지연 위험분석 및 우선순위 추천', patentPoint: '', axCore: '작업지연 위험 점수 산출(점수기반 추천)', platformSurface: '거래처 납기 조회 포털', ventureSentence: '', keyEvidence: '' },
    gate: { items: { knowsProblem: true, repeatedInefficiency: true, differentStructure: true, patentPoint: true, mvpShowable: true, realTarget: true }, decision: 'go', reason: '현장문제·거래처 명확. 시장 숫자 보강 필요', decidedAt: '2026-09-02T00:00:00.000Z' },
    freshness: [], kipo: [{ code: '0217', reason: 'AI 기반 공정 제어의 청구항 구조', pdfAttached: false }],
    patent: { problem: '납기 지연 인지 지연', existingMethod: '수기', differentStructure: '위험 산출 순서', processFlow: '입력→정규화→위험 산출→추천→Action→재반영', claimPoint: '', titleCandidates: '공정 데이터 기반 작업지연 위험 산출 및 우선순위 추천 시스템', priorArtKeywords: '', priorArtFindings: '', inventors: '', applicant: '한솔테크(주)', rightsNote: '', applicationNumber: '', filedAt: '', examRequestDue: '', filingStatus: 'none' },
    mvp: { productName: '', oneLineValue: '', targetUser: '', primaryJourney: '', axCoreFeature: '', axMode: 'scoring', platformSurface: '', live: '', demo: '', future: '', notBuilding: '', demoDataAssumption: '', mvpUrl: '', referenceStyle: '' },
    venture: { sections: {}, documents: {}, judgeScores: {}, redFlagsCleared: {}, submittedAt: '', submissionNote: '' },
    fieldReview: { reviewDate: '', script: '', demoFlow: '', qa: [], numbersToMemorize: [], evidencePackChecked: {}, mockReviewDone: false, result: '' },
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
  },
  // 막 만든 프로젝트 — 회사 기본정보가 비어 있어 S0 부터 시작한다 (서류로 채우기 시험용)
  {
    id: 'proj_new', workspaceId: null, clientId: 'cli_hansol', clientName: '한솔테크(주)', moduleKey: 'patent_venture_mvp',
    title: '신규 프로젝트', status: 'active', currentStage: 'S0',
    stages: { S0: { status: 'in_progress' } },
    factsheet: {},
    createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
  },
  {
    id: 'proj_doc', workspaceId: null, clientId: 'cli_hansol', clientName: '한솔테크(주)', moduleKey: 'patent_venture_mvp',
    title: '서류로 시작하는 프로젝트', status: 'active', currentStage: 'S0',
    stages: { S0: { status: 'in_progress' } },
    factsheet: {},
    createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
  },
]

export const SEED_PROJECT_ID = 'proj_hansol'
/** 회사 기본정보가 비어 있는 프로젝트 — S0 */
export const SEED_NEW_PROJECT_ID = 'proj_new'
/** 같은 상태의 두 번째 빈 프로젝트 — 서류 채우기 시험이 앞 시험에 영향받지 않게 */
export const SEED_DOC_PROJECT_ID = 'proj_doc'

export function seedScript() {
  return `
    localStorage.setItem('axmvp.v1.consulting_projects', ${JSON.stringify(JSON.stringify(consultingProjects))});
    localStorage.setItem('axmvp.onboarding.prefs', ${JSON.stringify(JSON.stringify({ tutorialVersion: 99, autoShowEnabled: false, snoozedUntilDate: '' }))});
    localStorage.setItem('axmvp.v1.operations_clients', ${JSON.stringify(JSON.stringify(clients))});
    localStorage.setItem('axmvp.v1.ops_journal_entries', ${JSON.stringify(JSON.stringify(journal))});
    localStorage.setItem('axmvp.v1.customer_events', ${JSON.stringify(JSON.stringify(events))});
  `
}

export const SEED_CLIENT_ID = 'cli_hansol'
export { clients, journal, TODAY }
