import {
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  MessageSquareText,
  RotateCcw,
  TimerReset,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { organizationRepository, projectRepository } from '../repositories'
import { useStoreVersion } from '../lib/useStoreVersion'
import { buildConsultingDailyPlan, type ConsultingDailyAction } from '../services/consultingOpsService'
import {
  clearTodayOpsCompletions,
  getCompletedOpsActionIds,
  getTodayOpsDateKey,
  setOpsActionCompleted,
} from '../services/opsExecutionService'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useToast } from '../components/ui/toastContext'

const LANE_LABEL = {
  recover: '병목 회복',
  client: '고객 회신',
  funding: '정책자금',
  advance: '단계 전환',
  protect: '운영 보호',
} as const

function ActionCard({ action }: { action: ConsultingDailyAction }) {
  const { showToast } = useToast()

  const toggleDone = () => {
    setOpsActionCompleted(action.id, !action.completed)
    showToast(action.completed ? '오늘 할 일 완료를 취소했습니다.' : '오늘 할 일을 완료 처리했습니다.')
  }

  const copyScript = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(action.script)
      showToast('실행 메모를 복사했습니다.')
    } catch {
      showToast('복사하지 못했습니다. 메모를 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <li className={`rounded-(--radius-panel) border bg-white shadow-(--shadow-card) ${action.completed ? 'border-success-200' : 'border-slate-200'}`}>
      <div className="flex flex-col gap-4 px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={action.tone}>{LANE_LABEL[action.lane]}</StatusBadge>
            <span className="text-[0.82rem] font-medium text-slate-400">{action.dueLabel}</span>
            <span className="text-[0.82rem] font-medium text-slate-400">{action.estimatedMinutes}분</span>
          </div>
          <h2 className="mt-2 text-[1.05rem] font-bold break-keep text-slate-900">{action.title}</h2>
          <p className="mt-1 text-[0.9rem] leading-relaxed break-keep text-slate-500">{action.detail}</p>
          <div className="mt-3 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="text-[0.82rem] font-semibold text-slate-500">실행 메모</p>
            <p className="mt-1 text-[0.88rem] leading-relaxed break-keep text-slate-700">{action.script}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="rounded-(--radius-card) border border-slate-200 px-3.5 py-3">
            <p className="text-[0.82rem] font-semibold text-slate-500">완료 체크</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {action.checklist.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[0.84rem] break-keep text-slate-600">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={action.completed ? 'secondary' : 'primary'} size="sm" onClick={toggleDone}>
              <CheckCircle2 aria-hidden="true" className="size-4" />
              {action.completed ? '완료 취소' : '완료'}
            </Button>
            <Button variant="secondary" size="sm" onClick={copyScript}>
              <ClipboardCopy aria-hidden="true" className="size-4" />
              복사
            </Button>
          </div>
          <Link
            to={action.path}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.875rem] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            작업 화면 열기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </li>
  )
}

