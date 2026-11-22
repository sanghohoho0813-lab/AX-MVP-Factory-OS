/**
 * ChatModeButton — 경로 줄 오른쪽 [⋯] 안 [대화로 묻기]: 이 화면에 대화창이 있고 닫혀 있을 때 연다(PC 오른쪽 판 · 휴대폰 아래 판).
 *
 * W7 앱 뼈대(메뉴 · 머리줄)가 이 단추 하나 때문에 모듈 대화창 전체(업체 판정 · 절세 계산 묶음)를 첫 화면 전에 받았다 —
 * 단추만 따로 두어 뼈대가 모듈 대화창을 끌어오지 않게(D-644). 모듈 대화창은 모듈 화면을 열 때 받는다.
 */
import { MessageCircle } from 'lucide-react'
import { MENU_ROW, useInPageTools } from '../layout/PageTools'
import { basePageChat, launchPageChat, usePageChat } from '../../lib/pageChat'

export function ChatModeButton() {
  const inMenu = useInPageTools()
  const pc = usePageChat()
  const base = basePageChat(pc)
  if (!base?.launcher) return null
  if (pc.mode === 'none' ? pc.sheet : pc.dockShown) return null
  return (
    <button
      type="button"
      onClick={launchPageChat}
      className={inMenu ? MENU_ROW : 'tap t-sub inline-flex h-9 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50'}
      data-testid="chatfirst-open"
      data-guide="fn-chat-mode"
    >
      <MessageCircle aria-hidden="true" className="size-4 text-slate-500" />
      <span>대화로 묻기</span>
    </button>
  )
}
