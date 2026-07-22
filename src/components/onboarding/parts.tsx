import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Lock,
  PlayCircle,
} from 'lucide-react'
import type {
  ChapterDisplayStatus,
  TutorialChapter,
} from '../../types/onboarding'
import type { ProjectProgress } from '../../services/projectProgressService'
import type { TodayGuidance } from '../../services/onboardingService'
import { CHAPTER_STATUS_LABEL } from '../../services/onboardingService'
import { Button } from '../ui/Button'
import { SYSTEM_DISCLAIMER, LOCAL_MODE_NOTICE } from '../../content/onboardingGuideContent'

/* 상태 배지 — 색상만이 아니라 아이콘·글자로 의미를 전달한다 (§21) */
const STATUS_STYLE: Record<
  ChapterDisplayStatus,
  { icon: typeof CheckCircle2; cls: string }
> = {
  completed: { icon: CheckCircle2, cls: 'bg-success-50 text-success-700 border-success-200' },
  in_progress: { icon: Clock, cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  guide_read: { icon: PlayCircle, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  not_started: { icon: CircleDashed, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  locked: { icon: Lock, cls: 'bg-slate-50 text-slate-400 border-slate-200' },
}

export function ChapterStatusBadge({ status }: { status: ChapterDisplayStatus }) {
  const { icon: Icon, cls } = STATUS_STYLE[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.82rem] font-medium ${cls}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {CHAPTER_STATUS_LABEL[status]}
    </span>
  )
}

/** 회색 안내 박스 (완료/디스클레이머) */
export function NoticeBox({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'warning'
  children: ReactNode
}) {
  const cls =
    tone === 'warning'
      ? 'border-warning-200 bg-warning-50/60 text-warning-800'
      : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <div className={`rounded-(--radius-card) border px-4 py-3 text-[0.95rem] break-keep ${cls}`}>
      {children}
    </div>
  )
}

export function DisclaimerNote() {
  return (
    <NoticeBox tone="warning">
      <span className="inline-flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{SYSTEM_DISCLAIMER}</span>
      </span>
    </NoticeBox>
  )
}

/* ------------------------------------------------------------------ */
/* 오늘 가장 먼저 할 일 (§6)                                            */
/* ------------------------------------------------------------------ */

export function TodayTaskCard({
  today,
  onGo,
  onCreateProject,
}: {
  today: TodayGuidance
  onGo: (path: string) => void
  onCreateProject: () => void
}) {
  if (!today.hasProject || !today.journey) {
    return (
      <section
        aria-label="오늘 가장 먼저 할 일"
        data-tour="today-task"
        className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5"
      >
        <h3 className="text-[1.3rem] font-bold break-keep text-slate-900">
          첫 프로젝트부터 함께 시작해 볼까요?
        </h3>
        <p className="mt-2 text-[1.05rem] break-keep text-slate-600">
          아직 등록된 프로젝트가 없습니다. 고객사와 프로젝트를 만들면 오늘 할 일을 단계별로 안내해 드립니다.
        </p>
        <div className="mt-4">
          <Button variant="primary" size="md" className="text-[1rem]" onClick={onCreateProject}>
            고객사와 프로젝트 만들기
          </Button>
        </div>
      </section>
    )
  }

  const j = today.journey
  const p = today.progress!
  if (today.allCompleted) {
    return (
      <section
        aria-label="오늘의 작업 안내"
        data-tour="today-task"
        className="rounded-(--radius-panel) border border-success-200 bg-success-50/50 p-5"
      >
        <p className="text-[0.9rem] font-medium text-success-700">
          {j.orgName} · {j.project.name}
        </p>
        <h3 className="mt-1 text-[1.3rem] font-bold break-keep text-slate-900">
          핵심 단계를 모두 마쳤습니다.
        </h3>
        <p className="mt-2 text-[1.05rem] break-keep text-slate-600">{j.reason}</p>
        <div className="mt-4">
          <Button variant="primary" size="md" className="text-[1rem]" onClick={() => onGo(j.actionPath)}>
            {j.actionLabel}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="오늘 가장 먼저 할 일"
      data-tour="today-task"
      className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.9rem] font-medium text-brand-700">
          {j.orgName} · {j.project.name}
        </p>
        <span className="text-[0.9rem] font-semibold text-slate-500">
          {p.stepText} · 현재 {p.currentStep.label}
        </span>
      </div>
      <p className="mt-2 text-[0.9rem] text-slate-500">오늘 가장 먼저 할 일</p>
      <h3 className="mt-0.5 text-[1.3rem] font-bold break-keep text-slate-900">{j.actionText}</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-[0.9rem] font-medium text-slate-500">왜 필요한가요?</dt>
          <dd className="text-[1.02rem] break-keep text-slate-700">{j.reason}</dd>
        </div>
        <div>
          <dt className="text-[0.9rem] font-medium text-slate-500">완료하면</dt>
          <dd className="text-[1.02rem] break-keep text-slate-700">{p.currentStep.detail}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="md" className="text-[1rem]" onClick={() => onGo(j.actionPath)}>
          {j.actionLabel}
        </Button>
        <span className="text-[0.9rem] text-slate-500">예상 소요시간: 약 {estimateMinutesFor(p)}분(대략)</span>
      </div>
    </section>
  )
}

/** 현재 단계의 대략적 안내 소요시간 (확정 아님, 안내용) */
function estimateMinutesFor(p: ProjectProgress): number {
  const key = p.currentStep.key
  const rough: Record<string, number> = {
    prepare: 5,
    diagnosis: 20,
    selection: 15,
    ax_design: 30,
    website_design: 30,
    deliverables: 20,
  }
  return rough[key] ?? 15
}

/* ------------------------------------------------------------------ */
/* 챕터 상세 (§8)                                                       */
/* ------------------------------------------------------------------ */

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-[1.1rem] font-semibold text-slate-800">{title}</h4>
      <div className="mt-1.5 text-[1.02rem] break-keep text-slate-600">{children}</div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((it, idx) => (
        <li key={idx}>{it}</li>
      ))}
    </ul>
  )
}

