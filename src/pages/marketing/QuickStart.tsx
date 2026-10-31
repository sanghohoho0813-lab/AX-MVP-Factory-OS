/**
 * MUX-2 주제 하나 → 바로 쓰기 — 스레드 · 릴스 · 틱톡 쓰기 칸 맨 위(공용).
 * 대표 "60대도 설명 없이 · 주제 하나만 골라도 초안까지 · 형식은 우선 추천 · 다른 안 · 고급 설정은 보조".
 *
 *  ① 무엇에 대해? — 이번 주 키워드(콘텐츠 레이더) · 우리 분야 주제 칩, 또는 한 줄 쓰기
 *  ② 추천 형식 한 줄(규칙 계산) — [형식 바꾸기] 는 아래 '형식 직접 고르기' 를 연다
 *  ③ 주 단추 하나 [AI로 바로 쓰기] — 1안은 글 칸에 바로, 다른 안은 이 아래(AI 는 누를 때만 · 한 번에 한 번)
 */
import type { ReactNode } from 'react'
import { Flame, Pin, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HintTip } from '../../components/ui/fold'
import type { TopicChip } from '../../services/marketing/quickStart'
import { StepTitle } from './snsParts'
import { toneChip } from './snsTone'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { ModelPicker } from '../../components/ai/ModelPicker'

export function QuickStart({
  testPrefix,
  topic,
  onTopic,
  onPick,
  chips,
  recLabel,
  recWhy,
  recTip,
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
  /** D-298 추천 형식이 무슨 뜻인지(쉽게 말하면 · 예시) — 마우스를 올리거나 ? 를 누르면 */
  recTip?: string
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
  // D-298 대표 "우리 분야 주제도 늘 고정인지 바뀌는 건지 모르겠다" — 이름 옆에 '매주 바뀌어요' / '늘 그대로예요' + 색(이번 주 = 빨강 계열 · 우리 분야 = 남색)
  const chipRow = (list: readonly TopicChip[], id: 'week' | 'ours') => {
    if (!list.length) return null
    const week = id === 'week'
    const Icon = week ? Flame : Pin
    const tone = week ? 'rose' : 'indigo'
    return (
      <div className="flex flex-col gap-1.5" data-testid={`${testPrefix}-qs-${id}`}>
        <HintTip
          tip={week ? '콘텐츠 레이더가 유튜브에서 이번 주에 뜨는 주제를 골라 둔 거예요. 월요일마다 새로 바뀌어요.' : '우리 회사가 꾸준히 이야기할 주제예요. 매주 바뀌지 않고 늘 같은 자리에 있어요.'}
          label={week ? '이번 주 키워드' : '우리 분야 주제'}
          tight
        >
          <span className="t-sub flex min-w-0 flex-wrap items-center gap-x-1.5 font-semibold text-slate-800" data-testid={`${testPrefix}-qs-${id}-label`}>
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${week ? 'text-rose-600' : 'text-indigo-600'}`} />
            {week ? '이번 주 키워드' : '우리 분야 주제'}
            <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${week ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-700'}`}>{week ? '매주 바뀌어요' : '늘 그대로예요'}</span>
          </span>
        </HintTip>
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => (
            <button key={c.topic} type="button" aria-pressed={topic === c.topic} onClick={() => onPick(c.topic)} title={c.label ? c.topic : undefined} className={toneChip(tone, topic === c.topic)} data-testid={`${testPrefix}-qs-chip`} data-from={c.from}>
              {c.label ?? c.topic}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div data-testid={`${testPrefix}-qs`}>
      {/* D-299 카드(Surface)는 넘치는 것을 자른다 — [모델 · ○○] 고르는 판 · ? 설명이 잘려서 자르지 않는 상자로 */}
      <div className="relative flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid={`${testPrefix}-qs-box`}>
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
        {chipRow(week, 'week')}
        {chipRow(ours, 'ours')}
        {/* D-298 추천 형식 줄 — 보라 테두리 · '추천 형식' 딱지 · 형식 이름에 마우스를 올리면(휴대폰은 ?) 무슨 뜻인지 · 예시 */}
        <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid={`${testPrefix}-qs-rec`}>
          <div className="t-sub min-w-[12rem] flex-1 break-keep text-slate-800">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <b className="t-meta shrink-0 font-bold text-brand-700">{picked ? '고른 형식' : '추천 형식'}</b>
              <HintTip tip={recTip} label="추천 형식" tight className="min-w-0">
                <span className="min-w-0 font-bold text-slate-900" data-testid={`${testPrefix}-qs-rec-label`}>
                  {recLabel}
                </span>
              </HintTip>
            </div>
            {!picked && recWhy && <span className="mt-0.5 block text-slate-600">{recWhy}</span>}
          </div>
          <button type="button" onClick={onChangeFormat} className="tap t-sub inline-flex h-10 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50" data-testid={`${testPrefix}-qs-change`}>
            <SlidersHorizontal aria-hidden="true" className="size-4" /> 형식 바꾸기
          </button>
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
            {/* D-299 대표 "마케팅 · 브랜딩 어디서든 모델을 골라 요청" — AI 단추 바로 옆에서 모델 고르기(고른 모델은 모든 화면 AI 단추가 같이 씀) */}
            {ai.ok && <ModelPicker popover className="sm:ml-auto" testId={`${testPrefix}-qs-model`} />}
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
      </div>
    </div>
  )
}
