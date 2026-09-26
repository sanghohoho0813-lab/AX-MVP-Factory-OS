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
 * 업무 진행 상태 — 6단계.
 *
 * 예전에는 8단계(서류 준비 중·접수 완료 포함)였다. 쓰다 보니 구분이 과해서
 * 줄였고, 이미 저장된 값은 읽을 때 normalizeServiceStatus 가 옮긴다.
 *   서류 준비 중·접수 완료 → 진행 중
 *
 * '해당 없음' 은 다시 살렸다. 보류로 합쳐 두었더니 "지금은 안 한다" 와
 * "이 회사에는 아예 없는 일" 이 한 칸에 섞였다. 특허가 없는 회사에 특허가
 * '보류' 로 떠 있으면 언젠가 해야 할 일처럼 읽힌다. 진행률 계산에서도 빠져야
 * 하므로 별도 상태여야 한다.
 */
export type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'done'
  | 'on_hold'
  | 'not_applicable'

/** 지금은 쓰지 않지만 저장된 데이터에 남아 있을 수 있는 예전 상태 */
export type LegacyServiceStatus = 'preparing' | 'submitted'

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

/**
 * 서류 키.
 *
 * 기본 10종은 코드가 이름으로 알고, 그 밖은 대표가 직접 만든다(D-82).
 * 업무 키(ServiceKey)와 같은 이유로 문자열로 연다 — 직접 만든 칸의 키를 미리 알 수 없다.
 */
export type DocumentKey = string

/** 코드가 이름으로 아는 기본 서류 10종 */
export const BUILTIN_DOCUMENT_KEYS = [
  'businessRegistration', // 사업자등록증
  'corporateRegistry', // 법인등기부등본
  'representativeId', // 대표자 신분증 사본
  'representativePhone', // 대표자 휴대폰번호
  'businessNumber', // 사업자등록번호
  'corporateNumber', // 법인번호
  'jointCertificate', // 공동인증서 전달
  'businessAddress', // 사업장 주소
  'smeCertificate', // 중소기업 확인서
  'healthInsurance', // 대표자 건강보험 득실확인서
  /* 도구함이 쓰는 서류 (D-90) */
  'payrollRoster', // 4대보험 가입자 명부 — 고용지원금 진단
  'cretopReport', // 크레탑 기업종합보고서 — 크레탑 분석
  'financialStatements', // 최근 3개년 재무제표 — 정책자금 진단
] as const

export type BuiltinDocumentKey = (typeof BUILTIN_DOCUMENT_KEYS)[number]

/** 대표가 직접 만든 서류 칸인지 */
export function isCustomDocumentKey(key: DocumentKey): boolean {
  return key.startsWith('customdoc_')
}

/**
 * 대표가 직접 만든 서류 칸 (업체마다 다르다).
 *
 * 기본 10종으로 안 되는 서류가 늘 있다 — 법인인감증명서·국세완납증명서·재무제표처럼
 * 기관이나 업종에 따라 달라진다. 칸을 만들면 기본 서류와 **똑같이** 받았는지·발급일·
 * 메모·파일 첨부를 쓴다. 상태는 `documents[key]` 에 함께 들어간다.
 */
export interface CustomDocument {
  id: string
  /** `customdoc_` 로 시작한다. 한 번 정해지면 바꾸지 않는다 — 상태와 파일이 이 키로 붙어 있다 */
  key: DocumentKey
  label: string
  /** 유효기간(개월). 없으면 null — 만료를 따지지 않는다 */
  validMonths: number | null
  /** 민감 정보라 취급에 주의가 필요한지 */
  sensitive: boolean
}