export function TodayOpsPage() {
  const version = useStoreVersion()
  const { showToast } = useToast()
  const dateKey = getTodayOpsDateKey()
  const plan = useMemo(() => {
    void version
    const projects = projectRepository.getAll()
    const organizations = organizationRepository.getAll()
    return buildConsultingDailyPlan(projects, organizations, getCompletedOpsActionIds(dateKey))
  }, [dateKey, version])

  const resetDone = () => {
    clearTodayOpsCompletions(dateKey)
    showToast('오늘 완료 표시를 초기화했습니다.')
  }

  const copyBatchReminder = async () => {
    try {
      if (!navigator.clipboard || !plan.batchReminderScript) throw new Error('No reminder script')
      await navigator.clipboard.writeText(plan.batchReminderScript)
      showToast('고객 회신 리마인드 묶음을 복사했습니다.')
    } catch {
      showToast('복사할 고객 회신 리마인드가 없습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="오늘 할 일"
        description="마감, 고객 답변, 정책자금, 단계 전환을 기준으로 오늘 처리 순서를 자동으로 정리합니다."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={copyBatchReminder} disabled={!plan.batchReminderScript}>
              <MessageSquareText aria-hidden="true" className="size-4" />
              회신 묶음 복사
            </Button>
            <Button variant="secondary" size="sm" onClick={resetDone} disabled={plan.completedMinutes === 0}>
              <RotateCcw aria-hidden="true" className="size-4" />
              완료 초기화
            </Button>
          </>
        }
      />

      <section className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/70 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">{plan.dateLabel}</StatusBadge>
              <StatusBadge tone={plan.plannedMinutes > 240 ? 'warning' : 'success'}>{plan.workModeLabel}</StatusBadge>
            </div>
            <h1 className="mt-2 text-xl font-bold break-keep text-slate-900">{plan.headline}</h1>
            <p className="mt-1 text-[0.92rem] break-keep text-slate-600">
              총 {plan.actions.length}개 액션, 예상 {plan.plannedMinutes}분 중 {plan.completedMinutes}분 완료
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-[0.84rem] font-medium text-brand-700">
              <span>오늘 실행률</span>
              <span>{plan.completionPercent}%</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={plan.completionPercent} tone="info" label="오늘 실행률" />
            </div>
          </div>
        </div>
      </section>

      <Panel title="이번 주 예보">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[0.82rem] font-semibold text-slate-500">7일 운영 요약</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[0.78rem] text-slate-400">예정/지연</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">{plan.weeklyForecast.totalDueCount}건</dd>
              </div>
              <div>
                <dt className="text-[0.78rem] text-slate-400">과부하일</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">{plan.weeklyForecast.overloadedDays}일</dd>
              </div>
              <div>
                <dt className="text-[0.78rem] text-slate-400">회신 회수</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">{plan.weeklyForecast.clientFollowUps}건</dd>
              </div>
              <div>
                <dt className="text-[0.78rem] text-slate-400">자금 후속</dt>
                <dd className="mt-0.5 text-xl font-bold text-slate-900">{plan.weeklyForecast.fundingFollowUps}건</dd>
              </div>
            </dl>
          </div>

          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {plan.weeklyForecast.days.map((day) => (
              <li key={day.key} className="rounded-(--radius-card) border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-2 xl:flex-col xl:items-start">
                  <div>
                    <p className="text-[0.9rem] font-semibold text-slate-900">{day.label}</p>
                    <p className="text-[0.76rem] text-slate-400">{day.dateLabel}</p>
                  </div>
                  <StatusBadge tone={day.tone}>{day.focus}</StatusBadge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="text-xl font-bold text-slate-900">{day.dueCount}</span>
                  <span className="text-[0.78rem] font-medium text-slate-400">{day.plannedMinutes}분</span>
                </div>
                {day.overdueCount > 0 && (
                  <p className="mt-1 text-[0.78rem] font-semibold text-danger-600">지연 {day.overdueCount}건 포함</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      <Panel title="시간 블록">
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {plan.timeBlocks.map((block) => (
            <li key={block.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={block.tone}>{block.timeLabel}</StatusBadge>
                <span className="inline-flex items-center gap-1 text-[0.82rem] font-medium text-slate-400">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {block.totalMinutes}분
                </span>
              </div>
              <p className="mt-2 text-[0.98rem] font-semibold text-slate-900">{block.label}</p>
              <p className="mt-1 text-[0.86rem] leading-relaxed break-keep text-slate-500">{block.intent}</p>
              <p className="mt-2 text-[0.82rem] font-medium text-slate-400">액션 {block.actionIds.length}개</p>
            </li>
          ))}
        </ol>
      </Panel>

      <section aria-labelledby="today-actions" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="today-actions" className="text-[1.05rem] font-bold text-slate-900">실행 큐</h2>
          <span className="inline-flex items-center gap-1.5 text-[0.86rem] font-medium text-slate-400">
            <TimerReset aria-hidden="true" className="size-4" />
            완료한 일은 오늘 날짜에만 저장됩니다
          </span>
        </div>
        {plan.actions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {plan.actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </ul>
        ) : (
          <Panel title="실행 큐">
            <p className="text-[0.9rem] break-keep text-slate-500">
              오늘 처리할 활성 프로젝트가 없습니다. 신규 상담을 받거나 기존 고객사 정보를 정리하기 좋은 상태입니다.
            </p>
          </Panel>
        )}
      </section>
    </div>
  )
}
