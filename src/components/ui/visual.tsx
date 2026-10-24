/**
 * D-282 화면 공통 부품 2 — 아이콘 칸 · 바로가기 타일 · KPI 칸 · 단계 표시.
 *
 * primitives.tsx 의 색 계약을 그대로 따른다:
 *  - 기능 색(featureVisual)은 **아이콘 칸에만**. 카드 바탕은 흰색.
 *  - 급한 정도(빨강 · 주황)는 KPI 칸 위쪽 3px 선 + 숫자 색으로만(MetricTile 과 같다). 값이 0 이면 색 없음.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Lock, type LucideIcon } from 'lucide-react'
import { toneClass, type FeatureTone } from '../../config/featureVisual'
import type { Tone } from './primitives'

const TILE_SIZE = {
  sm: { box: 'size-8 rounded-lg', icon: 'size-4' },
  md: { box: 'size-10 rounded-xl', icon: 'size-5' },
  lg: { box: 'size-12 rounded-xl', icon: 'size-6' },
  xl: { box: 'size-14 rounded-2xl', icon: 'size-7' },
} as const

/** 기능 아이콘 칸 — 옅은 기능 색 바탕 + 진한 아이콘 */
export function IconTile({ icon: Icon, tone, size = 'md', className = '' }: { icon: LucideIcon; tone: FeatureTone; size?: keyof typeof TILE_SIZE; className?: string }) {
  const s = TILE_SIZE[size]
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${s.box} ${toneClass(tone).tile} ${className}`}>
      <Icon className={s.icon} strokeWidth={2} />
    </span>
  )
}

/**
 * 바로가기 타일 — 앱 런처처럼 아이콘이 먼저 읽힌다.
 *  - card: 흰 카드(PC 오늘 화면). 아이콘 · 이름 · 한 줄 설명.
 *  - icon: 테두리 없는 큰 아이콘 + 이름(휴대폰 홈 · 전체 기능) — 손가락으로 누르기 쉽게 칸 전체가 눌린다.
 * 잠긴 기능(요금제)은 감추지 않고 자물쇠 + '잠김' 을 글자로.
 */
export function AppTile({
  to,
  icon,
  tone,
  label,
  sub,
  badge,
  badgeTone = 'neutral',
  locked = false,
  variant = 'card',
  onClick,
  testId,
  dataKey,
}: {
  to: string
  icon: LucideIcon
  tone: FeatureTone
  label: string
  sub?: string
  /** 오른쪽 위 숫자(계약 고객 수 · 새 상담신청) — 0 · 없음이면 그리지 않는다 */
  badge?: string | null
  badgeTone?: 'neutral' | 'danger'
  locked?: boolean
  variant?: 'card' | 'icon'
  onClick?: () => void
  testId?: string
  dataKey?: string
}) {
  const badgeEl = badge ? (
    <span
      className={`t-meta flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-bold tabular-nums ${badgeTone === 'danger' ? 'bg-danger-500 text-white' : 'bg-slate-100 text-slate-600'}`}
    >
      {badge}
    </span>
  ) : null
  const lockEl = locked ? (
    <span className="t-meta inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 font-semibold text-slate-500">
      <Lock aria-hidden="true" className="size-3" />
      잠김
    </span>
  ) : null
  if (variant === 'icon') {
    return (
      <Link
        to={to}
        onClick={onClick}
        data-testid={testId}
        data-key={dataKey}
        aria-label={locked ? `${label} (잠김)` : undefined}
        className="tap relative flex min-w-0 flex-col items-center gap-1.5 rounded-(--radius-card) px-1 py-2 text-center hover:bg-slate-50"
      >
        <IconTile icon={icon} tone={tone} size="xl" />
        <span className="t-sub w-full font-semibold break-keep text-slate-800">{label}</span>
        {badge && (
          <span className={`t-meta absolute top-1 right-[calc(50%-2.4rem)] flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-bold tabular-nums ring-2 ring-white ${badgeTone === 'danger' ? 'bg-danger-500 text-white' : 'bg-slate-700 text-white'}`}>
            {badge}
          </span>
        )}
        {locked && <Lock aria-hidden="true" className="absolute top-1.5 right-[calc(50%-2.2rem)] size-4 text-slate-400" />}
      </Link>
    )
  }
  return (
    <Link
      to={to}
      onClick={onClick}
      data-testid={testId}
      data-key={dataKey}
      className={`ax-lift relative flex min-h-[4.75rem] min-w-0 items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3 text-left ${toneClass(tone).hoverRing}`}
    >
      <IconTile icon={icon} tone={tone} size="lg" />
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span className="t-body font-bold break-keep text-slate-900">{label}</span>
          {lockEl ?? badgeEl}
        </span>
        {sub && <span className="t-meta break-keep text-slate-500">{sub}</span>}
      </span>
    </Link>
  )
}

const KPI_EDGE: Record<Tone, string> = {
  neutral: '',
  brand: 'bg-brand-500',
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
}

const KPI_VALUE: Record<Tone, string> = {
  neutral: 'text-slate-900',
  brand: 'text-brand-700',
  danger: 'text-danger-700',
  warning: 'text-warning-700',
  success: 'text-success-700',
}

/**
 * KPI 한 칸 — 아이콘 칸 + 이름 + 큰 숫자 + 한 줄 설명. 누르면 그 목록으로.
 * 숫자는 화면이 실제로 센 것만 넣는다(지어낸 숫자 금지). 0 이면 색을 쓰지 않는다.
 */
export function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
  urgency = 'neutral',
  to,
  onClick,
  testId,
}: {
  icon: LucideIcon
  tone: FeatureTone
  label: string
  value: string
  hint?: ReactNode
  urgency?: Tone
  to?: string
  onClick?: () => void
  testId?: string
}) {
  const body = (
    <>
      {urgency !== 'neutral' && <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${KPI_EDGE[urgency]}`} />}
      <span className="flex items-center gap-2">
        <IconTile icon={icon} tone={tone} size="sm" />
        <span className="t-sub min-w-0 font-medium break-keep text-slate-600">{label}</span>
      </span>
      <strong className={`t-num t-num-wrap ${KPI_VALUE[urgency]}`}>{value}</strong>
      {hint && <span className="t-meta min-w-0 break-keep text-slate-500">{hint}</span>}
    </>
  )
  const cls = 'ax-lift relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white px-3.5 py-3 text-left'
  if (to)
    return (
      <Link to={to} onClick={onClick} className={`tap ${cls} hover:border-slate-300`} data-testid={testId}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`tap ${cls} cursor-pointer hover:border-slate-300`} data-testid={testId}>
        {body}
      </button>
    )
  return (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  )
}