export interface DocumentState {
  /** 받았는지 여부 */
  received: boolean
  /** 발급일 (YYYY-MM-DD) — 유효기간 계산 기준. 없으면 '' */
  issuedAt: string
  /** 첨부 파일명 (업로드한 경우) */
  fileName: string
  /** 첨부 파일 크기(byte). 예전에 올린 파일은 0 */
  fileSize: number
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
  /** 청구 금액(원). 미정이면 null */
  amount: number | null
  /**
   * 이 건에서 영업자에게 나갈 수수료(원). 없으면 null.
   * 청구액에서 이것을 뺀 것이 '진짜 내가 받는 돈' 이다 — 이익률은 저장하지 않고 매번 계산한다.
   */
  agentFee: number | null
  /** 그 수수료를 받아 갈 영업자 이름. 없으면 '' — 누구한테 얼마 나가는지 한 줄에 보이게 */
  agentName: string
  /** 영업자에게 수수료를 실제로 준 날 (YYYY-MM-DD). 아직이면 null — 고객이 입금한 뒤에야 줄 돈이 된다 */
  agentPaidAt: string | null
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

/**
 * 저장되는 업체 상태 값. DB 의 check 제약이 이 네 가지만 받는다.
 * 화면에는 이 값을 그대로 보여 주지 않고 아래 계약 단계 3가지로 옮겨서 보여 준다.
 */
export type ClientOpsStatus = 'active' | 'waiting' | 'paused' | 'completed'

/**
 * 화면에 보이는 계약 단계 — 3단계.
 *
 * 예전에는 진행 중 · 고객 대기 · 일시 중지 · 종료 네 가지였는데, 앞의 셋은 업무별
 * 상태(진행 중·대기·보류)와 겹쳐 같은 말을 두 군데서 하고 있었다. 업체 수준에서
 * 정말 갈라야 하는 것은 "계약을 했는가" 하나다.
 *
 * 저장 값은 예전 네 가지를 그대로 쓴다 — DB 의 check 제약을 건드리지 않기 위해서다.
 * (제약을 바꾸려면 사람이 SQL 을 돌려야 하는데, 화면 문구 하나 때문에 그럴 이유가 없다.)
 *   계약 전   ↔ 'waiting'
 *   계약 완료 ↔ 'active'
 *   계약 종료 ↔ 'completed'
 *   'paused'(예전 일시 중지)는 읽을 때 계약 완료로 본다.
 */
export type ContractStage = 'pre' | 'signed' | 'closed'

export const CONTRACT_STAGE_ORDER: ContractStage[] = ['pre', 'signed', 'closed']

export const CONTRACT_STAGE_LABEL: Record<ContractStage, string> = {
  pre: '계약 전',
  signed: '계약 완료',
  closed: '계약 종료',
}

/** 저장 값 → 화면 단계 */
export function contractStageOf(status: ClientOpsStatus): ContractStage {
  if (status === 'waiting') return 'pre'
  if (status === 'completed') return 'closed'
  return 'signed'
}

/** 화면 단계 → 저장 값 */
export function statusForStage(stage: ContractStage): ClientOpsStatus {
  if (stage === 'pre') return 'waiting'
  if (stage === 'closed') return 'completed'
  return 'active'
}

/* ------------------------------------------------------------------ */
/* 계약 — 언제 · 어떤 방식으로 · 얼마에                                   */
/* ------------------------------------------------------------------ */

/**
 * 계약 방식.
 *   cash      수수료를 현금으로 받는 계약
 *   insurance 보험 계약으로 갈음하는 계약 (월납보험료가 곧 보수)
 *   mixed     둘 다 — 일부는 현금, 일부는 보험
 */
export type ContractKind = 'cash' | 'insurance' | 'mixed'

export const CONTRACT_KIND_ORDER: ContractKind[] = ['cash', 'insurance', 'mixed']

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  cash: '현금',
  insurance: '보험',
  mixed: '현금 + 보험',
}

export const CONTRACT_KIND_HINT: Record<ContractKind, string> = {
  cash: '수수료를 현금으로 받는 계약',
  insurance: '보험 계약으로 갈음하는 계약',
  mixed: '일부는 현금, 일부는 보험',
}

