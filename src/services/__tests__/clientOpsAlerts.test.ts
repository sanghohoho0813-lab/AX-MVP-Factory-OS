/**
 * 마감·누락 경고 엔진 단위 테스트.
 * 순수 함수와 저장 정규화만 검증하므로 node에서 실행된다.
 * 실행: npm run test:client-ops-alerts
 */

import {
  buildAllAlerts,
  buildClientAlerts,
  clientOpsProgress,
  daysBetween,
  documentStatus,
  dueText,
  expiryDate,
  missingDocumentsFor,
  summarizeAlerts,
} from '../clientOpsAlerts'
import { normalizeClientOps, withService } from '../clientOpsService'
import { DOCUMENTS, SERVICES } from '../../content/clientOpsCatalog'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const TODAY = '2026-08-27'

function client(over: Partial<ClientOpsRecord> = {}): ClientOpsRecord {
  return normalizeClientOps({ id: 'c1', companyName: '가나테크', ...over })
}

/** 서류를 "받았고 유효함" 상태로 만든다 */
function withDocs(record: ClientOpsRecord, keys: DocumentKey[], issuedAt = TODAY): ClientOpsRecord {
  const documents = { ...record.documents }
  for (const k of keys) {
    documents[k] = { ...documents[k], received: true, issuedAt, updatedAt: null }
  }
  return { ...record, documents }
}

/* ---------------- 날짜 유틸 ---------------- */
check('날짜: 같은 날 0일', daysBetween(TODAY, TODAY) === 0)
check('날짜: 미래 +5', daysBetween(TODAY, '2026-09-01') === 5, String(daysBetween(TODAY, '2026-09-01')))
check('날짜: 과거 -3', daysBetween(TODAY, '2026-08-24') === -3)
check('날짜: 월 경계', daysBetween('2026-08-31', '2026-09-01') === 1)
check('날짜: 잘못된 형식 null', daysBetween(TODAY, '') === null)

check('만료: 3개월 후', expiryDate('2026-08-27', 3) === '2026-11-27', String(expiryDate('2026-08-27', 3)))
check('만료: 말일 보정(1/31+1개월)', expiryDate('2026-01-31', 1) === '2026-02-28', String(expiryDate('2026-01-31', 1)))
check('만료: 유효기간 없음 null', expiryDate('2026-08-27', null) === null)
check('만료: 발급일 없음 null', expiryDate('', 3) === null)

check('문구: 지남', dueText(-3) === '3일 지남')
check('문구: 오늘', dueText(0) === '오늘까지')
check('문구: 내일', dueText(1) === '내일까지')
check('문구: 미정', dueText(null) === '기한 미정')

/* ---------------- 예전 형식 자동 승격 ---------------- */
{
  const legacy = normalizeClientOps({
    id: 'old',
    companyName: '옛날데이터',
    tasks: {
      patent: { completed: true, dueDate: '2026-09-01', note: '출원 완료' },
      venture: { completed: false, dueDate: '', note: '' },
    },
    contractDepositAmount: 3_000_000,
    contractDepositReceived: true,
    successFeeAmount: 5_000_000,
    successFeeReceived: false,
    fundingStatus: '중진공 검토 중',
  } as Partial<ClientOpsRecord>)
  check('승격: 완료된 예전 업무 → done', legacy.services.patent.status === 'done')
  check('승격: 마감일 보존', legacy.services.patent.dueDate === '2026-09-01')
  check('승격: 메모 보존', legacy.services.patent.note === '출원 완료')
  check('승격: 미완료 → not_started', legacy.services.venture.status === 'not_started')
  check('승격: 신규 업무(정책자금) 자동 추가', legacy.services.policyFund !== undefined)
  check('승격: 정책자금 메모 이관', legacy.services.policyFund.note.includes('중진공'))
  check('승격: 계약금 → 수금 항목', legacy.fees.some((f) => f.kind === 'deposit' && f.amount === 3_000_000))
  check('승격: 계약금 입금 처리됨', legacy.fees.find((f) => f.kind === 'deposit')?.receivedAt !== null)
  check('승격: 성공보수 미수금', legacy.fees.find((f) => f.kind === 'success')?.receivedAt === null)
  check('승격: 서류 신규 필드 기본값', legacy.documents.corporateRegistry.issuedAt === '')
}

