/**
 * D-253 AI 단추 옆 [모델 · ○○] — 대표: "제미나이 왜 3.1만 돼 있지? GPT 나 이런 것도 내가 선택할 수 있게 · 모델도 옆에서 고를 수 있게 버튼 하나 더".
 * AI 도우미 판의 '모델 바꾸기'(ModelRow)를 그대로 펼친다 — 고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 단추가 같이 쓴다.
 */
import { useEffect, useRef, useState } from 'react'
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

/**
 * popover — 띠(AI 도우미 줄)처럼 좁은 곳에서는 판을 단추 아래에 띄운다(줄 높이가 출렁이지 않게). 바깥을 누르거나 Esc 면 닫힘.
 * testId — 같은 화면에 여럿일 때 시험이 고를 수 있게(기본 model-pick)
 */
export function ModelPicker({ className = '', tone = 'light', popover = false, testId = 'model-pick' }: { className?: string; tone?: 'light' | 'dark'; popover?: boolean; testId?: string }) {
  const [choice, setChoice] = useAiChoice()
  const [status, setStatus] = useState<AssistStatus | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || !popover) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, popover])
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
    <div ref={box} className={`${popover ? 'relative' : 'flex flex-col gap-2'} min-w-0 ${className}`} data-testid="model-picker">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`tap t-sub inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 self-start rounded-(--radius-control) px-3 font-semibold ${tone === 'dark' ? 'bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25' : 'border border-violet-300 bg-white text-violet-900 hover:bg-violet-50'}`}
        data-testid={testId}
        data-model={effective.model}
        title="AI 모델 고르기 — 고른 모델은 모든 화면의 AI 단추가 같이 씁니다"
      >
        <Cpu aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 truncate">모델 · {label}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`rounded-(--radius-control) bg-white text-slate-900 shadow-(--shadow-card) ${popover ? 'absolute right-0 z-40 mt-2 w-[min(26rem,calc(100vw-2rem))]' : ''}`} data-testid="model-pick-panel">
          <ModelRow status={status} effective={effective} choice={choice} open setOpen={(v) => setOpen(v)} setChoice={(c) => setChoice(c)} loadStatus={load} />
        </div>
      )}
    </div>
  )
}
