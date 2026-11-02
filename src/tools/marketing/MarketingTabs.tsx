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
import { useEffect, useRef } from 'react'
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

// D-507 대표 "60대 이상도 처음 딱 봐도" — 칸 이름은 쉬운 말(인기 영상 · 참고 채널 · 올리는 때 · 길이) · 열쇠(key) · 시험 이름은 그대로
export const RADAR_VIEWS: Item[] = [
  { key: 'plan', label: '이번 주 찍을 것', short: '찍을 것', icon: slotIcon('mk-plan', Clapperboard) },
  { key: 'top', label: '인기 영상', short: '인기 영상', icon: slotIcon('mk-top', Flame) },
  { key: 'channels', label: '참고 채널', short: '참고 채널', icon: slotIcon('mk-channels', Tv) },
  { key: 'analysis', label: '올리는 때 · 길이', short: '분석', icon: slotIcon('mk-analysis', BarChart3) },
  { key: 'make', label: '내 콘텐츠', short: '내 콘텐츠', sub: '(만든 것 모음)', icon: slotIcon('mk-make', NotebookPen) },
]
const TOOLS: Array<Item & { to: string; on: string }> = [
  // D-273 대표 "쓰레드는 원래 없던 부분 — 기능을 잘 만들어 달라" — 실측 공식 틀 23가지 · 규칙 검사 · 기록표
  { key: 'threads', label: '스레드', short: '스레드', sub: '(짧은 글 SNS · 틀 23가지 · 기록표)', icon: slotIcon('mk-threads', AtSign), to: '/marketing/threads', on: 'from-slate-800 to-slate-950' },
  // D-273 대표 "릴스 틱톡 파트도 따로" — 숏폼 실측 공식 · 형식 5 · 대본 · 기록표
  { key: 'shorts', label: '릴스 · 틱톡', short: '릴스 · 틱톡', sub: '(1분 세로 영상 대본 · 기록표)', icon: slotIcon('mk-shorts', Film), to: '/marketing/shorts', on: 'from-pink-600 to-orange-500' },
  // D-239 대표 "홍보 글 만들기 이름이 별로 — 블로그 · 플레이스 홍보 글 만들기, 아래에 (키워드 · 플레이스 · 블로그 등)"
  { key: 'content', label: '블로그 · 플레이스 홍보 글 만들기', short: '블로그 · 플레이스', sub: '(키워드 · 플레이스 · 블로그 등)', icon: slotIcon('mk-content', PenLine), to: '/tools/content', on: 'from-violet-700 to-fuchsia-700' },
  { key: 'homepage', label: '홈페이지 만들기', short: '홈페이지', sub: '(업체 소개 한 장 · 내려받기)', icon: slotIcon('mk-homepage', Globe), to: '/tools/homepage', on: 'from-emerald-700 to-teal-700' },
]

/*
 * D-478 대표 "마케팅 · 브랜딩 — 돈 받고 팔아도 될 만큼" — 휴대폰에서 목차가 첫 화면의 절반(약 250px · 아이콘 위 · 글자 아래 두 줄 9칸)을 먹었다.
 *  - 휴대폰(sm 아래): 한 줄 가로 넘김 띠(칸마다 아이콘 + 짧은 이름 · 지금 화면은 파란 테두리 · 처음 열 때 지금 칸이 보이게 띠를 옮긴다).
 *    두 묶음(콘텐츠 레이더 · 만들기)은 띠 안 작은 이름표로 — 묶음 칸은 display: contents 로 풀어 한 줄에 둔다(같은 단추 하나 — 시험 이름 · 순서 그대로).
 *  - PC(sm 이상): 예전 두 줄 그대로(위 레이더 · 아래 만들기 칸 — D-282 · D-354).
 */
const cls = (on: boolean) =>
  `tap t-sub inline-flex min-h-11 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2.5 py-1 text-center leading-tight font-semibold whitespace-nowrap sm:min-w-max sm:flex-auto sm:flex-row sm:gap-1.5 sm:rounded-[8px] sm:border-transparent sm:px-3 sm:py-2 ${on ? 'border-brand-500 bg-white text-brand-700 ring-2 ring-brand-100 sm:bg-brand-50 sm:ring-1 sm:ring-brand-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`

