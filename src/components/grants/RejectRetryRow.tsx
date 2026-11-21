/**
 * D-641 떨어진 신청 — 신청 탭의 떨어진 건 아래 한 줄.
 *  · 처음엔 [떨어진 까닭 남기기] 한 줄 → 누르면 까닭 넷(고르기) · 한 줄 메모 · 다음 해 다시 도전 / 이번엔 접기 → [저장].
 *  · 적은 뒤엔 '지난번: … · 다음 회차 n월 무렵 다시 도전' 한 줄 + [고치기].
 *  · 같은 사업 공고가 다시 올라왔으면 '다시 올라왔어요 — 공고 · 마감' + [신청 준비](지난 까닭을 새 신청 건에 잇는다).
 * 다시 도전 건(retryOf)에는 '지난번 까닭 · 이번엔 이것부터' 한 줄(RetryOfLine).
 * 규칙 · 기록만(AI 0). 고객 글에는 까닭을 쓰지 않는다.
 */
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ClientOpsRecord, FundingApplication } from '../../types/clientOps'
import { REJECT_NOTE_MAX, REJECT_REASONS, expectedRetryMonth, rejectReasonText, retrySourceOf, retryTips, withRejectInfo, type RejectReason, type RetryHit } from '../../services/grants/grantRetry'
import { withGrantApplication } from '../../services/grants/grantApply'
import { nowIso } from '../../lib/appClock'
import { Button } from '../ui/Button'

const chip = (on: boolean) =>
  `tap min-h-11 rounded-full border px-3 text-[0.9375rem] font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`

export function RejectRetryRow({
  app,
  today,
  hit,
  onUpdate,
}: {
  app: FundingApplication
  today: string
  /** 같은 사업 공고가 다시 올라왔으면 */
  hit: RetryHit | null
  onUpdate: (change: (r: ClientOpsRecord) => ClientOpsRecord, message: string) => void
}) {
  const recorded = Boolean(app.rejectReasons?.length || app.rejectNote || app.retryPlan)
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<RejectReason[]>(app.rejectReasons ?? [])
  const [note, setNote] = useState(app.rejectNote ?? '')
  const [plan, setPlan] = useState<'retry' | 'skip'>(app.retryPlan ?? 'retry')
  const ym = expectedRetryMonth(app, today)
  const reasonText = rejectReasonText(app)

  const reposted = hit && (
    <div className="flex flex-wrap items-center gap-2" data-testid="retry-hit">
      <RotateCcw aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
      <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-brand-700 [overflow-wrap:anywhere]">
        다시 올라왔어요 — {hit.match.notice.title.length > 40 ? `${hit.match.notice.title.slice(0, 40)}…` : hit.match.notice.title} · {hit.match.deadline.label}
      </span>
      <Button
        size="sm"
        variant="primary"
        data-testid="retry-prepare"
        onClick={() => onUpdate((r) => withGrantApplication(r, hit.match.notice).record, '다시 도전 — 신청 준비를 만들었어요(지난 까닭을 이었어요)')}
      >
        신청 준비
      </Button>
    </div>
  )

  if (!open) {
    return (
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5" data-testid="reject-row" data-recorded={recorded ? '1' : undefined}>
        {reposted}
        {recorded ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-700 [overflow-wrap:anywhere]" data-testid="reject-summary">
              지난번: {reasonText || '까닭 안 적음'}
              {app.retryPlan === 'skip' ? ' · 다시 도전 안 함' : ym ? ` · ${Number(ym.slice(5, 7))}월 무렵 다시 도전` : ''}
            </p>
            <Button size="sm" variant="ghost" data-testid="reject-edit" onClick={() => setOpen(true)}>
              고치기
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" data-testid="reject-open" data-guide="fn-reject-retry" onClick={() => setOpen(true)}>
              떨어진 까닭 남기기
            </Button>
            <span className="t-meta break-keep text-slate-500">다음 해 같은 공고 때 먼저 챙겨요</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-2.5" data-testid="reject-form">
      {reposted}
      <div className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-700">왜 떨어졌나요? (여러 개)</span>
        <div className="flex flex-wrap gap-1.5">
          {REJECT_REASONS.map((r) => {
            const on = reasons.includes(r.key)
            return (
              <button key={r.key} type="button" aria-pressed={on} className={chip(on)} data-testid="reject-reason" data-key={r.key} onClick={() => setReasons((xs) => (on ? xs.filter((x) => x !== r.key) : [...xs, r.key]))}>
                {r.label}
              </button>
            )
          })}
        </div>
      </div>
      <label className="t-sub font-medium text-slate-600">
        한 줄 메모(평가 의견 등 · 선택)
        <input
          value={note}
          maxLength={REJECT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 발표 때 매출 근거 질문"
          aria-label="떨어진 까닭 메모"
          className="mt-1 block min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-2.5 py-2 text-[0.9375rem] focus:border-brand-500 focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="다음 해">
        <button type="button" aria-pressed={plan === 'retry'} className={chip(plan === 'retry')} data-testid="reject-plan" data-plan="retry" onClick={() => setPlan('retry')}>
          다음 해 다시 도전
        </button>
        <button type="button" aria-pressed={plan === 'skip'} className={chip(plan === 'skip')} data-testid="reject-plan" data-plan="skip" onClick={() => setPlan('skip')}>
          이번엔 접기
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          data-testid="reject-save"
          onClick={() => {
            onUpdate((r) => withRejectInfo(r, app.id, { reasons, note, retryPlan: plan }, nowIso()), plan === 'retry' ? '떨어진 까닭을 남겼어요 — 같은 공고가 다시 올라오면 알려 드려요' : '떨어진 까닭을 남겼어요 — 다시 올라와도 알리지 않아요')
            setOpen(false)
          }}
        >
          저장
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
    </div>
  )
}

/** 다시 도전 건 — 지난번 떨어진 까닭 · 이번엔 이것부터(첫 둘) */
export function RetryOfLine({ record, app }: { record: ClientOpsRecord; app: FundingApplication }) {
  const src = retrySourceOf(record, app)
  if (!src) return null
  const tips = retryTips(src).slice(0, 2)
  const why = rejectReasonText(src)
  return (
    <div className="t-sub flex flex-col gap-0.5 break-keep text-slate-700 [overflow-wrap:anywhere]" data-testid="retry-of">
      <p>
        <RotateCcw aria-hidden="true" className="mr-1 inline size-4 text-brand-700" />
        <span className="font-semibold text-brand-700">다시 도전</span> — 지난번: {why || '까닭 안 적음'}
      </p>
      {tips.map((t) => (
        <p key={t} className="text-slate-600">
          이번엔: {t}
        </p>
      ))}
    </div>
  )
}