/* ---------------- 마감 경고 ---------------- */
{
  let r = client()
  r = withService(r, 'patent', { status: 'in_progress', dueDate: '2026-08-20', nextStep: '명세서 검토' })
  r = withDocs(r, ['businessRegistration', 'representativeId'])
  const alerts = buildClientAlerts(r, TODAY)
  const overdue = alerts.find((a) => a.kind === 'task_overdue')
  check('마감: 지난 업무 경고 발생', overdue !== undefined)
  check('마감: 심각도 critical', overdue?.severity === 'critical')
  check('마감: 며칠 지났는지 표시', overdue?.title.includes('7일') === true, overdue?.title)
  check('마감: 다음 할 일이 상세에 들어감', overdue?.detail === '명세서 검토')
}
{
  let r = client()
  r = withService(r, 'venture', { status: 'in_progress', dueDate: '2026-08-30' })
  r = withDocs(r, ['businessRegistration', 'corporateRegistry', 'smeCertificate', 'representativeId'])
  const alerts = buildClientAlerts(r, TODAY)
  check('마감: 임박(3일) 경고', alerts.some((a) => a.kind === 'task_due_soon'))
  check('마감: 임박은 warning', alerts.find((a) => a.kind === 'task_due_soon')?.severity === 'warning')
}
{
  let r = client()
  r = withService(r, 'patent', { status: 'in_progress', dueDate: '2026-10-30' })
  r = withDocs(r, ['businessRegistration', 'representativeId'])
  check('마감: 먼 미래는 경고 없음', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'task_due_soon'))
}
{
  let r = client()
  r = withService(r, 'patent', { status: 'done', dueDate: '2026-08-01' })
  check('마감: 완료된 업무는 경고 안 함', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'task_overdue'))
}
{
  let r = client()
  r = withService(r, 'incorporation', { status: 'not_applicable', dueDate: '2026-08-01' })
  check('마감: 해당 없음은 경고 안 함', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'task_overdue'))
}

/* ---------------- 서류 누락으로 막힌 업무 ---------------- */
{
  let r = client()
  r = withService(r, 'venture', { status: 'in_progress' })
  const missing = missingDocumentsFor(r, 'venture', TODAY)
  check('누락: 벤처인증 필요서류 4건 전부 없음', missing.length === 4, String(missing.length))
  const alerts = buildClientAlerts(r, TODAY)
  const blocked = alerts.find((a) => a.kind === 'blocked_missing_doc')
  check('누락: 막힘 경고 발생', blocked !== undefined)
  check('누락: critical', blocked?.severity === 'critical')
  check('누락: 어떤 서류인지 나열', blocked?.detail.includes('중소기업 확인서') === true, blocked?.detail)
}
{
  let r = client()
  r = withService(r, 'venture', { status: 'in_progress' })
  r = withDocs(r, ['businessRegistration', 'corporateRegistry', 'smeCertificate', 'representativeId'])
  check('누락: 서류 다 갖추면 막힘 경고 사라짐', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'blocked_missing_doc'))
}
{
  let r = client()
  r = withService(r, 'venture', { status: 'not_started' })
  check('누락: 아직 시작 전이면 막힘 경고 안 함', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'blocked_missing_doc'))
}

