/**
 * 신청 건의 다음 단계 한 줄 (D-152) — 접수했어요 → 결과(선정 · 탈락) → 성공보수 수금에 걸기.
 * 상태 고르기 칸(FundingSection)은 그대로 두고, 자주 하는 다음 걸음만 단추로 꺼내 놓는다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Copy, Megaphone, Send, Wallet, XCircle } from 'lucide-react'
import type { ClientOpsRecord, FundingApplication } from '../../types/clientOps'
import { applyNews, applyStage, successFeeAmount, withApplyExecuted, withApplyResult, withApplySubmitted, withResultDueDate, withSuccessFee, type ApplyNewsKind } from '../../services/grants/grantApply'
import { withFunding } from '../../services/clientOpsService'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { daysLeftFrom, dueText } from '../../services/clientOpsAlerts'
import { formatKrwCompact as formatKrw, wonOf } from '../../lib/format'
import { Button } from '../ui/Button'

const inputCls = 'min-h-11 rounded-(--radius-control) border border-slate-300 px-2.5 py-2 text-[0.95rem] focus:border-brand-500 focus:outline-none'
const RATES = [5, 10, 15]
const md = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

export function ApplyStageBar({
  record,
  app,
  today,
  onUpdate,
  feesHref,
  publish,
}: {
  /** D-153: 고객 플랫폼 소식 올리기(연결된 업체만) */
  publish?: ((title: string, body: string, result: boolean) => Promise<void>) | null
  record: ClientOpsRecord
  app: FundingApplication
  today: string
  /** 최신 기록 위에서 바꾼다(다른 칸을 고치는 중이어도 덮지 않게) */
  onUpdate: (change: (r: ClientOpsRecord) => ClientOpsRecord, message: string) => void
  feesHref: string
}) {
  const stage = applyStage(app)
  const [resultDue, setResultDue] = useState(app.resultDueDate ?? '')
  const [amount, setAmount] = useState(app.approvedAmount ? app.approvedAmount.toLocaleString('ko-KR') : '')
  const [rate, setRate] = useState<number | null>(10)
  const [feeText, setFeeText] = useState('')

  if (stage === 'preparing') {
    return (
      <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2.5" data-testid="apply-stage" data-stage="preparing">
        <label className="t-sub font-medium text-slate-600">
          결과 발표 예정일(알면)
          <input type="date" value={resultDue} onChange={(e) => setResultDue(e.target.value)} className={`mt-1 block ${inputCls}`} aria-label="결과 발표 예정일" />
        </label>
        <Button size="sm" variant="secondary" onClick={() => onUpdate((r) => withApplySubmitted(r, app.id, resultDue), `${app.programName || '신청'} — 접수로 바꿨습니다`)} data-testid="apply-submitted">
          <Send aria-hidden="true" className="size-4" /> 접수했어요
        </Button>
      </div>
    )
  }

  if (stage === 'waiting') {
    const left = app.resultDueDate ? daysLeftFrom(today, app.resultDueDate) : null
    const won = wonOf(amount) ?? 0
    return (
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5" data-testid="apply-stage" data-stage="waiting">
        <p className="t-sub text-slate-700" data-testid="apply-waiting">
          접수 {md(app.submittedAt)} · 결과 발표 {app.resultDueDate ? `${md(app.resultDueDate)} (${dueText(left)})` : '날짜 모름'}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="t-sub font-medium text-slate-600">
            결과 발표 예정일
            <input
              type="date"
              value={resultDue}
              onChange={(e) => {
                setResultDue(e.target.value)
                onUpdate((r) => withResultDueDate(r, app.id, e.target.value), '결과 발표 예정일을 고쳤습니다')
              }}
              className={`mt-1 block ${inputCls}`}
              aria-label="결과 발표 예정일 고치기"
            />
          </label>
          <label className="t-sub font-medium text-slate-600">
            선정 금액(알면)
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 3천만" className={`mt-1 block w-36 ${inputCls}`} aria-label="선정 금액" />
          </label>
          <Button size="sm" variant="primary" onClick={() => onUpdate((r) => withApplyResult(r, app.id, 'selected', won > 0 ? won : null), `${app.programName || '신청'} — 선정!`)} data-testid="apply-selected">
            <CheckCircle2 aria-hidden="true" className="size-4" /> 선정됐어요
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onUpdate((r) => withApplyResult(r, app.id, 'rejected'), `${app.programName || '신청'} — 탈락으로 적었습니다`)} data-testid="apply-rejected">
            <XCircle aria-hidden="true" className="size-4" /> 탈락
          </Button>
        </div>
        <NewsRow record={record} app={app} kind="submitted" publish={publish} onUpdate={onUpdate} />
      </div>
    )
  }

  if (stage === 'selected') {
    const fee = app.successFeeId ? record.fees.find((f) => f.id === app.successFeeId) : undefined
    if (fee) {
      return (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5" data-testid="apply-stage" data-stage="fee-set">
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub font-semibold text-success-700">
              선정 {app.resultAt ? md(app.resultAt) : ''} · 성공보수 {fee.amount ? formatKrw(fee.amount) : '금액 미정'} {fee.receivedAt ? '받음' : fee.conditionMetAt ? '— 지금 받을 돈' : '수금에 걸림(지원금 입금 뒤)'}
            </span>
            <Link to={feesHref} className="tap t-sub inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline">
              수금 보기 <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ExecutedRow app={app} today={today} onUpdate={onUpdate} />
          <NewsRow record={record} app={app} kind="selected" publish={publish} onUpdate={onUpdate} />
        </div>
      )
    }
    const approved = wonOf(amount) ?? 0
    const byRate = rate ? successFeeAmount(approved > 0 ? approved : null, rate) : null
    const typed = wonOf(feeText) ?? 0
    const feeAmount = typed > 0 ? typed : byRate
    return (
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5" data-testid="apply-stage" data-stage="selected">
        <p className="t-sub font-semibold text-success-700">선정됐어요{app.resultAt ? ` (${md(app.resultAt)})` : ''} — 성공보수를 수금에 걸어 두세요</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="t-sub font-medium text-slate-600">
            선정 금액
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 3천만" className={`mt-1 block w-36 ${inputCls}`} aria-label="선정 금액(성공보수 계산)" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="t-sub font-medium text-slate-600">요율</span>
            <div className="flex gap-1">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRate(r)
                    setFeeText('')
                  }}
                  aria-pressed={rate === r && !feeText}
                  className={`tap min-h-11 min-w-12 rounded-(--radius-control) border px-2 text-[0.95rem] font-semibold ${rate === r && !feeText ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
          <label className="t-sub font-medium text-slate-600">
            성공보수(직접)
            <input inputMode="numeric" value={feeText} onChange={(e) => setFeeText(e.target.value)} placeholder={byRate ? byRate.toLocaleString('ko-KR') : '예: 300만'} className={`mt-1 block w-36 ${inputCls}`} aria-label="성공보수 금액" />
          </label>
          <Button
            size="sm"
            variant="primary"
            disabled={!feeAmount}
            data-testid="apply-fee"
            onClick={() =>
              onUpdate((r) => {
                const withAmount = approved > 0 && approved !== app.approvedAmount ? withApplyResult(r, app.id, 'selected', approved) : r
                return withSuccessFee(withAmount, app.id, feeAmount ?? 0, typed > 0 ? null : rate).record
              }, `성공보수 ${feeAmount ? formatKrw(feeAmount) : ''}을 수금에 걸었습니다 — 협약 · 입금 뒤 받을 돈`)
            }
          >
            {feeAmount ? `${formatKrw(feeAmount)} 수금에 걸기` : '금액을 적어 주세요'}
          </Button>
        </div>
        <NewsRow record={record} app={app} kind="selected" publish={publish} onUpdate={onUpdate} />
      </div>
    )
  }
  if (app.status === 'rejected' && (app.docs || app.noticeId)) {
    return (
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-2.5" data-testid="apply-stage" data-stage="rejected">
        <NewsRow record={record} app={app} kind="rejected" publish={publish} onUpdate={onUpdate} />
      </div>
    )
  }
  return null
}

/** D-153: 고객에게 알리기 — 카톡 문구 복사 · 고객 플랫폼에 연결돼 있으면 고객 화면 소식(한 번만) */
function NewsRow({ record, app, kind, publish, onUpdate }: { record: ClientOpsRecord; app: FundingApplication; kind: ApplyNewsKind; publish?: ((title: string, body: string, result: boolean) => Promise<void>) | null; onUpdate: (change: (r: ClientOpsRecord) => ClientOpsRecord, message: string) => void }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const news = applyNews(record, app, kind)
  const posted = app.newsPosted?.includes(kind) ?? false
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="apply-news" data-kind={kind}>
      <span className="t-sub font-medium text-slate-600">고객에게 알리기</span>
      <Button
        size="sm"
        variant="secondary"
        data-testid="apply-news-copy"
        onClick={async () => showToast((await copyText(news.kakao)) ? '고객에게 보낼 카톡 문구를 복사했습니다' : '복사하지 못했습니다')}
      >
        <Copy aria-hidden="true" className="size-4" /> 카톡 문구
      </Button>
      {publish &&
        (posted ? (
          <span className="t-sub font-semibold text-success-700" data-testid="apply-news-posted">고객 화면에 올림</span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            data-testid="apply-news-post"
            onClick={async () => {
              setBusy(true)
              try {
                await publish(news.title, news.body, kind !== 'submitted')
                onUpdate((r) => withFunding(r, app.id, { newsPosted: [...(r.fundingApplications.find((a) => a.id === app.id)?.newsPosted ?? []), kind] }), '고객 화면에 소식을 올렸습니다')
              } catch (cause) {
                showToast(cause instanceof Error ? cause.message : '올리지 못했습니다')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Megaphone aria-hidden="true" className="size-4" /> 고객 화면에 소식 올리기
          </Button>
        ))}
    </div>
  )
}

/** D-153: 지원금이 실제로 들어왔다 — 성공보수가 걸려 있으면 '지금 받을 돈' 이 된다 */
function ExecutedRow({ app, today, onUpdate }: { app: FundingApplication; today: string; onUpdate: (change: (r: ClientOpsRecord) => ClientOpsRecord, message: string) => void }) {
  const [amount, setAmount] = useState(app.approvedAmount ? app.approvedAmount.toLocaleString('ko-KR') : '')
  const [date, setDate] = useState(today)
  if (app.executedAmount) {
    return (
      <p className="t-sub font-semibold text-slate-700" data-testid="apply-executed">
        <Wallet aria-hidden="true" className="mr-1 inline size-4 text-success-600" />
        지원금 입금 {md(app.executedAt)} · {formatKrw(app.executedAmount)}
      </p>
    )
  }
  const won = wonOf(amount) ?? 0
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="t-sub font-medium text-slate-600">
        지원금 실제 입금액
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={`mt-1 block w-36 ${inputCls}`} aria-label="지원금 실제 입금액" />
      </label>
      <label className="t-sub font-medium text-slate-600">
        입금일
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 block ${inputCls}`} aria-label="지원금 입금일" />
      </label>
      <Button
        size="sm"
        variant="secondary"
        disabled={!(won > 0) || !date}
        data-testid="apply-executed-save"
        onClick={() =>
          onUpdate((r) => withApplyExecuted(r, app.id, won, date).record, app.successFeeId ? '지원금 입금 — 성공보수가 지금 받을 돈이 됐습니다' : '지원금 입금을 적었습니다')
        }
      >
        <Wallet aria-hidden="true" className="size-4" /> 입금됐어요
      </Button>
    </div>
  )
}
