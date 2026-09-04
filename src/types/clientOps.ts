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

/**
 * 업무 식별자.
 *
 * 기본 6종은 아래 BUILTIN_SERVICE_KEYS 로 고정돼 있고, 대표가 직접 만든 항목은
 * 'custom_...' 키를 갖는다. 업체마다 하는 일이 조금씩 달라 목록을 코드에 박아 둘 수
 * 없으므로 문자열로 연다 — 대신 기본 6종은 상수로 참조해 오타를 막는다.
 */
export type ServiceKey = string

/** 코드가 이름으로 아는 기본 업무 6종 */
export const BUILTIN_SERVICE_KEYS = [
  'incorporation',  // 법인설립 (필요한 경우)
  'businessScope',  // 사업자등록증 업종추가 · 등기부 목적사항 추가
  'patent',         // 특허 출원
  'venture',        // 벤처인증 (혁신성장유형)
  'ax',             // AX 기획 및 개발
  'policyFund',     // 정책자금 · 정부지원금 (반복 신청)
] as const

export type BuiltinServiceKey = (typeof BUILTIN_SERVICE_KEYS)[number]

/** 대표가 직접 만든 항목인지 */
export function isCustomServiceKey(key: ServiceKey): boolean {
  return key.startsWith('custom_')
}

/**
 * 업무 진행 상태 — 5단계.
 *
 * 예전에는 8단계(서류 준비 중·접수 완료·해당 없음 포함)였다. 쓰다 보니 구분이
 * 과해서 줄였고, 이미 저장된 값은 읽을 때 normalizeServiceStatus 가 옮긴다.
 *   서류 준비 중·접수 완료 → 진행 중
 *   해당 없음             → 보류
 */
export type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'done'
  | 'on_hold'

/** 지금은 쓰지 않지만 저장된 데이터에 남아 있을 수 있는 예전 상태 */
export type LegacyServiceStatus = 'preparing' | 'submitted' | 'not_applicable'

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
/* 정책자금 · 정부지원금 신청 건 (공고마다 반복)                        */
/* ------------------------------------------------------------------ */

export type FundingStatus =
  | 'watching' // 공고 확인 중
  | 'preparing' // 서류 준비 중
  | 'submitted' // 신청 접수
  | 'reviewing' // 심사 중
  | 'selected' // 선정
  | 'rejected' // 탈락
  | 'given_up' // 포기

export interface FundingApplication {
  id: string
  /** 사업·공고명 */
  programName: string
  /** 주관 기관 */
  institution: string
  status: FundingStatus
  /** 신청 마감일 (YYYY-MM-DD) */
  applyDueDate: string
  /** 접수한 날 */
  submittedAt: string | null
  /** 결과 나온 날 */
  resultAt: string | null
  /** 신청 금액(원) */
  requestedAmount: number | null
  /** 확정 금액(원) */
  approvedAmount: number | null
  note: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 고객사 레코드                                                        */
/* ------------------------------------------------------------------ */

export type ClientOpsStatus = 'active' | 'waiting' | 'paused' | 'completed'

/* ------------------------------------------------------------------ */
/* 메모                                                                 */
/* ------------------------------------------------------------------ */

export interface ClientNote {
  id: string
  text: string
  /** 위로 고정 */
  pinned: boolean
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 활동 기록 (자동 축적)                                                */
/* ------------------------------------------------------------------ */

/**
 * 무엇이 바뀌었는지 자동으로 남기는 기록.
 * 사람이 직접 쓰는 메모(ClientNote)와 달리, 화면에서 상태를 바꾸는 순간
 * 시스템이 알아서 한 줄씩 붙인다. "이 업체 어디까지 했더라"를 카톡·기억이 아니라
 * 여기서 확인하게 하는 것이 목적이다.
 */
export type ActivityKind =
  | 'service_status' // 업무 단계 변경
  | 'service_due' // 업무 마감일 설정·변경
  | 'document' // 서류 수령·해제·파일 첨부
  | 'fee_added' // 수금 항목 추가
  | 'fee_received' // 입금 확인
  | 'funding_added' // 지원사업 신청 건 추가
  | 'funding_status' // 지원사업 상태 변경
  | 'profile' // 기업 기본 정보 변경
  | 'archive' // 보관·보관 해제

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  /** 화면에 그대로 보여줄 한 줄 (예: "벤처인증 · 준비 중 → 접수 완료") */
  text: string
  /** 관련 업무 (있을 때만) */
  serviceKey: ServiceKey | null
  /** 발생 시각 */
  at: string
}

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
  /* 주기적으로 찾게 되는 기업 기본 정보 */
  /** 대표자 생년월일 (YYYY-MM-DD) — 나이 자동 계산 */
  representativeBirth: string
  /** 설립일·개업일 (YYYY-MM-DD) — 업력 자동 계산 */
  establishedAt: string
  /** 업태 */
  businessCategory: string
  /** 종목 */
  businessItem: string
  /** 담당자 직급 */
  contactTitle: string
  /** 회사 대표번호 */
  companyPhone: string
  /** 홈페이지 */
  homepage: string

  services: Record<ServiceKey, ServiceState>
  documents: Record<DocumentKey, DocumentState>
  fees: FeeItem[]
  notes_list: ClientNote[]
  fundingApplications: FundingApplication[]
  /** 자동 활동 기록 — 최신순. 오래된 것은 잘라낸다. */
  activity: ActivityEntry[]
  /** 보관 처리 시각 (보관하면 목록·경고에서 빠진다) */
  archivedAt: string | null
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
  | 'funding_due_soon' // 정책자금 신청 마감 임박
  | 'funding_overdue' // 정책자금 신청 마감 지남

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
