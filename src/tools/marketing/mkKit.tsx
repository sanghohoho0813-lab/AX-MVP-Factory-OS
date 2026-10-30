/**
 * 마케팅 · 브랜딩 색 부품 (D-226) — 대표 "색이 안 들어가 UI 가 눈에 하나도 안 들어온다 · 최소한 콘텐츠 레이더처럼".
 *
 * OS 테마 색(brand-*)은 오닉스 골드 같은 테마에서 회색에 가까워져, 홍보 글 · 홈페이지 화면이 온통 회색이었다.
 * 마케팅 화면은 테마와 상관없이 도구마다 정해 둔 색을 쓴다 — 홍보 글 = 보라 · 홈페이지 = 초록 · 콘텐츠 레이더 = 빨강.
 * 글 종류 · 상황 · 블록마다 색 아이콘 하나씩(콘텐츠 레이더 구역 제목처럼). 작은 글자는 바탕과 대비 4.5 이상인 단계만 쓴다.
 *
 * D-227 길잡이 — 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 토스처럼 누르면 다음 단계로".
 *  - MkSteps: 지금 몇 단계인지(지난 단계 ✓ · 지금 단계 색 · 남은 단계 회색) — 누르면 그 단계로.
 *  - MkPick: 여러 길 중 하나만 고르는 큰 칸 — 고른 것만 아래에 펼친다(나머지는 숨김 · 지우지 않음).
 */
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ContentKind } from '../../services/contentStudio'
import { HintTip } from '../../components/ui/fold'
import { hintFor } from '../../content/sectionHints'
import { HERO, KIND_STYLE, TONE, type MkTone } from './mkTheme'

