/**
 * 대표 ↔ 팀장(Pilot) 화면 바로 오가기 (D-164).
 *
 * 대표 계정으로 들어왔을 때만 보인다(서버 0020 의 my_pilot_views 가 준 목록). 다시 로그인하지 않는다 —
 * 대표가 팀장 작업공간의 구성원(편집자)이라 작업공간만 바꿔 연다. 팀장 화면에서는 메뉴 · 화면 · 이름 칸이 팀장이 보는 그대로.
 * 바꾸면 화면을 새로 연다(보기 무대의 PC · 휴대폰 화면도 함께 — 같은 저장소 값을 읽는다).
 */
import { useContext } from 'react'
import { ChevronDown, UserRound, UsersRound } from 'lucide-react'
import { useDismissable } from '../../lib/useDismissable'
import { AuthContext } from '../../auth/authContext'
import { brand } from '../../brand/brand.config'

/** 보이는 이름 — 팀장님이 아직 이름을 저장하지 않았으면(서버가 'Pilot' 을 준다) '팀장님' */
function whoOf(v: { personName: string; personTitle: string }): string {
  if (v.personTitle) return `${v.personName} ${v.personTitle}`
  return !v.personName || v.personName === 'Pilot' ? '팀장님' : v.personName
}

function reloadAll(): void {
  try {
    ;(window.top ?? window).location.reload()
  } catch {
    window.location.reload()
  }
}

export function useViewTargets() {
  const auth = useContext(AuthContext)
  if (!auth || auth.access !== 'full' || auth.pilotViews.length === 0) return null
  const me = auth.session?.user.id
  const pilotIds = new Set(auth.pilotViews.map((v) => v.workspaceId))
  const own =
    auth.workspaces
      .filter((w) => w.workspace?.ownerId === me && !pilotIds.has(w.workspaceId))
      .sort((a, b) => (a.workspace?.createdAt ?? '').localeCompare(b.workspace?.createdAt ?? ''))[0] ??
    auth.workspaces.find((w) => !pilotIds.has(w.workspaceId))
  const current = auth.currentWorkspaceId
  const go = (id: string | undefined) => {
    if (!id || id === current) return
    auth.selectWorkspace(id)
    reloadAll()
  }
  return { own, views: auth.pilotViews, current, go }
}

export function ViewAsSwitch({ stacked = false }: { stacked?: boolean }) {
  const t = useViewTargets()
  if (!t) return null
  const onOwn = !t.views.some((v) => v.workspaceId === t.current)
  const pill = (on: boolean) =>
    `inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-[0.875rem] font-semibold whitespace-nowrap ${on ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`
  return (
    <div
      role="radiogroup"
      aria-label="보는 화면"
      data-testid="view-as-switch"
      className={`inline-flex shrink-0 items-center rounded-(--radius-control) border border-slate-200 bg-white p-0.5 ${stacked ? 'h-11 w-full' : 'h-10'}`}
    >
      <button type="button" role="radio" aria-checked={onOwn} data-view="owner" onClick={() => t.go(t.own?.workspaceId)} className={`${pill(onOwn)} ${stacked ? 'flex-1' : ''}`}>
        <UserRound aria-hidden="true" className="size-4" />
        {brand.ownerTitle}
      </button>
      {t.views.map((v) => {
        const on = v.workspaceId === t.current
        return (
          <button key={v.workspaceId} type="button" role="radio" aria-checked={on} data-view="pilot" onClick={() => t.go(v.workspaceId)} className={`${pill(on)} ${stacked ? 'flex-1' : ''}`}>
            <UsersRound aria-hidden="true" className="size-4" />
            {whoOf(v)}
          </button>
        )
      })}
    </div>
  )
}

/** 좁은 PC(1024~1439px) 머리줄 — 지금 보는 사람 단추 하나 · 눌러서 고른다 */
export function ViewAsSwitchCompact() {
  const t = useViewTargets()
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  if (!t) return null
  const viewing = t.views.find((v) => v.workspaceId === t.current)
  const short = viewing ? viewing.personTitle || (viewing.personName === 'Pilot' ? '팀장님' : viewing.personName) : brand.ownerTitle
  const item = (on: boolean) => `tap flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.9rem] font-semibold whitespace-nowrap ${on ? 'bg-slate-100 text-navy-900' : 'text-slate-700 hover:bg-slate-50'}`
  return (
    <div ref={containerRef} className="relative inline-flex" data-testid="view-as-compact">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`보는 화면: ${viewing ? whoOf(viewing) : brand.ownerTitle}`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-10 items-center gap-1 rounded-(--radius-control) border px-2 text-[0.875rem] font-semibold whitespace-nowrap ${viewing ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
      >
        {viewing ? <UsersRound aria-hidden="true" className="size-4" /> : <UserRound aria-hidden="true" className="size-4" />}
        {short}
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
      </button>
      {open && (
        <div role="menu" aria-label="보는 화면" className="absolute top-full right-0 z-40 mt-1 min-w-48 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
          <button type="button" role="menuitemradio" aria-checked={!viewing} data-view="owner" onClick={() => { setOpen(false); t.go(t.own?.workspaceId) }} className={item(!viewing)}>
            <UserRound aria-hidden="true" className="size-4" />
            {brand.ownerTitle} 화면
          </button>
          {t.views.map((v) => (
            <button key={v.workspaceId} type="button" role="menuitemradio" aria-checked={v.workspaceId === t.current} data-view="pilot" onClick={() => { setOpen(false); t.go(v.workspaceId) }} className={item(v.workspaceId === t.current)}>
              <UsersRound aria-hidden="true" className="size-4" />
              {whoOf(v)} 화면
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 팀장 화면을 보는 동안 본문 위 한 줄 — 누구 화면인지 · 바로 돌아가기 */
export function ViewingPilotBanner() {
  const t = useViewTargets()
  if (!t) return null
  const v = t.views.find((x) => x.workspaceId === t.current)
  if (!v) return null
  const who = whoOf(v)
  // D-166: 휴대폰에서는 한 줄(누구 화면인지 + 돌아가기) — 설명 글은 넓은 화면에서만
  return (
    <div data-testid="viewing-pilot" className="mb-4 flex items-center gap-3 rounded-(--radius-control) border border-navy-900/20 bg-navy-900 px-3 py-2 text-white sm:px-4 sm:py-2.5">
      <UsersRound aria-hidden="true" className="size-4 shrink-0" />
      <p className="t-sub min-w-0 flex-1 break-keep">
        <b>{who}</b> 화면 보는 중
        <span className="hidden sm:inline"> — 팀장님 작업공간의 자료입니다(업무 일기는 사람마다 따로라 보이지 않습니다).</span>
      </p>
      <button type="button" onClick={() => t.go(t.own?.workspaceId)} className="tap t-sub shrink-0 rounded-(--radius-control) bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-navy-900 hover:bg-slate-100">
        {brand.ownerTitle}로
        <span className="hidden sm:inline"> 돌아가기</span>
      </button>
    </div>
  )
}
