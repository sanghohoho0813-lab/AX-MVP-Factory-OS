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
 * D-627 대표 "목차를 눌러 들어갔을 때 한 화면 글자 수를 엄격하게 — 기능은 그대로, 여러 번 누르더라도 하나하나 더 나오게" —
 *   처음 보이는 것은 ① 주제(한 줄 쓰기 + 우리 분야 칩 PC 4 · 휴대폰 3) ② 큰 단추 [AI로 완성 글 쓰기] · [뼈대] 둘뿐.
 *   추천 형식 · 더 바라는 점 · 잘 된 남의 글 · 사실 목록 · 모델 고르기 · 내 맞춤(more)은 접힌 한 줄 [더 정하기(선택)] 안(같은 시험 이름 · 지운 것 없음).
 * D-630 대표(2026-11-18) "스레드도 그렇다 · 릴스 · 틱톡도 들어갔을 때 글자가 너무 많다 — '2 고치고 확인하기' 부터는 안 보이는 게 낫다" —
 *   들어오면 1단계만: 주제 한 줄 · 우리 분야 칩 셋(짧은 이름) · 큰 단추 [AI로 완성 글 쓰기] · 작은 [직접 쓰기].
 *   [뼈대만 받기 · 예시로 시작] · [첫마디 10개 보기] 는 접힌 한 줄 [더 보기] 안으로(예전 [더 정하기(선택)] — 같은 접기 열쇠 · 같은 시험 이름).
 *   [더 보기] 는 들어올 때마다 접힌 채(펼친 것을 기억하지 않는다 · [모두 펼치기] 를 해 둔 사람만 처음부터 펼침). 2단계(글 칸)는 글이 생긴 뒤에야 그 아래에.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, Flame, NotebookPen, Pin, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Fold, HintTip, foldAllOpen } from '../../components/ui/fold'
import type { TopicChip } from '../../services/marketing/quickStart'
import { StepTitle } from './snsParts'
import { toneChip } from './snsTone'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { ModelPicker } from '../../components/ai/ModelPicker'

/** D-602 우리 분야 주제 칩 — 처음에 보이는 수(D-630 PC · 휴대폰 모두 3 · 나머지는 [n개 더 보기]) */
const OURS_SHOWN = 3

/**
 * D-630 접힌 칩의 짧은 이름 — 긴 주제 이름('정관정비 및 임원보수 규정')의 첫 낱말('정관정비').
 * 누르면 주제 칸에는 온전한 이름이 들어간다(마우스를 올리면 온전한 이름). 첫 낱말이 한 글자이거나 같은 줄에 겹치면 온전한 이름 그대로.
 */
