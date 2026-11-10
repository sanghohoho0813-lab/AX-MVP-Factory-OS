import { useContext } from 'react'
import { AuthContext } from '../../auth/authContext'
import { identityFromSession, ownerIdentity, type UserIdentity } from '../../auth/currentUser'
import { brand } from '../../brand/brand.config'
import { useBrandProfile } from '../../services/brandProfile'
import { useCustomerAudience } from '../../config/customerAudience'

const UNNAMED_PILOT = '팀장님'
/** 이름을 아직 적지 않은 팀장 등급 계정(auth/currentUser 의 기본 이름) */
const UNNAMED_USER = '사용자'

/**
 * 지금 쓰는 사람 (D-103) — 사이드바 아래·머리줄 사용자 칸이 같이 쓴다.
 * 로그인(클라우드) 모드면 로그인한 사람과 지금 작업실에서의 역할로, 로컬 모드면 대표 이름으로.
 */
export function useCurrentUser(): UserIdentity {
  // AuthProvider 가 없는 로컬 모드에서는 null — 그때는 대표 이름
  const auth = useContext(AuthContext)
  // D-564 팀장 등급 계정이 설정 › 내 정보에 이름을 안 적었으면 — 내 브랜드(마케팅 첫 설정 · 설정 › 내 브랜드)에 적은 이름으로
  const mine = useBrandProfile()
  if (!auth || !auth.session) return ownerIdentity()
  // D-164: 대표가 팀장 화면으로 바꿔 보면 이름 칸도 팀장 — 팀장이 보는 그대로
  const view = auth.access === 'full' ? auth.pilotViews.find((v) => v.workspaceId === auth.currentWorkspaceId) : undefined
  if (view) {
    // D-223 팀장님이 아직 이름을 저장하지 않았으면 서버가 'Pilot' 을 준다 — 사이드바 · 머리줄 · 고객에게 가는 서명에 'Pilot' 이 나오지 않게(화면 전환 단추와 같은 '팀장님')
    const unnamed = !view.personName || view.personName === 'Pilot'
    return unnamed ? { name: UNNAMED_PILOT, title: '', initial: '팀' } : { name: view.personName, title: view.personTitle, initial: view.personName.slice(0, 1) }
  }
  const role = auth.workspaces.find((w) => w.workspaceId === auth.currentWorkspaceId)?.role ?? null
  const me = identityFromSession(auth.session.user, role, auth.access)
  const brandName = mine.loaded && mine.workspaceId === auth.currentWorkspaceId ? mine.profile.name.trim() : ''
  if (auth.access === 'pilot' && me.name === UNNAMED_USER && brandName) return { ...me, name: brandName, initial: brandName.slice(0, 1).toUpperCase() }
  return me
}

/**
 * D-577 고객에게 드리는 문서(방문 리포트 · 제안서)의 '담당' 줄에 붙는 소속 이름.
 * 대표 · 내부 팀장은 예전처럼 대표 회사, 외부 구독 고객은 내 브랜드의 '회사 · 브랜드'(안 적었으면 빈칸 — 대표 회사 이름이 고객 문서에 나가지 않는다).
 */
export function useOrgName(): string {
  const auth = useContext(AuthContext)
  const customer = useCustomerAudience()
  const mine = useBrandProfile()
  if (auth?.access === 'pilot' && customer) return mine.loaded && mine.workspaceId === auth.currentWorkspaceId ? mine.profile.company.trim() : ''
  return brand.companyName
}

/**
 * 고객에게 가는 글(안부 카톡 · 성과 보고서) 맨 끝 서명 (D-162).
 * 대표 · 직원은 지금처럼 '미래AI랩 김상호 대표', Pilot 은 자기 이름 — 대표 이름으로 고객에게 나가지 않는다.
 */
export function useSenderLine(): string {
  const auth = useContext(AuthContext)
  const me = useCurrentUser()
  const customer = useCustomerAudience()
  const mine = useBrandProfile()
  const viewing = auth?.access === 'full' && auth.pilotViews.some((v) => v.workspaceId === auth.currentWorkspaceId)
  const unnamed = me.name === UNNAMED_PILOT || me.name === 'Pilot' || me.name === UNNAMED_USER
  // D-564 외부 구독 고객 — 대표 회사 이름을 붙이지 않는다. 내 브랜드의 회사 · 이름으로(없으면 '담당 컨설턴트')
  if (auth?.access === 'pilot' && customer) {
    const company = mine.loaded && mine.workspaceId === auth.currentWorkspaceId ? mine.profile.company.trim() : ''
    const who = unnamed ? '' : me.title ? `${me.name} ${me.title}` : me.name
    return [company, who].filter(Boolean).join(' ') || '담당 컨설턴트'
  }
  if (auth?.access === 'pilot' || viewing) {
    if (unnamed) return `${brand.brandNameKo} 담당 컨설턴트`
    return me.title ? `${me.name} ${me.title}` : me.name
  }
  return `${brand.brandNameKo} ${brand.ownerName} ${brand.ownerTitle}`
}
