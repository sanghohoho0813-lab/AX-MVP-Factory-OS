/**
 * 마케팅 · 브랜딩 (D-169) — 도입 예정. 가입한 컨설턴트가 OS 안에서 블로그 · 유튜브 · SNS 까지 하게 될 자리.
 * 지금은 무엇이 들어올지 안내만 한다(아무것도 밖으로 보내지 않는다).
 * D-171 대표: 유튜브는 가로 영상, 릴스 · 쇼츠는 세로 영상으로 나누고, 카드마다 맞는 색 아이콘.
 * D-193: 맨 위에 '지금 바로 쓸 수 있어요' — 유튜브 벤치마킹(대표가 예전에 만든 대시보드를 옮김). 도입 예정 카드는 그대로.
 * D-206: 대표 "홍보 글 · 홈페이지 툴도 마케팅 · 브랜딩에" — 바로 쓰기에 홍보 글 만들기 · 홈페이지 만들기(업체를 고르면 그 업체로).
 * D-226: 대표 "색이 안 들어가 눈에 하나도 안 들어온다" — 바로 쓰기 세 도구를 도구 색(빨강 · 보라 · 초록) 큰 카드로, 할 수 있는 일을 색 꼬리표로.
 * D-231: 마케팅 · 브랜딩(/marketing)을 누르면 바로 콘텐츠 레이더 — 이 안내 화면은 /marketing/more 로 옮겼다(지운 것 없음).
 */
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Globe, Images, Megaphone, MonitorPlay, PenLine, Smartphone, type LucideIcon } from 'lucide-react'
import { Badge, ScreenTitle } from '../components/ui/primitives'
import { HintTip } from '../components/ui/fold'
import { hintFor } from '../content/sectionHints'

interface LiveTool {
  to: string
  testId: string
  icon: LucideIcon
  title: string
  text: string
  /** 할 수 있는 일 — 색 꼬리표 */
  can: string[]
  band: string
  border: string
  tag: string
  cta: string
}

/** 바로 쓰기 — 콘텐츠 레이더(대표 채널) · 업체 홍보 도구 둘(웹 스튜디오와 같은 화면 · 같은 주소) */
const LIVE_TOOLS: LiveTool[] = [
  {
    to: '/marketing/youtube',
    testId: 'marketing-youtube',
    icon: BarChart3,
    title: '콘텐츠 레이더',
    text: 'YouTube 벤치마킹 — 이번 주에 찍을 주제 후보와 근거 · 평소보다 터진 영상 · 콘텐츠 수첩',
    can: ['이번 주 찍을 것', '터진 영상', '급상승 주제'],
    band: 'from-red-600 to-rose-700',
    border: 'border-red-200 hover:border-red-400',
    tag: 'bg-red-50 text-red-700',
    cta: 'text-red-700',
  },
  {
    to: '/tools/content',
    testId: 'marketing-content',
    icon: PenLine,
    title: '홍보 글 만들기',
    text: '업체 기록으로 키워드 · 블로그 · 짧은/긴 영상 대본 · 카드뉴스 · 카톡 소식 · 플레이스 소개 — 먼저 만들 글 3개 추천',
    can: ['블로그', '쇼츠 대본', '카드뉴스', '카톡 소식', '한 달 계획'],
    band: 'from-violet-700 to-fuchsia-700',
    border: 'border-violet-200 hover:border-violet-400',
    tag: 'bg-violet-50 text-violet-700',
    cta: 'text-violet-700',
  },
  {
    to: '/tools/homepage',
    testId: 'marketing-homepage',
    icon: Globe,
    title: '홈페이지 만들기',
    text: '업체 기록 → 업종 견본 홈페이지(그림 · 아이콘 카드) · PC/휴대폰 미리보기 · HTML 내려받기',
    can: ['업종 견본', '디자인 한 번에', '점수 · 점검', 'HTML 내려받기'],
    band: 'from-emerald-700 to-teal-700',
    border: 'border-emerald-200 hover:border-emerald-400',
    tag: 'bg-emerald-50 text-emerald-700',
    cta: 'text-emerald-700',
  },
]

const PLANNED = [
  { icon: PenLine, tone: 'bg-green-50 text-green-700 ring-green-200', title: '블로그 글', text: '컨설팅 사례 · 제도 소식을 블로그 글로 쓰고 올리기' },
  { icon: MonitorPlay, tone: 'bg-red-50 text-red-600 ring-red-200', title: '유튜브 (가로 영상)', text: '긴 영상 대본 · 제목 · 설명 · 썸네일 문구 만들기' },
  { icon: Smartphone, tone: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-200', title: '릴스 · 쇼츠 (세로 영상)', text: '30~60초 세로 영상 대본 · 자막 · 첫 3초 문구 만들기' },
  { icon: Images, tone: 'bg-sky-50 text-sky-700 ring-sky-200', title: 'SNS · 카드뉴스', text: '같은 내용을 SNS 글 · 카드뉴스로 나눠 올리기' },
  { icon: Megaphone, tone: 'bg-amber-50 text-amber-700 ring-amber-200', title: '내 브랜딩', text: '소개 페이지 · 명함 문구 · 상담 신청 받기' },
]

export default function MarketingSoonPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <ScreenTitle title="마케팅 · 브랜딩" sub="이 OS 안에서 내 마케팅까지 합니다" />
      <section className="flex flex-col gap-3" data-testid="marketing-live">
        <HintTip tip={hintFor('지금 바로 쓸 수 있어요')} label="지금 바로 쓸 수 있어요">
          <h2 className="t-section text-slate-900">지금 바로 쓸 수 있어요</h2>
        </HintTip>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {LIVE_TOOLS.map((x) => (
            <Link key={x.to} to={x.to} data-testid={x.testId} className={`tap group flex min-w-0 flex-col overflow-hidden rounded-(--radius-panel) border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${x.border}`}>
              {/* 도구 색 띠 — 흰 글자가 읽히는 진한 단계만 */}
              <span className={`relative flex items-center gap-3 overflow-hidden bg-gradient-to-br p-4 text-white ${x.band}`}>
                <span aria-hidden="true" className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full bg-white/10" />
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                  <x.icon className="size-6" />
                </span>
                <span className="relative flex min-w-0 flex-1 flex-col">
                  <span className="t-card font-bold break-keep text-white">{x.title}</span>
                  <span className="t-meta font-semibold text-white/90">바로 쓰기</span>
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2.5 p-4">
                <span className="t-sub break-keep text-slate-700">{x.text}</span>
                <span className="flex flex-wrap gap-1.5">
                  {x.can.map((c) => (
                    <span key={c} className={`t-meta rounded-full px-2 py-0.5 font-semibold ${x.tag}`}>
                      {c}
                    </span>
                  ))}
                </span>
                <span className={`t-sub mt-auto inline-flex items-center gap-1 pt-1 font-bold ${x.cta}`}>
                  열기
                  <ArrowRight aria-hidden="true" className="size-4 group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <HintTip tip={hintFor('도입 예정')} label="도입 예정">
        <h2 className="t-section text-slate-900">도입 예정</h2>
      </HintTip>
      <ul className="-mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="marketing-planned">
        {PLANNED.map((x) => (
          <li key={x.title} className="flex gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4">
            <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) ring-1 ${x.tone}`}>
              <x.icon className="size-6" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="t-body font-bold break-keep text-slate-900">{x.title}</span>
                <Badge tone="neutral">도입 예정</Badge>
              </span>
              <span className="t-sub break-keep text-slate-600">{x.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