function shortTopic(topic: string): string {
  const first = topic.trim().split(/\s+/)[0] ?? ''
  return first.length >= 2 && first.length < topic.trim().length ? first : topic
}

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
  onHand,
}: {
  /** D-630 [직접 쓰기] — AI · 뼈대 없이 빈 글 칸(2단계)을 바로 연다 */
  onHand?: () => void
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
  const oursAll = allOurs || pickedLate
  const oursShown = oursAll ? ours : ours.slice(0, OURS_SHOWN)
  // D-630 접힌 줄은 짧은 이름(첫 낱말) — 겹치면 온전한 이름 그대로
  const shorts = oursShown.map((c) => shortTopic(c.topic))
  const shortOf = (i: number): string | undefined => (oursAll || oursShown[i].label || shorts[i] === oursShown[i].topic || shorts.indexOf(shorts[i]) !== shorts.lastIndexOf(shorts[i]) ? undefined : shorts[i])
  // D-602 이번 주 키워드는 접힌 한 줄 — 고른 주제가 이번 주 키워드면 펼친 채로
  const [weekOpen, setWeekOpen] = useState(false)
  const weekPicked = week.some((c) => c.topic === topic)
  const chip = (c: TopicChip, tone: 'rose' | 'indigo', short?: string) => (
    <button key={c.topic} type="button" aria-pressed={topic === c.topic} onClick={() => onPick(c.topic)} title={c.label || short ? c.topic : undefined} className={toneChip(tone, topic === c.topic)} data-testid={`${testPrefix}-qs-chip`} data-from={c.from} data-topic={c.topic}>
      {c.label ?? short ?? c.topic}
    </button>
  )
  // 칸 사이 가로선(안쪽 상자 대신) — 대표 "줄글 느낌 · 큰 박스 안에 가로선"
  const row = 'border-t border-slate-100 pt-3'
  const oursLabel = (
    <HintTip tip="우리 분야 주제 — 늘 그대로예요. 영업 관리 › 전략에 모아 둔 상담 주제예요(정관 · 가지급금 · 정책자금 …). 고객이 실제로 묻는 것이라 글감으로 좋아요. 매주 바뀌지 않아요. 짧게 보이는 칩은 마우스를 올리면 온전한 이름이 보여요." label="우리 분야 주제" tight>
      <span className="t-sub flex min-w-0 flex-wrap items-center gap-x-1.5 font-semibold text-slate-800" data-testid={`${testPrefix}-qs-ours-label`}>
        {oursAll && <Pin aria-hidden="true" className="size-4 shrink-0 text-indigo-600" />}
        <span className={oursAll ? undefined : 'sr-only'}>우리 분야 주제</span>
      </span>
    </HintTip>
  )
  return (
    <div data-testid={`${testPrefix}-qs`}>
      {/* D-299 카드(Surface)는 넘치는 것을 자른다 — [모델 · ○○] 고르는 판 · ? 설명이 잘려서 자르지 않는 상자로 */}
      <div className="relative flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid={`${testPrefix}-qs-box`}>
        <StepTitle n="1">무엇에 대해 쓸까요?</StepTitle>
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
            {/* D-627 '늘 그대로예요' 표시는 ? 설명 안으로(글자 수 한도)
                D-630 이름표('우리 분야 주제')는 다 펼쳤을 때만 칩 위 한 줄로 — 접힌 줄은 칩 셋 + [n개 더 보기] + ?(이름표는 화면 읽기에만) */}
            {oursAll && oursLabel}
            <div className="flex flex-wrap items-center gap-1.5">
              {oursShown.map((c, i) => chip(c, 'indigo', shortOf(i)))}
              {ours.length > OURS_SHOWN && !pickedLate && (
                <button type="button" onClick={() => setAllOurs((v) => !v)} aria-expanded={allOurs} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold text-brand-700 hover:bg-slate-50" data-testid={`${testPrefix}-qs-ours-more`}>
                  {allOurs ? '접기' : `${ours.length - OURS_SHOWN}개 더 보기`}
                  <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${allOurs ? 'rotate-180' : ''}`} />
                </button>
              )}
              {!oursAll && oursLabel}
            </div>
          </div>
        )}
        {week.length > 0 && (
          // D-602 이번 주 키워드 — 좋지만 늘 펼쳐 둘 것은 아니다(대표) → 접힌 한 줄 · 누르면 칩
          <details open={weekOpen || weekPicked} onToggle={(e) => setWeekOpen((e.currentTarget as HTMLDetailsElement).open)} data-testid={`${testPrefix}-qs-week`}>
            <summary className="sum-chev tap t-sub flex min-h-9 cursor-pointer flex-wrap items-center gap-x-1.5 font-semibold text-slate-800" data-testid={`${testPrefix}-qs-week-open`}>
              <Flame aria-hidden="true" className="size-4 shrink-0 text-rose-600" />
              {/* D-630 '매주 바뀌어요' 는 마우스를 올리면(title) */}
              <span data-testid={`${testPrefix}-qs-week-label`} title="유튜브에서 이번 주에 뜨는 주제 — 매주 바뀌어요">
                이번 주 키워드 {week.length}개
              </span>
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{week.map((c) => chip(c, 'rose'))}</div>
          </details>
        )}
        <div className={`flex flex-col gap-2 ${row}`}>
          <div className="flex flex-wrap items-center gap-2">
            {ai.ok && (
              <AiConfirm><Button variant="primary" onClick={ai.onRun} disabled={ai.busy || !has} className="w-full sm:w-auto" data-testid={`${testPrefix}-qs-ai`} data-guide={testPrefix === 'sht' ? 'fn-mk-script' : 'fn-mk-write'}>
                <Sparkles aria-hidden="true" className="size-4" /> {ai.busy ? 'AI가 쓰는 중…' : ai.label}
              </Button></AiConfirm>
            )}
            {/* AI 를 못 쓰는 계정은 뼈대 · 예시가 큰 단추(쓸 수 있으면 아래 [더 보기] 안) */}
            {fallback && !ai.ok && (
              <Button variant="primary" onClick={fallback.onClick} disabled={!has} className="w-full sm:w-auto" data-testid={`${testPrefix}-qs-rule`}>
                <Wand2 aria-hidden="true" className="size-4" /> {fallback.label}
              </Button>
            )}
            {/* D-630 AI 없이 바로 쓰는 길 — 빈 글 칸(2단계)을 연다 */}
            {onHand && (
              <Button variant="ghost" onClick={onHand} title="AI 없이 빈 글 칸을 열어 직접 써요 — 쓰는 동안 규칙 검사가 바로 봐 줘요." data-testid={`${testPrefix}-hand`}>
                <NotebookPen aria-hidden="true" className="size-4" /> 직접 쓰기
              </Button>
            )}
          </div>
          {/* D-627 한 줄로 — 무엇이 되는지 긴 설명은 마우스를 올리면(title) · D-630 주제를 고른 뒤에만(고르기 전 안내는 주제 칸 안 글이 말한다) */}
          {has && (
            <p
              className="t-sub break-keep text-slate-600"
              data-testid={`${testPrefix}-qs-note`}
              title={ai.ok ? '한 번 누르면 바로 올려도 되는 완성 글(1안)이 아래 글 칸에 들어가요 — 다른 안은 이 아래에 남겨 둬요. 올리기 전 규칙 검사를 한 번 봐요.' : '추천 형식의 뼈대를 글 칸에 넣어요 — 대괄호 [ ] 를 사실로 채우면 돼요.'}
            >
              {ai.ok ? '완성 글이 아래 글 칸에 들어가요.' : '뼈대가 글 칸에 들어가요.'}
            </p>
          )}
          {ai.error && (
            <p role="alert" className="t-sub break-keep text-danger-700" data-testid={`${testPrefix}-qs-error`}>
              {ai.error}
            </p>
          )}
          {children}
        </div>
        {/* D-627 더 정하기(선택) — 추천 형식 · 바라는 점 · 참고 글 · 사실 · 모델 · 내 맞춤을 접힌 한 줄 안에
            D-630 이름은 [더 보기] · 뼈대/예시 · 첫마디 10개도 이 안으로 · 들어올 때마다 접힌 채(같은 접기 열쇠 — 예전 기억은 지우지 않고 읽지 않는다) */}
        <div className={row}>
        <Fold
          id={`${testPrefix}.qs.more`}
          title="더 보기"
          hint={`${fallback && ai.ok ? `${fallback.label} · ` : ''}첫마디 10개 · 추천 형식 · 더 바라는 점 · 잘 된 남의 글 · 사실 목록 · AI 모델 · 내 맞춤(형식 직접 고르기)이 여기 있어요. 안 열어도 추천 형식으로 바로 써요.${recLabel ? ` 지금 형식: ${recLabel}` : ''}`}
          icon={<SlidersHorizontal aria-hidden="true" className="size-4 text-slate-500" />}
          testId={`${testPrefix}-qs-more`}
          className="data-[open=1]:pb-1"
          keepClosed
          forceOpen={foldAllOpen()}
        >
        <div className="flex flex-col gap-3">
        {/* 기다리기 싫을 때(규칙 · 예시) — AI 를 쓸 수 있는 계정은 여기 */}
        {fallback && ai.ok && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={fallback.onClick} disabled={!has} data-testid={`${testPrefix}-qs-rule`}>
              <Wand2 aria-hidden="true" className="size-4" /> {fallback.label}
            </Button>
            {!has && <span className="t-sub text-slate-600">주제부터 골라 주세요.</span>}
          </div>
        )}
        {hooks}
        {top}
        {/* D-298 추천 형식 줄 — 형식 이름에 마우스를 올리면(휴대폰은 ?) 무슨 뜻인지 · 예시. D-602 상자 대신 가로선 */}
        <div className="flex flex-wrap items-center gap-2" data-testid={`${testPrefix}-qs-rec`}>
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
          <div className="flex flex-col gap-1">
            {reference}
            {facts}
          </div>
        )}
        {/* D-299 대표 "마케팅 · 브랜딩 어디서든 모델을 골라 요청" — 모델 고르기(고른 모델은 모든 화면 AI 단추가 같이 씀) · D-627 더 정하기 안 */}
        {ai.ok && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub font-semibold text-slate-800">AI 모델</span>
            <ModelPicker popover testId={`${testPrefix}-qs-model`} />
          </div>
        )}
        {more && <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">{more}</div>}
        </div>
        </Fold>
        </div>
      </div>
    </div>
  )
}
