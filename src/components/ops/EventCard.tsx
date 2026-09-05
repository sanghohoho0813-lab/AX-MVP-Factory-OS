import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronDown, ChevronUp, Link2, Plus, RotateCcw } from 'lucide-react'
import type { CustomerEvent, CustomerEventStatus } from '../../types/bridge'
import {
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  eventSummary,
  isOpenEvent,
} from '../../services/customerBridgeService'
import { activityTimeText } from '../../services/clientOpsActivity'
import { Badge, type Tone } from '../ui/primitives'
import { suggestServiceForProduct } from '../../config/serviceCatalog'

/**
 * 상태 색 — 분류색(cat-*)을 쓰지 않는다. 이벤트함은 '새로 왔다/처리했다' 두 가지가
 * 핵심이라 나머지는 전부 무채색으로 둔다.
 */
const STATUS_TONE: Record<CustomerEventStatus, Tone> = {
  new: 'brand',
  linked: 'neutral',
  in_progress: 'neutral',
  resolved: 'success',
  ignored: 'neutral',
}

/** payload 키 → 사람이 읽는 이름 (고객이 제출한 값만 표시) */
const FIELD_LABEL: Record<string, string> = {
  company_name: '회사명',
  company: '회사명',
  representative_name: '대표자',
  buyer_name: '구매자',
  name: '이름',
  phone: '연락처',
  buyer_phone: '연락처',
  contact: '연락처',
  email: '이메일',
  buyer_email: '이메일',
  industry: '업종',
  business_type: '사업자 형태',
  lead_grade: '진단 등급',
  contact_method: '희망 연락 방법',
  preferred_contact_time: '희망 연락 시간',
  order_number: '주문번호',
  product_slug: '상품',
  option_id: '옵션',
  status: '주문 상태',
  program: '진행 방식',
  message: '문의 내용',
  request_type: '요청 종류',
  title: '제목',
  body: '내용',
  document_type: '서류 종류',
  file_name: '파일',
  source: '유입 경로',
}

/**
 * 고객 이벤트 한 장 — 누가·무엇을·언제·연결된 고객·다음 행동.
 * 연결 전에는 [고객사와 연결] [새 고객사로 만들기], 연결 후에는 [처리 중] [처리 완료]로 좁힌다.
 */
export function EventCard({
  event,
  clientName,
  onLink,
  onCreateClient,
  onStatus,
  compact = false,
}: {
  event: CustomerEvent
  clientName: string | null
  onLink: () => void
  onCreateClient: () => void
  onStatus: (status: CustomerEventStatus) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const s = eventSummary(event)
  const isDemo = event.payload.demo === true
  const suggestion =
    event.eventType === 'service_order_created' && typeof event.payload.product_slug === 'string'
      ? suggestServiceForProduct(event.payload.product_slug)
      : null
  const fields = Object.entries(event.payload).filter(([k, v]) => k !== 'demo' && k !== 'intake' && typeof v === 'string' && v !== '')

  return (
    <article
      className={`relative overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {event.status === 'new' && isOpenEvent(event) && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[3px] ${event.priority === 'high' ? 'bg-danger-500' : 'bg-brand-500'}`}
        />
      )}
      {/* 머리줄 — 배지는 최대 두 개. 급한 것과 처리 상태만 남긴다 */}
      <div className="t-meta flex flex-wrap items-center gap-1.5">
        {event.priority === 'high' && isOpenEvent(event) && <Badge tone="danger">지금</Badge>}
        <span className="font-medium text-slate-500">{EVENT_TYPE_LABEL[event.eventType]}</span>
        {event.status !== 'new' && <Badge tone={STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>}
        {isDemo && <Badge tone="neutral">샘플</Badge>}
        <span className="ml-auto text-slate-400">
          <time dateTime={event.occurredAt}>{activityTimeText(event.occurredAt)}</time>
        </span>
      </div>

      <p className="t-card mt-1.5 break-keep [overflow-wrap:anywhere] text-slate-900">{s.who}</p>
      <p className="t-sub break-keep [overflow-wrap:anywhere] text-slate-600">{s.what}</p>

      <div className="t-sub mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {event.operationsClientId ? (
          <Link
            to={`/ops/clients/${event.operationsClientId}`}
            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
          >
            <Building2 aria-hidden="true" className="size-3.5" />
            {clientName ?? '연결된 고객사'} 열기
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Link2 aria-hidden="true" className="size-3.5" /> 아직 고객사와 연결되지 않음
          </span>
        )}
        {suggestion && <span className="text-slate-500">· 추천: {suggestion.shortLabel}</span>}
      </div>

      {!compact && fields.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[0.85rem] font-medium text-slate-500 hover:text-slate-800"
          >
            {open ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            고객이 제출한 내용 {fields.length}개
          </button>
          {open && (
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-(--radius-control) bg-slate-50 p-3 text-[0.9rem] sm:grid-cols-2">
              {fields.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">{FIELD_LABEL[k] ?? k}</dt>
                  <dd className="min-w-0 break-all text-slate-800">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {event.handlingNote && (
        <p className="mt-2 rounded-(--radius-control) bg-slate-50 px-3 py-2 text-[0.88rem] text-slate-600">처리 메모 · {event.handlingNote}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {isOpenEvent(event) ? (
          <>
            {!event.operationsClientId && (
              <>
                <button type="button" onClick={onLink} className="tap t-sub inline-flex h-11 items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700 sm:h-10">
                  <Link2 aria-hidden="true" className="size-4" /> 고객사와 연결
                </button>
                <button type="button" onClick={onCreateClient} className="tap t-sub inline-flex h-11 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 font-medium text-slate-700 hover:bg-slate-50 sm:h-10">
                  <Plus aria-hidden="true" className="size-4" /> 새 고객사로 만들기
                </button>
              </>
            )}
            {event.operationsClientId && event.status !== 'in_progress' && (
              <button type="button" onClick={() => onStatus('in_progress')} className="tap t-sub inline-flex h-11 items-center rounded-(--radius-control) border border-slate-200 px-3 font-medium text-slate-700 hover:bg-slate-50 sm:h-10">
                확인 · 처리 중
              </button>
            )}
            {event.operationsClientId && (
              <button type="button" onClick={() => onStatus('resolved')} className="tap t-sub inline-flex h-11 items-center rounded-(--radius-control) border border-brand-600 bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700 sm:h-10">
                처리 완료
              </button>
            )}
            <button type="button" onClick={() => onStatus('ignored')} className="tap t-sub inline-flex h-11 items-center rounded-(--radius-control) px-3 font-medium text-slate-500 hover:bg-slate-100 sm:h-10">
              보류
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onStatus(event.operationsClientId ? 'in_progress' : 'new')} className="tap t-sub inline-flex h-11 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 font-medium text-slate-700 hover:bg-slate-50 sm:h-10">
            <RotateCcw aria-hidden="true" className="size-4" /> 다시 열기
          </button>
        )}
      </div>
    </article>
  )
}