export interface StepItem {
  key: string
  label: string
  state: 'done' | 'current' | 'todo'
  /** 단계 아래 작은 글(예: '저장됨 2개') */
  note?: string
  /** 누르면 그 단계로(없으면 글자만) */
  onClick?: () => void
  /** 줄(li)에 그대로 붙일 속성(시험 이름 · 원래 상태 낱말 등) — data-state 도 덮을 수 있다 */
  attrs?: Record<string, string>
}

/**
 * 단계 표시 — 끝난 단계(✓) · 지금 단계(테두리 강조) · 남은 단계(흐림).
 * 화면이 실제로 가진 상태만 넣는다 — 상태를 지어내지 않는다.
 */
export function StepProgress({ steps, label, testId }: { steps: StepItem[]; label: string; testId?: string }) {
  return (
    <ol aria-label={label} className="grid gap-y-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} data-testid={testId}>
      {steps.map((s, i) => {
        const dot =
          s.state === 'done'
            ? 'border-brand-600 bg-brand-600 text-white'
            : s.state === 'current'
              ? 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100'
              : 'border-slate-300 bg-white text-slate-500'
        const inner = (
          <>
            <span className="flex w-full items-center">
              <span aria-hidden="true" className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : s.state === 'todo' ? 'bg-slate-200' : 'bg-brand-500'}`} />
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[0.875rem] font-bold ${dot}`}>
                {s.state === 'done' ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span aria-hidden="true" className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'bg-transparent' : steps[i + 1]?.state === 'todo' ? 'bg-slate-200' : 'bg-brand-500'}`} />
            </span>
            <span className={`t-sub px-0.5 text-center leading-snug font-semibold break-keep ${s.state === 'current' ? 'text-brand-700' : s.state === 'done' ? 'text-slate-700' : 'text-slate-500'}`}>
              {s.label}
              {s.state === 'current' && <span className="sr-only"> (지금 단계)</span>}
              {s.state === 'done' && <span className="sr-only"> (끝남)</span>}
            </span>
            {s.note && <span className="t-meta px-0.5 text-center break-keep text-slate-500">{s.note}</span>}
          </>
        )
        return (
          <li key={s.key} className="min-w-0" data-step={s.key} data-state={s.state} {...s.attrs}>
            {s.onClick ? (
              <button type="button" onClick={s.onClick} className="tap flex w-full cursor-pointer flex-col items-center gap-1 rounded-(--radius-control) py-1 hover:bg-slate-50" aria-current={s.state === 'current' ? 'step' : undefined}>
                {inner}
              </button>
            ) : (
              <span className="flex w-full flex-col items-center gap-1 py-1" aria-current={s.state === 'current' ? 'step' : undefined}>
                {inner}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
