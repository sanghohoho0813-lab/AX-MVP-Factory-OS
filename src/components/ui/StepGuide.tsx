/**
 * 단계 안내 줄 (D-235) — 대표 "딱딱 순서대로 쭉 앞으로 가기 · 각 단계마다 무엇을 위한 단계인지".
 *
 *  - 위(StepGuide): '업체 일 순서 · 2 / 6단계' + 이 단계 이름 — 무엇을 위한 것인지 한 문장 + [◀ 이전] [다음: … ▶] + 진행 막대.
 *  - 아래(StepNext): 화면 끝까지 내려왔을 때 '다음 단계 · 맞춤 추천 — …' + [다음 ▶]. 긴 화면에서 다시 위로 올라가지 않게.
 *  - 순서 밖 화면(업무 일기 · 설정 같은 것)은 이름 — 언제 여는지 + '순서대로 하려면 ① 부터'.
 * 탭은 onGo(키), 모듈 화면은 hrefOf(키) 로 옮긴다. 순서 · 문장은 content/flowSteps.
 * 순서를 다 아는 사람은 [설명 접기] — 한 줄(몇 번째 · 이전/다음)만 남는다. 이 기기에 기억(D-185 '사용법 상자' 처럼 글이 늘 깔리지 않게).
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Route } from 'lucide-react'
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
  short = false,
}: GoProps & {
  step: FlowStep
  dir: 'prev' | 'next' | 'first'
  after?: () => void
  testId: string
  /** D-627 한 줄 안(모듈 화면) — [이전] 은 ‹ 만 · 순서 밖 화면 단추는 '1단계 …' 만 */
  short?: boolean
}) {
  const cls =
    dir === 'next'
      ? 'tap inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-brand-600 bg-brand-600 px-3.5 font-semibold whitespace-nowrap text-white hover:bg-brand-700'
      : `tap inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white ${short && dir === 'prev' ? 'min-w-11 justify-center px-2' : 'px-3'} font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50`
  const body =
    short && dir === 'prev' ? (
      <ChevronLeft aria-hidden="true" className="size-4" />
    ) : short && dir === 'first' ? (
      <>
        <span className="t-sub">1단계 {step.label}</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </>
    ) : dir === 'next' ? (
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
      <Link to={hrefOf(step.key)} className={cls} title={short ? label : undefined} aria-label={label} data-testid={testId} data-to={step.key} onClick={after}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      title={short ? label : undefined}
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

/** 사람이 접기 · 펼치기를 한 번이라도 눌렀으면 그 선택(모든 화면 같이) · 안 눌렀으면 화면이 정한 기본값 */
function readMin(fallback = false): boolean {
  try {
    const v = localStorage.getItem(MIN_KEY)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

/** 화면 위 — 지금 몇 번째 단계 · 무엇을 위한 것인지 · 이전/다음 */
/**
 * defaultMin — U4(D-544) 업체 상세처럼 머리가 긴 화면은 처음엔 한 줄(몇 번째 · 이름 · 다음 단추)로.
 * 설명은 [펼치기] 한 번 · 한 번 고른 것은 기억(모든 화면 같이).
 */
export function StepGuide({
  pos,
  onGo,
  hrefOf,
  className = '',
  defaultMin = false,
  labelInTabs = false,
  lead,
}: GoProps & {
  pos: FlowPosition
  className?: string
  defaultMin?: boolean
  /** D-627 바로 위 탭 줄이 지금 단계 이름을 이미 보여 주면(업체 상세) 접힌 줄에서는 이름을 글로 다시 쓰지 않는다(화면 읽기 · 마우스에는 그대로) */
  labelInTabs?: boolean
  /**
   * D-667 접힌 한 줄의 '일 순서 안내' 글자 자리에 대신 설 것(업체 상세 '지금 할 것' 알약) — 글자 수 한도(D-627)를 늘리지 않고 보이게.
   * 펼쳐 둔 사람에게는 머리 줄 위에 한 줄. 순서 밖 화면(이 틀을 안 그리는 탭)은 부르는 쪽이 따로 그린다.
   */
  lead?: ReactNode
}) {
  const { flow, index, prev, next, here } = pos
  const [min, setMinState] = useState(() => readMin(defaultMin))
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
          {!min && lead && <div className="mb-2 flex">{lead}</div>}
          <div className="flex items-start gap-1">
            <p className="t-meta flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 font-bold text-brand-700" title={min && labelInTabs ? `${flow.name} · ${here.label}` : flow.name}>
              {!(min && labelInTabs && lead) && <Route aria-hidden="true" className="size-4 shrink-0" />}
              {/* D-627 접힌 한 줄은 '몇 번째 · 지금 단계' 만(순서 이름은 펼치면 · 마우스를 올리면) */}
              {!min && <span>{flow.name}</span>}
              {!min && <span aria-hidden="true">·</span>}
              {/*
                D-651 업체 상세(labelInTabs)의 접힌 한 줄은 숫자 대신 '일 순서 안내' — '2 / 6단계' 가 업체 진행도처럼 읽혔다
                (계약을 마친 업체도 개요 탭이면 2/6). 업체가 어디까지 왔는지는 이름 옆 계약 단계 알약이 말한다.
                펼치면 '몇 번째 화면' 으로 — 화면 순서라는 것이 글로 보이게.
              */}
              {labelInTabs && min && lead ? (
                <>
                  {lead}
                  <span className="sr-only" data-testid="step-count">
                    일 순서 안내
                  </span>
                </>
              ) : labelInTabs ? (
                <span className="tabular-nums" data-testid="step-count">
                  {min ? '일 순서 안내' : `${n}개 화면 중 ${index + 1}번째`}
                </span>
              ) : (
                <span className="tabular-nums" data-testid="step-count">
                  {index + 1} / {n}단계
                </span>
              )}
              {min && <span className={labelInTabs ? 'sr-only' : 'font-bold text-slate-900'}>· {here.label}</span>}
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
          // U4(D-544) · D-627 접힌 한 줄일 때는 이전 · 다음 단추를 숨긴다(바로 위 탭 줄 · 화면 끝 [다음 단계]가 같은 일) — 펼치면 보인다
          <div className={`flex-wrap items-center gap-2 ${min ? 'hidden' : 'flex'}`}>
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

/**
 * D-627 글자 수 한도 — 모듈 화면의 한 줄 안(목차 단추 옆). 상자 · 설명 문장 없이 '몇 번째 · [‹] · [다음: …]'.
 * 무엇을 위한 단계인지는 마우스를 올리면(title). 시험이 보는 이름표(step-guide · data-index · step-next-top …)는 위와 같다.
 * 순서 밖 화면(한눈에 보기 등)은 [1단계 …] 단추 하나.
 */
export function StepGuideInline({ pos, onGo, hrefOf, className = '' }: GoProps & { pos: FlowPosition; className?: string }) {
  const { flow, index, prev, next, here } = pos
  if (!here) return null
  if (index < 0) {
    const first = flow.steps[0]
    if (!first) return null
    return (
      <section aria-label="이 화면 안내" data-testid="step-guide" data-step="aside" title={`${here.label} — ${here.why}`} className={`no-print flex shrink-0 items-center ${className}`}>
        <GoButton step={first} dir="first" onGo={onGo} hrefOf={hrefOf} testId="step-first" short />
      </section>
    )
  }
  const n = flow.steps.length
  return (
    <section
      aria-label={`${flow.name} 안내`}
      title={`${flow.name} — ${here.label}: ${here.why}`}
      data-testid="step-guide"
      data-step={flow.steps[index].key}
      data-index={index + 1}
      data-total={n}
      data-min="1"
      className={`no-print flex min-w-0 shrink-0 items-center gap-2 ${className}`}
    >
      <span className="t-meta font-semibold text-slate-500 tabular-nums" data-testid="step-count">
        {index + 1}/{n}
      </span>
      {prev && <GoButton step={prev} dir="prev" onGo={onGo} hrefOf={hrefOf} testId="step-prev" short />}
      {next && <GoButton step={next} dir="next" onGo={onGo} hrefOf={hrefOf} testId="step-next-top" short />}
    </section>
  )
}

/**
 * 화면 끝 — 다 봤으면 다음 단계로(위로 다시 올라가지 않게). 설명 문장 없이 단추 하나(D-627 — 설명은 마우스를 올리면 · 단계 안내 펼침에).
 * D-631 문장 앞에 있던 화살표(→)는 문장이 빠진 뒤 혼자 남아 있었다 — 뺐다(단추 안에 › 가 있다). compact 는 예전 이름 그대로 받기만 한다(두 모양이 같아졌다).
 */
export function StepNext({ pos, onGo, hrefOf, className = '' }: GoProps & { pos: FlowPosition; className?: string; compact?: boolean }) {
  const { next, index } = pos
  if (index < 0 || !next) return null
  return (
    <section aria-label="다음 단계" data-testid="step-next" title={`다음 단계 · ${next.label} — ${next.why}`} className={`no-print flex justify-end ${className}`}>
      <GoButton step={next} dir="next" onGo={onGo} hrefOf={hrefOf} testId="step-next-bottom" after={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </section>
  )
}
