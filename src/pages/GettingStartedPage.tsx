import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Compass, LifeBuoy, Sparkles } from 'lucide-react'
import { useActiveProject } from '../context/activeProject'
import { useStoreVersion } from '../lib/useStoreVersion'
import { useDemoTour } from '../components/demo/demoTour'
import { useOnboarding } from '../components/onboarding/onboardingContext'
import { onboardingPreferencesRepository } from '../repositories/onboardingPreferencesRepository'
import {
  chapterDisplayStatus,
  computeTodayGuidance,
  defaultPath,
  guideProgressSummary,
  pathForProject,
  visibleChapters,
} from '../services/onboardingService'
import {
  CORE_FLOW_SUMMARY,
  FAQ_ITEMS,
  SYSTEM_DISCLAIMER,
  TERM_DEFINITIONS,
} from '../content/onboardingGuideContent'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import {
  ChapterDetail,
  ChapterStatusBadge,
  DisclaimerNote,
  NoticeBox,
  TodayTaskCard,
} from '../components/onboarding/parts'
import type { TutorialChapter } from '../types/onboarding'

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 shadow-(--shadow-card) sm:p-6"
    >
      <h2 id={`${id}-title`} className="text-[1.3rem] font-bold break-keep text-slate-900">
        {title}
      </h2>
      {description && <p className="mt-1 text-[1rem] break-keep text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ChapterAccordion({
  chapter,
  status,
  onGoRoute,
}: {
  chapter: TutorialChapter
  status: ReturnType<typeof chapterDisplayStatus>
  onGoRoute: (tpl: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-(--radius-card) border border-slate-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onboardingPreferencesRepository.markChapterRead(chapter.id)
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[1.05rem] font-semibold break-keep text-slate-800">
            <span className="text-slate-400">{chapter.order}.</span> {chapter.title}
          </span>
          <ChapterStatusBadge status={status} />
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <ChapterDetail chapter={chapter} status={status} onGoRoute={onGoRoute} />
        </div>
      )}
    </div>
  )
}

