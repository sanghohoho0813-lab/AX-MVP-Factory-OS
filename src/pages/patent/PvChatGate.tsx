/**
 * D-628 특허 · 벤처의 다른 화면(진행판 · 명세서 쓰기 · 사업계획서) — 첫 화면에서 오른쪽 대화창을 연 채 답 단추로 넘어왔으면
 * 같은 대화창을 이어 보여 준다(가운데 화면만 바뀌고 판은 열린 채). 열어 두지 않았으면 아무것도 받지 않고 그리지 않는다.
 */
import { Suspense, lazy } from 'react'
import { usePageChat } from '../../lib/pageChat'

const PvChatDock = lazy(() => import('./PatentVentureChat').then((m) => ({ default: m.PvChatDock })))

export function PvChatGate() {
  const open = usePageChat().open === 'pv'
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <PvChatDock />
    </Suspense>
  )
}
