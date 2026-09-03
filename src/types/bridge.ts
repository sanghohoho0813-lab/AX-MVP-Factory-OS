/**
 * 고객 플랫폼 ↔ 내부 OS 브릿지 도메인 타입.
 *
 * 테이블(supabase/migrations/20260903000006_customer_bridge.sql)과 1:1 로 맞춘다.
 * 고객에게 보이는 값과 내부 전용 값이 한 레코드에 섞여 있으므로,
 * 고객 화면은 이 타입을 쓰지 않고 portal_* RPC 의 투영 결과만 쓴다.
 */
import type { CustomerStage } from '../config/serviceCatalog'

/* ------------------------------------------------------------------ */
/* 연결                                                                  */
/* ------------------------------------------------------------------ */

export type PortalLinkStatus = 'active' | 'paused' | 'revoked'

export interface PortalClientLink {
  id: string
  workspaceId: string | null
  operationsClientId: string
  profileId: string
  organizationId: string | null
  primaryProjectId: string | null
  status: PortalLinkStatus
  customerStage: CustomerStage
  displayName: string
  consultantName: string
  linkedAt: string
  createdAt: string
  updatedAt: string
  /** 화면 표시용 — 연결된 고객 계정의 이메일·이름(profiles 조회 결과) */
  profileEmail: string
  profileName: string
}

/* ------------------------------------------------------------------ */
/* 고객 이벤트                                                            */
/* ------------------------------------------------------------------ */

export type CustomerEventType =
  | 'diagnosis_completed'
  | 'consultation_requested'
  | 'service_order_created'
  | 'document_uploaded'
  | 'customer_request_created'
  | 'customer_action_completed'
  | 'customer_reply'
  | 'profile_updated'

export type CustomerEventStatus = 'new' | 'linked' | 'in_progress' | 'resolved' | 'ignored'
export type CustomerEventPriority = 'high' | 'medium' | 'low'

export interface CustomerEvent {
  id: string
  workspaceId: string | null
  portalClientLinkId: string | null
  /** 계정 연결 없이 "어느 고객사 건인지"만 먼저 정한 경우 */
  operationsClientId: string | null
  profileId: string | null
  eventType: CustomerEventType
  sourceType: string
  sourceId: string
  dedupeKey: string
  payloadVersion: number
  /** 고객이 직접 제출한 값만 (회사명·이름·연락처·상품 등) */
  payload: Record<string, unknown>
  priority: CustomerEventPriority
  status: CustomerEventStatus
  occurredAt: string
  receivedAt: string
  handledAt: string | null
  handlingNote: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 고객에게 공개하는 업데이트                                             */
/* ------------------------------------------------------------------ */

export type PortalUpdateCategory = 'progress' | 'document_request' | 'result' | 'notice' | 'question'
export type PortalUpdateStatus = 'draft' | 'published' | 'archived'

export interface PortalUpdate {
  id: string
  workspaceId: string | null
  portalClientLinkId: string
  projectId: string | null
  category: PortalUpdateCategory
  title: string
  body: string
  status: PortalUpdateStatus
  customerActionRequired: boolean
  customerActionLabel: string
  dueDate: string
  customerCompletedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 고객 요청                                                              */
/* ------------------------------------------------------------------ */

export type PortalRequestType = 'document' | 'schedule' | 'status' | 'consultation' | 'info_change' | 'other'
export type PortalRequestStatus = 'open' | 'answered' | 'resolved' | 'closed'

export interface PortalRequest {
  id: string
  workspaceId: string | null
  portalClientLinkId: string
  projectId: string | null
  requestType: PortalRequestType
  title: string
  body: string
  status: PortalRequestStatus
  /** 고객에게 보이는 답변 */
  answer: string
  createdAt: string
  answeredAt: string | null
  resolvedAt: string | null
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 공유 서류                                                              */
/* ------------------------------------------------------------------ */

export type PortalDocumentSource = 'customer' | 'internal'
export type PortalDocumentVisibility = 'internal_only' | 'customer_uploaded' | 'shared_with_customer'
export type PortalDocumentStatus = 'requested' | 'uploaded' | 'verified' | 'rejected'

export interface PortalDocument {
  id: string
  workspaceId: string | null
  portalClientLinkId: string
  projectId: string | null
  operationsClientId: string
  documentType: string
  title: string
  storagePath: string
  fileName: string
  fileSize: number | null
  mimeType: string
  source: PortalDocumentSource
  visibility: PortalDocumentVisibility
  status: PortalDocumentStatus
  customerNote: string
  internalNote: string
  requestedAt: string | null
  uploadedAt: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 업무 일기                                                              */
/* ------------------------------------------------------------------ */

export type JournalEntryType = 'note' | 'call' | 'decision' | 'follow_up' | 'blocker' | 'win' | 'idea'

export interface JournalEntry {
  id: string
  workspaceId: string | null
  ownerId: string | null
  /** YYYY-MM-DD */
  entryDate: string
  entryType: JournalEntryType
  content: string
  clientId: string | null
  projectId: string | null
  serviceKey: string | null
  /** 후속조치 기한 YYYY-MM-DD ('' 이면 없음) */
  dueDate: string
  pinned: boolean
  completed: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 고객 화면 투영 (portal_project / portal_preview_project 의 결과) — 고객이 보는 것과 동일 */
export interface PortalProjection {
  project: {
    link_id: string
    name: string
    company_name: string
    stage: CustomerStage
    status: PortalLinkStatus
    consultant_name: string | null
    updated_at: string
  } | null
  updates: {
    id: string
    category: PortalUpdateCategory
    title: string
    body: string
    action_required: boolean
    action_label: string | null
    due_date: string | null
    completed_at: string | null
    published_at: string
  }[]
  documents: {
    id: string
    document_type: string
    title: string
    status: PortalDocumentStatus
    visibility: PortalDocumentVisibility
    file_name: string | null
    storage_path: string | null
    customer_note: string | null
    requested_at: string | null
    uploaded_at: string | null
    verified_at: string | null
  }[]
  requests: {
    id: string
    request_type: PortalRequestType
    title: string
    body: string
    status: PortalRequestStatus
    answer: string | null
    created_at: string
    answered_at: string | null
  }[]
}
