/**
 * D-593 새로 생긴 것 — 접힌 한 줄('새로 생긴 것 — 최근 n가지')을 누르면 최근에 생긴 기능이 쉬운 말로 한 줄씩.
 *
 * 📐 첫 화면에는 한 줄만(접힘). 안에서: 날짜 · 무엇이 생겼나 · 이렇게 써 보세요 · [가 보기](갈 화면이 있을 때만).
 * 글은 content/whatsNew(규칙 글 — AI 아님). 펼친 것 · 읽은 것을 기억하지 않는다(저장하는 꾸미기 이름을 늘리지 않는다).
 */
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useIsPilot } from '../../auth/osAccess'
import { usePilotMarketingScreens } from '../../config/pilotMarketing'
import { whatsNewDateLabel, whatsNewFor } from '../../content/whatsNew'

export function WhatsNew({ testId = 'whats-new' }: { testId?: string }) {
  const pilot = useIsPilot()
  const pilotMarketing = usePilotMarketingScreens()
  const items = whatsNewFor({ marketingOpen: !pilot || pilotMarketing })
  if (items.length === 0) return null
  return (
    <details className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <summary className="t-body flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-whats-new">
        새로 생긴 것 — <span className="font-semibold text-brand-700">최근 {items.length}가지</span>
      </summary>
      <ol className="flex flex-col divide-y divide-slate-100 border-t border-slate-100" aria-label="새로 생긴 것" data-testid={`${testId}-list`}>
        {items.map((x) => (
          <li key={x.id} className="flex flex-col gap-1 px-4 py-3" data-testid={`${testId}-item`} data-key={x.id}>
            <p className="t-body font-bold break-keep text-slate-900">
              {x.title} <span className="t-sub ml-1 font-medium whitespace-nowrap text-slate-600">{whatsNewDateLabel(x.date)}</span>
            </p>
            <p className="t-sub break-keep text-slate-700">{x.how}</p>
            {x.path && (
              <Link to={x.path} className="tap t-sub mt-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50" data-testid={`${testId}-go`}>
                {x.cta ?? '가 보기'} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
