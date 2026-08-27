/**
 * 고객에게 보낼 문구 자동 생성 (순수 함수).
 *
 * 컨설팅에서 가장 자주 반복되는 일 — "이 서류 보내주세요" 요청과
 * "지금 이만큼 진행됐습니다" 보고 — 를 한 번에 만들어 복사할 수 있게 한다.
 */

import type { ClientOpsRecord, DocumentKey, ServiceKey } from '../types/clientOps'
import {
  DOCUMENTS,
  SERVICES,
  SERVICE_STATUS_LABEL,
  documentMeta,
  isServiceOpen,
  isServiceStarted,
  serviceMeta,
} from '../content/clientOpsCatalog'
import { documentStatus, dueText, daysLeftFrom } from './clientOpsAlerts'

/** 서류별 "어디서 떼는지" 한 줄 안내 */
const WHERE_TO_GET: Record<DocumentKey, string> = {
  businessRegistration: '홈택스 또는 세무서에서 발급',
  corporateRegistry: '인터넷등기소 또는 등기소에서 발급 (3개월 이내 발급본)',
  representativeId: '주민등록번호 뒷자리를 가린 사본',
  representativePhone: '연락 가능한 번호',
  businessNumber: '사업자등록증 상단 번호',
  corporateNumber: '법인등기부등본 상단 번호',
  jointCertificate: '사용 가능한 공동인증서 (비밀번호는 따로 안전하게 전달해 주세요)',
  businessAddress: '사업자등록증상 주소',
  smeCertificate: '중소기업현황정보시스템에서 발급',
  healthInsurance: '국민건강보험공단에서 발급 (최근 발급본)',
}

export interface MissingDocLine {
  key: DocumentKey
  label: string
  /** 아예 없음 / 있는데 만료 */
  reason: 'missing' | 'expired'
  where: string
  /** 이 서류를 필요로 하는 진행 중 업무 이름들 */
  neededFor: string[]
}

/**
 * 지금 받아야 하는 서류 목록.
 * 대상 업무를 지정하지 않으면 "진행 중인 모든 업무"를 기준으로 계산한다.
 */
export function collectMissingDocuments(
  record: ClientOpsRecord,
  today: string,
  serviceKeys?: ServiceKey[],
): MissingDocLine[] {
  // 대상 미지정 시: 실제로 착수한 업무(준비·진행·대기·접수)만 기준으로 한다.
  const targets =
    serviceKeys ?? SERVICES.map((s) => s.key).filter((key) => isServiceStarted(record.services[key].status))

  const byDoc = new Map<DocumentKey, MissingDocLine>()
  for (const key of targets) {
    const meta = serviceMeta(key)
    for (const docKey of meta.requiredDocuments) {
      const view = documentStatus(docKey, record.documents[docKey], today)
      if (view.usable) continue
      const existing = byDoc.get(docKey)
      if (existing) {
        if (!existing.neededFor.includes(meta.label)) existing.neededFor.push(meta.label)
        continue
      }
      byDoc.set(docKey, {
        key: docKey,
        label: documentMeta(docKey).label,
        reason: view.received ? 'expired' : 'missing',
        where: WHERE_TO_GET[docKey],
        neededFor: [meta.label],
      })
    }
  }

  // 카탈로그 순서 유지
  return DOCUMENTS.map((d) => byDoc.get(d.key)).filter((x): x is MissingDocLine => x !== undefined)
}

/** 고객에게 그대로 보낼 서류 요청 문구 */
export function buildDocumentRequestMessage(
  record: ClientOpsRecord,
  today: string,
  serviceKeys?: ServiceKey[],
): string {
  const lines = collectMissingDocuments(record, today, serviceKeys)
  const name = record.contactName ? `${record.contactName} 대표님` : '대표님'
  if (lines.length === 0) {
    return `안녕하세요, ${name}. 현재 추가로 받을 서류는 없습니다. 진행 상황은 확인 후 다시 안내드리겠습니다.`
  }

  const purpose = (() => {
    const all = new Set(lines.flatMap((l) => l.neededFor))
    const list = [...all]
    if (list.length === 0) return '진행'
    if (list.length === 1) return list[0]
    return `${list.slice(0, -1).join(', ')} 및 ${list[list.length - 1]}`
  })()

  const body = lines
    .map((l, i) => {
      const tail = l.reason === 'expired' ? ' (기존 서류는 유효기간이 지나 새 발급본이 필요합니다)' : ''
      return `${i + 1}. ${l.label}${tail}\n   - ${l.where}`
    })
    .join('\n')

  return [
    `안녕하세요, ${name}.`,
    ``,
    `${purpose} 진행을 위해 아래 서류가 필요합니다.`,
    ``,
    body,
    ``,
    `준비되시는 대로 보내주시면 바로 진행하겠습니다. 감사합니다.`,
  ].join('\n')
}

/** 진행 상황 보고 문구 */
export function buildStatusReportMessage(record: ClientOpsRecord, today: string): string {
  const name = record.contactName ? `${record.contactName} 대표님` : '대표님'
  const rows = SERVICES.filter((s) => record.services[s.key].status !== 'not_applicable').map((s) => {
    const st = record.services[s.key]
    const due = st.dueDate ? ` (목표 ${st.dueDate}, ${dueText(daysLeftFrom(today, st.dueDate))})` : ''
    return `- ${s.label}: ${SERVICE_STATUS_LABEL[st.status]}${due}`
  })

  const nextSteps = SERVICES.filter(
    (s) => isServiceOpen(record.services[s.key].status) && record.services[s.key].nextStep.trim() !== '',
  ).map((s) => `- ${s.label}: ${record.services[s.key].nextStep}`)

  const out = [`안녕하세요, ${name}.`, ``, `${record.companyName} 진행 상황 공유드립니다.`, ``, ...rows]
  if (nextSteps.length > 0) out.push(``, `[다음 단계]`, ...nextSteps)
  out.push(``, `문의사항 있으시면 편하게 연락 주세요. 감사합니다.`)
  return out.join('\n')
}
