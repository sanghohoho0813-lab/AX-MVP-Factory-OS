/** 자금 연계 규칙 버전 — 같은 출처·같은 입력이면 같은 초안이 생성된다. */
export const FUNDING_RULE_VERSION = '1.0.0'

/** 콘텐츠 생성에 쓰는 고정 ISO (실제 시간은 저장 메타데이터에만 사용) */
export const FUNDING_ISO = '1970-01-01T00:00:00.000Z'

/** 근거 없는 값 대신 쓰는 표준 표기 */
export const FUNDING_NEEDS = {
  officialConfirm: '공식 공고 확인 필요',
  insufficient: '현재 정보로 판단 부족',
  measure: '실제 측정 필요',
  unknown: '확인 필요',
} as const
