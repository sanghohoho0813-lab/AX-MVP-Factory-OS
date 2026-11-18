/**
 * D-552 대화창으로 시작하는 모듈(9곳) → D-628 가운데는 늘 작업 화면 · 대화창은 오른쪽 판으로.
 *
 *   ChatFirst       모듈의 모든 화면에서 그 모듈 대화창을 오른쪽 판에 알린다. 맨 첫 주소(뒤에 아무것도 없음)에서는
 *                   붙일 폭이 되면 저절로 열린다('대화창 같이' 를 고른 모듈만). `?chat=1` 은 언제나 연다.
 *                   목차 화면 · 업체 주소에서는 저절로 열지 않고(열려 있었으면 그대로) 오른쪽 끝 [대화] 로 연다.
 *   ChatModeButton  경로 줄 오른쪽 [⋯] 안 [대화로 묻기] — 이 화면 대화창을 연다(PC 오른쪽 판 · 휴대폰 아래 판).
 */
import { useEffect, type ReactNode } from 'react'
import { MENU_ROW, useInPageTools } from '../layout/PageTools'
import { useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { ModuleChat } from './ModuleChat'
import { PageChat } from './PageChat'
import { ToolClientFrame } from '../../tools/shared/toolClientContext'
import { useEntitlements } from '../../lib/entitlementsStore'
import { chatShown, type ChatFirstKey } from '../../services/workChat/chatFirst'
import { useChatFirstPrefs } from '../../lib/useChatFirst'
import { basePageChat, launchPageChat, openPageChat, usePageChat } from '../../lib/pageChat'

export function ChatFirst({ k, children }: { k: ChatFirstKey; children: ReactNode }) {
  const loc = useLocation()
  const prefs = useChatFirstPrefs()
  const { ent, ready } = useEntitlements()
  // 구독으로 잠긴 모듈은 대화창 없이 예전 화면 그대로(잠금 안내 카드 · 미리 보기가 거기 있다)
  const f = k === 'grants' ? null : ent.feature(k)
  const locked = ready && !!f && !f.usable && !!f.moduleKey
  // `?chat=1` — 주소로 대화창 열기(그 주소로 들어올 때마다 한 번)
  const want = !locked && new URLSearchParams(loc.search).get('chat') === '1'
  useEffect(() => {
    if (want) openPageChat({ start: true })
  }, [want, loc.key])
  if (locked) return <>{children}</>
  return (
    <>
      {children}
      <PageChat scope={`mod:${k}`} auto={chatShown(loc.pathname, loc.search, prefs)}>
        {/* 지원사업은 도구 틀 밖 화면 — 업체 목록을 읽는 틀을 대화창에만 씌운다(띠 없이) */}
        {k === 'grants' ? (
          <ToolClientFrame bare>
            <ModuleChat k={k} />
          </ToolClientFrame>
        ) : (
          <ModuleChat k={k} />
        )}
      </PageChat>
    </>
  )
}

/** 이 화면에 대화창이 있고 닫혀 있을 때 — [⋯] 안 [대화로 묻기] */
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
