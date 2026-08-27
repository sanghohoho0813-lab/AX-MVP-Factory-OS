/**
 * 고객사 운영 — 표준 업무·서류 카탈로그 (단일 정의).
 *
 * 화면·서비스는 반드시 이 목록을 참조한다. 개수를 하드코딩하지 않는다.
 */

import type {
  DocumentKey,
  FeeKind,
  ServiceKey,
  ServiceStatus,
} from '../types/clientOps'

/* ------------------------------------------------------------------ */
/* 표준 업무 6종                                                        */
/* ------------------------------------------------------------------ */

export interface ServiceMeta {
  key: ServiceKey
  label: string
  /** 현황표 좁은 칸에 쓰는 짧은 이름 */
  shortLabel: string
  description: string
  /** 이 업무를 시작·진행하려면 반드시 있어야 하는 서류 */
  requiredDocuments: DocumentKey[]
  /** 여러 번 반복 신청하는 업무인지 (정책자금) */
  recurring: boolean
  /** 진행 순서 (앞 업무가 대체로 먼저) */
  order: number
}

export const SERVICES: ServiceMeta[] = [
  {
    key: 'incorporation',
    label: '법인설립',
    shortLabel: '법인설립',
    description: '개인사업자이거나 법인이 없는 경우에만 진행합니다. 이미 법인이면 "해당 없음"으로 두세요.',
    requiredDocuments: ['representativeId', 'representativePhone', 'businessAddress'],
    recurring: false,
    order: 1,
  },
  {
    key: 'businessScope',
    label: '업종 추가 · 목적사항 추가',
    shortLabel: '업종·목적',
    description:
      '사업자등록증에 업종을 추가하고, 법인등기부등본 목적사항에 해당 사업을 넣습니다. 특허·벤처인증·정책자금의 사전 요건이 되는 경우가 많습니다.',
    requiredDocuments: ['businessRegistration', 'corporateRegistry', 'jointCertificate'],
    recurring: false,
    order: 2,
  },
  {
    key: 'patent',
    label: '특허 출원',
    shortLabel: '특허',
    description: '발명 내용을 정리하고 선행기술을 검토한 뒤 출원합니다. 벤처인증 혁신성장유형의 근거가 됩니다.',
    requiredDocuments: ['businessRegistration', 'representativeId'],
    recurring: false,
    order: 3,
  },
  {
    key: 'venture',
    label: '벤처인증 (혁신성장유형)',
    shortLabel: '벤처인증',
    description: '기술의 혁신성·사업성 평가를 거쳐 벤처기업 확인을 받습니다. 정책자금 조건이 크게 좋아집니다.',
    requiredDocuments: [
      'businessRegistration',
      'corporateRegistry',
      'smeCertificate',
      'representativeId',
    ],
    recurring: false,
    order: 4,
  },
  {
    key: 'ax',
    label: 'AX 기획 및 개발',
    shortLabel: 'AX 개발',
    description:
      '기업 진단 → 먼저 만들 업무 선택 → 기능·화면 설계 → 결과자료까지 진행합니다. 결과물이 정책자금 신청의 사업계획 근거가 됩니다.',
    requiredDocuments: ['businessRegistration'],
    recurring: false,
    order: 5,
  },
  {
    key: 'policyFund',
    label: '정책자금 · 정부지원금',
    shortLabel: '정책자금',
    description:
      '앞 단계 결과물을 근거로 주기적으로 신청합니다. 공고 시기마다 반복되므로 마감일을 계속 갱신하며 관리하세요.',
    requiredDocuments: [
      'businessRegistration',
      'corporateRegistry',
      'smeCertificate',
      'healthInsurance',
      'jointCertificate',
      'corporateNumber',
    ],
    recurring: true,
    order: 6,
  },
]

export const SERVICE_KEYS: ServiceKey[] = SERVICES.map((s) => s.key)

export function serviceMeta(key: ServiceKey): ServiceMeta {
  return SERVICES.find((s) => s.key === key) ?? SERVICES[0]
}

/* 업무 상태 표시 */
export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  not_applicable: '해당 없음',
  not_started: '시작 전',
  preparing: '서류 준비 중',
  in_progress: '진행 중',
  waiting_client: '고객 회신 대기',
  submitted: '접수 완료',
  done: '완료',
  on_hold: '보류',
}

/** 선택 가능한 상태 (화면 드롭다운 순서) */
export const SERVICE_STATUS_ORDER: ServiceStatus[] = [
  'not_started',
  'preparing',
  'in_progress',
  'waiting_client',
  'submitted',
  'done',
  'on_hold',
  'not_applicable',
]

/** 아직 끝나지 않았고 실제로 굴러가는 중인 상태 */
export function isServiceOpen(status: ServiceStatus): boolean {
  return status !== 'done' && status !== 'not_applicable'
}

