/**
 * MUX-2 주제 하나 → 바로 쓰기 — 스레드 · 릴스 · 틱톡 쓰기 칸 맨 위(공용).
 * 대표 "60대도 설명 없이 · 주제 하나만 골라도 초안까지 · 형식은 우선 추천 · 다른 안 · 고급 설정은 보조".
 *
 *  ① 무엇에 대해? — 이번 주 키워드(콘텐츠 레이더) · 우리 분야 주제 칩, 또는 한 줄 쓰기
 *  ② 추천 형식 한 줄(규칙 계산) — [형식 바꾸기] 는 아래 '형식 직접 고르기' 를 연다
 *  ③ 주 단추 하나 [AI로 완성 글 쓰기] — 1안은 글 칸에 바로, 다른 안은 이 아래(AI 는 누를 때만 · 한 번에 한 번)
 * D-558 대표 "고르고 요청 한 줄 달고 한 번 누르면 바로 올려도 되는 글이 나와야" — 형식 줄 아래 '더 바라는 점' 한 줄 ·
 *   '잘 된 남의 글' 을 이 상자 안으로(예전엔 형식 고르기 맨 아래 4번에 숨어 있었다).
 * D-602 대표(2026-11-12) "박스가 너무 많아 눈에 안 들어온다 — 큰 박스 안에 가로선으로 나누든지 줄글 느낌으로 ·
 *   우리 분야 주제는 영업 관리 › 전략 키워드로 · 이번 주 키워드는 좋지만 접어 두기" —
 *   상자 하나 안에서 칸마다 가로선(안쪽 테두리 상자 0) · 우리 분야(전략 키워드) 8개 먼저 + [n개 더] · 이번 주 키워드는 접힌 한 줄.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, Flame, Pin, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HintTip } from '../../components/ui/fold'
import type { TopicChip } from '../../services/marketing/quickStart'
import { StepTitle } from './snsParts'
import { toneChip } from './snsTone'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { ModelPicker } from '../../components/ai/ModelPicker'

/** D-602 우리 분야 주제 칩 — 처음에 보이는 수(PC 8 · 휴대폰 4 · 나머지는 [전부 n개 보기]) */
const OURS_SHOWN = 8
const OURS_SHOWN_PHONE = 4

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
  hooks,
  request,
  reference,
  more,
}: {
  /** D-558 요청 한 줄(선택) — AI 에 [자료 · 요청] 으로 */
  request?: { value: string; onChange: (v: string) => void; placeholder: string }
  /** D-558 잘 된 남의 글(선택 · 저장 안 함) — 상자 안에 보이게 */
  reference?: ReactNode
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
  /** D-546 첫마디 10개(평소 단추 한 줄 · 누르면 펼침) — 상자 맨 끝 */
  hooks?: ReactNode
  /** D-602 더 정하기(이것만 지키면 돼요 · 내 맞춤) — 같은 상자 맨 아래 접힌 줄(따로 상자 0) */
  more?: ReactNode
}) {
  const week = chips.filter((c) => c.from === 'week')
  const ours = chips.filter((c) => c.from === 'ours')
  const has = !!topic.trim()
  // D-602 우리 분야(영업 관리 › 전략 키워드)는 앞 8개만 — 고른 주제가 뒤쪽이면 처음부터 다 보인다
  const pickedAt = ours.findIndex((c) => c.topic === topic)
  const pickedLate = pickedAt >= OURS_SHOWN
  const [allOurs, setAllOurs] = useState(false)
  const oursShown = allOurs || pickedLate ? ours : ours.slice(0, OURS_SHOWN)
  // D-602 이번 주 키워드는 접힌 한 줄 — 고른 주제가 이번 주 키워드면 펼친 채로
  const [weekOpen, setWeekOpen] = useState(false)
  const weekPicked = week.some((c) => c.topic === topic)
  const chip = (c: TopicChip, tone: 'rose' | 'indigo', phoneHide = false) => (
    <button key={c.topic} type="button" aria-pressed={topic === c.topic} onClick={() => onPick(c.topic)} title={c.label ? c.topic : undefined} className={`${toneChip(tone, topic === c.topic)} ${phoneHide ? 'max-sm:hidden' : ''}`} data-testid={`${testPrefix}-qs-chip`} data-from={c.from}>
      {c.label ?? c.topic}
    </button>
  )
  // 칸 사이 가로선(안쪽 상자 대신) — 대표 "줄글 느낌 · 큰 박스 안에 가로선"
  const row = 'border-t border-slate-100 pt-3'
  return (
    <div data-testid={`${testPrefix}-qs`}>
      {/* D-299 카드(Surface)는 넘치는 것을 자른다 — [모델 · ○○] 고르는 판 · ? 설명이 잘려서 자르지 않는 상자로 */}
      <div className="relative flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid={`${testPrefix}-qs-box`}>
        <StepTitle n="1">무엇에 대해 쓸까요?</StepTitle>
        {top}
        <input
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder="주제를 적거나 아래에서 고르세요"
          aria-label="무엇에 대해 쓸까요"
          className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3"
          data-testid={`${testPrefix}-qs-topic`}
        />
        {ours.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid={`${testPrefix}-qs-ours`}>
            <HintTip tip="영업 관리 › 전략에 모아 둔 상담 주제예요(정관 · 가지급금 · 정책자금 …). 고객이 실제로 묻는 것이라 글감으로 좋아요. 매주 바뀌지 않아요." label="우리 분야 주제" tight>
              <span className="t-sub flex min-w-0 flex-wrap items-center gap-x-1.5 font-semibold text-slate-800" data-testid={`${testPrefix}-qs-ours-label`}>
                <Pin aria-hidden="true" className="size-4 shrink-0 text-indigo-600" />
                우리 분야 주제
                <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">늘 그대로예요</span>
              </span>
            </HintTip>
            <div className="flex flex-wrap gap-1.5">
              {/* 휴대폰은 이름이 길어 한 줄에 하나씩 — 앞 4개만(고른 주제는 늘 보임) */}
              {oursShown.map((c, i) => chip(c, 'indigo', !allOurs && i >= OURS_SHOWN_PHONE && i !== pickedAt))}
              {ours.length > OURS_SHOWN_PHONE && !pickedLate && (
                <button type="button" onClick={() => setAllOurs((v) => !v)} aria-expanded={allOurs} className={`tap t-sub inline-flex min-h-9 items-center gap-1 rounded-full px-3 font-semibold text-brand-700 hover:bg-slate-50 ${ours.length > OURS_SHOWN ? '' : 'sm:hidden'}`} data-testid={`${testPrefix}-qs-ours-more`}>
                  {allOurs ? '접기' : `전부 ${ours.length}개 보기`}
                  <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${allOurs ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}
        {week.length > 0 && (
          // D-602 이번 주 키워드 — 좋지만 늘 펼쳐 둘 것은 아니다(대표) → 접힌 한 줄 · 누르면 칩
          <details open={weekOpen || weekPicked} onToggle={(e) => setWeekOpen((e.currentTarget as HTMLDetailsElement).open)} data-testid={`${testPrefix}-qs-week`}>
            <summary className="sum-chev tap t-sub flex min-h-9 cursor-pointer flex-wrap items-center gap-x-1.5 font-semibold text-slate-800" data-testid={`${testPrefix}-qs-week-open`}>
              <Flame aria-hidden="true" className="size-4 shrink-0 text-rose-600" />
              <span data-testid={`${testPrefix}-qs-week-label`}>이번 주 키워드 {week.length}개</span>
              <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">매주 바뀌어요</span>
              <span className="t-meta font-normal text-slate-600">— 유튜브에서 이번 주에 뜨는 주제</span>
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{week.map((c) => chip(c, 'rose'))}</div>
          </details>
        )}
        {/* D-298 추천 형식 줄 — 형식 이름에 마우스를 올리면(휴대폰은 ?) 무슨 뜻인지 · 예시. D-602 상자 대신 가로선 */}
        <div className={`flex flex-wrap items-center gap-2 ${row}`} data-testid={`${testPrefix}-qs-rec`}>
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
        {request && (
          <label className="flex flex-col gap-1" data-testid={`${testPrefix}-qs-request-box`}>
            <span className="t-sub font-semibold text-slate-800">
              더 바라는 점 <span className="font-normal text-slate-600">(선택 — 한 줄이면 돼요)</span>
            </span>
            <input
              value={request.value}
              onChange={(e) => request.onChange(e.target.value)}
              maxLength={200}
              placeholder={request.placeholder}
              className="t-body min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3"
              data-testid={`${testPrefix}-qs-request`}
            />
          </label>
        )}
        {(reference || facts) && (
          // D-602 잘 된 남의 글 · 사실 목록 — 접힌 줄 둘(상자 없이 가로선만)
          <div className={`flex flex-col gap-1 ${row}`}>
            {reference}
            {facts}
          </div>
        )}
        <div className={`flex flex-col gap-2 ${row}`}>
          <div className="flex flex-wrap items-center gap-2">
            {ai.ok && (
              <AiConfirm><Button variant="primary" onClick={ai.onRun} disabled={ai.busy || !has} className="w-full sm:w-auto" data-testid={`${testPrefix}-qs-ai`} data-guide={testPrefix === 'sht' ? 'fn-mk-script' : 'fn-mk-write'}>
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
            {has ? (ai.ok ? '한 번 누르면 바로 올려도 되는 완성 글(1안)이 아래 글 칸에 들어가요 — 다른 안은 이 아래에 남겨 둬요. 올리기 전 규칙 검사를 한 번 봐요.' : '추천 형식의 뼈대를 글 칸에 넣어요 — 대괄호 [ ] 를 사실로 채우면 돼요.') : '주제를 고르면 바로 쓸 수 있어요.'}
          </p>
          {ai.error && (
            <p role="alert" className="t-sub break-keep text-danger-700" data-testid={`${testPrefix}-qs-error`}>
              {ai.error}
            </p>
          )}
          {children}
        </div>
        {hooks}
        {more && <div className={`flex flex-col gap-1 ${row}`}>{more}</div>}
      </div>
    </div>
  )
}