/**
 * 보험 계약 한 건.
 *
 * 여러 건일 수 있다 — 대표 개인 종신 + 법인 CEO플랜처럼 나뉘어 들어간다.
 * 계약자·피보험자 주민등록번호는 **넣지 않는다**(CLAUDE.md). 증권번호도 여기 두지 않는다.
 */
export interface InsurancePolicy {
  id: string
  /** 보험사 */
  insurer: string
  /** 상품명 */
  productName: string
  /** 월납보험료(원). 모르면 null */
  monthlyPremium: number | null
  /** 가입일 (YYYY-MM-DD) */
  startedAt: string
  /** 납입기간 — '10년납' · '전기납' 처럼 말이 붙으므로 글자로 둔다 */
  payTerm: string
  /** 계약자·피보험자 구분 같은 메모 */
  note: string
}

/** 계약 정보 — 없으면 전부 빈 값이다(계약 전 업체) */
export interface ContractInfo {
  /** 계약일 (YYYY-MM-DD) */
  signedAt: string
  /** 방식. 아직 안 정했으면 '' */
  kind: ContractKind | ''
  /** 현금 계약 금액(원). 미정이면 null */
  cashAmount: number | null
  /** 보험 계약들 */
  policies: InsurancePolicy[]
  /** 계약 조건 메모 */
  note: string
}

export function emptyContract(): ContractInfo {
  return { signedAt: '', kind: '', cashAmount: null, policies: [], note: '' }
}

/* ------------------------------------------------------------------ */
/* 회사 기본 정보 — 직접 만든 칸                                          */
/* ------------------------------------------------------------------ */

/** 회사 기본 정보의 묶음 — 화면에서 이 순서·이 제목으로 나눈다 */
export type ProfileGroupKey = 'identity' | 'people' | 'contact' | 'credential'

export const PROFILE_GROUP_KEYS: ProfileGroupKey[] = ['identity', 'people', 'contact', 'credential']

export function isProfileGroupKey(v: unknown): v is ProfileGroupKey {
  return typeof v === 'string' && (PROFILE_GROUP_KEYS as string[]).includes(v)
}

/**
 * 대표가 직접 만든 칸.
 *
 * 업종마다 챙겨야 하는 값이 다르다 — 어떤 업체는 공장 등록번호가, 어떤 업체는
 * 세무사 연락처가 매번 필요하다. 그때마다 개발을 기다리는 대신 그 자리에서 칸을 만든다.
 * 네 묶음(회사·사람·연락처·인증서) 중 어디에 둘지 고른다.
 *
 * 비밀번호·주민등록번호는 여기에도 적지 않는다(CLAUDE.md). 화면에 그렇게 적어 둔다.
 */
export interface CustomProfileField {
  id: string
  group: ProfileGroupKey
  /** 칸 이름 — 예: '공장 등록번호' */
  label: string
  /** 적어 둔 값 */
  value: string
}

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
  | 'contract' // 계약 정보 변경 (계약일·방식·금액·보험)
  | 'archive' // 보관·보관 해제
  | 'tool' // 도구함 결과를 붙임 (창업감면 판정 · 크레탑 분석 · 정책자금 진단 …)
  | 'sales' // 영업 단계 변경 · 영업 정보 수정 (D-114)

/**
 * 도구함 결과 한 건 (D-88).
 *
 * 도구(창업감면 판정기·크레탑 분석기·정책자금 진단 …)에서 나온 판정을 업체 기록에 붙여 둔다.
 * `summary` 는 고객에게 보여 줘도 되는 글(도구가 그렇게 만든 것만), `data` 는 다시 열어 볼 입력값.
 * 내부 메모·수수료·업무 일기는 여기 들어오지 않는다 — 고객 플랫폼 발행은 `summary` 만 나간다.
 */
