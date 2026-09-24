import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'

/**
 * 맨 위로 (D-100).
 *
 * 업체가 100곳이면 휴대폰에서 고객 운영 목록이 화면 42장 길이(약 3만 5천 px)가 된다.
 * 검색·필터가 맨 위에 있으니, 두 화면 넘게 내려가면 오른쪽 아래에 '맨 위로' 를 띄운다.
 * 휴대폰에서는 하단 메뉴 위, 크레탑처럼 하단 탭이 한 줄 더 있는 화면에서는 그 위로 올린다.
 */
export function ScrollTopButton() {
  const [show, setShow] = useState(false)
  const [lift, setLift] = useState<number | null>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 2
      setShow(past)
      // 화면 아래에 붙는 탭 줄(크레탑)이 보이면 그 윗선에서 12px 위로 — 탭 높이는 글자 크기에 따라 달라 직접 잰다
      //   탭 줄이 위로 지나가 버린 때(긴 화면에서 크레탑 칸 아래로 내려감)는 올리지 않는다
      const tabs = past ? document.querySelector('.cretop-mini-tabs') : null
      const r = tabs?.getBoundingClientRect()
      const pinned = !!r && r.top < window.innerHeight && r.bottom > window.innerHeight - 160
      setLift(pinned && r ? Math.round(window.innerHeight - r.top + 12) : null)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  if (!show) return null

  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="맨 위로"
      title="맨 위로"
      data-testid="scroll-top"
      style={lift !== null ? { bottom: lift } : undefined}
      className="no-print tap fixed right-4 bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-30 inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-700 shadow-(--shadow-overlay) hover:bg-slate-50 lg:right-6 lg:bottom-6"
    >
      <ArrowUp aria-hidden="true" className="size-5" />
    </button>
  )
}
