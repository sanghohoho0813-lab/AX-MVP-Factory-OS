/**
 * 피드백 단추 (D-188) — 예전 사이드바 아래 '컨설팅 운영 · AX 스튜디오 · v0.1.0' 글자 자리.
 * D-290 설정 › 계정 · 보기 안으로 옮겼다(왼쪽 아래는 이름 · 로그아웃만). 새 피드백 · 새 설문은 메뉴 '설정' 줄에 표시(FeedbackNavDot).
 *
 *  - 팀장(Pilot · 대표가 팀장 화면 보기): 옅은 금색 테두리 [개발자에게 피드백](D-189 — 꽉 찬 금색은 과해서). 이번 회차 설문을 아직 안 보냈으면 '새 설문' 점.
 *  - 대표: [받은 피드백함] + 안 읽은 피드백 수(빨간 숫자).
 * 로그인(클라우드) 모드에서만 — 로컬 모드에는 팀장이 없다.
 */

import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, MessageSquareHeart } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useIsPilot } from '../../auth/osAccess'
import { getDataModeConfig } from '../../data/dataMode'
import { todayLocalDate } from '../../lib/appClock'
import { feedbackRound } from '../../services/feedbackSurvey'
import { useFeedbackInbox, useMyFeedback } from './useFeedback'

// D-189 대표: "노란 버튼 조금만 눈에 덜 띄게 — 좀 과하다." 꽉 찬 금색 대신 옅은 금색 테두리 · 살짝 비치는 바탕
const LOOK =
  'tap relative flex min-h-11 w-full items-center gap-2.5 rounded-(--radius-control) border border-amber-300/30 bg-amber-300/[0.07] px-3 py-2 text-[0.95rem] font-semibold text-amber-100 hover:border-amber-300/50 hover:bg-amber-300/15 hover:text-white'

// D-290 설정 화면(밝은 바탕)용
const LOOK_LIGHT =
  'tap relative flex min-h-11 w-full items-center gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.95rem] font-semibold text-amber-950 hover:bg-amber-100'

type Tone = 'dark' | 'light'

function usePilotFresh(): boolean {
  const auth = useContext(AuthContext)
  const mine = useMyFeedback(auth?.currentWorkspaceId ?? null)
  const round = feedbackRound(todayLocalDate())
  return mine !== null && !mine.some((e) => e.round === round.id)
}

function PilotFeedbackButton({ collapsed, onNavigate, tone }: { collapsed: boolean; onNavigate?: () => void; tone: Tone }) {
  const fresh = usePilotFresh()
  const light = tone === 'light'
  return (
    <Link
      to="/feedback"
      onClick={onNavigate}
      data-testid="feedback-open"
      data-fresh={fresh ? '1' : '0'}
      aria-label={collapsed ? `개발자에게 피드백${fresh ? ' — 새 설문' : ''}` : undefined}
      title={collapsed ? '개발자에게 피드백' : undefined}
      className={`${light ? LOOK_LIGHT : LOOK} ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <MessageSquareHeart aria-hidden="true" className={`size-5 shrink-0 ${light ? 'text-amber-600' : 'text-amber-300'}`} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">개발자에게 피드백</span>}
      {fresh && (
        <span className={collapsed ? 'absolute top-1 right-1 size-2 rounded-full bg-amber-300' : light ? 'shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[0.78rem] font-semibold text-amber-950' : 'shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.78rem] font-semibold text-amber-200'}>
          {collapsed ? '' : '새 설문'}
        </span>
      )}
    </Link>
  )
}

function OwnerInboxButton({ collapsed, onNavigate, tone }: { collapsed: boolean; onNavigate?: () => void; tone: Tone }) {
  const { unread } = useFeedbackInbox()
  const light = tone === 'light'
  return (
    <Link
      to="/feedback/inbox"
      onClick={onNavigate}
      data-testid="feedback-inbox-open"
      data-unread={unread}
      aria-label={collapsed || unread > 0 ? `받은 피드백함${unread > 0 ? ` — 새 피드백 ${unread}건` : ''}` : undefined}
      title={collapsed ? '받은 피드백함' : undefined}
      className={`${light ? LOOK_LIGHT : LOOK} ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Inbox aria-hidden="true" className={`size-5 shrink-0 ${light ? 'text-amber-600' : 'text-amber-300'}`} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">받은 피드백함</span>}
      {unread > 0 && (
        <span
          data-testid="feedback-unread"
          className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[0.8rem] font-bold text-white ${collapsed ? 'absolute -top-1 -right-1' : ''}`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function FeedbackNavButton({ collapsed = false, onNavigate, tone = 'dark' }: { collapsed?: boolean; onNavigate?: () => void; tone?: Tone }) {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  if (getDataModeConfig().mode !== 'supabase' || !auth?.session) return null
  return pilot ? <PilotFeedbackButton collapsed={collapsed} onNavigate={onNavigate} tone={tone} /> : <OwnerInboxButton collapsed={collapsed} onNavigate={onNavigate} tone={tone} />
}

function PilotFreshDot({ collapsed }: { collapsed: boolean }) {
  if (!usePilotFresh()) return null
  if (collapsed) return <span data-testid="settings-feedback-fresh" aria-label="새 설문" className="absolute top-1.5 right-3 size-2.5 rounded-full bg-amber-300" />
  return (
    <span data-testid="settings-feedback-fresh" className="t-meta ml-auto shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 font-semibold text-amber-200">
      새 설문
    </span>
  )
}

function OwnerUnreadDot({ collapsed }: { collapsed: boolean }) {
  const { unread } = useFeedbackInbox()
  if (unread <= 0) return null
  const text = unread > 99 ? '99+' : String(unread)
  return (
    <span
      data-testid="settings-feedback-unread"
      aria-label={`새 피드백 ${unread}건`}
      className={collapsed ? 'absolute top-1 right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[0.875rem] font-bold text-white tabular-nums' : 't-meta ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger-500 px-1.5 font-bold text-white tabular-nums'}
    >
      {text}
    </span>
  )
}

/** D-290 메뉴 '설정' 줄 — 대표: 안 읽은 피드백 수(빨간 숫자) · 팀장: 이번 회차 설문 아직이면 '새 설문' */
export function FeedbackNavDot({ collapsed }: { collapsed: boolean }) {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  if (getDataModeConfig().mode !== 'supabase' || !auth?.session) return null
  return pilot ? <PilotFreshDot collapsed={collapsed} /> : <OwnerUnreadDot collapsed={collapsed} />
}
