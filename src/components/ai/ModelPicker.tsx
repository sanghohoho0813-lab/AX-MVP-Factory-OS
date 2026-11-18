/**
 * D-253 AI 단추 옆 [모델 · ○○] — 대표: "제미나이 왜 3.1만 돼 있지? GPT 나 이런 것도 내가 선택할 수 있게 · 모델도 옆에서 고를 수 있게 버튼 하나 더".
 * AI 도우미 판의 '모델 바꾸기'(ModelRow)를 그대로 펼친다 — 고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 단추가 같이 쓴다.
 * D-629 대표: "단순 질문에 비싼 모델을 쓸 이유가 없다 · 모델도 실시간으로 바꿀 수 있게" — 고른 모델이 없으면 [모델 · 자동]
 *   (물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델). 판 맨 위에서 자동 · [가장 싼 모델] · [좋은 모델] 을 한 번에 고르고, 바로 다음 질문부터 쓰인다.
 *   팀장 · 구독 고객처럼 올려 쓸 좋은 모델이 없는 계정은 예전 그대로 그 모델 이름만 보인다.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Cpu } from 'lucide-react'
import { fetchAssistStatus, peekAssistStatus, type AssistStatus } from '../../services/aiAssist/client'
import { CHOICE_EVENT, readChoice, saveChoice, type AiChoice } from '../../services/aiAssist/store'
import { ModelRow, labelOf } from './AiAssist'
import { useCustomerAudience } from '../../config/customerAudience'
import { autoPlanFor, showsAuto, useModelPickShown } from '../../lib/modelPickPref'

const FALLBACK: AiChoice = { provider: 'gemini', model: 'gemini-3.1-flash-lite' }

/**
 * 지금 직접 고른 모델 — 화면이 같이 바뀌게 알림을 듣는다.
 * D-629 null 이면 자동(대표 화면: 물음은 가장 싼 모델 · 일은 좋은 모델 / 팀장 · 고객 화면: 서버 기본 = 가장 싼 모델). setChoice(null) = 자동으로.
 */
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
  // D-629 다른 AI 단추 · 방금 보낸 질문이 받아 둔 서버 모델 목록이 있으면 그것부터(단추 글이 처음부터 맞게)
  const [status, setStatus] = useState<AssistStatus | null>(() => peekAssistStatus())
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
  // D-629 고른 모델이 없고 올려 쓸 좋은 모델이 있는 계정 → '자동'. 그 밖(팀장 · 고객 · 모델 하나)은 예전처럼 그 모델 이름
  const auto = !choice && showsAuto(status)
  // 자동일 때 단추가 가리키는 모델은 물음에 쓰는 가장 싼 모델(예전 기본과 같다)
  const effective = choice ?? (auto ? autoPlanFor(status)?.light : null) ?? status?.defaultChoice ?? FALLBACK
  const label = auto ? '자동' : labelOf(status, effective)
  // D-570 구독 고객 화면은 기본으로 숨긴다(AI 는 기본 모델로 그대로) — 설정 › 계정 · 보기에서 [보이기] 를 고르면 나온다
  const customer = useCustomerAudience()
  const shown = useModelPickShown()
  if (customer && !shown) return null
  return (
    <div ref={box} className={`${popover ? 'relative' : 'flex flex-col gap-2'} min-w-0 ${className}`} data-testid="model-picker">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`tap t-sub inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 self-start rounded-(--radius-control) px-3 font-semibold ${tone === 'dark' ? 'bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25' : 'border border-violet-300 bg-white text-violet-900 hover:bg-violet-50'}`}
        data-testid={testId}
        data-model={effective.model}
        data-mode={auto ? 'auto' : 'manual'}
        title={auto ? 'AI 모델 고르기 — 지금은 자동: 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델' : 'AI 모델 고르기 — 고른 모델은 모든 화면의 AI 단추가 같이 씁니다'}
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