/** D-282 만들기 칸 — 흰 칸 + 형식 색 아이콘. 지금 화면이면 테두리 강조 */
const makeCls = (on: boolean) =>
  `tap t-sub flex min-h-11 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2.5 py-1 leading-tight font-semibold whitespace-nowrap sm:min-h-12 sm:min-w-0 sm:shrink sm:flex-row sm:justify-start sm:gap-2 sm:rounded-(--radius-control) sm:px-2.5 sm:py-1.5 sm:whitespace-normal sm:break-keep ${on ? 'border-brand-500 bg-white text-slate-900 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'}`

/** 휴대폰 띠 안 묶음 이름표 · PC 왼쪽 이름 칸 */
function GroupLabel({ long, short }: { long: string; short: string }) {
  return (
    <span className="t-meta flex shrink-0 items-center font-semibold whitespace-nowrap text-slate-500 max-sm:snap-start max-sm:px-1 max-sm:text-[0.6875rem] sm:w-[6.5rem]">
      <span className="sm:hidden">{short}</span>
      <span className="max-sm:hidden">{long}</span>
    </span>
  )
}

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
  const strip = useRef<HTMLDivElement>(null)
  // D-478 휴대폰 띠 — 처음 열 때 지금 칸이 화면 안에 오게(띠만 옮긴다 · 화면은 그대로)
  useEffect(() => {
    const el = strip.current
    if (!el || el.scrollWidth <= el.clientWidth + 1) return
    const on = el.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]')
    if (!on) return
    const left = on.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft
    el.scrollLeft = Math.max(0, left - (el.clientWidth - on.offsetWidth) / 2)
  }, [active])
  // 도구 화면에서 마케팅이 닫힌 팀장(Pilot)에게는 그리지 않는다
  if (pilot && !open && !onRadar) return null
  const tools = pilot ? TOOLS.filter((t) => t.key === 'threads' || t.key === 'shorts') : TOOLS
  /*
   * D-282 두 줄 — 위: 콘텐츠 레이더 보기(그 자리에서 바뀜) · 아래: 만들기(형식마다 색 아이콘 칸). 예전 한 줄은 넓은 화면에서도 두 줄로 어색하게 접혔다.
   * 칸 순서 · 시험 이름 · 주소는 그대로(찍을 것 · 인기 · 채널 · 분석 · 내 콘텐츠 → 스레드 · 릴스 · 틱톡 · 홍보 글 · 홈페이지).
   */
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" data-testid="mk-tabs">
      <div ref={strip} data-testid="mk-tabs-strip" className="flex gap-1.5 max-sm:snap-x max-sm:overflow-x-auto max-sm:pb-1 max-sm:[scrollbar-width:none] sm:flex-col sm:gap-2">
        <div className="max-sm:contents sm:flex sm:flex-row sm:items-center sm:gap-2">
          {/* D-507 '콘텐츠 레이더' → 쉬운 말 '살펴보기'(남의 인기 영상을 보고 고른다) */}
          <GroupLabel long="살펴보기" short="살펴보기" />
          <div className="max-sm:contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-wrap sm:gap-1 sm:rounded-(--radius-control) sm:border sm:border-slate-200 sm:bg-white sm:p-1">
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
          <div className="max-sm:contents sm:flex sm:flex-row sm:items-center sm:gap-2">
            <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-slate-200 sm:hidden" />
            <GroupLabel long="만들기" short="만들기" />
            {/* D-354 넓은 화면 4칸은 칸이 좁아 이름 · 설명이 서너 줄로 접혔다 — 칸 폭(@container)이 넉넉할 때만 4칸, 아니면 2칸에 한 줄씩 */}
            <div className="max-sm:contents sm:@container sm:min-w-0 sm:flex-1">
              <div className={`max-sm:contents sm:grid sm:min-w-0 sm:gap-1.5 ${tools.length < TOOLS.length ? 'sm:grid-cols-2' : 'sm:grid-cols-2 sm:@[70rem]:grid-cols-4'}`}>
                {tools.map((it) => (
                  <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={makeCls(active === it.key)} data-testid={`mk-tab-${it.key}`}>
                    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white [--icon-art-scale:1] sm:size-9">
                      <it.icon className="size-5 sm:size-8" />
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
      </div>
    </nav>
  )
}
