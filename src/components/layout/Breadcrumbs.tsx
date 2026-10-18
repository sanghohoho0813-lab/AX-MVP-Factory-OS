/**
 * 경로 줄 (D-235) — 본문 맨 위 한 줄: 고객 관리 › (주)샤인디자인 › 맞춤 추천 › 고용지원금 관리.
 * 앞 칸을 누르면 그 단계로 돌아간다. 마지막 칸은 지금 자리(굵게 · 누르지 않음).
 * 휴대폰은 줄을 바꿔 다 보인다(옆으로 넘치지 않게) — 긴 업체 이름은 칸마다 줄여 쓴다.
 * 업체 이름을 아직 모르면 한 번만 업체 목록을 읽어 기억한다(못 읽으면 '업체' 로).
 */
import { useContext, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { routeCrumbs } from '../../lib/wayfinding'
import { clientNameOf, lastClientTab, rememberClientNames, useClientNamesVersion, useCrumbExtras } from '../../lib/crumbStore'
import { navFromOf } from '../../lib/navFrom'
import { AuthContext } from '../../auth/authContext'
import { listClients } from '../../services/clientOpsService'

function clientIdNeeded(pathname: string, search: string): string | null {
  const m = /^\/ops\/clients\/([^/]+)$/.exec(pathname)
  if (m && m[1] !== 'new') return decodeURIComponent(m[1])
  return new URLSearchParams(search).get('client')
}

export function Breadcrumbs() {
  const location = useLocation()
  const extras = useCrumbExtras()
  const ver = useClientNamesVersion()
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const asked = useRef(false)

  // 이름을 모르는 업체면 업체 목록을 한 번 읽어 이름을 기억한다(이 탭 동안 다시 읽지 않는다)
  const needId = clientIdNeeded(location.pathname, location.search)
  useEffect(() => {
    if (!needId || clientNameOf(needId) || asked.current) return
    asked.current = true
    listClients(workspaceId)
      .then((list) => rememberClientNames(list))
      .catch(() => {
        // 이름 없이 '업체' 로
      })
  }, [needId, workspaceId])

  const crumbs = useMemo(
    () =>
      routeCrumbs({
        pathname: location.pathname,
        search: location.search,
        clientName: clientNameOf,
        lastClientTab: lastClientTab(),
        fromSales: navFromOf(location.state)?.path.startsWith('/sales') ?? false,
        extras,
      }),
    // ver: 업체 이름 기억이 바뀌면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, location.search, location.state, extras, ver],
  )
  if (crumbs.length < 2) return null
  return (
    <nav aria-label="지금 있는 곳" className="no-print mb-3 lg:mb-4" data-testid="crumbs">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 max-w-full items-center gap-1" data-testid="crumb" data-last={last ? '1' : '0'}>
              {i > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
              {c.to && !last ? (
                <Link to={c.to} className="tap t-sub inline-flex min-h-9 max-w-[16rem] min-w-0 items-center truncate rounded-(--radius-control) px-1.5 font-medium text-brand-700 hover:bg-slate-100 hover:text-brand-800 sm:max-w-[20rem]">
                  <span className="truncate">{c.label}</span>
                </Link>
              ) : (
                <span aria-current={last ? 'location' : undefined} className={`t-sub inline-flex min-h-9 max-w-[16rem] min-w-0 items-center px-1.5 sm:max-w-[24rem] ${last ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                  <span className="truncate">{c.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
