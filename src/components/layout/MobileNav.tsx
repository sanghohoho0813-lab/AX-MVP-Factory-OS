/**
 * 모바일 하단 내비게이션.
 *
 * 대표가 하루에 여러 번 오가는 곳은 사실 다섯 군데뿐이다. 그 다섯 개만 아래에
 * 두고, 나머지(AX 스튜디오·도구·설정)는 '더보기' 로 접는다. 서랍 메뉴만으로는
 * 화면을 옮길 때마다 두 번씩 눌러야 해서 한 손으로 쓰기 어렵다.
 *
 * D-295 대표: "하단 메뉴도 커스터마이징 할 수 있게" — 칸은 '더보기 › 아래 메뉴 바꾸기' 에서 고른다(최대 5개 · 이 기기에 기억).
 *   고른 것이 없으면 예전 그대로(오늘 · 일정 · 고객 · 상담 · 영업). 칸은 메뉴 표(moduleRegistry)의 줄 그대로 — 주소 · 불 켜짐 · 숫자가 서랍과 같다.
 *
 * 1024px 이상에서는 왼쪽 사이드바가 그 역할을 하므로 나타나지 않는다.
 */

import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { enabledModulesByGroup, moduleMatchLength, navPathForSidebar } from '../../config/moduleRegistry'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { navCandidates, resolveMobileNav, shortLabel, useMobileNavKeys } from '../../lib/mobileNavPrefs'
import { useNavCounts } from './useNavCounts'
import { Link } from 'react-router-dom'
import { useNavPath } from '../../lib/navFrom'
import { LayoutGrid } from 'lucide-react'
import { moduleTone, toneClass } from '../../config/featureVisual'
import { slotIcon } from '../../config/iconSlots'

/** D-283 '더보기' 칸도 아이콘 자리 표를 거친다(지금은 임시 아이콘) */
const MoreIcon = slotIcon('more', LayoutGrid)

export function MobileNav({ onOpenMore }: { onOpenMore: () => void }) {
  // D-124: 영업에서 온 업체 화면이면 '고객' 칸에 불을 켜지 않는다
  const navPath = navPathForSidebar(useNavPath())
  const counts = useNavCounts()
  // D-162: Pilot 에게는 상담신청(공개 사이트 → 대표 작업공간) 칸이 없다 — 메뉴 표의 대표 전용 줄을 그대로 따른다
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  useStoreVersion()
  const saved = useMobileNavKeys()
  const items = resolveMobileNav(saved, navCandidates(enabledModulesByGroup({ advanced: isAdvancedVisible(), pilot, caps })))

  return (
    <nav
      aria-label="주요 화면"
      className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      data-testid="mobile-nav"
      data-keys={items.map((m) => m.key).join(',')}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = moduleMatchLength(item, navPath) > 0
          const Icon = item.icon
          const tone = toneClass(moduleTone(item.key))
          const requests = item.badge === 'requests' ? (counts.requests ?? 0) : item.badge === 'first-meetings' ? (counts.firstMeetings ?? 0) : 0
          const clients = item.badge === 'clients' ? counts.clients : null
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0 py-1.5"
              >
                <span
                  className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors ${active ? tone.soft : ''}`}
                >
                  <Icon aria-hidden="true" className={`size-[22px] ${tone.icon}`} strokeWidth={active ? 2.4 : 2} />
                  {/* D-104 · D-108: 처리 안 한 상담신청 수 — 빨간 바탕 흰 숫자, 흰 테두리로 아이콘과 떼어 바로 보이게 (0 이면 없음) */}
                  {requests > 0 && (
                    <span
                      data-nav-badge={item.badge}
                      aria-label={item.badge === 'requests' ? `새 상담신청 ${requests}건` : `남은 1차 미팅 ${requests}건`}
                      className="absolute -top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[0.875rem] leading-none font-bold text-white tabular-nums shadow-sm ring-2 ring-white"
                    >
                      {requests > 99 ? '99+' : requests}
                    </span>
                  )}
                </span>
                <span className="flex max-w-full items-baseline gap-0.5 overflow-hidden whitespace-nowrap">
                  <span
                    className={`t-meta truncate ${
                      active ? 'font-semibold text-slate-900' : requests > 0 ? 'font-semibold text-slate-700' : 'font-medium text-slate-500'
                    }`}
                  >
                    {shortLabel(item)}
                  </span>
                  {/* D-108 · D-114: 계약 고객 수 — 아주 작게, 튀지 않는 색 (0 도 보인다) */}
                  {clients !== null && (
                    <span data-nav-badge="clients" aria-label={`계약 고객 ${clients}곳`} className="text-[0.8125rem] leading-none font-medium text-slate-400 tabular-nums">
                      {clients > 999 ? '999+' : clients}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-0 py-1.5 whitespace-nowrap text-slate-500"
            data-testid="mobile-more"
          >
            {/* D-282 높이는 예전 그대로(h-7) — 아래 메뉴가 높아지면 '맨 위로' 단추와 겹친다 */}
            <span className="flex h-7 w-14 items-center justify-center">
              <MoreIcon aria-hidden="true" className="size-[22px] text-slate-600" />
            </span>
            <span className="t-meta font-medium">더보기</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
