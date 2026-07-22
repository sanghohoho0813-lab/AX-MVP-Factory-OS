import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, ChevronLeft, ChevronRight, Footprints, X } from 'lucide-react'
import { getScreenHelp, getScreenTour } from '../../content/onboardingGuideContent'
import type { ScreenTour, TourStep } from '../../types/onboarding'
import { Button } from '../ui/Button'
import { useOnboarding } from './onboardingContext'

/**
 * 화면별 "이 화면 사용법"(§12) + "이 화면 따라 해보기"(§13) 런처.
 * 각 화면 상단에 한 줄로 배치한다.
 */
export function ScreenGuide({ screenKey }: { screenKey: string }) {
  const help = getScreenHelp(screenKey)
  const tour = getScreenTour(screenKey)
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourOn, setTourOn] = useState(false)

  if (!help && !tour) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {help && (
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-[0.92rem] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          <BookOpen aria-hidden="true" className="size-4 text-slate-400" />
          이 화면 사용법
        </button>
      )}
      {tour && tour.steps.length > 0 && (
        <button
          type="button"
          onClick={() => setTourOn(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-[0.92rem] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
        >
          <Footprints aria-hidden="true" className="size-4 text-slate-400" />
          이 화면 따라 해보기
        </button>
      )}
      {help && helpOpen && <HelpPanel screenKey={screenKey} onClose={() => setHelpOpen(false)} />}
      {tour && tourOn && <TourOverlay tour={tour} onEnd={() => setTourOn(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 이 화면 사용법 패널 (§12)                                            */
/* ------------------------------------------------------------------ */

function HelpPanel({ screenKey, onClose }: { screenKey: string; onClose: () => void }) {
  const help = getScreenHelp(screenKey)!
  const { openGuide } = useOnboarding()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="사용법 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-navy-950/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${help.screenTitle} 사용법`}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-(--shadow-overlay)"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[1.3rem] font-bold break-keep text-slate-900">{help.screenTitle} 사용법</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <HelpBlock title="이 화면의 목적">{help.purpose}</HelpBlock>
          <HelpBullets title="먼저 확인" items={help.checkFirst} />
          <HelpBullets title="입력 방법" items={help.howToInput} />
          <HelpBullets title="완료 조건" items={help.completionCriteria} />
          <HelpBlock title="다음 단계">{help.nextStep}</HelpBlock>
        </div>
        {help.relatedChapterId && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-4">
            <Button
              variant="primary"
              size="md"
              className="w-full text-[1rem]"
              onClick={() => {
                onClose()
                openGuide(help.relatedChapterId!)
              }}
            >
              관련 안내 챕터 열기
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function HelpBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[1.05rem] font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-[1rem] break-keep text-slate-600">{children}</p>
    </div>
  )
}

function HelpBullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="text-[1.05rem] font-semibold text-slate-800">{title}</h3>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[1rem] break-keep text-slate-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 이 화면 따라 해보기 — DOM 앵커 투어 (§13)                            */
/* ------------------------------------------------------------------ */

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function TourOverlay({ tour, onEnd }: { tour: ScreenTour; onEnd: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const step: TourStep = tour.steps[index]
  const isFirst = index === 0
  const isLast = index === tour.steps.length - 1

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null)
      return
    }
    const el = document.querySelector(step.target)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    // 화면에 들어오도록 스크롤 (입력값은 건드리지 않고 위치만 조정)
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    const r2 = el.getBoundingClientRect()
    setRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height })
  }, [step.target])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const onChange = () => measure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [measure])

  const end = useCallback(() => onEnd(), [onEnd])
  const next = useCallback(() => setIndex((i) => Math.min(tour.steps.length - 1, i + 1)), [tour.steps.length])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    tooltipRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        end()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        isLast ? end() : next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Tab') {
        // 포커스를 툴팁 안에 가둔다
        e.preventDefault()
        tooltipRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [end, next, prev, isLast, index])

  const pad = 6
  const hole: Rect | null = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  // 툴팁 위치: 타겟 아래(공간 부족 시 위), 없으면 화면 중앙. 모바일에서 가로 넘침 방지.
  const tipStyle = computeTooltipStyle(hole)

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`${tour.screenTitle} 따라 해보기`}>
      {hole ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-brand-400"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          }}
        />
      ) : (
        <button
          type="button"
          aria-label="따라 해보기 닫기"
          onClick={end}
          className="absolute inset-0 cursor-default bg-navy-950/60"
        />
      )}

      <div
        ref={tooltipRef}
        tabIndex={-1}
        style={tipStyle}
        className="absolute w-[min(360px,calc(100vw-24px))] rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-overlay) outline-none"
      >
        <p aria-live="polite" className="text-[0.85rem] font-medium text-slate-400">
          {index + 1} / {tour.steps.length}
        </p>
        <h3 className="mt-0.5 text-[1.15rem] font-bold break-keep text-slate-900">{step.title}</h3>
        <p className="mt-1.5 text-[1rem] break-keep text-slate-600">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={end}
            className="rounded-(--radius-control) px-2.5 py-1.5 text-[0.92rem] font-medium text-slate-500 hover:bg-slate-100"
          >
            그만 보기
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-2.5 text-[0.92rem] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              이전
            </button>
            <button
              type="button"
              onClick={() => (isLast ? end() : next())}
              className="inline-flex h-9 items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 text-[0.92rem] font-semibold text-white hover:bg-brand-700"
            >
              {isLast ? '마치기' : '다음'}
              {!isLast && <ChevronRight aria-hidden="true" className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function computeTooltipStyle(hole: Rect | null): React.CSSProperties {
  if (!hole) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const margin = 12
  const tipW = Math.min(360, window.innerWidth - 24)
  const belowTop = hole.top + hole.height + margin
  const spaceBelow = window.innerHeight - belowTop
  const top = spaceBelow > 180 ? belowTop : Math.max(12, hole.top - 180 - margin)
  let left = hole.left
  if (left + tipW > window.innerWidth - 12) left = window.innerWidth - 12 - tipW
  if (left < 12) left = 12
  return { top, left }
}