/* ---------------- 서류 유효기간 ---------------- */
{
  // 등기부등본 유효 3개월 → 4개월 전 발급이면 만료
  let r = client()
  r = withDocs(r, ['corporateRegistry'], '2026-04-27')
  const view = documentStatus('corporateRegistry', r.documents.corporateRegistry, TODAY)
  check('만료: 4개월 전 등기부 → 만료', view.expired === true)
  check('만료: 사용 불가로 판정', view.usable === false)
  const alerts = buildClientAlerts(r, TODAY)
  check('만료: 만료 경고 발생', alerts.some((a) => a.kind === 'doc_expired'))
}
{
  // 2개월 15일 전 발급 → 만료 임박(30일 이내)
  let r = client()
  r = withDocs(r, ['corporateRegistry'], '2026-06-10')
  const view = documentStatus('corporateRegistry', r.documents.corporateRegistry, TODAY)
  check('만료: 임박 판정', view.expiringSoon === true, `daysLeft=${view.daysLeft}`)
  check('만료: 아직 사용 가능', view.usable === true)
  check('만료: 임박 경고 발생', buildClientAlerts(r, TODAY).some((a) => a.kind === 'doc_expiring'))
}
{
  let r = client()
  r = withDocs(r, ['businessRegistration'], '2020-01-01')
  const view = documentStatus('businessRegistration', r.documents.businessRegistration, TODAY)
  check('만료: 유효기간 없는 서류는 만료 안 함', view.expired === false && view.usable === true)
}
{
  // 진행 중 업무가 필요로 하는 서류가 만료 → critical
  let r = client()
  r = withService(r, 'venture', { status: 'in_progress' })
  r = withDocs(r, ['businessRegistration', 'smeCertificate', 'representativeId'])
  r = withDocs(r, ['corporateRegistry'], '2026-01-01')
  const expired = buildClientAlerts(r, TODAY).find((a) => a.kind === 'doc_expired')
  check('만료: 진행 중 업무에 필요하면 critical', expired?.severity === 'critical')
  check('만료: 어느 업무에 필요한지 안내', expired?.detail.includes('벤처인증') === true, expired?.detail)
}

/* ---------------- 고객 회신 장기 대기 ---------------- */
{
  let r = client()
  r = withService(r, 'ax', { status: 'waiting_client' })
  r = withDocs(r, ['businessRegistration'])
  // waitingSince 를 10일 전으로 조정
  r = {
    ...r,
    services: { ...r.services, ax: { ...r.services.ax, waitingSince: '2026-08-17T09:00:00.000Z' } },
  }
  const alert = buildClientAlerts(r, TODAY).find((a) => a.kind === 'waiting_too_long')
  check('대기: 10일 대기 경고 발생', alert !== undefined)
  check('대기: 며칠째인지 표시', alert?.title.includes('10일') === true, alert?.title)
}
{
  let r = client()
  r = withService(r, 'ax', { status: 'waiting_client' })
  r = withDocs(r, ['businessRegistration'])
  r = {
    ...r,
    services: { ...r.services, ax: { ...r.services.ax, waitingSince: '2026-08-25T09:00:00.000Z' } },
  }
  check('대기: 2일은 경고 안 함', !buildClientAlerts(r, TODAY).some((a) => a.kind === 'waiting_too_long'))
}

/* ---------------- 수금 ---------------- */
{
  const r = client({
    fees: [
      { id: 'f1', serviceKey: 'venture', kind: 'success', label: '벤처인증 성공보수', amount: 5_000_000, dueDate: '2026-08-10', receivedAt: null, note: '' },
      { id: 'f2', serviceKey: null, kind: 'deposit', label: '계약금', amount: 3_000_000, dueDate: '2026-08-30', receivedAt: null, note: '' },
      { id: 'f3', serviceKey: null, kind: 'interim', label: '중도금', amount: 2_000_000, dueDate: '2026-08-01', receivedAt: '2026-08-01', note: '' },
    ],
  })
  const alerts = buildClientAlerts(r, TODAY)
  const overdue = alerts.find((a) => a.kind === 'payment_overdue')
  check('수금: 연체 경고 발생', overdue !== undefined)
  check('수금: 연체는 critical', overdue?.severity === 'critical')
  check('수금: 금액 표시', overdue?.detail.includes('5,000,000') === true, overdue?.detail)
  check('수금: 예정 임박 경고', alerts.some((a) => a.kind === 'payment_due_soon'))
  check('수금: 입금된 건은 경고 없음', !alerts.some((a) => a.id.includes('f3')))

  const p = clientOpsProgress(r, TODAY)
  check('수금: 미수금 합계', p.unpaidAmount === 8_000_000, String(p.unpaidAmount))
  check('수금: 연체 건수', p.overduePayments === 1, String(p.overduePayments))
}

