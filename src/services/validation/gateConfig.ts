import type {
  GateCriterion,
  ValidationGateNumber,
  ValidationPlan,
} from '../../types/validation'

/** 검증 규칙 버전 — 결정적 산출물의 버전 표식 */
export const VALIDATION_RULE_VERSION = '1.0.0'

export function emptyPlan(): ValidationPlan {
  return {
    purpose: '',
    scope: '',
    outOfScope: '',
    environment: '로컬 테스트 모드(동일 브라우저 저장소)',
    testMethod: 'scenario_test',
    startDate: '',
    targetEndDate: '',
    ownerId: '',
    reviewerIds: [],
    participantTarget: 3,
    requiredRounds: 1,
    entryCriteria: ['확정 설계·인계 스냅샷', '테스트 버전', '필수 시나리오', '참여자'],
    exitCriteria: ['필수 시나리오 결과 기록', 'critical 이슈 처리', 'Gate 6 판정', '다음 결정'],
    privacyNotes: '',
    securityNotes: '',
    fallbackPlan: '',
    notes: '',
  }
}

let cSeq = 0
function crit(title: string, description: string, required = true): GateCriterion {
  cSeq += 1
  return {
    id: `gc-${cSeq}`,
    title,
    description,
    required,
    status: 'not_checked',
    evidenceIds: [],
    waiverReason: '',
    approvedBy: '',
    notes: '',
  }
}

/** Gate별 기본 필수 기준(규칙 기반). 자동 초안 평가와 담당자 확정에 사용한다. */
export function defaultGateCriteria(gate: ValidationGateNumber): GateCriterion[] {
  cSeq = 0
  switch (gate) {
    case 'gate_0':
      return [crit('해결할 문제 구체화', '해결할 문제가 구체적으로 정의됨'), crit('대상 사용자 확인', '테스트 대상 사용자가 확인됨'), crit('진단 근거', '진단 결과 근거가 있음')]
    case 'gate_1':
      return [crit('핵심 과제 확정', '핵심 과제가 확정됨'), crit('성공 지표', '성공 지표가 있음'), crit('제외 범위', '제외 범위가 있음')]
    case 'gate_2':
      return [crit('설계 확정', '설계가 finalized 상태'), crit('수용 기준 준비', '기능·페이지·수용 기준이 준비됨'), crit('인계 스냅샷', 'HandoffSnapshot이 있음')]
    case 'gate_3':
      return [crit('제작 담당 지정', '제작 담당자가 지정됨', false), crit('테스트 버전 등록', '테스트 버전·URL·실행 방법이 있음'), crit('테스트 데이터 준비', '테스트 데이터가 준비됨', false)]
    case 'gate_4':
      return [crit('참여자 확보', '참여자가 있음'), crit('시나리오 준비', '시나리오가 있음'), crit('필수 수용 기준 연결', '필수 수용 기준이 시나리오에 연결됨'), crit('KPI 측정 방법', 'KPI 측정 방법이 정해짐'), crit('개인정보·보안 확인', '개인정보·보안 확인이 됨', false)]
    case 'gate_5':
      return [crit('회차 실행', '테스트 회차가 실행됨'), crit('주요 결과 기록', '주요 시나리오 결과가 기록됨'), crit('피드백·증거 수집', '피드백과 증거가 수집됨'), crit('중대 장애 분류', '중대한 장애가 분류됨')]
    case 'gate_6':
      return [crit('필수 통과율 확인', '필수 기준 통과율이 확인됨'), crit('KPI 측정값', 'KPI 측정값이 있음'), crit('critical 해결', 'critical blocker가 해결됨'), crit('의사결정 근거', '다음 의사결정 근거가 있음')]
    case 'gate_7':
      return [crit('다음 단계 결정', '유지·수정·확대·운영·보류·중단 중 하나 확정')]
    default:
      return []
  }
}
