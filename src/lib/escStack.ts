/**
 * 겹친 창의 Esc (D-209) — 맨 위 창만 닫는다.
 * 예전에는 창마다 document 에 Esc 를 걸어서, 폴더 보기 파일 창 위의 미리보기에서 Esc 를 누르면 아래 창까지 한꺼번에 닫혔다.
 * 나중에 열린 창이 맨 위다. 맨 위가 아닌 창은 Esc 를 흘려보낸다.
 */
import { useEffect, useRef } from 'react'

const stack: number[] = []
let seq = 0

export function useEscToClose(active: boolean, onClose: () => void): void {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!active) return
    seq += 1
    const id = seq
    stack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (stack[stack.length - 1] !== id) return
      e.preventDefault()
      ref.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}
