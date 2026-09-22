/**
 * AX Partner OS 전달 패킷(partner_handoffs) 읽기 — 파트너 컨설턴트가 1차 미팅을 마치고 보낸 구조화 데이터.
 *
 * 쓰기는 Partner OS 의 RPC(partner_submit_handoff / partner_withdraw_handoff)만 한다. 이 앱은 읽고, 이벤트(customer_events)를
 * 처리(연결·처리 중·처리 완료·보류)하면 DB 트리거가 파트너 쪽 상태를 따라 올린다 — 여기서 따로 쓸 것이 없다.
 * 파트너가 철회하면 이 이벤트는 'ignored' 로 바뀌고 payload 에 withdrawn=true 가 붙는다(Partner OS 0005). 다시 전달하면 같은 이벤트가 'new' 로 다시 열린다.
 * local 모드에는 파트너 OS 가 없으므로 항상 null(READY 안내).
 * 계약 원문: miraeailab-ax-sales-os/supabase/migrations/20260922000002_partner_os_bridge.sql · docs/INTEGRATION.md
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'

export type HandoffLevel = 'low' | 'medium' | 'high'
export type HandoffEvidence = 'confirmed' | 'assumed' | 'unknown'

export interface HandoffFact {
  key: string
  label: string
  value: string
  status: HandoffEvidence
}
export interface HandoffPainPoint {
  rank: number
  area: string
  title: string
  clientSafeTitle: string
  loss: string
  axStructure: string
  status: HandoffEvidence
}
export interface PartnerHandoffPayload {
  company?: { name?: string; industry?: string; industryNote?: string; headcount?: string; tradeType?: string; interests?: string[]; representativeName?: string; phone?: string }
  consultant?: { id?: string; name?: string; email?: string }
  meetingDate?: string
  diagnosis?: { grade?: string | null; score?: number | null } | null
  answers?: { questionId: string; area: string; question: string; answer: string; answerLabel: string; source: string }[]
  keyQuotes?: string[]
  confirmedFacts?: HandoffFact[]
  assumptions?: HandoffFact[]
  unknownItems?: HandoffFact[]
  painPoints?: HandoffPainPoint[]
  recommendedAxScope?: { axNeed?: HandoffLevel; scopeLevel?: string; scopeLabel?: string; scopeReason?: string; validationPotential?: HandoffLevel; fundingReadiness?: HandoffLevel; structure?: { problem: string; loss: string; structure: string }[] }
  similarCases?: { id: string; companyName: string; whySimilar: string }[]
  valuePotential?: Record<string, HandoffLevel>
  fundingInterest?: { interested?: boolean; note?: string }
  followupQuestions?: string[]
  internalNotes?: string
  clientSafeSummary?: string[]
  usage?: { durationSec?: number | null; skipped?: number; hard?: number }
}

export interface PartnerHandoff {
  id: string
  meetingId: string
  companyId: string
  consultantId: string
  status: 'draft' | 'submitted' | 'received' | 'reviewing' | 'proposal_ready' | 'withdrawn'
  payload: PartnerHandoffPayload
  customerEventId: string | null
  operationsClientId: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export const HANDOFF_STATUS_LABEL: Record<PartnerHandoff['status'], string> = {
  draft: '전달 전',
  submitted: '전달됨',
  received: '수신',
  reviewing: '검토 중',
  proposal_ready: '2차 제안 준비 완료',
  withdrawn: '파트너가 철회함 (이벤트 보류)',
}

export const VALUE_AREA_LABEL: Record<string, string> = {
  time_saving: '업무시간 절감',
  hiring_avoidance: '추가채용 억제',
  revenue_leak: '매출누수 감소',
  throughput: '처리량 증가',
  ceo_time: '대표시간 회수',
  asset_building: '기업자산화',
  external_funding: '외부성장자금 활용',
}

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const nul = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export async function getPartnerHandoff(id: string): Promise<PartnerHandoff | null> {
  if (getDataModeConfig().mode === 'local') return null
  const { data, error } = await getSupabaseClient().from('partner_handoffs').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    id: str(r.id),
    meetingId: str(r.meeting_id),
    companyId: str(r.company_id),
    consultantId: str(r.consultant_id),
    status: (str(r.status, 'submitted') as PartnerHandoff['status']) ?? 'submitted',
    payload: (r.payload && typeof r.payload === 'object' ? (r.payload as PartnerHandoffPayload) : {}),
    customerEventId: nul(r.customer_event_id),
    operationsClientId: nul(r.operations_client_id),
    submittedAt: nul(r.submitted_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }
}

/** partner_handoffs 표가 아직 없는 환경(Partner OS 마이그레이션 미적용)인지 */
export function isHandoffNotReady(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown } | null
  const msg = [o?.message, o?.code, o?.details].filter((v) => typeof v === 'string').join(' ') || String(cause)
  return /relation .* does not exist|partner_handoffs|42P01|schema cache/i.test(msg)
}