/**
 * 도구가 계산해 낸 기한 한 줄 (D-89).
 *
 * 고용지원금 회차 신청일, 연구소 사후관리 기한처럼 "언제까지" 가 결과의 핵심인 것들이 있다.
 * 결과에 함께 붙여 두면 달력·오늘 화면이 업무 마감·수금과 나란히 보여 준다.
 * 도구가 만든 것이므로 사람이 고치지 않는다 — 다시 판정하면 새 결과에 새 기한이 붙는다.
 */
export interface ToolDeadline {
  /** YYYY-MM-DD */
  date: string
  /** 달력에 보일 한 줄 (예: "1회차 신청 (2026-04-01 ~ 2026-04-30)") */
  title: string
  /** 한 줄 더 — 없으면 빈 글자 */
  note: string
}

export interface ToolResult {
  id: string
  /** toolRegistry 의 key (startup-tax · cretop · policy-funding …) */
  toolKey: string
  /** 화면에 보일 이름 (예: "창업감면 판정") */
  title: string
  /** 도구가 정한 판정 키 (good/caution … 도구마다 다름). 없으면 null */
  verdict: string | null
  /** 판정을 사람 말로 (예: "🟢 감면 가능성 높음") */
  verdictLabel: string
  /** 고객에게도 보여 줄 수 있는 요약 글 */
  summary: string
  /** 다시 열어 볼 입력값·결과 (도구마다 모양이 다르다) */
  data: unknown
  /** 도구가 계산한 기한들 — 달력·오늘 화면에 그대로 뜬다 (D-89). 없으면 빈 배열 */
  deadlines: ToolDeadline[]
  createdAt: string
  /** 고객 플랫폼에 발행했으면 그 update id */
  publishedUpdateId: string | null
}

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

/* ------------------------------------------------------------------ */
/* 영업 (D-114) — 계약 전 고객도 고객 관리 한 장부에                      */
/* ------------------------------------------------------------------ */

/**
 * 영업 단계 — 기업컨설팅 OS(영업 도구 모음)의 '핵심 6단계 + 보류' 를 그대로 옮기고 '이탈' 을 따로 뺐다.
 *   lead 잠재 고객 → m1sched 1차 미팅 예정 → m1done 1차 미팅 완료 → m2 2차 미팅(제안·견적) → closing 3차 클로징 → contracted 계약 완료
 *   hold 보류·장기관리 · lost 이탈
 * 계약 단계(pre/signed/closed)와는 따로 둔다 — 영업은 '어디까지 왔나', 계약 단계는 '계약을 했나'.
 * contracted 로 옮기면 계약 단계도 '계약 완료' 가 된다(salesPipeline.withSalesStage).
 */
export type SalesStage = 'lead' | 'm1sched' | 'm1done' | 'm2' | 'closing' | 'contracted' | 'hold' | 'lost'

export const SALES_STAGE_ORDER: SalesStage[] = ['lead', 'm1sched', 'm1done', 'm2', 'closing', 'contracted', 'hold', 'lost']

/** 보드의 흐름 칸(보류·이탈 제외) */
export const SALES_FLOW_STAGES: SalesStage[] = ['lead', 'm1sched', 'm1done', 'm2', 'closing', 'contracted']

export const SALES_STAGE_LABEL: Record<SalesStage, string> = {
  lead: '잠재 고객',
  m1sched: '1차 미팅 예정',
  m1done: '1차 미팅 완료',
  m2: '2차 미팅',
  closing: '3차 클로징',
  contracted: '계약 완료',
  hold: '보류·장기관리',
  lost: '이탈',
}

export const SALES_STAGE_HINT: Record<SalesStage, string> = {
  lead: '발굴 · 첫 연락',
  m1sched: '일정 조율 · 확정',
  m1done: '자료 요청 · 수령 · 제안 준비',
  m2: '제안서 · 견적 전달, 2차 진행',
  closing: '조건 조율 · 의사결정 · 청약 준비',
  contracted: '계약 완료 · 관리 시작',
  hold: '지금은 아님 — 다시 연락할 때까지',
  lost: '진행하지 않기로 함',
}