/** 구역 제목 앞 색 아이콘 */
export function MkIcon({ icon: Icon, tone, size = 'md' }: { icon: LucideIcon; tone: MkTone; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-11 rounded-xl' : size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-lg'
  const ico = size === 'lg' ? 'size-6' : size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${box} ${TONE[tone].icon}`}>
      <Icon className={ico} />
    </span>
  )
}

/**
 * 구역 제목줄 — 색 아이콘 + 제목 + ? 설명 + 오른쪽 한 줄.
 * 설명은 help 를 주거나, 제목이 글자면 목차 설명 사전에서 찾는다(없으면 ? 없이).
 */
export function MkHead({ icon, tone, title, aside, help, children }: { icon: LucideIcon; tone: MkTone; title: ReactNode; aside?: ReactNode; help?: string; children?: ReactNode }) {
  const name = typeof title === 'string' ? title : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <HintTip tip={help ?? (name ? hintFor(name) : undefined)} label={name}>
        <h2 className="t-section flex min-w-0 items-center gap-2.5 text-slate-900">
          <MkIcon icon={icon} tone={tone} />
          <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{title}</span>
          {children}
        </h2>
      </HintTip>
      {aside && <span className="t-sub break-keep text-slate-600">{aside}</span>}
    </div>
  )
}

export interface MkStat {
  label: string
  value: ReactNode
  testId?: string
}

/** 도구 머리 띠 — 진한 색 그라데이션 + 흰 글자 + 숫자 알약 */
export function MkHero({
  tone,
  icon: Icon,
  eyebrow,
  title,
  sub,
  stats,
  actions,
  children,
  testId,
}: {
  tone: keyof typeof HERO
  icon: LucideIcon
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  stats?: MkStat[]
  actions?: ReactNode
  children?: ReactNode
  testId?: string
}) {
  return (
    // D-370 머리 띠도 흰 칸 — 색 그라데이션 · 장식 동그라미 대신 아래 얇은 줄 하나(tone 은 이름만 남는다)
    <div className="relative overflow-hidden border-b border-slate-100 bg-white p-4 text-slate-900 sm:p-5" data-testid={testId} data-tone={tone}>
      <div className="relative flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          {eyebrow && <p className="t-meta font-semibold tracking-wide text-slate-500">{eyebrow}</p>}
          <h2 className="t-section break-keep text-slate-900 [overflow-wrap:anywhere]">{title}</h2>
          {sub && <p className="t-sub mt-0.5 break-keep text-slate-600">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <dl className="relative mt-3 flex flex-wrap gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5 rounded-full bg-slate-100 px-3 py-1" data-testid={s.testId}>
              <dt className="t-meta text-slate-600">{s.label}</dt>
              <dd className="t-sub font-bold tabular-nums text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children && <div className="relative mt-3">{children}</div>}
    </div>
  )
}

/** 글 종류 아이콘만(글자 옆) */
export function KindGlyph({ kind, className = 'size-4' }: { kind: ContentKind; className?: string }) {
  const Icon = KIND_STYLE[kind].icon
  return <Icon className={className} aria-hidden="true" />
}

/** 작은 색 꼬리표 */
export function MkTag({ tone, children, testId }: { tone: MkTone; children: ReactNode; testId?: string }) {
  return (
    <span className={`t-meta inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-0.5 font-semibold break-keep ${TONE[tone].icon}`} data-testid={testId}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* D-227 길잡이                                                          */
/* ------------------------------------------------------------------ */

export interface MkStep {
  key: string
  label: string
}

/**
 * 단계 표시 — ① 고르기 → ② 다듬기 → ③ 저장처럼. current 는 0부터.
 * onGo 를 주면 지난 단계 · 지금 단계를 눌러 그 자리로 간다(남은 단계는 누를 수 없다 — 순서를 건너뛰지 않게).
 */
export function MkSteps({ steps, current, tone, onGo, testId }: { steps: MkStep[]; current: number; tone: MkTone; onGo?: (key: string) => void; testId?: string }) {
  const t = TONE[tone]
  return (
    <ol className="flex w-full min-w-0 items-start" data-testid={testId} data-current={steps[current]?.key ?? ''} aria-label="진행 단계">
      {steps.map((s, i) => {
        const done = i < current
        const now = i === current
        const can = !!onGo && i <= current
        const dot = (
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${done ? `${t.solid}` : now ? `${t.solid} ring-4 ring-offset-0 ${t.line.replace('border-', 'ring-')}` : 'bg-slate-200 text-slate-500'}`}>
            {done ? <Check aria-hidden="true" className="size-4" /> : i + 1}
          </span>
        )
        const label = <span className={`t-meta mt-1 block text-center break-keep ${now ? `font-bold ${t.deep}` : done ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{s.label}</span>
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-start" data-step={s.key} data-state={done ? 'done' : now ? 'now' : 'todo'} aria-current={now ? 'step' : undefined}>
            {can ? (
              <button type="button" onClick={() => onGo?.(s.key)} className="tap flex w-full min-w-0 flex-col items-center rounded-(--radius-control) px-0.5 hover:bg-slate-50" data-testid="mk-step">
                {dot}
                {label}
              </button>
            ) : (
              <span className="flex w-full min-w-0 flex-col items-center px-0.5" data-testid="mk-step">
                {dot}
                {label}
              </span>
            )}
            {i < steps.length - 1 && <span aria-hidden="true" className={`mt-4 h-0.5 w-3 shrink-0 rounded-full sm:w-6 ${i < current ? t.solid.split(' ')[0] : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export interface MkPickOption {
  key: string
  label: string
  hint?: string
  icon: LucideIcon
  tone: MkTone
  /** 오른쪽 위 작은 숫자(상황 12 · 계획 진행 3/8 …) */
  badge?: ReactNode
}

/** 여러 길 중 하나 고르기 — 큰 칸(아이콘 · 이름 · 한 줄). 고른 칸만 진한 색 */
export function MkPick({ options, value, onChange, label, testId, cols = 4 }: { options: MkPickOption[]; value: string; onChange: (key: string) => void; label: string; testId?: string; cols?: 2 | 3 | 4 | 5 }) {
  const grid = cols === 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
  return (
    <div role="tablist" aria-label={label} className={`grid gap-2 ${grid}`} data-testid={testId}>
      {options.map((o) => {
        const on = o.key === value
        const t = TONE[o.tone]
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            // 휴대폰(두 칸)은 아이콘을 위 줄에 — 옆에 두면 이름이 세 줄로 짜부라진다
            className={`tap relative flex min-h-16 min-w-0 flex-col items-start gap-1.5 rounded-(--radius-control) border-2 px-3 py-2.5 text-left transition-shadow sm:flex-row sm:gap-2.5 ${on ? `border-transparent shadow-md ${t.solid}` : `bg-white ${t.line} ${t.hover} hover:shadow-sm`}`}
            data-testid="mk-pick"
            data-key={o.key}
          >
            <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-white/20' : t.icon}`}>
              <o.icon className="size-5" />
            </span>
            <span className="w-full min-w-0 flex-1 pr-5 sm:pr-4">
              <span className={`t-body block font-bold break-keep ${on ? '' : 'text-slate-900'}`}>{o.label}</span>
              {o.hint && <span className={`t-meta block break-keep ${on ? 'opacity-90' : 'text-slate-500'}`}>{o.hint}</span>}
            </span>
            {o.badge !== undefined && o.badge !== null && o.badge !== '' && (
              <span className={`t-meta absolute top-1.5 right-1.5 rounded-full px-1.5 font-bold tabular-nums ${on ? 'bg-white/25' : t.icon}`}>{o.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
