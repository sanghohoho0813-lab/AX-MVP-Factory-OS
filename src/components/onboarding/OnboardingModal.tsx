import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ListChecks, Sparkles, X } from 'lucide-react'
import { useActiveProject } from '../../context/activeProject'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { useDemoTour } from '../demo/demoTour'
import { onboardingPreferencesRepository } from '../../repositories/onboardingPreferencesRepository'
import {
  chapterDisplayStatus,
  computeTodayGuidance,
  defaultPath,
  pathForProject,
  visibleChapters,
} from '../../services/onboardingService'
import { getChapter } from '../../content/onboardingGuideContent'
import { Button } from '../ui/Button'
import { ChapterStatusBadge, ChapterDetail, TodayTaskCard } from './parts'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface OnboardingModalProps {
  open: boolean
  /** 처음 열 챕터 (없으면 오늘 안내부터) */
  initialChapterId?: string | null
  /** X·배경 클릭·ESC — 이번 세션만 닫기 */
  onClose: () => void
}

/** 라우트 템플릿(:projectId 포함 가능)을 실제 경로로 변환 */
function resolveRoute(template: string, projectId: string | null): string {
  if (template.includes(':projectId')) {
    if (!projectId) return '/clients/new'
    return template.replace(':projectId', projectId)
  }
  return template
}

