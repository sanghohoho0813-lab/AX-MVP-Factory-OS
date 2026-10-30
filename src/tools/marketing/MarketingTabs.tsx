/**
 * 마케팅 · 브랜딩 목차 (D-231) — 대표 "마케팅 브랜딩을 누르면 바로 콘텐츠 레이더가 뜨고, 홍보 글 · 홈페이지도 분석 · 채널 옆에
 * 목차로 — 굳이 나눌 필요 없다".
 *  - 한 줄 목차: 이번 주 찍을 것 · 인기 · 급상승 · 채널 · 분석 · 내 콘텐츠 | 스레드 · 릴스 · 틱톡(D-273) · 홍보 글 만들기 · 홈페이지 만들기.
 *  - 레이더 화면에서는 레이더 칸이 그 자리에서 바뀌고(onRadar), 홍보 글 · 홈페이지 화면에서는 레이더 칸이 /marketing 으로 간다.
 *  - 홍보 글 · 홈페이지 도구는 주소 · 화면이 그대로(웹 스튜디오 도구 줄 · 업체 상세 입구도 그대로) — 목차만 같은 줄에 둔다.
 *  - 마케팅 · 브랜딩은 대표 전용 — 팀장(Pilot) · 팀장 화면으로 볼 때는 도구 화면에 이 줄을 그리지 않는다.
 * D-295 대표가 준 아이콘(마케팅 한 장 — config/iconSlots 'mk-*'): 찍을 것 = YouTube · 스레드 = Threads · 릴스 · 틱톡 = Reels · TikTok ·
 *   블로그 · 플레이스 = 블로그 실제 로고, 나머지(인기 · 채널 · 분석 · 내 콘텐츠 · 홈페이지)는 입체 아이콘. 여러 색 그림이라 흰 칸 위에 그린다.
 */
import { Link } from 'react-router-dom'
import { AtSign, BarChart3, Clapperboard, Film, Flame, Globe, NotebookPen, PenLine, Tv, type LucideIcon } from 'lucide-react'
import { useIsPilot } from '../../auth/osAccess'
import { usePilotMarketing } from '../../config/pilotMarketing'
import { slotIcon } from '../../config/iconSlots'

export type RadarView = 'plan' | 'top' | 'channels' | 'analysis' | 'make'
export type MarketingTab = RadarView | 'threads' | 'shorts' | 'content' | 'homepage'

interface Item {
  key: MarketingTab
  label: string
  short: string
  icon: LucideIcon
  /** D-239 넓은 화면에서 이름 아래 작은 글 */
  sub?: string
}

export const RADAR_VIEWS: Item[] = [
  { key: 'plan', label: '이번 주 찍을 것', short: '찍을 것', icon: slotIcon('mk-plan', Clapperboard) },
  { key: 'top', label: '인기 · 급상승', short: '인기', icon: slotIcon('mk-top', Flame) },
  { key: 'channels', label: '채널', short: '채널', icon: slotIcon('mk-channels', Tv) },
  { key: 'analysis', label: '분석', short: '분석', icon: slotIcon('mk-analysis', BarChart3) },
  { key: 'make', label: '내 콘텐츠', short: '내 콘텐츠', icon: slotIcon('mk-make', NotebookPen) },
]
const TOOLS: Array<Item & { to: string; on: string }> = [
  // D-273 대표 "쓰레드는 원래 없던 부분 — 기능을 잘 만들어 달라" — 실측 공식 틀 23가지 · 규칙 검사 · 기록표
  { key: 'threads', label: '스레드', short: '스레드', sub: '(틀 23가지 · 글쓰기 · 기록표)', icon: slotIcon('mk-threads', AtSign), to: '/marketing/threads', on: 'from-slate-800 to-slate-950' },
  // D-273 대표 "릴스 틱톡 파트도 따로" — 숏폼 실측 공식 · 형식 5 · 대본 · 기록표
  { key: 'shorts', label: '릴스 · 틱톡', short: '릴스 · 틱톡', sub: '(쇼츠 · 대본 · 기록표)', icon: slotIcon('mk-shorts', Film), to: '/marketing/shorts', on: 'from-pink-600 to-orange-500' },
  // D-239 대표 "홍보 글 만들기 이름이 별로 — 블로그 · 플레이스 홍보 글 만들기, 아래에 (키워드 · 플레이스 · 블로그 등)"
  { key: 'content', label: '블로그 · 플레이스 홍보 글 만들기', short: '블로그 · 플레이스', sub: '(키워드 · 플레이스 · 블로그 등)', icon: slotIcon('mk-content', PenLine), to: '/tools/content', on: 'from-violet-700 to-fuchsia-700' },
  { key: 'homepage', label: '홈페이지 만들기', short: '홈페이지', icon: slotIcon('mk-homepage', Globe), to: '/tools/homepage', on: 'from-emerald-700 to-teal-700' },
]

