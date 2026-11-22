/**
 * D-623 맞는 공고 골라서 보내기 — 업체 판 안의 '다음 단계'(창을 하나 더 띄우지 않는다).
 *  ① 보낼 공고 고르기(지난번 알린 뒤 새로 올라온 것을 먼저 골라 둔다) → ② 한 줄 의견(안 적어도 된다) → ③ 문구 복사 · 보낸 기록.
 * 고르는 순서 · 문구는 services/grants/grantDigest.ts(규칙). 여기는 그리기만 한다.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, Copy, FileText } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  DIGEST_COMMENT_MAX,
  DIGEST_LIMIT,
  DIGEST_NOTE_MAX,
  defaultDigestPicks,
  type DigestCandidate,
  type DigestHistoryLine,
  type DigestItem,
  type DigestSheet,
} from '../../services/grants/grantDigest'
import { SENT_CHANNEL_LABEL } from '../../services/grants/grantStore'
import { DeadlineText, VerdictBadge } from './GrantParts'
import { GrantDigestSheetStep } from './GrantDigestSheet'

const md = (ymd: string) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '')
const FIRST = 8

export function GrantDigestStep({
  companyName,
  cands,
  lastSent,
  preview,
  onSend,
  onBack,
  sheet,
  onSheet,
}: {
  companyName: string
  cands: DigestCandidate[]
  /** 이 업체에 마지막으로 알린 날('' = 한 번도 안 알림) */
  lastSent: string
  preview: (items: readonly DigestItem[], note: string) => string
  onSend: (items: readonly DigestItem[], note: string) => Promise<boolean>
  onBack: () => void
  /** D-645 대표님께 드릴 한 장 — 없으면 단추를 그리지 않는다 */
  sheet?: (items: readonly DigestItem[], note: string) => DigestSheet
  onSheet?: (items: readonly DigestItem[], note: string) => Promise<void>
}) {
  // 처음에 골라 둔 수 — 안내 글은 이 수로 말한다(넣고 빼도 '골라 뒀어요' 숫자가 흔들리지 않게)
  const initial = useMemo(() => defaultDigestPicks(cands), [cands])
  const [picked, setPicked] = useState<string[]>(initial)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [limit, setLimit] = useState(FIRST)
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  // D-645 같은 판 안의 다음 단계 — 고른 것 · 의견 · 한마디는 그대로 두고 종이 모양만 본다
  const [paperStep, setPaperStep] = useState(false)

  const fresh = cands.filter((c) => c.bucket === 'fresh').length
  // 보내는 순서 = 목록 순서(새로 올라온 것 · 맞음 · 마감 급한 순) — 누른 순서가 아니다
  const items = useMemo<DigestItem[]>(() => cands.filter((c) => picked.includes(c.match.notice.id)).map((c) => ({ match: c.match, comment: comments[c.match.notice.id] ?? '' })), [cands, picked, comments])
  const full = picked.length >= DIGEST_LIMIT
  // 고른 것은 '더 보기' 를 누르지 않아도 보이게(골라 둔 것이 접힌 줄 아래에 숨지 않게)
  const shown = cands.filter((c, i) => i < limit || picked.includes(c.match.notice.id))
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= DIGEST_LIMIT ? prev : [...prev, id]))
  const send = async () => {
    if (busy || items.length === 0) return
    setBusy(true)
    try {
      if (await onSend(items, note)) onBack()
    } finally {
      setBusy(false)
    }
  }

  if (paperStep && sheet && items.length > 0) {
    return <GrantDigestSheetStep sheet={sheet(items, note)} onPrint={() => onSheet?.(items, note) ?? Promise.resolve()} onBack={() => setPaperStep(false)} />
  }

  return (
    <div className="flex flex-col gap-3" data-testid="grant-digest">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack} data-testid="grant-digest-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> 목록으로
        </Button>
        <h3 className="t-body font-semibold text-slate-900">골라서 보내기</h3>
      </div>
      <p className="t-sub break-keep text-slate-600">① 보낼 공고 고르기 → ② 한 줄 의견(안 적어도 돼요) → ③ 문구 복사</p>
      <p className="t-sub break-keep text-slate-700" data-testid="grant-digest-lead">
        {cands.length === 0
          ? '지금 이 업체 조건에 맞는 접수 중 공고가 없어요.'
          : !lastSent
            ? `아직 한 번도 알리지 않은 업체예요 — 맞음 먼저 · 마감 급한 순으로 ${initial.length}건을 골라 뒀어요.`
            : fresh > 0
              ? `지난번(${md(lastSent)}) 알린 뒤 새로 올라온 공고 ${fresh}건 가운데 ${initial.length}건을 골라 뒀어요.`
              : `지난번(${md(lastSent)}) 알린 뒤 새로 올라온 맞는 공고는 없어요. 다시 보내려면 아래에서 골라 주세요.`}
      </p>

      {shown.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white" data-testid="grant-digest-list">
          {shown.map((c) => {
            const id = c.match.notice.id
            const on = picked.includes(id)
            return (
              <li key={id} className="flex flex-col gap-2 px-3 py-3" data-testid="grant-digest-row" data-bucket={c.bucket} data-picked={on ? '1' : '0'}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(id)} data-testid="grant-digest-check" className="mt-1 size-5 shrink-0 cursor-pointer accent-brand-600" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-start gap-2">
                      <span className="t-body min-w-0 flex-1 break-keep font-semibold text-slate-900">{c.match.notice.title}</span>
                      <DeadlineText d={c.match.deadline} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <VerdictBadge v={c.match.verdict} />
                      {c.match.notice.amountText && <span className="t-sub text-slate-600">{c.match.notice.amountText}</span>}
                      {c.bucket === 'fresh' && lastSent && <span className="t-meta font-semibold text-brand-700">새로 올라옴</span>}
                      {c.bucket === 'sent' && <span className="t-meta text-slate-500">알림 보냄 {md(c.sentOn)}</span>}
                    </span>
                  </span>
                </label>
                {on && (
                  <input
                    type="text"
                    value={comments[id] ?? ''}
                    maxLength={DIGEST_COMMENT_MAX}
                    onChange={(e) => setComments((prev) => ({ ...prev, [id]: e.target.value }))}
                    placeholder="한 줄 의견 (안 적어도 돼요)"
                    aria-label={`${c.match.notice.title} 한 줄 의견`}
                    data-testid="grant-digest-comment"
                    className="t-sub ml-8 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {cands.length > limit && (
        <Button size="sm" variant="secondary" onClick={() => setLimit((v) => v + 20)} className="self-center" data-testid="grant-digest-more">
          더 보기 (남은 {cands.length - limit}건)
        </Button>
      )}

      {cands.length > 0 && (
        <>
          <input
            type="text"
            value={note}
            maxLength={DIGEST_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="맨 위에 넣을 한마디 (안 적어도 돼요)"
            aria-label="맨 위에 넣을 한마디"
            data-testid="grant-digest-note"
            className="t-sub rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void send()} disabled={busy || items.length === 0} data-testid="grant-digest-send">
              <Copy aria-hidden="true" className="size-4" /> 문구 복사 · 보낸 것으로 기록
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowPreview((v) => !v)} disabled={items.length === 0} aria-expanded={showPreview} data-testid="grant-digest-preview-toggle">
              {showPreview ? '미리 보기 접기' : '미리 보기'}
            </Button>
            {sheet && (
              <Button size="sm" variant="secondary" onClick={() => setPaperStep(true)} disabled={items.length === 0} data-testid="grant-digest-sheet" data-guide="fn-grant-digest-paper">
                <FileText aria-hidden="true" className="size-4" /> 대표님께 드릴 한 장
              </Button>
            )}
            <span className="t-sub text-slate-600" data-testid="grant-digest-count">
              고른 공고 {items.length}건{full ? ` · 한 통에 ${DIGEST_LIMIT}건까지` : ''}
            </span>
          </div>
          {showPreview && items.length > 0 && (
            <pre className="t-sub max-h-80 font-sans overflow-auto rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3 break-keep whitespace-pre-wrap text-slate-800" data-testid="grant-digest-preview" aria-label={`${companyName}에 보낼 글 미리 보기`}>
              {preview(items, note)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

/** 지난번 알린 날 한 줄 + 보낸 기록 펼치기 — 언제 · 어떤 길로 · 무엇을(이름 · 의견) */
export function GrantSentHistory({ history, lastSent, fresh }: { history: DigestHistoryLine[]; lastSent: string; fresh: number }) {
  const [open, setOpen] = useState(false)
  if (!lastSent || history.length === 0) return null
  return (
    <div className="flex flex-col gap-2" data-testid="grant-sent-history">
      <p className="t-sub break-keep text-slate-600" data-testid="grant-sent-last">
        지난번 알림 {md(lastSent)} —{' '}
        {fresh > 0 ? <b className="font-semibold text-brand-700">그 뒤 새로 올라온 맞는 공고 {fresh}건</b> : '그 뒤 새로 올라온 맞는 공고 없음'}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="grant-sent-toggle" className="tap ml-2 font-semibold text-brand-700 hover:underline">
          보낸 기록 {open ? '접기' : '보기'}
        </button>
      </p>
      {open && (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white" data-testid="grant-sent-list">
          {history.map((h) => {
            const named = h.items.filter((it) => it.title)
            const unnamed = h.items.length - named.length
            return (
              <li key={h.id} className="flex flex-col gap-1 px-3 py-2.5" data-testid="grant-sent-row">
                <span className="t-sub font-semibold text-slate-800">
                  {md(h.day)} · {SENT_CHANNEL_LABEL[h.channel]}
                  {h.items.length ? ` · 공고 ${h.items.length}건` : ''}
                </span>
                {h.note && <span className="t-sub break-keep text-slate-600">한마디: {h.note}</span>}
                {named.map((it) => (
                  <span key={it.id} className="t-sub break-keep text-slate-600">
                    · {it.title}
                    {it.comment ? ` — 의견: ${it.comment}` : ''}
                  </span>
                ))}
                {unnamed > 0 && <span className="t-sub text-slate-500">· 지금은 목록에 없는 공고 {unnamed}건(마감 등)</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
