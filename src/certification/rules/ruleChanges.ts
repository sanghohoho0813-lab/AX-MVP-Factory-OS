/**
 * 공식 기준 변경 기록 (P2) — 이 OS 의 기준 자료(officialRules)를 언제 무엇으로 고쳤나.
 * 공식 출처 · 시행일 · 버전은 officialRules 의 sources(OfficialSource) 에 그대로 두고, 여기는 '바뀐 것' 만 적는다.
 * 새 고시 · 개정판을 반영하면 맨 위에 한 줄 더한다(지우지 않는다).
 */
import type { CertificationKey } from '../core/types'

export interface RuleChange {
  cert: CertificationKey
  /** 어느 기준(고시 · 법령 · 표준 이름) */
  rule: string
  /** 'YYYY-MM-DD' — 원문을 확인한 날 */
  checkedAt: string
  change: string
}

export const RULE_CHANGES: readonly RuleChange[] = [
  { cert: 'innobiz', rule: '이노비즈넷 신규신청 · 현장평가 제출서류 표', checkedAt: '2026-10-07', change: '공식 제출서류(사업자등록증 · 주주명부 · 조직도 · 표준재무제표증명원)와 MIRAE 실무 준비자료를 나눔 — 기술사업계획서는 이노비즈넷에서 작성하는 절차(첨부 서류 아님)' },
  { cert: 'mainbiz', rule: '중소벤처24 메인비즈 현장평가 준비서류 표', checkedAt: '2026-10-07', change: '공식 기본서류 중 OS 가 챙기는 것은 표준재무제표 증명원뿐 — 사업자등록증 · 경영계획서는 공식 필수로 확인되지 않아 막지 않음' },
  { cert: 'innobiz', rule: 'Inno-Biz 제도 운영규정(중소벤처기업부고시 제2026-44호)', checkedAt: '2026-10-07', change: '별표3 기술혁신시스템 평가표(4부문 1,000점) · 별표4 연장 평가표(100점 중 60점) 원문 확인 → 공식 기준에 반영' },
  { cert: 'mainbiz', rule: 'Main-Biz 제도 운영규정(중소벤처기업부고시 제2026-45호)', checkedAt: '2026-10-07', change: '별표1 평가 영역을 3영역(경영혁신인프라 350 · 활동 400 · 성과 250)으로 바로잡음 — 4가지 질문 예시는 영역 안의 지표' },
  { cert: 'venture', rule: '벤처기업확인요령(중소벤처기업부고시 제2026-68호)', checkedAt: '2026-10-07', change: '별표1 업종별 연구개발 투자비율 원문 확인 → 연구개발유형 판정에 반영' },
  { cert: 'lab', rule: '기업부설연구소법 시행규칙(과학기술정보통신부령 제163호)', checkedAt: '2026-10-07', change: '연구공간(고정 벽 · 별도 출입문 · 칸막이 예외) · 연구전담요원 자격 원문 확인' },
  { cert: 'iso9001', rule: 'ISO 9001:2026(제6판)', checkedAt: '2026-10-07', change: '현재판을 ISO 9001:2026(2026-09-16 발행)으로 기준 정리' },
]

export function ruleChangesOf(cert: CertificationKey): RuleChange[] {
  return RULE_CHANGES.filter((r) => r.cert === cert)
}
