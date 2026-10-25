/**
 * 영업 관리 안의 탭 (D-114).
 *
 * 대표 지시: "왼쪽 목차를 많이 만들지 말고, 영업 안에서 클릭해 들어가게."
 * 그래서 기업컨설팅 OS 의 여러 화면(보드 · 미팅 준비 · 상품·견적 · 전략)은 사이드바 한 줄('영업 관리') 아래 탭으로 둔다.
 * 일정 안의 탭(ScheduleTabs, D-103)과 같은 모양이다.
 */
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { SALES_TABS } from '../../config/salesTabs'
import { rampAt } from './salesColor'
import { SALES_FLOW, flowPosition } from '../../content/flowSteps'
import { StepGuide } from '../ui/StepGuide'

/** 업체를 골라 보는 탭 — 옮겨 가도 보던 업체를 그대로 (D-124) */
const CLIENT_TABS = new Set(['/sales/meeting', '/sales/proposal'])

/**
 * part — UXS-1 영업 보드는 탭을 화면 머리(PageHero) 안 '보는 대상' 줄에 넣고(tabs), 순서 안내는 '지금 할 일' 줄이 맡는다.
 * 다른 영업 탭(미팅 준비 · 상품·제안 · 전략)은 예전처럼 둘 다(all).
 */
export function SalesTabs({ part = 'all' }: { part?: 'all' | 'tabs' } = {}) {
  const [params] = useSearchParams()
  const client = params.get('client')
  const { pathname } = useLocation()
  if (SALES_TABS.length < 2) return null
  // D-235: 영업 순서 — 지금 몇 번째 · 무엇을 위한 화면인지 · 이전/다음(업체를 골라 보던 중이면 그 업체를 들고)
  const flowKey = SALES_FLOW.steps.find((st) => pathname.startsWith(st.key))?.key ?? Object.keys(SALES_FLOW.aside ?? {}).find((k) => pathname.startsWith(k)) ?? ''
  const pos = flowPosition(SALES_FLOW, flowKey)
  const hrefOf = (to: string) => (client && CLIENT_TABS.has(to) ? `${to}?client=${encodeURIComponent(client)}` : to)
  return (
    <>
    <nav aria-label="영업 관리 보기" data-testid="sales-tabs" className="no-print w-full sm:w-auto">
      <ul
        className="grid gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto"
        style={{ gridTemplateColumns: `repeat(${SALES_TABS.length}, minmax(0, 1fr))` }}
      >
        {SALES_TABS.map((t, i) => (
          <li key={t.to} className="min-w-0">
            <NavLink
              to={client && CLIENT_TABS.has(t.to) ? `${t.to}?client=${encodeURIComponent(client)}` : t.to}
              end
              className={({ isActive }) =>
                `tap flex h-full flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 py-1.5 text-center font-semibold break-keep sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {/* D-118: 안 고른 탭 아이콘은 탭마다 조금씩 다른 구분색(테마를 따라감) — 고른 탭은 흰색 */}
              {({ isActive }) => (
                <>
                  <t.icon aria-hidden="true" className={`size-4 shrink-0 ${isActive ? '' : 'ramp-text'}`} style={isActive ? undefined : rampAt(i, SALES_TABS.length)} />
                  <span className="text-[0.875rem] leading-tight sm:text-[0.9rem] sm:whitespace-nowrap">{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
    {part === 'all' && <StepGuide pos={pos} hrefOf={hrefOf} />}
    </>
  )
}
