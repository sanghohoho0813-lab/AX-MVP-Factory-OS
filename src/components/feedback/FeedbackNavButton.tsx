/**
 * 사이드바 아래 피드백 단추 (D-188) — 예전 '컨설팅 운영 · AX 스튜디오 · v0.1.0' 글자 자리.
 *
 *  - 팀장(Pilot · 대표가 팀장 화면 보기): 눈에 띄는 [개발자에게 피드백]. 이번 회차 설문을 아직 안 보냈으면 '새 설문' 점.
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

const LOOK =
  'tap relative flex min-h-11 w-full items-center gap-2.5 rounded-(--radius-control) bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-2 text-[0.95rem] font-bold text-navy-950 shadow-sm ring-1 ring-amber-300/60 hover:from-amber-300 hover:to-orange-300'

function PilotFeedbackButton({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const auth = useContext(AuthContext)
  const mine = useMyFeedback(auth?.currentWorkspaceId ?? null)
  const round = feedbackRound(todayLocalDate())
  const fresh = mine !== null && !mine.some((e) => e.round === round.id)
  return (
    <Link
      to="/feedback"
      onClick={onNavigate}
      data-testid="feedback-open"
      data-fresh={fresh ? '1' : '0'}
      aria-label={collapsed ? `개발자에게 피드백${fresh ? ' — 새 설문' : ''}` : undefined}
      title={collapsed ? '개발자에게 피드백' : undefined}
      className={`${LOOK} ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <MessageSquareHeart aria-hidden="true" className="size-5 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">개발자에게 피드백</span>}
      {fresh && (
        <span className={collapsed ? 'absolute top-1 right-1 size-2.5 rounded-full bg-danger-500 ring-2 ring-amber-300' : 'shrink-0 rounded-full bg-navy-950 px-2 py-0.5 text-[0.78rem] font-bold text-amber-200'}>
          {collapsed ? '' : '새 설문'}
        </span>
      )}
    </Link>
  )
}

function OwnerInboxButton({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { unread } = useFeedbackInbox()
  return (
    <Link
      to="/feedback/inbox"
      onClick={onNavigate}
      data-testid="feedback-inbox-open"
      data-unread={unread}
      aria-label={collapsed || unread > 0 ? `받은 피드백함${unread > 0 ? ` — 새 피드백 ${unread}건` : ''}` : undefined}
      title={collapsed ? '받은 피드백함' : undefined}
      className={`${LOOK} ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Inbox aria-hidden="true" className="size-5 shrink-0" />
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

export function FeedbackNavButton({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  if (getDataModeConfig().mode !== 'supabase' || !auth?.session) return null
  return pilot ? <PilotFeedbackButton collapsed={collapsed} onNavigate={onNavigate} /> : <OwnerInboxButton collapsed={collapsed} onNavigate={onNavigate} />
}
