/**
 * 옆으로 미는 줄 + '더 있음' 표시 (D-122).
 *
 * 탭 · 거르기 칩이 화면보다 길면 옆으로 민다. 스크롤바를 숨겨 두었더니 휴대폰에서 오른쪽에 탭이 더 있는지
 * 몰랐다(업체 상세 9개 탭 중 수금 · 자금 · 고객 플랫폼이 안 보였다). 오른쪽에 더 있으면 흐린 가장자리와 '›' 를,
 * 고른 탭은 화면 안으로 끌어온다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ScrollHintRow({
  children,
  className = '',
  innerClassName = '',
  role,
  ariaLabel,
  /** 이 값이 바뀌면 고른 것(aria-selected · aria-pressed)을 화면 안으로 */
  activeKey,
  fade = 'from-slate-50 via-slate-50/90',
}: {
  /** 흐린 가장자리 색 — 흰 카드 안이면 'from-white via-white/90' */
  fade?: string
  children: ReactNode
  className?: string
  innerClassName?: string
  role?: string
  ariaLabel?: string
  activeKey?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  /** D-171: 끝까지 넘긴 뒤 PC(마우스)에서 처음으로 돌아올 길 — 왼쪽에도 '‹' */
  const [less, setLess] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
      setLess(el.scrollLeft > 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]')
    if (!el || !active) return
    const left = active.offsetLeft - el.offsetLeft
    if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' })
    }
  }, [activeKey])

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} role={role} aria-label={ariaLabel} className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${innerClassName}`}>
        {children}
      </div>
      {less && (
        <button
          type="button"
          aria-label="앞으로 다시 보기"
          data-testid="scroll-less"
          onClick={() => {
            const el = ref.current
            if (el) el.scrollBy({ left: -Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' })
          }}
          className={`absolute inset-y-0 left-0 flex w-11 cursor-pointer items-center justify-start bg-gradient-to-r ${fade} to-transparent pl-1 text-slate-500 hover:text-brand-700`}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
      )}
      {more && (
        // D-171: 단추처럼 보였는데 눌리지 않았다(대표: "오른쪽에 누르는 버튼이 있는 것 같은데 안 넘어간다") — 누르면 옆으로 넘긴다
        <button
          type="button"
          aria-label="옆으로 더 보기"
          data-testid="scroll-more"
          onClick={() => {
            const el = ref.current
            if (el) el.scrollBy({ left: Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' })
          }}
          className={`absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-end bg-gradient-to-l ${fade} to-transparent pr-1 text-slate-500 hover:text-brand-700`}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      )}
    </div>
  )
}
