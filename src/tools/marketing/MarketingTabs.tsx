/**
 * 마케팅 · 브랜딩 목차 (D-231) — 대표 "마케팅 브랜딩을 누르면 바로 콘텐츠 레이더가 뜨고, 홍보 글 · 홈페이지도 분석 · 채널 옆에
 * 목차로 — 굳이 나눌 필요 없다".
 *  - 한 줄 목차: 이번 주 찍을 것 · 인기 · 급상승 · 채널 · 분석 · 내 콘텐츠 | 홍보 글 만들기 · 홈페이지 만들기.
 *  - 레이더 화면에서는 레이더 칸이 그 자리에서 바뀌고(onRadar), 홍보 글 · 홈페이지 화면에서는 레이더 칸이 /marketing 으로 간다.
 *  - 홍보 글 · 홈페이지 도구는 주소 · 화면이 그대로(웹 스튜디오 도구 줄 · 업체 상세 입구도 그대로) — 목차만 같은 줄에 둔다.
 *  - 마케팅 · 브랜딩은 대표 전용 — 팀장(Pilot) · 팀장 화면으로 볼 때는 도구 화면에 이 줄을 그리지 않는다.
 */
import { Link } from 'react-router-dom'
import { BarChart3, Clapperboard, Flame, Globe, NotebookPen, PenLine, Tv, type LucideIcon } from 'lucide-react'
import { useIsPilot } from '../../auth/osAccess'

export type RadarView = 'plan' | 'top' | 'channels' | 'analysis' | 'make'
export type MarketingTab = RadarView | 'content' | 'homepage'

interface Item {
  key: MarketingTab
  label: string
  short: string
  icon: LucideIcon
}

export const RADAR_VIEWS: Item[] = [
  { key: 'plan', label: '이번 주 찍을 것', short: '찍을 것', icon: Clapperboard },
  { key: 'top', label: '인기 · 급상승', short: '인기', icon: Flame },
  { key: 'channels', label: '채널', short: '채널', icon: Tv },
  { key: 'analysis', label: '분석', short: '분석', icon: BarChart3 },
  { key: 'make', label: '내 콘텐츠', short: '내 콘텐츠', icon: NotebookPen },
]
const TOOLS: Array<Item & { to: string; on: string }> = [
  { key: 'content', label: '홍보 글 만들기', short: '홍보 글', icon: PenLine, to: '/tools/content', on: 'from-violet-700 to-fuchsia-700' },
  { key: 'homepage', label: '홈페이지 만들기', short: '홈페이지', icon: Globe, to: '/tools/homepage', on: 'from-emerald-700 to-teal-700' },
]

const cls = (on: boolean, grad = 'from-red-600 to-rose-700') =>
  // 휴대폰: 아이콘 위 · 글자 아래(4칸 × 2줄 — 칸이 좁아도 글자가 잘리지 않게, 넘치면 줄바꿈) / sm 이상: 한 줄
  `tap t-sub inline-flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 py-1.5 text-center leading-tight font-semibold break-keep sm:min-w-max sm:flex-auto sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:whitespace-nowrap ${on ? `bg-gradient-to-r ${grad} text-white shadow-(--shadow-card)` : 'text-slate-600 hover:bg-white/70'}`

function Label({ it }: { it: Item }) {
  const Icon = it.icon
  return (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="lg:hidden">{it.short}</span>
      <span className="hidden lg:inline">{it.label}</span>
    </>
  )
}

/** onRadar 가 있으면(레이더 화면) 레이더 칸은 그 자리에서 바꾼다 — 예전 시험 이름(yt-view-*) 그대로 */
export function MarketingTabs({ active, onRadar }: { active: MarketingTab; onRadar?: (v: RadarView) => void }) {
  const pilot = useIsPilot()
  // 도구 화면에서 팀장(Pilot)에게는 그리지 않는다(마케팅 · 브랜딩은 대표 전용)
  if (pilot && !onRadar) return null
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" className="grid grid-cols-4 gap-1 rounded-(--radius-control) border border-rose-100 bg-rose-50/60 p-1 sm:flex sm:flex-wrap" data-testid="mk-tabs">
      {RADAR_VIEWS.map((it) =>
        onRadar ? (
          <button key={it.key} type="button" role="tab" aria-selected={active === it.key} data-testid={`yt-view-${it.key}`} onClick={() => onRadar(it.key as RadarView)} className={cls(active === it.key)}>
            <Label it={it} />
          </button>
        ) : (
          <Link key={it.key} to={it.key === 'plan' ? '/marketing' : `/marketing?view=${it.key}`} className={cls(false)} data-testid={`mk-tab-${it.key}`}>
            <Label it={it} />
          </Link>
        ),
      )}
      <span aria-hidden="true" className="mx-0.5 hidden w-px self-stretch bg-rose-200 sm:block" />
      {!pilot &&
        TOOLS.map((it) => (
          <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={cls(active === it.key, it.on)} data-testid={`mk-tab-${it.key}`}>
            <Label it={it} />
          </Link>
        ))}
    </nav>
  )
}