/** 이미 착수한 상태 (서류가 없으면 문제가 되는 시점) */
export function isServiceStarted(status: ServiceStatus): boolean {
  return (
    status === 'preparing' ||
    status === 'in_progress' ||
    status === 'waiting_client' ||
    status === 'submitted'
  )
}

/* ------------------------------------------------------------------ */
/* 서류 10종                                                            */
/* ------------------------------------------------------------------ */

export interface DocumentMeta {
  key: DocumentKey
  label: string
  /**
   * 실무상 유효기간(개월). 기관이 "최근 발급본"을 요구하는 서류는 값이 있고,
   * 사실상 만료가 없는 서류는 null.
   */
  validMonths: number | null
  /** 파일 첨부가 필요한 서류인지 (아니면 값만 적어두는 항목) */
  needsFile: boolean
  /** 민감 정보라 취급에 주의가 필요한지 */
  sensitive: boolean
  hint: string
}

export const DOCUMENTS: DocumentMeta[] = [
  {
    key: 'businessRegistration',
    label: '사업자등록증',
    validMonths: null,
    needsFile: true,
    sensitive: false,
    hint: '업종 추가 등으로 내용이 바뀌면 새로 받아 두세요.',
  },
  {
    key: 'corporateRegistry',
    label: '법인등기부등본',
    validMonths: 3,
    needsFile: true,
    sensitive: false,
    hint: '대부분의 기관이 3개월 이내 발급본을 요구합니다.',
  },
  {
    key: 'representativeId',
    label: '대표자 신분증 사본',
    validMonths: null,
    needsFile: true,
    sensitive: true,
    hint: '주민등록번호 뒷자리는 가린 사본을 받아 두세요.',
  },
  {
    key: 'representativePhone',
    label: '대표자 휴대폰번호',
    validMonths: null,
    needsFile: false,
    sensitive: false,
    hint: '본인인증·서류 발급 때 계속 필요합니다.',
  },
  {
    key: 'businessNumber',
    label: '사업자등록번호',
    validMonths: null,
    needsFile: false,
    sensitive: false,
    hint: '000-00-00000 형식으로 적어 두세요.',
  },
  {
    key: 'corporateNumber',
    label: '법인번호',
    validMonths: null,
    needsFile: false,
    sensitive: false,
    hint: '법인등기부등본 상단에서 확인할 수 있습니다.',
  },
  {
    key: 'jointCertificate',
    label: '공동인증서 전달',
    validMonths: 12,
    needsFile: false,
    sensitive: true,
    hint: '비밀번호는 이 시스템에 저장하지 마세요. 보관 위치만 메모에 적습니다.',
  },
  {
    key: 'businessAddress',
    label: '사업장 주소',
    validMonths: null,
    needsFile: false,
    sensitive: false,
    hint: '등기부상 주소와 실제 사업장이 다르면 함께 적어 두세요.',
  },
  {
    key: 'smeCertificate',
    label: '중소기업 확인서',
    validMonths: 12,
    needsFile: true,
    sensitive: false,
    hint: '매년 갱신됩니다. 만료되면 벤처인증·정책자금 신청이 막힙니다.',
  },
  {
    key: 'healthInsurance',
    label: '대표자 건강보험 득실확인서',
    validMonths: 3,
    needsFile: true,
    sensitive: true,
    hint: '정책자금 신청 시 최근 발급본을 요구하는 경우가 많습니다.',
  },
]

export const DOCUMENT_KEYS: DocumentKey[] = DOCUMENTS.map((d) => d.key)

export function documentMeta(key: DocumentKey): DocumentMeta {
  return DOCUMENTS.find((d) => d.key === key) ?? DOCUMENTS[0]
}

/** 이 서류를 필요로 하는 업무 목록 (서류함에서 "왜 필요한지" 표시) */
export function servicesNeeding(key: DocumentKey): ServiceMeta[] {
  return SERVICES.filter((s) => s.requiredDocuments.includes(key))
}

/* ------------------------------------------------------------------ */
/* 수금                                                                 */
/* ------------------------------------------------------------------ */

export const FEE_KIND_LABEL: Record<FeeKind, string> = {
  deposit: '계약금',
  interim: '중도금',
  success: '성공보수',
}

export const FEE_KIND_ORDER: FeeKind[] = ['deposit', 'interim', 'success']

/* ------------------------------------------------------------------ */
/* 임박 기준                                                            */
/* ------------------------------------------------------------------ */

/** 며칠 남으면 "임박"으로 볼지 */
export const DUE_SOON_DAYS = 7
/** 서류 만료 며칠 전부터 경고할지 */
export const DOC_EXPIRING_DAYS = 30
/** 고객 회신 대기가 며칠 넘으면 경고할지 */
export const WAITING_TOO_LONG_DAYS = 7