export function isSalesStage(v: unknown): v is SalesStage {
  return typeof v === 'string' && (SALES_STAGE_ORDER as string[]).includes(v)
}

export interface SalesStageEvent {
  at: string
  from: SalesStage | null
  to: SalesStage
}

export interface SalesInfo {
  stage: SalesStage
  /** 유입 경로 (소개 · 홈페이지 상담신청 · 전화 …) */
  source: string
  /** 소개한 사람 */
  referrer: string
  /** 관심사 (절세 · 가업승계 · 가지급금 …) */
  interests: string[]
  /** 대표의 고민 한 줄 */
  concern: string
  /** 예상 수임료(원) — 모르면 null */
  expectedFee: number | null
  /** 단계 이력 (최신이 끝) */
  history: SalesStageEvent[]
  /** 마지막으로 단계를 옮긴 시각 */
  movedAt: string
  /** 기업컨설팅 OS(영업 도구 모음)에서 옮겨 온 원래 기록 — 미팅 대본 · 점수 등 다음 단계에서 쓴다 */
  imported?: Record<string, unknown>
  /** 대표 나이 — 리드 점수 · 승계 질문에 쓴다 (D-114 2단계) */
  ceoAge?: number | null
  /** 매출(백만원) — 원본 단위 그대로 */
  revenueM?: number | null
  /** 고객 체크 17가지(가지급금 있음 · 자녀 근무 …) — 켜진 것만 */
  flags?: Record<string, boolean>
  /** 상담 메모 (자유 글) */
  memo?: string
  /** 미팅 기록 — 최신이 앞 */
  meetings?: SalesMeetingNote[]
  /** 제안 (D-114 3단계) — 고른 상품 · 합계 · 상태 · 월납 */
  proposal?: SalesProposal
  /** 계약 준비 체크 10 · 필수 서류 14 중 챙긴 것 (이름) */
  contractPrep?: string[]
  /**
   * 계약 경로 (D-119) — 무엇으로 계약할 것 같은가. 영업 흐름에서 몇 차에 계약하는지가 달라진다.
   * cash 현금(1차 뒤 전화 · 2차) · insurance 법인보험(3·4차) · total 종합 컨설팅 · step 단계별(현금 먼저 → 종합)
   */
  path?: SalesPath
}

export type SalesPath = 'cash' | 'insurance' | 'total' | 'step'
export const SALES_PATH_ORDER: SalesPath[] = ['cash', 'insurance', 'total', 'step']
export function isSalesPath(v: unknown): v is SalesPath {
  return typeof v === 'string' && (SALES_PATH_ORDER as string[]).includes(v)
}

/** 제안 한 건 (D-114 3단계) — 원본 영업 도구의 제안 상태 · 월납 제안을 그대로 */
export interface SalesProposal {
  /** 고른 상품 이름 */
  packages: string[]
  /** 합계 수임료(만원, 상품표 가격 기준) */
  feeManwon: number
  /** 제안 상태 — 제안 전 · 제안서 작성 · 제안 완료 · 견적 전달 · 검토 중 · 조건 조율 · 계약 예정 · 계약 완료 · 보류 */
  status: string
  /** 마지막으로 저장한 날 (YYYY-MM-DD) */
  at: string
  /** 월납 보험료 제안 — 만원 · 개월 · 환급률(%) · 직전년도 당기순이익(만원) */
  monthly?: { premium: number; months: number; rate: number; netIncome: number | null } | null
}

/** 미팅 한 번의 기록 — 적은 메모와 규칙 분석 결과 (D-114 2단계) */
export interface SalesMeetingNote {
  id: string
  at: string
  /** 몇 차 미팅 */
  round: 1 | 2 | 3
  text: string
  /** 반응 추정 · 언급된 주제 · 망설임 · 다음 자료 */
  reaction: string
  issues: string[]
  hesitant: string[]
  nextDocs: string[]
}