const cls = (on: boolean) =>
  // 휴대폰: 아이콘 위 · 글자 아래(3칸 × 3줄 — D-273 스레드 · 릴스 · 틱톡이 늘어 9칸. 칸이 좁아도 글자가 잘리지 않게, 넘치면 줄바꿈) / sm 이상: 한 줄
  `tap t-sub inline-flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 py-1.5 text-center leading-tight font-semibold break-keep sm:min-w-max sm:flex-auto sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:whitespace-nowrap ${on ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-600 hover:bg-slate-50'}`

/** D-282 만들기 칸 — 흰 칸 + 형식 색 아이콘. 지금 화면이면 테두리 강조 */
const makeCls = (on: boolean) =>
  `tap t-sub flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-(--radius-control) border px-1.5 py-1.5 leading-tight font-semibold break-keep sm:flex-row sm:justify-start sm:gap-2 sm:px-2.5 ${on ? 'border-brand-500 bg-white text-slate-900 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'}`

function Label({ it }: { it: Item }) {
  const Icon = it.icon
  return (
    <>
      {/* D-295 여러 색 아이콘 — 빨간 칸(지금 화면)에서도 보이게 흰 칸 위에 · 칸을 넘지 않게 그대로 크기(--icon-art-scale 1) */}
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white [--icon-art-scale:1] sm:size-7">
        <Icon aria-hidden="true" className="size-5 shrink-0 sm:size-6" />
      </span>
      <span className="lg:hidden">{it.short}</span>
      {it.sub ? (
        <span className="hidden flex-col items-start leading-tight lg:flex">
          <span>{it.label}</span>
          <span className="t-meta font-normal opacity-80">{it.sub}</span>
        </span>
      ) : (
        <span className="hidden lg:inline">{it.label}</span>
      )}
    </>
  )
}

/** onRadar 가 있으면(레이더 화면) 레이더 칸은 그 자리에서 바꾼다 — 예전 시험 이름(yt-view-*) 그대로 */
export function MarketingTabs({ active, onRadar }: { active: MarketingTab; onRadar?: (v: RadarView) => void }) {
  const pilot = useIsPilot()
  // SAAS-2 서버가 마케팅을 연 고객 계정 — 레이더 · 스레드 · 릴스/틱톡까지(홍보 글 · 홈페이지는 1차 상품 정리 전까지 닫힘)
  const open = usePilotMarketing() === 'open'
  // 도구 화면에서 마케팅이 닫힌 팀장(Pilot)에게는 그리지 않는다
  if (pilot && !open && !onRadar) return null
  const tools = pilot ? TOOLS.filter((t) => t.key === 'threads' || t.key === 'shorts') : TOOLS
  /*
   * D-282 두 줄 — 위: 콘텐츠 레이더 보기(그 자리에서 바뀜) · 아래: 만들기(형식마다 색 아이콘 칸). 예전 한 줄은 넓은 화면에서도 두 줄로 어색하게 접혔다.
   * 칸 순서 · 시험 이름 · 주소는 그대로(찍을 것 · 인기 · 채널 · 분석 · 내 콘텐츠 → 스레드 · 릴스 · 틱톡 · 홍보 글 · 홈페이지).
   */
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" className="flex flex-col gap-2" data-testid="mk-tabs">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="t-meta shrink-0 font-semibold whitespace-nowrap text-slate-500 sm:w-[6.5rem]">콘텐츠 레이더</span>
        <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:flex sm:flex-wrap">
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
        </div>
      </div>
      {(!pilot || open) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="t-meta shrink-0 font-semibold whitespace-nowrap text-slate-500 sm:w-[6.5rem]">만들기</span>
          {/* D-354 넓은 화면 4칸은 칸이 좁아 이름 · 설명이 서너 줄로 접혔다 — 칸 폭(@container)이 넉넉할 때만 4칸, 아니면 2칸에 한 줄씩 */}
          <div className="@container min-w-0 flex-1">
          <div className={`grid min-w-0 gap-1.5 ${tools.length < TOOLS.length ? 'grid-cols-2' : 'grid-cols-4 sm:grid-cols-2 sm:@[70rem]:grid-cols-4'}`}>
            {tools.map((it) => (
              <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={makeCls(active === it.key)} data-testid={`mk-tab-${it.key}`}>
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white [--icon-art-scale:1]">
                  <it.icon className="size-8" />
                </span>
                <span className="min-w-0 text-center sm:text-left">
                  <span className="lg:hidden">{it.short}</span>
                  <span className="hidden min-w-0 flex-col leading-tight lg:flex">
                    <span className="truncate">{it.label}</span>
                    {it.sub && <span className="t-meta truncate font-normal text-slate-500">{it.sub}</span>}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          </div>
        </div>
      )}
    </nav>
  )
}