export function ChapterDetail({
  chapter,
  status,
  onGoRoute,
}: {
  chapter: TutorialChapter
  status: ChapterDisplayStatus
  onGoRoute: ((routeTemplate: string) => void) | null
}) {
  return (
    <article className="flex flex-col gap-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[1.5rem] font-bold break-keep text-slate-900">
            {chapter.order}. {chapter.title}
          </h3>
          <ChapterStatusBadge status={status} />
          {chapter.advanced && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.82rem] text-slate-500">
              고급 운영
            </span>
          )}
        </div>
        <p className="mt-2 text-[1.1rem] break-keep text-slate-600">{chapter.detailedPurpose}</p>
      </header>

      <DetailBlock title="왜 필요한가요?">{chapter.whyNeeded}</DetailBlock>
      <DetailBlock title="시작 전 필요한 것">
        <BulletList items={chapter.prerequisites} />
      </DetailBlock>
      <DetailBlock title="이 화면에서 하는 일">
        <BulletList items={chapter.tasks} />
      </DetailBlock>
      <DetailBlock title="입력 내용">
        <BulletList items={chapter.inputs} />
      </DetailBlock>
      {chapter.warnings.length > 0 && (
        <DetailBlock title="주의점">
          <BulletList items={chapter.warnings} />
        </DetailBlock>
      )}
      <DetailBlock title="완료 조건">
        <BulletList items={chapter.completionCriteria} />
      </DetailBlock>
      <DetailBlock title="완료 후 결과">
        <BulletList items={chapter.expectedOutputs} />
      </DetailBlock>
      <DetailBlock title="자주 하는 실수">
        <BulletList items={chapter.commonMistakes} />
      </DetailBlock>
      <DetailBlock title="다음 단계">{chapter.nextStepHint}</DetailBlock>
      {chapter.estimatedMinutes > 0 && (
        <p className="text-[0.9rem] text-slate-500">
          예상 소요시간: 약 {chapter.estimatedMinutes}분(대략적 안내입니다)
        </p>
      )}
      {chapter.showLocalModeNotice && <NoticeBox>{LOCAL_MODE_NOTICE}</NoticeBox>}

      {chapter.routeTemplate && onGoRoute && (
        <div>
          <Button
            variant="primary"
            size="md"
            className="text-[1rem]"
            onClick={() => onGoRoute(chapter.routeTemplate!)}
          >
            이 화면으로 이동하기
          </Button>
        </div>
      )}
    </article>
  )
}