export function OnboardingModal({ open, initialChapterId, onClose }: OnboardingModalProps) {
  const navigate = useNavigate()
  const version = useStoreVersion()
  const { project } = useActiveProject()
  const demoTour = useDemoTour()

  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const prefs = useMemo(() => {
    void version
    return onboardingPreferencesRepository.get()
  }, [version])

  const today = useMemo(() => {
    void version
    return computeTodayGuidance(project?.id ?? null)
  }, [project, version])

  const path = useMemo(
    () => pathForProject(today.project) ?? defaultPath(prefs),
    [today.project, prefs],
  )
  const chapters = useMemo(
    () => visibleChapters(path, prefs.guideMode),
    [path, prefs.guideMode],
  )

  // 선택된 뷰: 'today' 또는 챕터 id
  const [selectedId, setSelectedId] = useState<string>(initialChapterId ?? 'today')
  const [mobileListOpen, setMobileListOpen] = useState(false)

  useEffect(() => {
    if (open) setSelectedId(initialChapterId ?? 'today')
  }, [open, initialChapterId])

  const targetProjectId = today.project?.id ?? project?.id ?? null

  const go = useCallback(
    (to: string) => {
      onClose()
      navigate(to)
    },
    [navigate, onClose],
  )

  const openChapter = useCallback((id: string) => {
    setSelectedId(id)
    setMobileListOpen(false)
    onboardingPreferencesRepository.markChapterRead(id)
  }, [])

  const startSample = useCallback(() => {
    onClose()
    demoTour.start()
  }, [demoTour, onClose])

  const snoozeToday = useCallback(() => {
    onboardingPreferencesRepository.snoozeToday()
    onClose()
  }, [onClose])

  const startToday = useCallback(() => {
    if (today.hasProject && today.journey) {
      go(today.journey.actionPath)
    } else {
      go('/clients/new')
    }
  }, [today, go])

  // 포커스 트랩 · ESC · 포커스 복귀 (§21)
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusFirst = () => {
      const nodes = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)
      nodes && nodes.length > 0 ? nodes[0].focus() : panel?.focus()
    }
    const raf = requestAnimationFrame(focusFirst)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const { body } = document
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      body.style.overflow = prevOverflow
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const lightVariant = today.allCompleted
  const selectedChapter = selectedId === 'today' ? null : getChapter(selectedId)
  const title = lightVariant ? '오늘의 작업 안내' : '처음 사용하시나요?'
  const subtitle = lightVariant
    ? '핵심 단계를 마쳤습니다. 오늘의 작업과 다음 단계를 안내해 드립니다.'
    : '현재 프로젝트 상태를 기준으로 오늘 가장 먼저 해야 할 일을 안내해 드립니다.'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="가이드 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-navy-950/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay)"
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-6 shrink-0 text-brand-600" />
              <h2
                id="onboarding-title"
                className="text-[1.75rem] leading-tight font-bold break-keep text-slate-900 sm:text-[1.9rem]"
              >
                {title}
              </h2>
            </div>
            <p className="mt-1.5 text-[1.02rem] break-keep text-slate-600">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* 본문: 좌 챕터 목록 · 우 상세 */}
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[260px_1fr]">
          {/* 모바일 접이식 챕터 목록 토글 */}
          <button
            type="button"
            aria-expanded={mobileListOpen}
            onClick={() => setMobileListOpen((v) => !v)}
            className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-left text-[1rem] font-semibold text-slate-700 lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <ListChecks aria-hidden="true" className="size-4 text-slate-400" />
              핵심 사용 순서
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform ${mobileListOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <nav
            aria-label="가이드 챕터"
            className={`${mobileListOpen ? 'block' : 'hidden'} shrink-0 overflow-y-auto border-b border-slate-100 bg-slate-50/60 p-2 lg:block lg:border-r lg:border-b-0`}
          >
            <ul className="flex flex-col gap-1">
              <li>
                <button
                  type="button"
                  aria-current={selectedId === 'today' ? 'true' : undefined}
                  onClick={() => {
                    setSelectedId('today')
                    setMobileListOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-(--radius-control) px-3 py-2.5 text-left text-[1rem] font-semibold ${
                    selectedId === 'today'
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Sparkles aria-hidden="true" className="size-4 shrink-0" />
                  오늘 할 일
                </button>
              </li>
              {chapters.map((c) => {
                const status = chapterDisplayStatus(c, today.progress, prefs)
                const active = selectedId === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => openChapter(c.id)}
                      className={`flex w-full flex-col gap-1 rounded-(--radius-control) px-3 py-2.5 text-left ${
                        active ? 'bg-white ring-1 ring-brand-300' : 'hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-[1rem] font-medium break-keep text-slate-800">
                        <span className="text-slate-400">{c.order}.</span>
                        {c.title}
                        {c.advanced && (
                          <span className="rounded bg-slate-100 px-1 text-[0.75rem] text-slate-500">
                            고급
                          </span>
                        )}
                      </span>
                      <ChapterStatusBadge status={status} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* 우측 상세 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            {selectedChapter ? (
              <ChapterDetail
                chapter={selectedChapter}
                status={chapterDisplayStatus(selectedChapter, today.progress, prefs)}
                onGoRoute={(tpl) => go(resolveRoute(tpl, targetProjectId))}
              />
            ) : (
              <div className="flex flex-col gap-5">
                <TodayTaskCard
                  today={today}
                  onGo={go}
                  onCreateProject={() => go('/clients/new')}
                />

                {/* 두 갈래 경로 (§5) */}
                <section aria-label="시작 방법 선택" className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col rounded-(--radius-panel) border border-slate-200 p-5">
                    <h3 className="text-[1.15rem] font-bold break-keep text-slate-900">
                      10분 만에 전체 흐름 둘러보기
                    </h3>
                    <p className="mt-1.5 flex-1 text-[1rem] break-keep text-slate-600">
                      샘플 데이터로 진단부터 결과자료까지 전체 흐름을 미리 체험합니다. 실제 고객 데이터와 섞이지 않습니다.
                    </p>
                    <div className="mt-3">
                      <Button variant="secondary" size="md" className="text-[1rem]" onClick={startSample}>
                        샘플 전체 흐름 체험하기
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col rounded-(--radius-panel) border border-slate-200 p-5">
                    <h3 className="text-[1.15rem] font-bold break-keep text-slate-900">
                      내 고객 프로젝트 시작하기
                    </h3>
                    <p className="mt-1.5 flex-1 text-[1rem] break-keep text-slate-600">
                      {today.hasProject
                        ? '현재 프로젝트의 다음 단계로 이어서 진행합니다.'
                        : '고객사와 프로젝트를 만들며 실제 작업을 시작합니다.'}
                    </p>
                    <div className="mt-3">
                      <Button variant="primary" size="md" className="text-[1rem]" onClick={startToday}>
                        {today.hasProject && today.journey
                          ? '현재 프로젝트 이어서 하기'
                          : '고객사와 프로젝트 만들기'}
                      </Button>
                    </div>
                  </div>
                </section>

                <p className="text-[0.95rem] break-keep text-slate-500">
                  왼쪽에서 각 단계를 눌러 자세한 사용법을 볼 수 있습니다. 전체 안내는 상단 “처음 사용 가이드”에서 다시 열 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 sm:px-7">
          <Button variant="primary" size="md" className="text-[1rem]" onClick={startToday}>
            {lightVariant ? '오늘의 작업 보기' : '오늘 안내 시작하기'}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="md" className="text-[1rem]" onClick={startSample}>
              샘플로 전체 흐름 체험하기
            </Button>
            <button
              type="button"
              onClick={snoozeToday}
              className="rounded-(--radius-control) px-3 py-2 text-[0.95rem] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <span aria-hidden="true">오늘 하루 보지 않기</span>
              <span className="sr-only">오늘 하루 이 안내를 자동으로 열지 않기(내일 다시 표시)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
