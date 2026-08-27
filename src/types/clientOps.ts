/**
 * 고객사 운영 관리 — 통합 데이터 모델.
 *
 * 컨설팅 표준 서비스(법인설립·업종추가·특허·벤처인증·AX 개발·정책자금)와
 * 그 과정에서 반복 사용되는 서류, 수금을 하나의 고객사 레코드로 관리한다.
 *
 * 보안 원칙:
 *  - 공동인증서 비밀번호 등 자격증명은 저장하지 않는다. "전달 여부"와
 *    "보관 위치 메모"만 기록한다.
 *  - 주민등록번호는 저장하지 않는다(신분증 사본 파일로만 관리).
 */

/* ------------------------------------------------------------------ */
/* 표준 업무 (서비스)                                                   */
/* ------------------------------------------------------------------ */

export type ServiceKey =
  | 'incorporation' // 법인설립 (필요한 경우)
  | 'businessScope' // 사업자등록증 업종추가 · 등기부 목적사항 추가
  | 'patent' // 특허 출원
  | 'venture' // 벤처인증 (혁신성장유형)
  | 'ax' // AX 기획 및 개발
  | 'policyFund' // 정책자금 · 정부지원금 (반복 신청)

/**
 * 업무 진행 상태.
 * not_applicable: 이 업체에는 해당 없음(예: 이미 법인이라 설립 불필요)
 */
export type ServiceStatus =
  | 'not_applicable'
  | 'not_started'
  | 'preparing'
  | 'in_progress'
  | 'waiting_client'
  | 'submitted'
  | 'done'
  | 'on_hold'

export interface ServiceState {
  status: ServiceStatus
  /** 마감·목표일 (YYYY-MM-DD, 미정이면 '') */
  dueDate: string
  /** 다음에 할 일 한 줄 */
  nextStep: string
  note: string
  startedAt: string | null
  completedAt: string | null
  /** 고객 회신을 기다리기 시작한 시각 (장기 대기 감지용) */
  waitingSince: string | null
}

/* ------------------------------------------------------------------ */
/* 서류                                                                 */
/* ------------------------------------------------------------------ */

export type DocumentKey =
  | 'businessRegistration' // 사업자등록증
  | 'corporateRegistry' // 법인등기부등본
  | 'representativeId' // 대표자 신분증 사본
  | 'representativePhone' // 대표자 휴대폰번호
  | 'businessNumber' // 사업자등록번호
  | 'corporateNumber' // 법인번호
  | 'jointCertificate' // 공동인증서 전달
  | 'businessAddress' // 사업장 주소
  | 'smeCertificate' // 중소기업 확인서
  | 'healthInsurance' // 대표자 건강보험 득실확인서

export interface DocumentState {
  /** 받았는지 여부 */
  received: boolean
  /** 발급일 (YYYY-MM-DD) — 유효기간 계산 기준. 없으면 '' */
  issuedAt: string
  /** 첨부 파일명 (업로드한 경우) */
  fileName: string
  /** Supabase Storage 경로 (업로드한 경우) */
  storagePath: string
  /**
   * 보관 위치·비고 메모.
   * 공동인증서의 경우 "어디에 보관 중인지"만 적는다. 비밀번호는 적지 않는다.
   */
  note: string
  updatedAt: string | null
}

/* ------------------------------------------------------------------ */
/* 수금                                                                 */
/* ------------------------------------------------------------------ */

export type FeeKind = 'deposit' | 'interim' | 'success'

export interface FeeItem {
  id: string
  /** 어떤 업무의 대금인지 (전체 계약이면 null) */
  serviceKey: ServiceKey | null
  kind: FeeKind
  /** 표시용 이름 (예: "벤처인증 성공보수") */
  label: string
  /** 금액(원). 미정이면 null */
  amount: number | null
  /** 받기로 한 날 (YYYY-MM-DD, 미정이면 '') */
  dueDate: string
  /** 실제 입금 확인일 (YYYY-MM-DD). 미수금이면 null */
  receivedAt: string | null
  note: string
}

/* ------------------------------------------------------------------ */
/* 고객사 레코드                                                        */
/* ------------------------------------------------------------------ */

export type ClientOpsStatus = 'active' | 'waiting' | 'paused' | 'completed'

export interface ClientOpsRecord {
  id: string
  workspaceId: string | null
  companyName: string
  contactName: string
  contactPhone: string
  contactEmail: string
  businessNumber: string
  corporateNumber: string
  businessAddress: string
  industry: string
  status: ClientOpsStatus
  /** 업체 전체 기준 다음 할 일 (업무별 nextStep과 별개) */
  nextAction: string
  nextActionDueDate: string
  notes: string
  services: Record<ServiceKey, ServiceState>
  documents: Record<DocumentKey, DocumentState>
  fees: FeeItem[]
  createdAt: string
  updatedAt: string
}

export interface CreateClientOpsInput {
  companyName: string
  contactName?: string
  contactPhone?: string
  businessNumber?: string
  industry?: string
}

/* ------------------------------------------------------------------ */
/* 경고 (마감·누락)                                                     */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertKind =
  | 'task_overdue' // 업무 마감 지남
  | 'task_due_soon' // 업무 마감 임박
  | 'blocked_missing_doc' // 필요 서류가 없어 진행 불가
  | 'doc_expired' // 서류 유효기간 지남
  | 'doc_expiring' // 서류 유효기간 임박
  | 'payment_overdue' // 받기로 한 날이 지난 미수금
  | 'payment_due_soon' // 수금 예정일 임박
  | 'waiting_too_long' // 고객 회신 장기 대기
  | 'no_next_step' // 진행 중인데 다음 할 일이 비어 있음

export interface OpsAlert {
  id: string
  clientId: string
  clientName: string
  kind: AlertKind
  severity: AlertSeverity
  /** 한 줄 제목 (무엇을 해야 하는지) */
  title: string
  /** 부연 설명 */
  detail: string
  /** 관련 업무 (없으면 null) */
  serviceKey: ServiceKey | null
  /** 기준 날짜 (YYYY-MM-DD, 없으면 '') */
  dueDate: string
  /** 남은 일수 (음수면 지남). 날짜 없으면 null */
  daysLeft: number | null
}
