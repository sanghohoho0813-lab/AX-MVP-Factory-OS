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

export function seedScript() {
  return `
    localStorage.setItem('axmvp.onboarding.prefs', ${JSON.stringify(JSON.stringify({ tutorialVersion: 99, autoShowEnabled: false, snoozedUntilDate: '' }))});
    localStorage.setItem('axmvp.v1.operations_clients', ${JSON.stringify(JSON.stringify(clients))});
    localStorage.setItem('axmvp.v1.ops_journal_entries', ${JSON.stringify(JSON.stringify(journal))});
  `
}

export const SEED_CLIENT_ID = 'cli_hansol'
export { clients, journal, TODAY }
