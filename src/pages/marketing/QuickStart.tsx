/**
 * MUX-2 주제 하나 → 바로 쓰기 — 스레드 · 릴스 · 틱톡 쓰기 칸 맨 위(공용).
 * 대표 "60대도 설명 없이 · 주제 하나만 골라도 초안까지 · 형식은 우선 추천 · 다른 안 · 고급 설정은 보조".
 *
 *  ① 무엇에 대해? — 이번 주 키워드(콘텐츠 레이더) · 우리 분야 주제 칩, 또는 한 줄 쓰기
 *  ② 추천 형식 한 줄(규칙 계산) — [형식 바꾸기] 는 아래 '형식 직접 고르기' 를 연다
 *  ③ 주 단추 하나 [AI로 바로 쓰기] — 1안은 글 칸에 바로, 다른 안은 이 아래(AI 는 누를 때만 · 한 번에 한 번)
 */
import type { ReactNode } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/primitives'
import type { TopicChip } from '../../services/marketing/quickStart'
import { StepTitle, chip } from './snsParts'
import { AiConfirm } from '../../components/ai/AiConfirm'

export function QuickStart({
  testPrefix,
  topic,
  onTopic,
  onPick,
  chips,
  recLabel,
  recWhy,
  picked,
  onChangeFormat,
  top,
  facts,
  ai,
  fallback,
  children,
}: {
  testPrefix: string
  topic: string
  /** 손으로 고친 주제(형식은 그대로) */
  onTopic: (t: string) => void
  /** 칩으로 고른 주제(추천 형식을 새로 맞춘다) */
  onPick: (t: string) => void
  chips: readonly TopicChip[]
  /** 추천(또는 직접 고른) 형식 이름 */
  recLabel: string
  recWhy: string
  /** 사람이 직접 고른 형식이면 true — '고른 형식' 으로 보인다 */
  picked: boolean
  onChangeFormat: () => void
  /** 주제 위(릴스 · 틱톡: 어디에 올려요) */
  top?: ReactNode
  /** 사실 목록 · 더 쓸 사실(접힘) */
  facts?: ReactNode
  ai: { ok: boolean; busy: boolean; error: string; label: string; onRun: () => void }
  /** AI 를 못 쓸 때 · 기다리기 싫을 때(규칙 · 예시) */
  fallback?: { label: string; onClick: () => void }
  /** AI 가 쓴 다른 안 */
  children?: ReactNode
}) {
  const week = chips.filter((c) => c.from === 'week')
  const ours = chips.filter((c) => c.from === 'ours')
  const has = !!topic.trim()
  const chipRow = (list: readonly TopicChip[], label: string, id: string) =>
    list.length > 0 && (
      <div className="flex flex-col gap-1.5" data-testid={`${testPrefix}-qs-${id}`}>
        <span className="t-sub font-semibold text-slate-700">{label}</span>
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => (
            <button key={c.topic} type="button" aria-pressed={topic === c.topic} onClick={() => onPick(c.topic)} title={c.label ? c.topic : undefined} className={chip(topic === c.topic)} data-testid={`${testPrefix}-qs-chip`} data-from={c.from}>
              {c.label ?? c.topic}
            </button>
          ))}
        </div>
      </div>
    )
  return (
    <div data-testid={`${testPrefix}-qs`}>
      <Surface className="flex flex-col gap-3 border-2 border-slate-900">
        <StepTitle n="1">무엇에 대해 쓸까요?</StepTitle>
        {top}
        <input
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder="주제를 아래에서 누르거나 한 줄로 적어요"
          aria-label="무엇에 대해 쓸까요"
          className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3"
          data-testid={`${testPrefix}-qs-topic`}
        />
        {chipRow(week, '이번 주 키워드(콘텐츠 레이더)', 'week')}
        {chipRow(ours, '우리 분야 주제', 'ours')}
        <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/60 px-3 py-2.5" data-testid={`${testPrefix}-qs-rec`}>
          <p className="t-sub min-w-[12rem] flex-1 break-keep text-slate-800">
            <b className="text-slate-900">{picked ? '고른 형식' : '추천 형식'}</b> · <span data-testid={`${testPrefix}-qs-rec-label`}>{recLabel}</span>
            {!picked && recWhy && <span className="block text-slate-600">{recWhy}</span>}
          </p>
          <Button size="sm" variant="ghost" onClick={onChangeFormat} data-testid={`${testPrefix}-qs-change`}>
            형식 바꾸기
          </Button>
        </div>
        {facts}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ai.ok && (
              <AiConfirm><Button variant="primary" onClick={ai.onRun} disabled={ai.busy || !has} className="w-full sm:w-auto" data-testid={`${testPrefix}-qs-ai`}>
                <Sparkles aria-hidden="true" className="size-4" /> {ai.busy ? 'AI가 쓰는 중…' : ai.label}
              </Button></AiConfirm>
            )}
            {fallback && (
              <Button variant={ai.ok ? 'ghost' : 'primary'} onClick={fallback.onClick} disabled={!has} className={ai.ok ? '' : 'w-full sm:w-auto'} data-testid={`${testPrefix}-qs-rule`}>
                <Wand2 aria-hidden="true" className="size-4" /> {fallback.label}
              </Button>
            )}
          </div>
          <p className="t-sub break-keep text-slate-600" data-testid={`${testPrefix}-qs-note`}>
            {has ? (ai.ok ? '1안은 아래 글 칸에 바로 넣어요 — 다른 안은 이 아래에 남겨 둬요. 올리기 전 규칙 검사를 꼭 봐요.' : '추천 형식의 뼈대를 글 칸에 넣어요 — 대괄호 [ ] 를 사실로 채우면 돼요.') : '주제를 고르면 바로 쓸 수 있어요.'}
          </p>
          {ai.error && (
            <p role="alert" className="t-sub break-keep text-danger-700" data-testid={`${testPrefix}-qs-error`}>
              {ai.error}
            </p>
          )}
          {children}
        </div>
      </Surface>
    </div>
  )
}
