/**
 * D-546 첫마디 10개 — 스레드 · 릴스 · 틱톡 쓰기 칸 맨 위 '무엇에 대해 쓸까요?' 안(공용).
 *
 * 평소: 단추 한 줄 [첫마디 10개 먼저 보기]. 누르면 —
 *  ① 누구에게(칩 · 한 줄) ② 방향(골고루 · 궁금하게 · 믿음 가게 · 손해 막기 · 쉽게 알려 주기 · 마음 알아주기)
 *  → 26가지 방법 가운데 서로 다른 10개가 바로(규칙 — 누를 때마다 다시 그림, AI 아님) · [다른 방법으로 10개]
 *  → 줄마다 [복사] · [이걸로 쓰기](글 칸 첫 줄로) · 방법 이름에 마우스를 올리면 언제 좋은지 · 조심할 것
 *  → [AI로 10개 새로 쓰기](두 번 눌러 확인 · 누를 때만) — 같은 26가지를 서버 단추에 보낸다.
 * 숫자 · 기간 · 결과는 대괄호로 비워 둔다(지어내지 않기). 부풀리는 말이 있으면 줄 아래 빨간 글로.
 */
import { useMemo, useState } from 'react'
import { ClipboardCopy, MessageSquareQuote, PenLine, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { copyText } from '../../components/consulting/studioParts'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { AssistError, callAssist } from '../../services/aiAssist/client'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { todayLocalDate } from '../../lib/appClock'
import { HOOK_AIMS, HOOK_PATTERNS, defaultTarget, draftFirstLines, hookPattern, hookWarn, hooksContext, parseHookAnswer, targetChips, type HookAim, type HookChannel, type HookLine } from '../../services/marketing/hookPatterns'
import { HoverTip, TipBody } from './snsParts'
import { toneChip } from './snsTone'

const TARGET_KEY = 'axmvp.hooks.target'

function readTarget(): string {
  try {
    return localStorage.getItem(TARGET_KEY) ?? ''
  } catch {
    return ''
  }
}

export function FirstLineMaker({ testPrefix, channel, topic, facts = '', aiOk, onUse }: { testPrefix: string; channel: HookChannel; topic: string; facts?: string; aiOk: boolean; onUse: (line: string) => void }) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [target, setTargetState] = useState(readTarget)
  const [aim, setAim] = useState<HookAim | ''>('')
  const [page, setPage] = useState(0)
  const [ai, setAi] = useState<{ busy: boolean; error: string; lines: HookLine[] | null; key: string }>({ busy: false, error: '', lines: null, key: '' })
  const t = topic.trim()
  const setTarget = (v: string) => {
    setTargetState(v)
    try {
      localStorage.setItem(TARGET_KEY, v)
    } catch {
      // 기억만 못 한다
    }
  }
  const rule = useMemo(() => draftFirstLines({ topic: t, target, aim, channel, page }), [t, target, aim, channel, page])
  // AI 답은 그때의 주제 · 누구에게 · 방향에만 — 하나라도 바꾸면 규칙 첫마디로 돌아간다(지난 답을 새 주제 답처럼 보이지 않게)
  const key = `${t}|${target.trim()}|${aim}`
  const aiLines = ai.lines && ai.key === key ? ai.lines : null
  const lines = aiLines ?? rule

  const runAi = async () => {
    if (ai.busy || !t) return
    setAi({ busy: true, error: '', lines: null, key })
    try {
      const run = await callAssist({ requestId: newRequestId(), assistId: channel === 'shorts' ? 'shorts.hooks' : 'threads.hooks', page: channel, choice: readChoice(), context: hooksContext({ topic: t, target, aim, channel, facts, today: todayLocalDate() }) })
      const got = parseHookAnswer(run.structured)
      if (!got.length) throw new AssistError('provider_error', 'AI 답에서 첫마디를 찾지 못했어요 — 다시 눌러 주세요.')
      setAi({ busy: false, error: '', lines: got, key })
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error && e.message ? e.message : '다시 눌러 주세요.', lines: null, key })
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid={`${testPrefix}-hooks`} data-open="0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50"
          data-testid={`${testPrefix}-hooks-open`}
          data-guide="fn-mk-firstline"
        >
          <MessageSquareQuote aria-hidden="true" className="size-4 text-slate-500" />
          첫마디 10개 먼저 보기
        </button>
        <span className="t-sub break-keep text-slate-600">{channel === 'shorts' ? '영상 맨 앞 한마디' : '글 맨 앞 한 줄'} — 26가지 방법 가운데 10개를 바로 뽑아요</span>
      </div>
    )
  }

  return (
    <section aria-label="첫마디 10개" className="flex flex-col gap-3 border-t border-slate-200 pt-3" data-testid={`${testPrefix}-hooks`} data-open="1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="t-body flex items-center gap-1.5 font-bold text-slate-900">
            <MessageSquareQuote aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            첫마디 10개
          </h3>
          <p className="t-sub mt-0.5 break-keep text-slate-600">
            {channel === 'shorts' ? '영상 맨 앞 2초에 할 말' : '글 맨 앞 한 줄'}을 서로 다른 방법 10가지로 써 봤어요. 마음에 드는 것을 [이걸로 쓰기] 하면 {channel === 'shorts' ? '대본 첫 줄' : '글 첫 줄'}로 들어가요. [ ] 칸은 실제 숫자로 채워 주세요.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="첫마디 닫기" className="tap -mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" data-testid={`${testPrefix}-hooks-close`}>
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-800">누구에게 하는 말인가요?</span>
        <div className="flex flex-wrap gap-1.5" data-testid={`${testPrefix}-hooks-targets`}>
          {targetChips().map((c) => {
            const on = (target.trim() || defaultTarget()) === c
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setTarget(c === defaultTarget() ? '' : c)} className={toneChip('slate', on)} data-testid={`${testPrefix}-hooks-target`}>
                {c}
              </button>
            )
          })}
        </div>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value.slice(0, 30))}
          placeholder={`직접 적기 — 예: 직원 10명 넘는 제조업 대표님 (비우면 '${defaultTarget()}')`}
          aria-label="누구에게 — 직접 적기"
          className="t-body min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3"
          data-testid={`${testPrefix}-hooks-target-input`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-800">어떤 느낌으로?</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="어떤 느낌으로" data-testid={`${testPrefix}-hooks-aims`}>
          {HOOK_AIMS.map((a) => (
            <HoverTip key={a.key || 'mix'} tip={<TipBody title={a.label} body={a.hint} />}>
              <button
                type="button"
                role="radio"
                aria-checked={aim === a.key}
                onClick={() => {
                  setAim(a.key)
                  setPage(0)
                }}
                className={toneChip('slate', aim === a.key)}
                data-testid={`${testPrefix}-hooks-aim`}
                data-aim={a.key || 'mix'}
              >
                {a.label}
              </button>
            </HoverTip>
          ))}
        </div>
      </div>

      {!t ? (
        <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 break-keep text-slate-700" data-testid={`${testPrefix}-hooks-empty`}>
          위에서 주제를 먼저 적거나 고르세요 — 그 주제로 바로 10개가 나와요.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub font-semibold text-slate-800" data-testid={`${testPrefix}-hooks-kind`}>
              {aiLines ? 'AI가 쓴 첫마디' : '틀로 만든 첫마디'}
            </span>
            <span className="t-sub text-slate-600">· {lines.length}개</span>
            {aiLines ? (
              <button type="button" onClick={() => setAi({ busy: false, error: '', lines: null, key: '' })} className="tap t-sub ml-auto inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-brand-700 hover:bg-brand-50" data-testid={`${testPrefix}-hooks-back`}>
                틀로 만든 것 다시 보기
              </button>
            ) : (
              <button type="button" onClick={() => setPage((p) => p + 1)} className="tap t-sub ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid={`${testPrefix}-hooks-more`}>
                <RefreshCw aria-hidden="true" className="size-4" /> 다른 방법으로 10개
              </button>
            )}
          </div>
          <ol className="flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200 bg-white" data-testid={`${testPrefix}-hooks-list`}>
            {lines.map((l, i) => {
              const h = l.no ? hookPattern(l.no) : undefined
              const warn = hookWarn(l.line)
              return (
                <li key={`${l.no}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5" data-testid={`${testPrefix}-hook`} data-no={l.no}>
                  <span aria-hidden="true" className="t-sub w-5 shrink-0 text-right font-bold text-slate-500 tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="t-body font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid={`${testPrefix}-hook-line`}>
                      {l.line}
                    </p>
                    <HoverTip tip={<TipBody title={l.name} body={[h?.when ?? l.when, h?.caution ?? ''].filter(Boolean).join(' — ')} />}>
                      <span className="t-sub mt-0.5 inline-block break-keep text-slate-600 underline decoration-slate-300 decoration-dotted underline-offset-4" data-testid={`${testPrefix}-hook-name`}>
                        {l.name}
                        {aiLines && l.when ? ` · ${l.when}` : ''}
                      </span>
                    </HoverTip>
                    {warn && (
                      <p className="t-sub mt-0.5 break-keep text-danger-700" data-testid={`${testPrefix}-hook-warn`}>
                        {warn}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void copyText(l.line).then((ok) => showToast(ok ? '첫마디를 복사했어요.' : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.'))}
                      aria-label={`${i + 1}번 첫마디 복사`}
                      className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50"
                      data-testid={`${testPrefix}-hook-copy`}
                    >
                      <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => onUse(l.line)}
                      aria-label={`${i + 1}번 첫마디로 쓰기`}
                      className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-brand-600 bg-white px-3 font-semibold text-brand-700 hover:bg-brand-50"
                      data-testid={`${testPrefix}-hook-use`}
                    >
                      <PenLine aria-hidden="true" className="size-4" /> 이걸로 쓰기
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
          {aiOk && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-(--radius-control) bg-violet-50 px-3 py-2" data-testid={`${testPrefix}-hooks-ai`}>
              <Sparkles aria-hidden="true" className="size-4 shrink-0 text-violet-700" />
              <span className="t-sub min-w-0 flex-1 basis-48 break-keep text-violet-950">
                {ai.busy ? 'AI가 10개를 새로 쓰는 중이에요(10~30초).' : '틀이 아쉬우면 — 같은 26가지 방법으로 AI가 이 주제에 맞게 새로 써요(누를 때만).'}
              </span>
              {!ai.busy && <ModelPicker popover />}
              <AiConfirm>
                <Button size="sm" variant={aiLines ? 'secondary' : 'primary'} onClick={() => void runAi()} disabled={ai.busy} data-testid={`${testPrefix}-hooks-ai-run`}>
                  <Sparkles aria-hidden="true" className="size-4" /> {ai.busy ? '쓰는 중…' : aiLines ? 'AI로 다시 10개' : 'AI로 10개 새로 쓰기'}
                </Button>
              </AiConfirm>
              {ai.error && (
                <p role="alert" className="t-sub basis-full break-keep text-danger-700" data-testid={`${testPrefix}-hooks-ai-error`}>
                  {ai.error}
                </p>
              )}
            </div>
          )}
          <details className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-0.5" data-testid={`${testPrefix}-hooks-all`}>
            <summary className="t-sub flex min-h-11 cursor-pointer items-center font-semibold text-slate-800">26가지 방법 모두 보기</summary>
            <ol className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
              {HOOK_PATTERNS.map((h) => (
                <li key={h.no} className="min-w-0 break-keep" data-testid={`${testPrefix}-hooks-all-item`}>
                  <span className="t-sub font-bold text-slate-900">
                    {h.no}. {h.name}
                  </span>
                  <span className="t-sub text-slate-600"> — {h.when}</span>
                  <span className="t-sub mt-0.5 block text-slate-800 [overflow-wrap:anywhere]">{channel === 'shorts' ? h.short(t, target.trim() || defaultTarget()) : h.line(t, target.trim() || defaultTarget())}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  )
}