function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <div className="flex flex-col gap-2">
      {FAQ_ITEMS.map((item, idx) => {
        const open = openIdx === idx
        return (
          <div key={idx} className="rounded-(--radius-card) border border-slate-200">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenIdx(open ? null : idx)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[1.02rem] font-medium break-keep text-slate-800"
            >
              {item.question}
              <ChevronDown
                aria-hidden="true"
                className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <p className="border-t border-slate-100 px-4 py-3 text-[1rem] break-keep text-slate-600">
                {item.answer}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function GettingStartedPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()
  const { project } = useActiveProject()
  const demoTour = useDemoTour()
  const { openGuide } = useOnboarding()

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
  const chapters = useMemo(() => visibleChapters(path, prefs.guideMode), [path, prefs.guideMode])
  const coreChapters = chapters.filter((c) => !c.advanced)
  const advancedChapters = chapters.filter((c) => c.advanced)
  const summary = useMemo(
    () => guideProgressSummary(path, today.progress, prefs),
    [path, today.progress, prefs],
  )

  const targetProjectId = today.project?.id ?? project?.id ?? null
  const resolveRoute = (tpl: string): string =>
    tpl.includes(':projectId')
      ? targetProjectId
        ? tpl.replace(':projectId', targetProjectId)
        : '/clients/new'
      : tpl
  const goRoute = (tpl: string) => navigate(resolveRoute(tpl))

  // C. 현재 막힌 이유
  const blockedSteps = today.progress?.steps.filter((s) => s.state === 'blocked_by_prerequisite') ?? []

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
      <PageHeader
        title="처음 사용 가이드"
        description="이 시스템의 전체 흐름과 오늘 할 일을 한곳에서 안내합니다."
      />

      {/* 헤더 요약 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 shadow-(--shadow-card) sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[0.95rem] font-medium text-brand-700">
              <Compass aria-hidden="true" className="size-4" />
              전체 핵심 흐름
            </p>
            <p className="mt-1 text-[1.05rem] break-keep text-slate-700">{CORE_FLOW_SUMMARY}</p>
          </div>
          <Button variant="secondary" size="md" className="text-[1rem]" onClick={() => openGuide()}>
            <LifeBuoy aria-hidden="true" className="size-4" />
            오늘 안내 다시 보기
          </Button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-4 py-3">
            <dt className="text-[0.9rem] text-slate-500">현재 프로젝트</dt>
            <dd className="mt-0.5 text-[1.05rem] font-semibold break-keep text-slate-800">
              {today.journey ? `${today.journey.orgName} · ${today.journey.project.name}` : '선택된 프로젝트 없음'}
            </dd>
          </div>
          <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-4 py-3">
            <dt className="text-[0.9rem] text-slate-500">현재 단계</dt>
            <dd className="mt-0.5 text-[1.05rem] font-semibold break-keep text-slate-800">
              {today.progress ? `${today.progress.currentStep.label} (${today.progress.stepText})` : '—'}
            </dd>
          </div>
          <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-4 py-3">
            <dt className="text-[0.9rem] text-slate-500">전체 진행률</dt>
            <dd className="mt-1">
              <ProgressBar value={summary.percent} tone="info" label={`전체 진행률 ${summary.percent}%`} />
              <span className="mt-1 block text-[0.9rem] text-slate-500">
                핵심 {summary.completedCore} / {summary.totalCore}단계 완료
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* A. 빠른 시작 */}
      <SectionCard id="quick" title="A. 빠른 시작" description="처음이라면 여기서 바로 시작하세요.">
        <TodayTaskCard today={today} onGo={(p) => navigate(p)} onCreateProject={() => navigate('/clients/new')} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="md" className="text-[1rem]" onClick={() => demoTour.start()}>
            <Sparkles aria-hidden="true" className="size-4" />
            샘플로 전체 흐름 체험하기
          </Button>
        </div>
      </SectionCard>

      {/* B. 핵심 사용 순서 */}
      <SectionCard id="flow" title="B. 핵심 사용 순서" description="이 프로젝트 유형에 맞춘 단계별 안내입니다.">
        <div className="flex flex-col gap-2">
          {coreChapters.map((c) => (
            <ChapterAccordion
              key={c.id}
              chapter={c}
              status={chapterDisplayStatus(c, today.progress, prefs)}
              onGoRoute={goRoute}
            />
          ))}
        </div>
      </SectionCard>

      {/* C. 현재 막힌 이유 */}
      <SectionCard id="blocked" title="C. 현재 막힌 이유" description="다음 단계로 가려면 무엇이 필요한지 안내합니다.">
        {today.hasProject ? (
          blockedSteps.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {blockedSteps.map((s) => (
                <li key={s.key} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                  <p className="text-[1.02rem] font-semibold text-slate-800">{s.label}</p>
                  <p className="mt-0.5 text-[1rem] break-keep text-slate-600">{s.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <NoticeBox>지금은 막힌 단계가 없습니다. 오늘의 추천 작업을 진행하세요.</NoticeBox>
          )
        ) : (
          <NoticeBox>먼저 고객사와 프로젝트를 만들면 단계별 안내가 시작됩니다.</NoticeBox>
        )}
      </SectionCard>

      {/* D. 결과물 설명 */}
      <SectionCard id="outputs" title="D. 이 시스템이 만드는 결과물" description="무엇을 만들고 무엇은 만들지 않는지 명확히 안내합니다.">
        <ul className="mb-3 flex list-disc flex-col gap-1 pl-5 text-[1.02rem] break-keep text-slate-600">
          <li>기업 진단서 — 설문 응답 기반 AX 적합성·핵심 문제 정리</li>
          <li>기능·화면 설계서 / 홈페이지 설계서 — 개발 가능한 수준의 설계</li>
          <li>고객·기관용 보고서 — 전달용으로 정리된 자료</li>
          <li>개발 지시문 — 개발자가 그대로 만들 수 있는 지침</li>
        </ul>
        <DisclaimerNote />
        <div className="mt-4">
          <h3 className="text-[1.1rem] font-semibold text-slate-800">용어 쉽게 이해하기</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {TERM_DEFINITIONS.map((t) => (
              <div key={t.term}>
                <dt className="text-[1rem] font-semibold text-slate-800">{t.term}</dt>
                <dd className="text-[0.95rem] break-keep text-slate-600">{t.plain}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionCard>

      {/* E. 고급 운영 (접힘) */}
      {advancedChapters.length > 0 && (
        <SectionCard id="advanced" title="E. 고급 운영 기능" description="핵심 흐름 이후에 사용하는 기능입니다. 처음에는 없어도 됩니다.">
          <div className="flex flex-col gap-2">
            {advancedChapters.map((c) => (
              <ChapterAccordion
                key={c.id}
                chapter={c}
                status={chapterDisplayStatus(c, today.progress, prefs)}
                onGoRoute={goRoute}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* F. 자주 묻는 질문 */}
      <SectionCard id="faq" title="F. 자주 묻는 질문">
        <FaqAccordion />
      </SectionCard>

      <p className="pb-4 text-center text-[0.9rem] text-slate-400">{SYSTEM_DISCLAIMER}</p>
    </div>
  )
}
