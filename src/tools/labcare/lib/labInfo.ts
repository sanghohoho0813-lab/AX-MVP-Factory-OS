/**
 * 업체의 '연구소 쪽 정보' (D-91).
 *
 * 업체 자체는 고객 운영에 있다. 연구소 모듈이 더 아는 것만 여기 둔다 —
 * 연구소 이름·유형·인정(신고)일·인정번호·연구전담요원.
 *
 * 신고관리시스템 비밀번호 칸은 **만들지 않는다.** 원본에는 메모 칸이 있었지만,
 * 이 저장소는 비밀번호를 저장하지 않는다.
 */

export type LabType = '기업부설연구소' | '연구개발전담부서'

export interface Researcher {
  name: string
  /** 연구소장 · 전담부서장 · 연구전담요원 */
  role: string
  /** YYYY-MM-DD */
  joinDate: string
  /** 연구업무 전담인가 (겸직이면 실사에서 지적된다) */
  dedicated: boolean
}

export interface LabInfoData extends Record<string, unknown> {
  labType: LabType
  labName: string
  /** 인정(신고)일 YYYY-MM-DD */
  certifiedDate: string
  /** 인정번호 */
  registrationNumber: string
  researchers: Researcher[]
  memo: string
}

export function emptyLabInfo(): LabInfoData {
  return {
    labType: '기업부설연구소',
    labName: '',
    certifiedDate: '',
    registrationNumber: '',
    researchers: [],
    memo: '',
  }
}

/** 연구전담요원 수 (겸직 제외) */
export function dedicatedCount(info: LabInfoData): number {
  return info.researchers.filter((r) => r.dedicated).length
}

/**
 * 인정 유형별 최소 연구전담요원 수 (2026 업무편람).
 * 여기서는 가장 흔한 경우만 본다 — 정확한 판정은 '설립 가능성 체크' 화면이 한다.
 */
export function minResearchers(labType: LabType): number {
  return labType === '기업부설연구소' ? 2 : 1
}

/** 인원이 모자라면 그 말을, 아니면 빈 글자 */
export function researcherWarning(info: LabInfoData): string {
  const need = minResearchers(info.labType)
  const have = dedicatedCount(info)
  if (info.researchers.length === 0) return '연구전담요원을 아직 적지 않았습니다'
  return have < need ? `연구전담요원이 ${have}명입니다 — ${info.labType}는 보통 ${need}명 이상이 필요합니다` : ''
}
