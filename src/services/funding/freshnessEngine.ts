import type {
  InformationFreshnessStatus,
  Institution,
  SupportProgram,
} from '../../types/funding'

/**
 * 내부 재확인 주기(일). '공식 유효기간'이 아니라 내부 재확인 기준이다.
 * 중앙에서 관리하며 컴포넌트마다 중복 정의하지 않는다.
 */
export const FRESHNESS_POLICY = {
  /** 프로그램 공고 재확인 주기 */
  programDays: 30,
  /** 기관 일반정보 재확인 주기 */
  institutionDays: 180,
  /** 내부 참고규칙 재확인 주기 */
  internalDays: 90,
} as const

interface FreshnessInput {
  lastVerifiedAt: string | null
  validUntil: string | null
}

/**
 * 정보 최신성을 결정한다. 결정적이려면 기준 시각(now)을 주입한다.
 * now 미지정 시 실행 시각을 사용(표시용).
 */
export function computeFreshness(input: FreshnessInput, reviewDays: number, now: Date): InformationFreshnessStatus {
  if (input.validUntil) {
    const until = Date.parse(input.validUntil)
    if (Number.isFinite(until) && until < now.getTime()) return 'stale'
  }
  if (!input.lastVerifiedAt) return 'unknown'
  const verified = Date.parse(input.lastVerifiedAt)
  if (!Number.isFinite(verified)) return 'unknown'
  const ageDays = (now.getTime() - verified) / (1000 * 60 * 60 * 24)
  if (ageDays > reviewDays) return 'review_due'
  return 'current'
}

function currentDate(): Date {
  // 표시용 계산에만 사용 (콘텐츠 스냅샷에는 저장하지 않음)
  return new Date()
}

export function computeProgramFreshness(program: SupportProgram, now: Date = currentDate()): InformationFreshnessStatus {
  return computeFreshness(program, FRESHNESS_POLICY.programDays, now)
}

export function computeInstitutionFreshness(institution: Institution, now: Date = currentDate()): InformationFreshnessStatus {
  return computeFreshness(institution, FRESHNESS_POLICY.institutionDays, now)
}
