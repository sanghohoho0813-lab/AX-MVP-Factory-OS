import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 바깥을 '눌렀을 때만' 부른다 (D-124) — 손가락으로 화면을 밀어 스크롤할 때는 부르지 않는다.
 *
 * 예전에는 바깥에 손이 닿는 순간(pointerdown) 닫았다. 휴대폰에서 펼쳐 둔 목록 옆을 밀어 스크롤하면
 * 그 첫 닿음에 목록이 닫히고, 목록 높이만큼 화면이 한꺼번에 당겨져 '특정 위치로 튀는' 것처럼 보였다
 * (세금 계산기 목록 — 대표 보고). 이제는 닿은 자리에서 10px 안에서 뗐을 때(= 누름)만 닫는다.
 */
export function useOutsideTap(ref: RefObject<HTMLElement | null>, onTap: () => void, enabled = true): void {
  const cb = useRef(onTap)
  cb.current = onTap
  useEffect(() => {
    if (!enabled) return
    let start: { x: number; y: number; outside: boolean } | null = null
    const onDown = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, outside: !ref.current?.contains(e.target as Node) }
    }
    const onUp = (e: PointerEvent) => {
      const s = start
      start = null
      if (!s || !s.outside) return
      if (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10) return // 민 것 — 스크롤
      if (ref.current?.contains(e.target as Node)) return
      cb.current()
    }
    const onCancel = () => {
      start = null // 브라우저가 스크롤로 가져간 손가락
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
    }
  }, [ref, enabled])
}

/**
 * 드롭다운/팝오버 공통 동작: 바깥을 누르거나(스크롤은 제외) ESC 로 닫힌다.
 */
export function useDismissable<T extends HTMLElement>() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<T>(null)

  useOutsideTap(containerRef, () => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return { open, setOpen, containerRef }
}
