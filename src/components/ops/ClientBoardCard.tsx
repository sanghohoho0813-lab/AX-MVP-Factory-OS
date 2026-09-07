/**
 * 고객 목록 한 장 — 표를 대신한다.
 *
 * 왜 표를 버렸나
 *   업무가 6개일 때도 데스크톱 표는 가로로 900px 를 넘겨 옆으로 밀어야 했다.
 *   앞으로 15개까지 늘 수 있으니 표를 유지하면 밀어야 하는 거리만 길어진다.
 *   대신 업무를 작은 조각(chip)으로 만들어 줄바꿈시킨다. 6개면 한 줄, 15개면
 *   세 줄이 되고 가로로는 절대 넘치지 않는다. 휴대폰과 데스크톱이 같은 부품을
 *   쓰므로 한쪽만 어긋나는 일도 없다.
 *
 * 여기서 바로 할 수 있는 것
 *   업무 조각을 누르면 상태를 그 자리에서 바꾼다 (업체 안으로 안 들어가도 된다).
 *   미수금을 누르면 수금 항목을 그 자리에서 고친다.
 *   둘 다 실제 업체 기록에 그대로 저장된다 — 화면용 사본이 아니다.
 */

import { ArrowRight, ChevronRight } from 'lucide-react'
import { CONTRACT_STAGE_LABEL, contractStageOf } from '../../types/clientOps'
import type { ClientOpsRecord, ServiceKey, ServiceStatus } from '../../types/clientOps'
import { SERVICES, SERVICE_STATUS_LABEL, isServiceOpen } from '../../content/clientOpsCatalog'
import { clientOpsProgress, daysLeftFrom, dueText, missingDocumentsFor } from '../../services/clientOpsAlerts'
import { yearsInBusiness, regionOf } from '../../services/clientOpsProfile'
import { formatKrw } from '../../lib/format'
import { Badge, type Tone } from '../ui/primitives'

/* ------------------------------------------------------------------ */
/* 업무 조각                                                            */
/* ------------------------------------------------------------------ */

export interface ChipState {
  key: ServiceKey
  label: string
  status: ServiceStatus
  /** 마감 지남 */
  overdue: boolean
  /** 7일 이내 마감 */
  dueSoon: boolean
  /** 필요 서류가 없어 막힘 */
  blocked: boolean
  daysLeft: number | null
}

export function chipStateFor(
  record: ClientOpsRecord,
  key: ServiceKey,
  label: string,
  today: string,
  dueSoonDays: number,
): ChipState {
  const st = record.services[key]
  const open = isServiceOpen(st.status)
  const left = st.dueDate ? daysLeftFrom(today, st.dueDate) : null
  return {
    key,
    label,
    status: st.status,
    overdue: open && left !== null && left < 0,
    dueSoon: open && left !== null && left >= 0 && left <= dueSoonDays,
    blocked: (st.status === 'in_progress' || st.status === 'waiting_client') && missingDocumentsFor(record, key, today).length > 0,
    daysLeft: left,
  }
}

/** 상태별 점 색 — 색은 시간과 상태만 말한다 */
const DOT: Record<ServiceStatus, string> = {
  done: 'bg-success-500',
  in_progress: 'bg-brand-500',
  waiting_client: 'bg-warning-500',
  on_hold: 'bg-slate-400',
  not_started: 'bg-slate-300',
  not_applicable: 'bg-slate-300',
}

const SHORT: Record<ServiceStatus, string> = {
  done: '완료',
  in_progress: '진행',
  waiting_client: '대기',
  on_hold: '보류',
  not_started: '시작 전',
  not_applicable: '해당 없음',
}

