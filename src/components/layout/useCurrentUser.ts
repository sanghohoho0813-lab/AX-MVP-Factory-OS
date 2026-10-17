import { useContext } from 'react'
import { AuthContext } from '../../auth/authContext'
import { identityFromSession, ownerIdentity, type UserIdentity } from '../../auth/currentUser'
import { brand } from '../../brand/brand.config'

const UNNAMED_PILOT = '팀장님'

/**
 * 지금 쓰는 사람 (D-103) — 사이드바 아래·머리줄 사용자 칸이 같이 쓴다.
 * 로그인(클라우드) 모드면 로그인한 사람과 지금 작업실에서의 역할로, 로컬 모드면 대표 이름으로.
 */
export function useCurrentUser(): UserIdentity {
  // AuthProvider 가 없는 로컬 모드에서는 null — 그때는 대표 이름
  const auth = useContext(AuthContext)
  if (!auth || !auth.session) return ownerIdentity()
  // D-164: 대표가 팀장 화면으로 바꿔 보면 이름 칸도 팀장 — 팀장이 보는 그대로
  const view = auth.access === 'full' ? auth.pilotViews.find((v) => v.workspaceId === auth.currentWorkspaceId) : undefined
  if (view) {
    // D-223 팀장님이 아직 이름을 저장하지 않았으면 서버가 'Pilot' 을 준다 — 사이드바 · 머리줄 · 고객에게 가는 서명에 'Pilot' 이 나오지 않게(화면 전환 단추와 같은 '팀장님')
    const unnamed = !view.personName || view.personName === 'Pilot'
    return unnamed ? { name: UNNAMED_PILOT, title: '', initial: '팀' } : { name: view.personName, title: view.personTitle, initial: view.personName.slice(0, 1) }
  }
  const role = auth.workspaces.find((w) => w.workspaceId === auth.currentWorkspaceId)?.role ?? null
  return identityFromSession(auth.session.user, role, auth.access)
}

/**
 * 고객에게 가는 글(안부 카톡 · 성과 보고서) 맨 끝 서명 (D-162).
 * 대표 · 직원은 지금처럼 '미래AI랩 김상호 대표', Pilot 은 자기 이름 — 대표 이름으로 고객에게 나가지 않는다.
 */
export function useSenderLine(): string {
  const auth = useContext(AuthContext)
  const me = useCurrentUser()
  const viewing = auth?.access === 'full' && auth.pilotViews.some((v) => v.workspaceId === auth.currentWorkspaceId)
  if (auth?.access === 'pilot' || viewing) {
    if (me.name === UNNAMED_PILOT || me.name === 'Pilot') return `${brand.brandNameKo} 담당 컨설턴트`
    return me.title ? `${me.name} ${me.title}` : me.name
  }
  return `${brand.brandNameKo} ${brand.ownerName} ${brand.ownerTitle}`
}
