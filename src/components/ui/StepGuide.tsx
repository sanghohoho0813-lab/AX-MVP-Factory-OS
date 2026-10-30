/**
 * 단계 안내 줄 (D-235) — 대표 "딱딱 순서대로 쭉 앞으로 가기 · 각 단계마다 무엇을 위한 단계인지".
 *
 *  - 위(StepGuide): '업체 일 순서 · 2 / 6단계' + 이 단계 이름 — 무엇을 위한 것인지 한 문장 + [◀ 이전] [다음: … ▶] + 진행 막대.
 *  - 아래(StepNext): 화면 끝까지 내려왔을 때 '다음 단계 · 맞춤 추천 — …' + [다음 ▶]. 긴 화면에서 다시 위로 올라가지 않게.
 *  - 순서 밖 화면(업무 일기 · 설정 같은 것)은 이름 — 언제 여는지 + '순서대로 하려면 ① 부터'.
 * 탭은 onGo(키), 모듈 화면은 hrefOf(키) 로 옮긴다. 순서 · 문장은 content/flowSteps.
 * 순서를 다 아는 사람은 [설명 접기] — 한 줄(몇 번째 · 이전/다음)만 남는다. 이 기기에 기억(D-185 '사용법 상자' 처럼 글이 늘 깔리지 않게).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Route } from 'lucide-react'
import type { FlowPosition, FlowStep } from '../../content/flowSteps'

interface GoProps {
  onGo?: (key: string) => void
  hrefOf?: (key: string) => string
}

function GoButton({
  step,
  dir,
  onGo,
  hrefOf,
  after,
  testId,
}: GoProps & {
  step: FlowStep
  dir: 'prev' | 'next' | 'first'
  after?: () => void
  testId: string
}) {
  const cls =
    dir === 'next'
      ? 'tap inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-brand-600 bg-brand-600 px-3.5 font-semibold whitespace-nowrap text-white hover:bg-brand-700'
      : 'tap inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50'
  const body =
    dir === 'next' ? (
      <>
        <span className="t-sub">다음: {step.label}</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </>
    ) : dir === 'first' ? (
      <>
        <span className="t-sub">순서대로: 1단계 {step.label}</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </>
    ) : (
      <>
        <ChevronLeft aria-hidden="true" className="size-4" />
        <span className="t-sub sm:hidden">이전</span>
        <span className="t-sub hidden sm:inline">{step.label}</span>
      </>
    )
  const label = dir === 'next' ? `다음 단계 ${step.label}로` : dir === 'first' ? `1단계 ${step.label}부터 순서대로` : `이전 단계 ${step.label}로`
  if (hrefOf) {
    return (
      <Link to={hrefOf(step.key)} className={cls} aria-label={label} data-testid={testId} data-to={step.key} onClick={after}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      data-testid={testId}
      data-to={step.key}
      onClick={() => {
        onGo?.(step.key)
        after?.()
      }}
    >
      {body}
    </button>
  )
}

const MIN_KEY = 'axmvp.stepguide.min'

function readMin(): boolean {
  try {
    return localStorage.getItem(MIN_KEY) === '1'
  } catch {
    return false
  }
}

/** 화면 위 — 지금 몇 번째 단계 · 무엇을 위한 것인지 · 이전/다음 */
export function StepGuide({ pos, onGo, hrefOf, className = '' }: GoProps & { pos: FlowPosition; className?: string }) {
  const { flow, index, prev, next, here } = pos
  const [min, setMinState] = useState(readMin)
  const setMin = (v: boolean) => {
    setMinState(v)
    try {
      localStorage.setItem(MIN_KEY, v ? '1' : '0')
    } catch {
      // 기억만 못 한다
    }
  }
  if (!here) return null
  const n = flow.steps.length
  if (index < 0) {
    // 순서 밖 화면 — 언제 여는지 + 순서의 첫 단계로
    const first = flow.steps[0]
    return (
      <section aria-label="이 화면 안내" data-testid="step-guide" data-step="aside" className={`no-print rounded-(--radius-card) border border-slate-200 bg-white px-3 py-2.5 sm:px-4 ${className}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="t-sub min-w-0 flex-1 basis-60 break-keep text-slate-700">
            <b className="font-bold text-slate-900">{here.label}</b> — {here.why}
          </p>
          {first && <GoButton step={first} dir="first" onGo={onGo} hrefOf={hrefOf} testId="step-first" />}
        </div>
      </section>
    )
  }
  return (
    <section
      aria-label={`${flow.name} 안내`}
      data-testid="step-guide"
      data-step={flow.steps[index].key}
      data-index={index + 1}
      data-total={n}
      data-min={min ? '1' : '0'}
      className={`no-print rounded-(--radius-card) border border-slate-200 bg-white px-3 py-2.5 sm:px-4 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex items-start gap-1">
            <p className="t-meta flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 font-bold text-brand-700">
              <Route aria-hidden="true" className="size-4 shrink-0" />
              <span>{flow.name}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums" data-testid="step-count">
                {index + 1} / {n}단계
              </span>
              {min && <span className="font-bold text-slate-900">· {here.label}</span>}
            </p>
            <button
              type="button"
              onClick={() => setMin(!min)}
              aria-expanded={!min}
              aria-label={min ? '단계 설명 펼치기' : '단계 설명 접기'}
              title={min ? '설명 펼치기' : '설명 접기'}
              data-testid="step-min"
              className="tap -my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-brand-700 hover:bg-brand-100"
            >
              {min ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronUp aria-hidden="true" className="size-4" />}
            </button>
          </div>
          {!min && (
            <p className="t-sub mt-0.5 break-keep text-slate-700" data-testid="step-why">
              <b className="font-bold text-slate-900">{here.label}</b> — {here.why}
            </p>
          )}
        </div>
        {(prev || next) && (
          <div className="flex flex-wrap items-center gap-2">
            {prev && <GoButton step={prev} dir="prev" onGo={onGo} hrefOf={hrefOf} testId="step-prev" />}
            {next && <GoButton step={next} dir="next" onGo={onGo} hrefOf={hrefOf} testId="step-next-top" />}
          </div>
        )}
      </div>
      {n > 1 && !min && (
        <div aria-hidden="true" className="mt-2 flex gap-1">
          {flow.steps.map((s, i) => (
            <span key={s.key} title={s.label} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-brand-500' : 'bg-brand-100'}`} />
          ))}
        </div>
      )}
    </section>
  )
}

/** 화면 끝 — 다 봤으면 다음 단계로(위로 다시 올라가지 않게) */
export function StepNext({ pos, onGo, hrefOf, className = '' }: GoProps & { pos: FlowPosition; className?: string }) {
  const { next, index } = pos
  if (index < 0 || !next) return null
  return (
    <section aria-label="다음 단계" data-testid="step-next" className={`no-print flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--radius-card) border border-slate-200 bg-white px-3 py-3 sm:px-4 ${className}`}>
      <p className="t-sub min-w-0 flex-1 basis-60 break-keep text-slate-600">
        <span className="inline-flex items-center gap-1 font-bold text-slate-900">
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
          다음 단계 · {next.label}
        </span>{' '}
        — {next.why}
      </p>
      <GoButton step={next} dir="next" onGo={onGo} hrefOf={hrefOf} testId="step-next-bottom" after={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </section>
  )
}
