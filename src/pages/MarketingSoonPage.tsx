/**
 * 마케팅 · 브랜딩 (D-169) — 도입 예정. 가입한 컨설턴트가 OS 안에서 블로그 · 유튜브 · SNS 까지 하게 될 자리.
 * 지금은 무엇이 들어올지 안내만 한다(아무것도 밖으로 보내지 않는다).
 * D-171 대표: 유튜브는 가로 영상, 릴스 · 쇼츠는 세로 영상으로 나누고, 카드마다 맞는 색 아이콘.
 */
import { Images, Megaphone, MonitorPlay, PenLine, Smartphone } from 'lucide-react'
import { Badge, ScreenTitle } from '../components/ui/primitives'

const PLANNED = [
  { icon: PenLine, tone: 'bg-green-50 text-green-700 ring-green-200', title: '블로그 글', text: '컨설팅 사례 · 제도 소식을 블로그 글로 쓰고 올리기' },
  { icon: MonitorPlay, tone: 'bg-red-50 text-red-600 ring-red-200', title: '유튜브 (가로 영상)', text: '긴 영상 대본 · 제목 · 설명 · 썸네일 문구 만들기' },
  { icon: Smartphone, tone: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-200', title: '릴스 · 쇼츠 (세로 영상)', text: '30~60초 세로 영상 대본 · 자막 · 첫 3초 문구 만들기' },
  { icon: Images, tone: 'bg-sky-50 text-sky-700 ring-sky-200', title: 'SNS · 카드뉴스', text: '같은 내용을 SNS 글 · 카드뉴스로 나눠 올리기' },
  { icon: Megaphone, tone: 'bg-amber-50 text-amber-700 ring-amber-200', title: '내 브랜딩', text: '소개 페이지 · 명함 문구 · 상담 신청 받기' },
]

export default function MarketingSoonPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <ScreenTitle title="마케팅 · 브랜딩" sub="도입 예정 — 이 OS 안에서 내 마케팅까지 합니다" />
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="marketing-planned">
        {PLANNED.map((x) => (
          <li key={x.title} className="flex gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4">
            <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) ring-1 ${x.tone}`}>
              <x.icon className="size-6" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="t-body font-bold break-keep text-slate-900">{x.title}</span>
                <Badge tone="brand">도입 예정</Badge>
              </span>
              <span className="t-sub break-keep text-slate-600">{x.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