export function emptySales(stage: SalesStage = 'lead', at: string = new Date().toISOString()): SalesInfo {
  return { stage, source: '', referrer: '', interests: [], concern: '', expectedFee: null, history: [{ at, from: null, to: stage }], movedAt: at }
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
  /**
   * 대표자 이름. 담당자(contactName)와 다를 수 있다 — 대표는 김대표인데
   * 실무는 이과장이 하는 경우가 흔하다. 비어 있으면 화면에서 담당자 이름으로
   * 대신 보여 준다(예전 기록은 담당자 칸에 대표 이름을 넣어 두었다).
   */
  representativeName: string
  /** 대표자 생년월일 (YYYY-MM-DD) — 나이 자동 계산 */
  representativeBirth: string
  /**
   * 상시근로자 수. 정책자금·벤처인증·중소기업확인서에서 거의 매번 묻는다.
   * 숫자만 넣지 않고 글자로 두는 이유: "5명(대표 포함)" 처럼 단서가 붙는다.
   */
  employeeCount: string
  /**
   * 주주·임원 구성. 지분율과 등기임원이 벤처인증·정책자금 심사에 들어간다.
   * 예: "대표 60% · 배우자 25% · 김이사 15% / 등기임원 2명"
   */
  shareholders: string
  /** 설립일·개업일 (YYYY-MM-DD) — 업력 자동 계산 */
  establishedAt: string
  /** 업태 */
  businessCategory: string
  /** 종목 — 대표 종목 하나만. 여러 개면 아래 businessItemsExtra 로 뺀다 */
  businessItem: string
  /**
   * 대표 종목을 뺀 나머지 종목 (' · ' 로 이음).
   * 사업자등록증에 종목이 일곱 줄씩 찍히는 회사가 있는데, 그것을 다 앞에 두면
   * 화면이 문단이 된다. 버리지는 않고 뒤로 뺀다.
   */
  businessItemsExtra: string
  /** 담당자 직급 */
  contactTitle: string
  /** 회사 대표번호 */
  companyPhone: string
  /** 홈페이지 */
  homepage: string

  services: Record<ServiceKey, ServiceState>
  documents: Record<DocumentKey, DocumentState>
  /** 계약 — 언제 · 어떤 방식으로 · 얼마에 (payload 에 함께 저장된다) */
  contract: ContractInfo
  /** 회사 기본 정보에 직접 만든 칸 (payload 에 함께 저장된다) */
  customFields: CustomProfileField[]
  /** 서류함에 직접 만든 칸 (payload 에 함께 저장된다) */
  customDocuments: CustomDocument[]
  fees: FeeItem[]
  notes_list: ClientNote[]
  fundingApplications: FundingApplication[]
  /** 도구함에서 붙인 결과들 — 최신이 앞 (D-88) */
  toolResults: ToolResult[]
  /** 영업 정보 (D-114). 영업 보드에 올린 적 없는 업체는 null */
  sales: SalesInfo | null
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
  /** 기본 'active'(계약함). 잠재고객은 'waiting'(계약 전) — D-114 */
  status?: ClientOpsStatus
  /** 영업 칸 — 잠재고객으로 만들 때 (D-114) */
  sales?: SalesInfo | null
}

/* ------------------------------------------------------------------ */
/* 경고 (마감·누락)                                                     */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertKind =
  | 'task_overdue' // 업무 마감 지남
  | 'task_due_soon' // 업무 마감 임박
  | 'doc_expired' // 서류 유효기간 지남
  | 'doc_expiring' // 서류 유효기간 임박
  | 'payment_overdue' // 받기로 한 날이 지난 미수금
  | 'payment_due_soon' // 수금 예정일 임박
  | 'waiting_too_long' // 고객 회신 장기 대기
  | 'no_next_step' // 진행 중인데 다음 할 일이 비어 있음
  | 'funding_due_soon' // 정책자금 신청 마감 임박
  | 'funding_overdue' // 정책자금 신청 마감 지남
  | 'client_quiet' // 오랫동안 아무 기록이 없는 업체

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
