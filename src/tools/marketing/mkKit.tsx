/**
 * 마케팅 · 브랜딩 색 부품 (D-226) — 대표 "색이 안 들어가 UI 가 눈에 하나도 안 들어온다 · 최소한 콘텐츠 레이더처럼".
 *
 * OS 테마 색(brand-*)은 오닉스 골드 같은 테마에서 회색에 가까워져, 홍보 글 · 홈페이지 화면이 온통 회색이었다.
 * 마케팅 화면은 테마와 상관없이 도구마다 정해 둔 색을 쓴다 — 홍보 글 = 보라 · 홈페이지 = 초록 · 콘텐츠 레이더 = 빨강.
 * 글 종류 · 상황 · 블록마다 색 아이콘 하나씩(콘텐츠 레이더 구역 제목처럼). 작은 글자는 바탕과 대비 4.5 이상인 단계만 쓴다.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ContentKind } from '../../services/contentStudio'
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

/** 구역 제목줄 — 색 아이콘 + 제목 + 오른쪽 한 줄 */
export function MkHead({ icon, tone, title, aside, children }: { icon: LucideIcon; tone: MkTone; title: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="t-section flex min-w-0 items-center gap-2.5 text-slate-900">
        <MkIcon icon={icon} tone={tone} />
        <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{title}</span>
        {children}
      </h2>
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
    <div className={`relative overflow-hidden bg-gradient-to-br ${HERO[tone]} p-4 text-white sm:p-5`} data-testid={testId}>
      {/* 장식 동그라미 — 눌리지 않고 읽히지 않는다 */}
      <span aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 size-44 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-28 size-32 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          {eyebrow && <p className="t-meta font-semibold tracking-wide text-white/90">{eyebrow}</p>}
          <h2 className="t-section break-keep text-white [overflow-wrap:anywhere]">{title}</h2>
          {sub && <p className="t-sub mt-0.5 break-keep text-white/90">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <dl className="relative mt-3 flex flex-wrap gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25" data-testid={s.testId}>
              <dt className="t-meta text-white/90">{s.label}</dt>
              <dd className="t-sub font-bold tabular-nums text-white">{s.value}</dd>
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
