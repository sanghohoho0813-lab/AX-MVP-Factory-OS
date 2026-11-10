/**
 * D-567 고객 계정 첫 화면(업체 0곳) — '어디서 시작할까요?' 두 갈래.
 * 대표(2026-11-10): "컨설턴트들이 가장 원하는 건 마케팅(고객 DB 확보) — 어디서부터 시작해야 할지 모르는 사람이 대부분."
 * 예전에는 고객 계정도 '등록된 업체가 없습니다 · 첫 업체 등록' 하나만 보였다(마케팅부터 하고 싶은 사람이 갈 곳을 못 찾음).
 *
 *  - 📐 한 화면에 한 가지: 큰 칸 둘(고객 모으기 · 내 고객 정리) — 각 칸에 무엇이 되는지 한 줄 + 큰 단추 하나.
 *  - 이름을 아직 안 적었으면 아래 작은 줄 '먼저 내 이름 · 회사 적기' · 늘 '사용법 안내'.
 *  - 대표 · 내부 팀장 화면은 예전 그대로(이 칸은 외부 구독 고객 + 마케팅 화면이 열린 계정에만).
 * 규칙 화면이다 — AI 를 부르지 않는다.
 */
import { ArrowRight, Building2, CirclePlus, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'

export function CustomerWelcome({ name, named, onGo }: { name: string; named: boolean; onGo: (href: string) => void }) {
  const card = 'flex min-w-0 flex-1 basis-72 flex-col gap-2.5 rounded-(--radius-card) border border-slate-200 bg-white p-4 text-left sm:p-5'
  return (
    <section data-testid="today-first-client" data-variant="welcome" className="flex flex-col gap-4 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-7" aria-labelledby="today-welcome-title">
      <div className="flex flex-col gap-1 text-center">
        <h2 id="today-welcome-title" className="text-[1.3rem] font-bold break-keep text-slate-900">
          {named && name ? `${name}님, 어디서 시작할까요?` : '환영합니다 — 어디서 시작할까요?'}
        </h2>
        <p className="t-body break-keep text-slate-600">둘 중 편한 것부터 누르세요. 나중에 다른 쪽도 언제든 할 수 있어요.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className={card} data-testid="today-welcome-marketing">
          <span className="flex items-center gap-2">
            <Megaphone aria-hidden="true" className="size-6 shrink-0 text-brand-600" />
            <span className="t-section text-slate-900">고객 모으기부터</span>
          </span>
          <p className="t-body break-keep text-slate-700">이번 주에 올릴 글 · 대본을 바로 만들어요. 처음이어도 지금 할 한 가지를 차례로 알려 드려요.</p>
          <Button variant="primary" className="mt-auto min-h-12 justify-center" onClick={() => onGo('/marketing')} data-testid="today-welcome-marketing-go">
            마케팅 시작하기 <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className={card} data-testid="today-welcome-clients">
          <span className="flex items-center gap-2">
            <Building2 aria-hidden="true" className="size-6 shrink-0 text-brand-600" />
            <span className="t-section text-slate-900">내 고객 정리부터</span>
          </span>
          <p className="t-body break-keep text-slate-700">사업자등록증 한 장이면 업체가 등록돼요. 서류 · 일정 · 받을 돈이 한곳에 모여요.</p>
          <Button variant="secondary" className="mt-auto min-h-12 justify-center" onClick={() => onGo('/ops/clients?new=1')} data-testid="today-first-client-add">
            <CirclePlus aria-hidden="true" className="size-4" />첫 업체 등록
          </Button>
        </div>
      </div>
      <p className="t-sub flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-slate-600" data-testid="today-welcome-foot">
        {!named && (
          <Link to="/settings" className="tap inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline" data-testid="today-welcome-name">
            먼저 내 이름 · 회사 적기
          </Link>
        )}
        <Link to="/guide" className="tap inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline" data-testid="today-welcome-guide">
          사용법 안내 보기
        </Link>
      </p>
    </section>
  )
}
