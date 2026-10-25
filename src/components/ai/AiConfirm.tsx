/**
 * D-289 AI 를 부르는 단추는 두 번 — 한 번 누르면 '이대로 질문하기' 로 바뀌고, 한 번 더 눌러야 AI 를 부른다.
 *
 * 대표: "단추 한 번 누른다고 바로 LLM 가동되지 않게 싹 다 — 한 번 누른 다음 '이대로 질문하기' 가 나타나서 한 번 더 눌러야.
 * 실수로 잘못 누르는 경우도 있는데 바로 로딩돼 버리면 짜증 나거든."
 *
 *   <AiConfirm><Button onClick={start}>AI 와 기획 시작</Button></AiConfirm>
 *
 *  - 감싼 단추 하나의 onClick 만 가로챈다(모양 · 이름표 · 시험 이름은 그대로).
 *  - 고른 상태: 단추 글이 '✓ 이대로 질문하기' 로(원래 글은 읽는 기계용으로 남김 — keepLabel 이면 눈에도) · 옆에 [취소].
 *  - 손가락이 두 번 튀어 바로 도는 일 없게 고른 뒤 0.4초 안의 두 번째 누름은 무시. 8초 지나면 저절로 풀림.
 */
import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { Check } from 'lucide-react'

const GUARD_MS = 400
const DISARM_MS = 8000

type ClickableProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void
  disabled?: boolean
  children?: ReactNode
  className?: string
}

export function AiConfirm({
  children,
  confirmLabel = '이대로 질문하기',
  keepLabel = false,
  cancel = true,
}: {
  children: ReactElement<ClickableProps>
  /** 고른 뒤 단추 글(기본 '이대로 질문하기') */
  confirmLabel?: string
  /** 고른 뒤에도 원래 글을 눈에 보이게(대화 답 고르기처럼 무엇을 골랐는지가 중요한 단추) */
  keepLabel?: boolean
  /** 옆에 [취소] 를 둘지(좁은 줄에서는 끔 — 8초 뒤 저절로 풀림) */
  cancel?: boolean
}) {
  const child = Children.only(children)
  const [armedAt, setArmedAt] = useState(0)
  const timer = useRef(0)
  const armed = armedAt > 0
  useEffect(() => {
    if (!armed) return
    timer.current = window.setTimeout(() => setArmedAt(0), DISARM_MS)
    return () => window.clearTimeout(timer.current)
  }, [armed])
  if (!isValidElement(child)) return child
  const props = child.props
  const original = props.children
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (props.disabled) return
    if (!armed) {
      e.preventDefault()
      setArmedAt(Date.now())
      return
    }
    if (Date.now() - armedAt < GUARD_MS) return
    setArmedAt(0)
    props.onClick?.(e)
  }
  const label = armed ? (
    <>
      <Check aria-hidden="true" className="size-4 shrink-0" />
      <span>{confirmLabel}</span>
      {keepLabel ? <span className="font-normal opacity-90">· {original}</span> : <span className="sr-only">· {original}</span>}
    </>
  ) : (
    original
  )
  const cloned = cloneElement(child, {
    onClick,
    children: label,
    className: `${props.className ?? ''} ${armed ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`,
    'data-armed': armed ? 'true' : undefined,
    'aria-live': 'polite',
  } as Partial<ClickableProps>)
  if (!armed || !cancel) return cloned
  return (
    <>
      {cloned}
      <button type="button" onClick={() => setArmedAt(0)} className="tap t-sub inline-flex min-h-10 items-center px-2 font-semibold text-slate-600 underline-offset-2 hover:underline" data-testid="ai-confirm-cancel">
        취소
      </button>
    </>
  )
}
