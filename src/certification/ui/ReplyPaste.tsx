/**
 * D-252 대표님 답장 한 번에 넣기 — 질문마다 [답 적기] 를 하나씩 누르던 것을, 카톡 답장을 통째로 붙여 넣으면 질문마다 나눠 담는다.
 *   [나눠 보기]      번호(1. 2) ①) → 질문 / 번호가 없어도 줄 수가 같으면 순서대로(규칙 · AI 아님)
 *   [AI로 나눠 보기] 대표 화면에서만 — 번호 없이 섞여 온 답장을 cert.reply 로
 * 저장 전에 '무엇이 어느 질문으로 가는지' 를 보여 주고, 빼고 싶은 것은 체크를 끈다.
 */
import { useState } from 'react'
import { ClipboardPaste, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { assistOn, useAiAssistAccess } from '../../auth/ownerAiAccess'
import { AssistError, assistMessage, callAssist } from '../../services/aiAssist/client'
import { answerOf } from '../../services/aiAssist/looseJson'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { replyPicksOfAi, splitReply, type ReplyAsk, type ReplyHow, type ReplyPick } from '../core/replySplit'
import { buildReplyContext } from '../integration/certAi'

export function ReplyPaste({
  asks,
  certLabel,
  today,
  onSave,
  testId = 'reply',
}: {
  asks: readonly ReplyAsk[]
  certLabel: string
  today: string
  onSave: (picks: { key: string; text: string }[]) => Promise<void>
  testId?: string
}) {
  const { showToast } = useToast()
  const ai = useAiAssistAccess()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [picks, setPicks] = useState<ReplyPick[] | null>(null)
  const [how, setHow] = useState<ReplyHow | null>(null)
  const [leftover, setLeftover] = useState('')
  const [off, setOff] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'' | 'ai' | 'save'>('')
  const [err, setErr] = useState('')

  if (!asks.length) return null

  const reset = (p: ReplyPick[] | null, h: ReplyHow | null, rest = '') => {
    setPicks(p)
    setHow(h)
    setLeftover(rest)
    setOff(new Set())
    setErr('')
  }
  const split = () => {
    const r = splitReply(text, asks)
    reset(r.picks, r.how, r.leftover)
  }
  const splitAi = async () => {
    setBusy('ai')
    setErr('')
    try {
      const run = await callAssist({ requestId: newRequestId(), assistId: 'cert.reply', page: 'cert', choice: readChoice(), context: buildReplyContext({ asks, reply: text, certLabel, today }) })
      const p = replyPicksOfAi(answerOf(run)?.items ?? [], asks)
      reset(p, 'ai')
      if (!p.length) setErr('AI 도 답을 찾지 못했어요 — 답장이 맞는지 봐 주세요')
    } catch (e) {
      setErr(e instanceof AssistError ? e.message || assistMessage(e.code) : 'AI 에 묻지 못했어요 — 잠시 뒤 다시 눌러 주세요')
    } finally {
      setBusy('')
    }
  }
  const chosen = (picks ?? []).filter((p) => !off.has(p.key))
  const save = async () => {
    if (!chosen.length) return
    setBusy('save')
    try {
      await onSave(chosen.map((p) => ({ key: p.key, text: p.answer })))
      showToast(`대표님 답 ${chosen.length}개를 넣었습니다 — 실사 답 가이드에 '대표 답' 근거로 들어갑니다`)
      setText('')
      reset(null, null)
      setOpen(false)
    } catch (e) {
      showToast(`저장하지 못했습니다: ${e instanceof Error && e.message ? e.message : '연결을 확인하세요'} — 붙여 넣은 글은 그대로 있어요`)
    } finally {
      setBusy('')
    }
  }

  if (!open)
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)} data-testid={`${testId}-open`}>
        <ClipboardPaste aria-hidden="true" className="size-4" /> 대표님 답장 붙여 넣기 — 질문마다 알아서 나눠 넣어요
      </Button>
    )

  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/50 px-3 py-3" data-testid={testId}>
      <p className="t-sub break-keep text-slate-800">
        <b className="font-semibold">대표님 카톡 답장을 통째로 붙여 넣으세요.</b> 번호(1. 2.)대로 답하셨으면 질문마다 나눠 담고, 저장 전에 어디로 가는지 보여 드려요.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (picks) reset(null, null)
        }}
        rows={4}
        className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2"
        placeholder={'예)\n1. 네 맞습니다\n2. 연구 인력은 2명이에요'}
        aria-label="대표님 답장"
        data-testid={`${testId}-text`}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={!text.trim() || !!busy} onClick={split} data-testid={`${testId}-split`}>
          나눠 보기
        </Button>
        {assistOn(ai) && (
          <Button size="sm" variant="secondary" disabled={!text.trim() || !!busy} onClick={() => void splitAi()} data-testid={`${testId}-ai`}>
            <Sparkles aria-hidden="true" className="size-4" /> {busy === 'ai' ? 'AI 가 나누는 중…' : 'AI로 나눠 보기'}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
      {err && (
        <p role="alert" className="t-sub break-keep text-danger-700" data-testid={`${testId}-error`}>
          {err}
        </p>
      )}
      {picks && picks.length === 0 && !err && (
        <p className="t-sub break-keep rounded-(--radius-control) bg-warning-50 px-3 py-2 text-warning-900" data-testid={`${testId}-none`}>
          번호가 없어 나누지 못했어요 — {assistOn(ai) ? '[AI로 나눠 보기] 를 누르거나 ' : ''}답장 줄 앞에 번호(1. 2.)를 붙여 다시 눌러 주세요.
        </p>
      )}
      {picks && picks.length > 0 && (
        <div className="flex flex-col gap-2" data-testid={`${testId}-result`} data-how={how ?? ''}>
          {how === 'order' && <p className="t-meta break-keep font-semibold text-warning-800">번호가 없어 줄 순서대로 나눴어요 — 맞는지 한 번 봐 주세요.</p>}
          {how === 'ai' && <p className="t-meta break-keep text-slate-600">AI 가 나눈 것 — 대표님 말만 옮겼는지 한 번 봐 주세요.</p>}
          <ul className="flex flex-col gap-1.5">
            {picks.map((p) => (
              <li key={p.key} className="flex items-start gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid={`${testId}-pick`} data-key={p.key}>
                <input
                  type="checkbox"
                  checked={!off.has(p.key)}
                  onChange={() => setOff((cur) => (cur.has(p.key) ? new Set([...cur].filter((k) => k !== p.key)) : new Set([...cur, p.key])))}
                  className="mt-1 size-5 shrink-0"
                  aria-label={`${p.question} — 넣기`}
                />
                <span className="min-w-0 flex-1">
                  <span className="t-meta block break-keep text-slate-500">{p.question}</span>
                  <span className="t-sub block font-semibold break-keep text-slate-900">{p.answer}</span>
                </span>
              </li>
            ))}
          </ul>
          {picks.length < asks.length && <p className="t-meta break-keep text-slate-600">답이 없는 질문 {asks.length - picks.length}개는 그대로 남겨 둡니다.</p>}
          {leftover.trim() && <p className="t-meta break-keep text-slate-500">어느 질문에도 안 들어간 글: {leftover.trim().slice(0, 140)}</p>}
          <Button size="sm" variant="primary" className="self-start" disabled={!chosen.length || !!busy} onClick={() => void save()} data-testid={`${testId}-save`}>
            {busy === 'save' ? '넣는 중…' : `${chosen.length}개 넣기`}
          </Button>
        </div>
      )}
    </div>
  )
}
