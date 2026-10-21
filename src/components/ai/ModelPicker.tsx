/**
 * D-253 AI 단추 옆 [모델 · ○○] — 대표: "제미나이 왜 3.1만 돼 있지? GPT 나 이런 것도 내가 선택할 수 있게 · 모델도 옆에서 고를 수 있게 버튼 하나 더".
 * AI 도우미 판의 '모델 바꾸기'(ModelRow)를 그대로 펼친다 — 고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 단추가 같이 쓴다.
 */
import { useEffect, useState } from 'react'
import { ChevronDown, Cpu } from 'lucide-react'
import { fetchAssistStatus, type AssistStatus } from '../../services/aiAssist/client'
import { CHOICE_EVENT, readChoice, saveChoice, type AiChoice } from '../../services/aiAssist/store'
import { ModelRow, labelOf } from './AiAssist'

const FALLBACK: AiChoice = { provider: 'gemini', model: 'gemini-3.1-flash-lite' }

/** 지금 고른 모델(없으면 서버 기본 · 그것도 모르면 가장 싼 Gemini) — 화면이 같이 바뀌게 알림을 듣는다 */
export function useAiChoice(): [AiChoice | null, (c: AiChoice | null) => void] {
  const [choice, setChoice] = useState<AiChoice | null>(() => readChoice())
  useEffect(() => {
    const fromEvent = (e: Event) => setChoice(((e as CustomEvent<AiChoice | null>).detail ?? null) as AiChoice | null)
    const fromStorage = () => setChoice(readChoice())
    window.addEventListener(CHOICE_EVENT, fromEvent)
    window.addEventListener('storage', fromStorage)
    return () => {
      window.removeEventListener(CHOICE_EVENT, fromEvent)
      window.removeEventListener('storage', fromStorage)
    }
  }, [])
  return [choice, (c) => {
    setChoice(c)
    saveChoice(c)
  }]
}

export function ModelPicker({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const [choice, setChoice] = useAiChoice()
  const [status, setStatus] = useState<AssistStatus | null>(null)
  const [open, setOpen] = useState(false)
  const load = async (withModels = false) => {
    try {
      const s = await fetchAssistStatus(withModels)
      setStatus(s)
      return s
    } catch {
      return null
    }
  }
  useEffect(() => {
    if (open && !status) void load()
  }, [open, status])
  const effective = choice ?? status?.defaultChoice ?? FALLBACK
  const label = labelOf(status, effective)
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`} data-testid="model-picker">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`tap t-sub inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 self-start rounded-(--radius-control) px-3 font-semibold ${tone === 'dark' ? 'bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25' : 'border border-violet-300 bg-white text-violet-900 hover:bg-violet-50'}`}
        data-testid="model-pick"
        data-model={effective.model}
      >
        <Cpu aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 truncate">모델 · {label}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="rounded-(--radius-control) bg-white text-slate-900 shadow-(--shadow-card)" data-testid="model-pick-panel">
          <ModelRow status={status} effective={effective} choice={choice} open setOpen={(v) => setOpen(v)} setChoice={(c) => setChoice(c)} loadStatus={load} />
        </div>
      )}
    </div>
  )
}
