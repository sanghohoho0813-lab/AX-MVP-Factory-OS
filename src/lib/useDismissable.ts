import { useEffect, useRef, useState } from 'react'

/**
 * 드롭다운/팝오버 공통 동작: 바깥 클릭과 ESC로 닫힌다.
 */
export function useDismissable<T extends HTMLElement>() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, containerRef }
}
