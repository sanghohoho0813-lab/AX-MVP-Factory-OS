/**
 * D-552 모듈 첫 주소 → 대화창 · 그 밖(목차 화면 · 업체 · 상황 예시 주소)은 예전 화면 그대로.
 * ChatModeButton — 예전 화면에서 경로 줄 오른쪽 [대화로 묻기](자리 · 높이를 더 차지하지 않는다).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { ModuleChat } from './ModuleChat'
import { ToolClientFrame } from '../../tools/shared/toolClientContext'
import { useEntitlements } from '../../lib/entitlementsStore'
import { CHAT_FIRST_EVENT, CHAT_FIRST_PATHS, chatFirstKeyOf, chatShown, readChatFirst, type ChatFirstKey } from '../../services/workChat/chatFirst'

function usePrefs() {
  const [prefs, setPrefs] = useState(readChatFirst)
  useEffect(() => {
    const on = () => setPrefs(readChatFirst())
    window.addEventListener(CHAT_FIRST_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(CHAT_FIRST_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return prefs
}

export function ChatFirst({ k, children }: { k: ChatFirstKey; children: ReactNode }) {
  const loc = useLocation()
  const prefs = usePrefs()
  const { ent, ready } = useEntitlements()
  // 구독으로 잠긴 모듈은 예전 화면 그대로(잠금 안내 카드 · 미리 보기가 거기 있다)
  const f = k === 'grants' ? null : ent.feature(k)
  const locked = ready && !!f && !f.usable && !!f.moduleKey
  if (locked || !chatShown(loc.pathname, loc.search, prefs)) return <>{children}</>
  // 지원사업은 도구 틀 밖 화면 — 업체 목록을 읽는 틀을 대화창에만 씌운다(예전 화면은 그대로)
  return k === 'grants' ? (
    <ToolClientFrame>
      <ModuleChat k={k} />
    </ToolClientFrame>
  ) : (
    <ModuleChat k={k} />
  )
}

export function ChatModeButton() {
  const loc = useLocation()
  const prefs = usePrefs()
  const { ent, ready } = useEntitlements()
  const k = chatFirstKeyOf(loc.pathname)
  if (!k || chatShown(loc.pathname, loc.search, prefs)) return null
  const f = k === 'grants' ? null : ent.feature(k)
  if (ready && f && !f.usable && f.moduleKey) return null
  return (
    <Link
      to={`${CHAT_FIRST_PATHS[k]}?chat=1`}
      className="tap t-sub inline-flex h-9 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
      data-testid="chatfirst-open"
    >
      <MessageCircle aria-hidden="true" className="size-4 text-slate-500" />
      <span>대화로 묻기</span>
    </Link>
  )
}
