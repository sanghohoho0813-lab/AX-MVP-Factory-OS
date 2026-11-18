/**
 * D-628 특허 · 벤처의 다른 화면(진행판 · 명세서 쓰기 · 사업계획서) — 첫 화면에서 오른쪽 대화창을 연 채 답 단추로 넘어왔으면
 * 같은 대화창을 이어 보여 준다(가운데 화면만 바뀌고 판은 열린 채). 열어 두지 않았으면 아무것도 받지 않고 그리지 않는다.
 *
 * D-636 여기서 Suspense 로 감싸지 않는다 — 감싸면 조각을 기다리는 사이 빈칸이 먼저 그려져 오른쪽 판이 잠깐 사라진다.
 *   화면 이동(전환)이 본문 바깥 경계에서 앞 화면을 띄운 채 기다리게 둔다(대화창 조각은 첫 화면이 이미 받아 둔 것).
 */
import { lazy } from 'react'
import { usePageChat } from '../../lib/pageChat'

const PvChatDock = lazy(() => import('./PatentVentureChat').then((m) => ({ default: m.PvChatDock })))

export function PvChatGate() {
  const open = usePageChat().open === 'pv'
  if (!open) return null
  return <PvChatDock />
}
