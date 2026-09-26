/**
 * 휴대폰 뒤로가기로 열린 창 닫기 (D-124)
 *
 * 예전에는 아래에서 올라온 창(시트) · 가운데 창 · 서랍 메뉴가 열린 채로 휴대폰 뒤로가기를 누르면
 * 창이 닫히는 대신 앞 화면으로 넘어갔다 — 적던 내용이 사라지고, 대표는 "뒤로 눌렀더니 엉뚱한 데로 갔다" 고 느낀다.
 *
 * 그래서 창이 하나라도 열려 있으면 뒤로가기(POP)를 막고 맨 위 창만 닫는다.
 * 방문 기록에 가짜 칸을 넣지 않는다(라우터의 막기 기능만 쓴다) — 저장하고 다른 화면으로 가는 흐름과 엉키지 않는다.
 */
import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

interface OpenLayer {
  close: () => void
}

/** 열린 창 — 나중에 열린 것이 끝 */
const layers: OpenLayer[] = []

export function useBackToClose(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const layer: OpenLayer = { close: () => closeRef.current() }
    layers.push(layer)
    return () => {
      const i = layers.indexOf(layer)
      if (i >= 0) layers.splice(i, 1)
    }
  }, [open])
}

/** 열린 창이 있나 — 다른 막기(useUnsavedChangesGuard)가 먼저 물어본다 */
export function hasOpenLayer(): boolean {
  return layers.length > 0
}

/** 맨 위 창을 닫는다 */
export function closeTopLayer(): void {
  layers[layers.length - 1]?.close()
}

/**
 * 앱 틀(AppShell)에 하나만 둔다 — 라우터는 마지막에 등록한 막기 하나만 따른다.
 * 그래서 화면에 '저장 안 한 내용' 막기가 있으면 그쪽(useUnsavedChangesGuard)이 창 닫기까지 맡는다.
 */
export function BackToCloseGuard(): null {
  const blocker = useBlocker(({ historyAction }) => historyAction === 'POP' && layers.length > 0)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const top = layers[layers.length - 1]
    blocker.reset()
    top?.close()
  }, [blocker])
  return null
}
