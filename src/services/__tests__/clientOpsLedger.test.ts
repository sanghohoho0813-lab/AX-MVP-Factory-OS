/**
 * 고객 운영 레저 단위 테스트.
 * 프로젝트 필드 기반으로 병목·정책자금·사업계획서·마감 필터가
 * 일관되게 계산되는지 검증한다.
 * 실행: npm run test:client-ops
 */

import type { Organization, Project } from '../../types/domain'
import { buildClientOpsLedger } from '../clientOpsLedgerService'
import type { ClientOpsCheckMap } from '../clientOpsChecklistService'

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function org(id: string, name: string): Organization {
  return {
    id,
    name,
    businessRegistrationNumber: '000-00-00000',
    industry: '제조업',
    subIndustry: '정밀가공',
    businessType: 'corporation',
    foundedAt: null,
    employeeCount: null,
    annualRevenue: null,
    region: '서울',
    address: '',
    website: '',
    primaryContact: { name: `${name} 담당자`, position: '대표', phone: '', email: '' },
    status: 'active',
    healthStatus: 'healthy',
    notes: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
  }
}

function project(over: Partial<Project> & { id: string; organizationId: string; name: string }): Project {
  return {
    id: over.id,
    projectCode: `AX-2026-${over.id}`,
    organizationId: over.organizationId,
    name: over.name,
    projectType: 'ax',
    objective: 'AX 도입 컨설팅',
    currentStage: 'diagnosis',
    currentMvpLevel: 0,
    targetMvpLevel: 3,
    status: 'active',
    healthStatus: 'healthy',
    progress: 20,
    ownerId: 'owner-1',
    fundingRequired: false,
    targetInstitutions: [],
    targetFundingAmount: null,
    startDate: '2026-08-01',
    dueDate: null,
    nextAction: '진단 설문 회수',
    nextActionDueDate: null,
    riskSummary: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null,
    ...over,
  }
}

const organizations = [
  org('org-a', '대한정밀'),
  org('org-b', '한빛푸드'),
  org('org-c', '그린물류'),
]

const projects = [
  project({
    id: 'p-a',
    organizationId: 'org-a',
    name: '대한정밀 AX',
    status: 'waiting_client',
    nextActionDueDate: '2026-01-01',
    nextAction: '현장 담당자 답변 회수',
  }),
  project({
    id: 'p-b',
    organizationId: 'org-b',
    name: '한빛푸드 정책자금',
    currentStage: 'mvp_design',
    fundingRequired: true,
    targetInstitutions: ['기술보증기금'],
    targetFundingAmount: 100_000_000,
    nextAction: '정책자금 증빙 정리',
  }),
  project({
    id: 'p-c',
    organizationId: 'org-c',
    name: '그린물류 결과자료',
    currentStage: 'deliverables',
    nextAction: '고객용 제안서 확정',
  }),
]

{
  const ledger = buildClientOpsLedger(organizations, projects)
  check('전체: 고객 3곳', ledger.summary.clientCount === 3, String(ledger.summary.clientCount))
  check('전체: 행 3개', ledger.rows.length === 3, String(ledger.rows.length))
  check('전체: 브리핑 생성', ledger.briefingScript.includes('[고객 운영 브리핑]'))
  check('정렬: 고객 회신 대기가 먼저', ledger.rows[0].clientName === '대한정밀', ledger.rows[0]?.clientName)
}

{
  const ledger = buildClientOpsLedger(organizations, projects, '', 'funding')
  check('정책자금 필터: 1건', ledger.rows.length === 1, String(ledger.rows.length))
  check('정책자금 필터: 한빛푸드', ledger.rows[0]?.clientName === '한빛푸드', ledger.rows[0]?.clientName)
}

{
  const ledger = buildClientOpsLedger(organizations, projects, '', 'plan')
  check('사업계획서 필터: 미완 항목 존재', ledger.rows.length >= 1, String(ledger.rows.length))
  check('사업계획서 필터: 정책자금 고객 포함', ledger.rows.some((row) => row.clientName === '한빛푸드'))
}

{
  const ledger = buildClientOpsLedger(organizations, projects, '증빙')
  check('검색: 다음 행동 검색', ledger.rows.length === 1, String(ledger.rows.length))
  check('검색: 한빛푸드 반환', ledger.rows[0]?.clientName === '한빛푸드', ledger.rows[0]?.clientName)
}

{
  const checks: ClientOpsCheckMap = {
    'p-b': {
      projectId: 'p-b',
      checks: {
        clientReplySent: false,
        fundingContacted: true,
        businessPlanDrafted: true,
        midCheckDone: true,
      },
      updatedAt: '2026-08-02T00:00:00.000Z',
    },
  }
  const ledger = buildClientOpsLedger(organizations, projects, '', 'funding', checks)
  const row = ledger.rows[0]
  check('수동 체크: 정책자금 컨택 반영', row.tracks.find((track) => track.key === 'funding')?.detail === '기관 컨택')
  check('수동 체크: 사업계획서 70% 이상', (row.tracks.find((track) => track.key === 'business_plan')?.value ?? 0) >= 70)
  check('수동 체크: 중간점검 80% 이상', (row.tracks.find((track) => track.key === 'mid_check')?.value ?? 0) >= 80)
}

console.log(`ClientOpsLedger 단위 테스트: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('CLIENT_OPS_FAIL')
  process.exit(1)
}
console.log('CLIENT_OPS_PASS')