function ServiceChip({ chip, onClick }: { chip: ChipState; onClick: () => void }) {
  const na = chip.status === 'not_applicable'
  const danger = !na && (chip.overdue || chip.blocked)
  const warn = !na && !danger && chip.dueSoon

  // 해당 없음은 가로선으로 지운 것처럼 — 있지만 세지 않는 항목이라는 뜻
  const look = na
    ? 'border-slate-200 bg-white text-slate-400 line-through decoration-slate-300'
    : danger
      ? 'border-danger-200 bg-danger-50 text-danger-700'
      : warn
        ? 'border-warning-200 bg-warning-50 text-warning-800'
        : chip.status === 'done'
          ? 'border-success-200 bg-success-50/60 text-success-800'
          : 'border-slate-200 bg-white text-slate-700'

  // '시작 전' 은 굳이 쓰지 않는다 — 아무 표시 없는 회색 조각이 곧 시작 전이다.
  // 조각이 15개까지 늘어날 것이라 글자 하나가 줄 수를 바꾼다.
  const note = chip.blocked
    ? '서류 없음'
    : chip.overdue || chip.dueSoon
      ? dueText(chip.daysLeft)
      : chip.status === 'not_started'
        ? ''
        : SHORT[chip.status]

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${chip.label} · ${SERVICE_STATUS_LABEL[chip.status]} — 눌러서 상태 바꾸기`}
      className={`tap inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.85rem] font-medium hover:border-brand-300 ${look}`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full no-underline ${DOT[chip.status]}`} />
      <span className="whitespace-nowrap">{chip.label}</span>
      {note !== '' && <span className={`whitespace-nowrap ${na ? '' : 'opacity-70'}`}>{note}</span>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 한 장                                                           */
/* ------------------------------------------------------------------ */

const CARD_FILL: Record<Tone, string> = {
  danger: 'border-danger-200 bg-danger-50/50',
  warning: 'border-warning-200 bg-warning-50/50',
  success: 'border-slate-200 bg-white',
  neutral: 'border-slate-200 bg-white',
  brand: 'border-brand-200 bg-brand-50/50',
}

const CARD_EDGE: Record<Tone, string> = {
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  success: 'bg-success-400',
  neutral: 'bg-slate-300',
  brand: 'bg-brand-500',
}

export function ClientBoardCard({
  record,
  today,
  dueSoonDays,
  tone,
  criticalCount,
  warningCount,
  onOpen,
  onChip,
  onMoney,
}: {
  record: ClientOpsRecord
  today: string
  dueSoonDays: number
  tone: Tone
  criticalCount: number
  warningCount: number
  onOpen: () => void
  onChip: (key: ServiceKey) => void
  onMoney: () => void
}) {
  const p = clientOpsProgress(record, today)
  const chips = SERVICES.map((s) => chipStateFor(record, s.key, s.shortLabel, today, dueSoonDays))
  const dLeft = record.nextActionDueDate ? daysLeftFrom(today, record.nextActionDueDate) : null
  const stage = contractStageOf(record.status)

  const y = yearsInBusiness(record.establishedAt, today)
  const region = regionOf(record.businessAddress)
  const repName = record.representativeName.trim() || record.contactName.trim()
  // 한 줄 요약 — 복사해서 쓰는 값(사업자번호)과 상담에서 바로 쓰는 값만
  // 계약 단계는 이름 옆이 아니라 이 줄에 둔다 — 이름 옆에 두면 좁은 폭에서 이름을 밀어낸다.
  // '계약 완료' 는 보통 상태라 굳이 쓰지 않는다(써 봐야 모든 카드에 붙는다).
  const meta = [
    stage === 'signed' ? '' : CONTRACT_STAGE_LABEL[stage],
    record.businessNumber,
    y ? `${y.nthYear}년차` : record.establishedAt,
    repName,
    region,
    record.businessCategory || record.industry,
  ].filter((v) => v && v.trim() !== '')

  return (
    <li className={`relative overflow-hidden rounded-(--radius-panel) border ${CARD_FILL[tone]}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${CARD_EDGE[tone]}`} />

      <div className="flex flex-col gap-2 p-3.5 pl-[1.15rem] sm:p-4 sm:pl-[1.15rem]">
        {/* 이름 줄 */}
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left">
            <span className="t-card truncate text-slate-900 hover:text-brand-700 hover:underline">
              {record.companyName || '(이름 없음)'}
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {criticalCount > 0 ? (
              <Badge tone={tone}>지금 {criticalCount}</Badge>
            ) : warningCount > 0 ? (
              <Badge tone={tone === 'neutral' ? 'warning' : tone}>곧 {warningCount}</Badge>
            ) : (
              <Badge tone="success">이상 없음</Badge>
            )}
            <span className="t-meta whitespace-nowrap text-slate-500">진행 {p.percent}%</span>
          </div>
        </div>

        {/* 회사 요약 — 사업자번호 · 업력 · 대표자 · 지역 · 업종 */}
        {meta.length > 0 && (
          <p className="t-meta flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
            {meta.map((m, i) => (
              <span key={`${m}-${i}`} className="whitespace-nowrap">
                {i > 0 && <span aria-hidden="true" className="mr-2 text-slate-300">·</span>}
                {m}
              </span>
            ))}
          </p>
        )}

        {/* 다음 할 일 */}
        <p className="t-sub break-keep text-slate-700">
          {record.nextAction || <span className="text-slate-400">다음 할 일이 정해지지 않았습니다</span>}
          {record.nextActionDueDate && (
            <span className={dLeft !== null && dLeft < 0 ? 'font-semibold text-danger-700' : 'text-slate-500'}>
              {' · '}
              {record.nextActionDueDate}
              {dLeft !== null && ` ${dueText(dLeft)}`}
            </span>
          )}
        </p>

        {/* 업무 조각 — 줄바꿈된다. 가로로 밀 일이 없다 */}
        <ul className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <li key={c.key}>
              <ServiceChip chip={c} onClick={() => onChip(c.key)} />
            </li>
          ))}
        </ul>

        {/* 돈·서류 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMoney}
            className={`tap inline-flex items-center gap-1.5 rounded-(--radius-control) border px-2.5 py-1.5 text-[0.88rem] font-medium hover:border-brand-300 ${
              p.overduePayments > 0
                ? 'border-danger-200 bg-danger-50 text-danger-700'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            미수금 {p.unpaidAmount > 0 ? formatKrw(p.unpaidAmount) : '없음'}
            {p.overduePayments > 0 && ` · 예정일 지남 ${p.overduePayments}`}
          </button>
          <span className="t-meta rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600">
            서류 {p.documentsUsable}/{p.documentsTotal}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="tap t-meta ml-auto inline-flex items-center gap-1 rounded-(--radius-control) px-2 py-1.5 font-medium text-brand-700 hover:underline"
          >
            업체 열기
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}
