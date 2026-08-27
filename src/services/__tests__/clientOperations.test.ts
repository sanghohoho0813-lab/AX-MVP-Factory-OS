import type { Organization } from '../../types/domain'
import {
  buildClientOperationsSummary,
  CLIENT_DOCUMENTS,
  CLIENT_SETUP_TASKS,
  getClientOperations,
} from '../clientOperationsService'

let passed = 0
let failed = 0

function check(name: string, condition: boolean): void {
  if (condition) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}`)
  }
}

const organization: Organization = {
  id: 'client-ops-test-org',
  name: '테스트 주식회사',
  businessRegistrationNumber: '123-45-67890',
  industry: '제조업',
  subIndustry: '정밀기기',
  businessType: 'corporation',
  foundedAt: null,
  employeeCount: null,
  annualRevenue: null,
  region: '서울',
  address: '서울시 강남구 테스트로 1',
  website: '',
  primaryContact: { name: '홍길동', position: '대표', phone: '010-1234-5678', email: '' },
  status: 'active',
  healthStatus: 'healthy',
  notes: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
}

const record = getClientOperations(organization)
check('기본 업무 5개 생성', Object.keys(record.tasks).length === CLIENT_SETUP_TASKS.length)
check('필수 서류 10개 생성', Object.keys(record.documents).length === CLIENT_DOCUMENTS.length)
check('대표자 연락처 초기값 반영', record.representativePhone === organization.primaryContact.phone)
check('사업장 주소 초기값 반영', record.businessAddress === organization.address)

record.tasks.patent.completed = true
record.documents.businessRegistration.received = true
record.documents.corporateRegistry.received = true
record.contract.depositAmount = 1_000_000
record.contract.depositReceived = false
const summary = buildClientOperationsSummary(record)
check('기본 업무 완료 집계', summary.taskCompleted === 1)
check('서류 수령 집계', summary.documentReceived === 2)
check('정책자금 공통 증빙 집계', summary.fundingDocumentReceived === 2)
check('미수 계약금 경고', summary.paymentAttentionCount === 1)
check('미수령 서류 목록 생성', summary.missingLabels.length > 0)

console.log(`ClientOperations 단위 테스트: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('CLIENT_OPERATIONS_PASS')
