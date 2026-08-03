import {
  AlertTriangle,
  CalendarClock,
  Landmark,
  ListChecks,
  MessageSquareWarning,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  ConsultingOpsBrief,
  ConsultingOpsItem,
  ConsultingOpsRecommendation,
} from '../../services/consultingOpsService'
import { StatusBadge } from '../ui/StatusBadge'

interface ConsultingOpsBoardProps {
  brief: ConsultingOpsBrief
}

const STAT_CARDS = [
  { key: 'capacity', label: '월 운영 부하', icon: Users },
  { key: 'waiting', label: '고객 답변 대기', icon: MessageSquareWarning },
  { key: 'overdue', label: '마감 초과', icon: AlertTriangle },
  { key: 'funding', label: '정책자금 트랙', icon: Landmark },
] as const

const TONE_BAR_CLASS = {
  neutral: 'bg-slate-400',
  info: 'bg-brand-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  accent: 'bg-accent-600',
} as const

function OpsItemRow({ item }: { item: ConsultingOpsItem }) {
  return (
    <li>
      <Link
        to={`/projects/${item.projectId}`}
        className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_auto]"
      >
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-semibold text-slate-900">{item.clientName}</p>
          <p className="mt-0.5 truncate text-[0.875rem] text-slate-500">{item.projectName}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.92rem] font-medium text-slate-700">{item.nextAction}</p>
          <p className="mt-0.5 truncate text-[0.82rem] text-slate-400">{item.reason}</p>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <StatusBadge tone={item.tone}>{item.dueLabel}</StatusBadge>
          <span className="text-[0.82rem] font-medium text-slate-400">{item.progressLabel}</span>
        </div>
      </Link>
    </li>
  )
}

function EmptyLane({ children }: { children: string }) {
  return (
    <div className="px-5 py-8 text-center text-[0.9rem] text-slate-400">
      {children}
    </div>
  )
}

function OpsLane({ title, items, emptyText }: { title: string; items: ConsultingOpsItem[]; emptyText: string }) {
  return (
    <div className="min-w-0">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-[0.95rem] font-semibold text-slate-800">{title}</h3>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <OpsItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <EmptyLane>{emptyText}</EmptyLane>
      )}
    </div>
  )
}

function RecommendationCard({ item }: { item: ConsultingOpsRecommendation }) {
  return (
    <li className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.95rem] font-semibold break-keep text-slate-900">{item.title}</p>
        <StatusBadge tone={item.tone}>권장</StatusBadge>
      </div>
      <p className="mt-1.5 text-[0.86rem] leading-relaxed break-keep text-slate-500">{item.detail}</p>
    </li>
  )
}

export function ConsultingOpsBoard({ brief }: ConsultingOpsBoardProps) {
  const stats = {
    capacity: {
      value: `${brief.activeCount}/${brief.monthlyCapacityTarget}`,
      detail: brief.capacityLabel,
      tone: brief.activeCount >= brief.monthlyCapacityTarget ? 'warning' : 'info',
    },
    waiting: {
      value: String(brief.waitingClientCount),
      detail: '답변 필요',
      tone: brief.waitingClientCount > 0 ? 'warning' : 'success',
    },
    overdue: {
      value: String(brief.overdueCount),
      detail: '기한 지남',
      tone: brief.overdueCount > 0 ? 'danger' : 'success',
    },
    funding: {
      value: String(brief.fundingPipelineCount),
      detail: `자료화 ${brief.deliverablePipelineCount}건`,
      tone: brief.fundingPipelineCount > 0 ? 'accent' : 'neutral',
    },
  } as const

  return (
    <section aria-labelledby="consulting-ops" className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="consulting-ops" className="text-[15px] font-semibold text-slate-900">컨설팅 관제실</h2>
          <p className="mt-1 text-[0.875rem] text-slate-500">
            고객 답변, 마감, 정책자금 준비, 월 처리량을 한 번에 점검합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-[0.82rem] font-semibold text-brand-700">
            <TrendingUp aria-hidden="true" className="size-3.5" />
            오늘 초점: {brief.focusLabel}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.82rem] font-medium text-slate-500">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            프로젝트 데이터 기준
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => {
          const stat = stats[key]
          return (
            <div key={key} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.82rem] font-medium text-slate-400">{label}</span>
                <Icon aria-hidden="true" className="size-4 text-slate-300" />
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                <StatusBadge tone={stat.tone}>{stat.detail}</StatusBadge>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 border-t border-slate-100 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="min-w-0 border-b border-slate-100 px-5 py-4 xl:border-r xl:border-b-0">
          <div className="mb-3 flex items-center gap-2">
            <ListChecks aria-hidden="true" className="size-4 text-slate-400" />
            <h3 className="text-[0.95rem] font-semibold text-slate-800">자동 운영 판단</h3>
          </div>
          {brief.recommendations.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3 xl:grid-cols-1">
              {brief.recommendations.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <EmptyLane>추가 권장 판단이 없습니다.</EmptyLane>
          )}
        </div>

        <div className="min-w-0 px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp aria-hidden="true" className="size-4 text-slate-400" />
            <h3 className="text-[0.95rem] font-semibold text-slate-800">단계별 부하</h3>
          </div>
          {brief.stageLoads.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {brief.stageLoads.map((stage) => (
                <li key={stage.stage} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[0.9rem] font-medium text-slate-700">{stage.label}</p>
                      <span className="text-[0.82rem] font-semibold text-slate-400">{stage.count}건</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full ${TONE_BAR_CLASS[stage.tone]}`} style={{ width: `${stage.percent}%` }} />
                    </div>
                  </div>
                  {(stage.riskCount > 0 || stage.waitingCount > 0) && (
                    <StatusBadge tone={stage.riskCount > 0 ? 'danger' : 'warning'}>
                      {stage.riskCount > 0 ? `위험 ${stage.riskCount}` : `대기 ${stage.waitingCount}`}
                    </StatusBadge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLane>진행 중인 단계 부하가 없습니다.</EmptyLane>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-slate-100 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-w-0 border-b border-slate-100 xl:border-r xl:border-b-0">
          <OpsLane title="이번 주 병목 큐" items={brief.urgentItems} emptyText="긴급 병목이 없습니다." />
        </div>
        <div className="grid min-w-0 grid-cols-1 divide-y divide-slate-100">
          <OpsLane title="고객 답변 대기" items={brief.clientWaitingItems} emptyText="대기 중인 고객 답변이 없습니다." />
          <OpsLane title="정책자금 후속 조치" items={brief.fundingItems} emptyText="진행 중인 정책자금 트랙이 없습니다." />
        </div>
      </div>
    </section>
  )
}