/* ---------------- 진행률 ---------------- */
{
  let r = client()
  r = withService(r, 'incorporation', { status: 'not_applicable' })
  r = withService(r, 'patent', { status: 'done' })
  const p = clientOpsProgress(r, TODAY)
  check('진행률: 해당 없음은 분모에서 제외', p.servicesTotal === SERVICES.length - 1, String(p.servicesTotal))
  check('진행률: 완료 1건', p.servicesDone === 1)
  check('진행률: 서류 총 개수', p.documentsTotal === DOCUMENTS.length)
  check('진행률: 서류 0건', p.documentsUsable === 0)
}
{
  let r = client()
  r = withDocs(r, ['corporateRegistry'], '2026-01-01') // 만료
  const p = clientOpsProgress(r, TODAY)
  check('진행률: 만료 서류는 보유로 안 셈', p.documentsUsable === 0, String(p.documentsUsable))
}

/* ---------------- 정렬·집계 ---------------- */
{
  let a = client({ id: 'a', companyName: 'A사' })
  a = withService(a, 'patent', { status: 'in_progress', dueDate: '2026-09-02', nextStep: 'x' })
  a = withDocs(a, ['businessRegistration', 'representativeId'])

  let b = client({ id: 'b', companyName: 'B사' })
  b = withService(b, 'patent', { status: 'in_progress', dueDate: '2026-08-01', nextStep: 'y' })
  b = withDocs(b, ['businessRegistration', 'representativeId'])

  const alerts = buildAllAlerts([a, b], TODAY)
  check('정렬: 급한(연체) 것이 맨 위', alerts[0].clientId === 'b', alerts[0]?.title)
  check('정렬: critical 이 warning 보다 앞', alerts[0].severity === 'critical')

  const s = summarizeAlerts(alerts)
  check('집계: 총 건수 일치', s.total === alerts.length)
  check('집계: 업체별 심각 건수', s.criticalByClient['b'] >= 1)
}
{
  const done = client({ id: 'z', companyName: '종료업체', status: 'completed' })
  const withOverdue = withService(done, 'patent', { status: 'in_progress', dueDate: '2026-01-01' })
  check('집계: 종료된 업체는 제외', buildAllAlerts([withOverdue], TODAY).length === 0)
}

/* ---------------- 카탈로그 일관성 ---------------- */
{
  check('카탈로그: 업무 6종', SERVICES.length === 6, String(SERVICES.length))
  check('카탈로그: 서류 10종', DOCUMENTS.length === 10, String(DOCUMENTS.length))
  const docKeys = new Set(DOCUMENTS.map((d) => d.key))
  const badRefs = SERVICES.flatMap((s) => s.requiredDocuments.filter((d) => !docKeys.has(d)))
  check('카탈로그: 필요서류가 모두 실제 서류를 가리킴', badRefs.length === 0, badRefs.join(','))
  check('카탈로그: 정책자금은 반복 업무', SERVICES.find((s) => s.key === 'policyFund')?.recurring === true)
  const certDoc = DOCUMENTS.find((d) => d.key === 'jointCertificate')
  check('보안: 공동인증서에 비밀번호 필드 없음', !('password' in (certDoc ?? {})))
}

console.log(`\nclient-ops-alerts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('CLIENT_OPS_ALERTS_PASS')
