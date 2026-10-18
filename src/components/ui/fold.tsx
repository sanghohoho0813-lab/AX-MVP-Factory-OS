/**
 * 접어 두는 목차 · 목차 설명 (D-192).
 *
 * 대표: "글씨가 너무 많으면 안 돼. 접어 뒀다가 펼치기. 접어 둘 거면 목차 옆에 커서를 갖다 대면
 * 무슨 기능인지 딱 보이게 — 펼칠지 말지 결정할 수 있게. 모든 목차."
 *
 *  - Fold: 목차 한 줄(▸ 제목 · 숫자 · ?)만 보이고, 누르면 펼친다. 펼침/접힘은 이 기기에 기억한다.
 *  - HintTip: 목차에 마우스를 올리면(PC) 또는 ? 를 누르면(휴대폰) 한두 줄 설명이 바로 뜬다.
 *    설명 글은 화면에 늘 깔지 않는다 — 궁금할 때만.
 *  - HelpHeading: 글자 그대로 쓴 소제목(h2 · h3)에도 같은 ? 를 단다.
 *  - FoldAllButton: 긴 화면 위에서 [모두 펼치기 · 모두 접기].
 * 기억은 이 기기 브라우저에만(사람마다 다른 편의) — 저장이 막혀도 기본값으로 그린다.
 *
 * 대표: "모든 소목차 · 소제목 옆에 조그맣게 ? 물음표 — 마우스를 올리면(휴대폰은 누르면) 그 의미 · 무엇을 위한 것인지."
 * 그래서 ⓘ 대신 누구나 '물어보는 곳' 으로 아는 ? 모양을 쓴다.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleHelp } from 'lucide-react'
import { hintFor } from '../../content/sectionHints'

const KEY = (id: string) => `axmvp.fold.${id}`
/** 'open' 이면 따로 접어 둔 것 말고는 모두 펼친 채로 시작한다([모두 펼치기]) */
export const FOLD_ALL_KEY = 'axmvp.fold.all'
const EVT = 'axmvp:fold-all'

function readFold(id: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(KEY(id))
    if (v === '1') return true
    if (v === '0') return false
    if (localStorage.getItem(FOLD_ALL_KEY) === 'open') return true
  } catch {
    // 저장소를 못 읽어도 기본값으로
  }
  return fallback
}

function writeFold(id: string, open: boolean) {
  try {
    localStorage.setItem(KEY(id), open ? '1' : '0')
  } catch {
    // 기억만 못 할 뿐 화면은 그대로
  }
}

const EVT_ONE = 'axmvp:fold-one'

/** 목차 하나를 펼친다 — '모듈별 판정 보기' 처럼 그 목차로 데려갈 때(기억도 펼침으로) */
export function openFold(id: string) {
  writeFold(id, true)
  window.dispatchEvent(new CustomEvent(EVT_ONE, { detail: id }))
}

/** 접힘 상태 — 기억 · [모두 펼치기/접기] 를 따른다. force 면 기억과 상관없이 펼친 채로 시작 */
export function useFold(id: string, defaultOpen: boolean, force = false): [boolean, (next: boolean) => void] {
  const [open, setOpenState] = useState(() => force || readFold(id, defaultOpen))
  useEffect(() => {
    const on = (e: Event) => setOpenState((e as CustomEvent<boolean>).detail)
    const one = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) setOpenState(true)
    }
    window.addEventListener(EVT, on)
    window.addEventListener(EVT_ONE, one)
    return () => {
      window.removeEventListener(EVT, on)
      window.removeEventListener(EVT_ONE, one)
    }
  }, [id])
  const setOpen = (next: boolean) => {
    setOpenState(next)
    writeFold(id, next)
  }
  return [open, setOpen]
}

/** 화면에 있는 목차를 한꺼번에 펼치거나 접는다 — 펼치기는 다음에 여는 화면에도 이어진다 */
export function foldAll(open: boolean) {
  try {
    if (open) localStorage.setItem(FOLD_ALL_KEY, 'open')
    else localStorage.removeItem(FOLD_ALL_KEY)
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith('axmvp.fold.') && k !== FOLD_ALL_KEY) localStorage.removeItem(k)
    }
  } catch {
    // 지금 화면만 바뀐다
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: open }))
}

/**
 * 목차 설명 — 감싼 것(목차)에 마우스를 올리면 바로, 휴대폰은 ? 를 누르면 뜬다.
 * 설명이 없으면 감싼 것만 그린다.
 */
export function HintTip({
  tip,
  label,
  children,
  className = '',
  dot = true,
  tight = false,
  onDark = false,
}: {
  tip?: string
  label: string
  children: ReactNode
  className?: string
  /** false 면 ? 없이 마우스를 올릴 때만(좁은 칸 머리 — 영업 보드 단계) */
  dot?: boolean
  /** 작은 소제목 — ? 단추(누르는 칸 44px 그대로)가 줄 높이를 키우지 않게 위아래로 겹쳐 둔다 */
  tight?: boolean
  /** 짙은 바탕 위 소제목 — ? 를 밝은 색으로 */
  onDark?: boolean
}) {
  const [shown, setShown] = useState(false)
  const id = useId()
  // D-235: 설명 상자가 화면 오른쪽 밖으로 나가면(휴대폰 · 카드 안쪽 소제목) 그만큼 왼쪽으로 당긴다
  const tipRef = useRef<HTMLSpanElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  // 상자는 소제목 줄 왼쪽 끝(left-0)에서 시작한다 — 그 자리와 상자 폭만으로 계산해 여러 번 불려도 같은 값
  const fit = () =>
    window.requestAnimationFrame(() => {
      const el = tipRef.current
      const wrap = wrapRef.current
      if (!el || !wrap) return
      const width = el.getBoundingClientRect().width
      if (width === 0) return
      const left = wrap.getBoundingClientRect().left
      // innerWidth 는 상자가 넘친 순간 휴대폰에서 같이 늘어난다 — 화면 폭은 clientWidth 로
      const over = left + width - (document.documentElement.clientWidth - 8)
      setShift(over > 0 ? -Math.min(over, Math.max(0, left - 8)) : 0)
    })
  if (!tip) return <>{children}</>
  return (
    <div ref={wrapRef} className={`group/hint relative flex min-w-0 items-center ${className}`} onMouseEnter={fit} onFocusCapture={fit} onMouseLeave={() => setShown(false)}>
      {children}
      {dot && (
      <button
        type="button"
        // 이름에 목차 글자를 넣지 않는다 — '목차 단추' 와 이름이 겹치지 않게(설명 자체는 aria-describedby 로 읽힌다)
        aria-label="무슨 기능인지 설명 보기"
        data-hint-for={label}
        aria-expanded={shown}
        aria-describedby={id}
        onClick={() => {
          setShown((v) => !v)
          fit()
        }}
        data-testid="hint-dot"
        className={`tap flex size-11 shrink-0 items-center justify-center rounded-full ${onDark ? 'text-white/75 hover:text-white focus-visible:text-white' : 'text-slate-500 hover:text-brand-600 focus-visible:text-brand-600'} ${tight ? '-my-2.5' : ''}`}
      >
        <CircleHelp aria-hidden="true" className="size-[1.05rem]" />
      </button>
      )}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        data-testid="hint-tip"
        className={`pointer-events-none absolute top-full left-0 z-40 mt-0.5 w-max max-w-[min(24rem,calc(100vw-2.5rem))] rounded-(--radius-control) bg-slate-900 px-3 py-2 text-[0.92rem] leading-snug font-medium break-keep whitespace-pre-line text-white shadow-lg ${
          shown ? 'block' : 'hidden group-hover/hint:block group-has-[:focus-visible]/hint:block'
        }`}
      >
        {tip}
      </span>
    </div>
  )
}

/** 목차 안 글자만 모은다 — '모듈 {n}개' 처럼 숫자가 섞여도 앞 글자로 사전을 찾게 */
function plainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join('')
  return ''
}

/**
 * 글자 그대로 쓴 소제목(h2 · h3 · h4) + ? 설명.
 * 설명은 help 를 주거나, 없으면 목차 이름(label · 없으면 안의 글자)으로 사전에서 찾는다. 둘 다 없으면 소제목만 그린다.
 * 소제목은 ? 와 함께 한 줄로 묶인다 — 줄 맞춤(flex-1 등)이 필요하면 wrapClassName 에.
 */
export function HelpHeading({
  as: Tag = 'h2',
  id,
  className = '',
  wrapClassName = '',
  help,
  label,
  tight = false,
  onDark = false,
  testId,
  children,
}: {
  as?: 'h2' | 'h3' | 'h4'
  id?: string
  className?: string
  /** ? 와 소제목을 묶은 줄의 모양(밑줄 · 바깥 여백 · flex-1 등). 설명이 없어도 이 줄은 그린다 */
  wrapClassName?: string
  help?: string
  /** 소제목 안에 숫자 · 그림이 섞여 글자만으로 찾기 어려울 때 사전에서 찾을 이름 */
  label?: string
  /** 작은 소제목 — ? 가 줄 높이를 키우지 않게 */
  tight?: boolean
  /** 짙은 바탕 위 소제목 */
  onDark?: boolean
  testId?: string
  children: ReactNode
}) {
  const name = (label ?? plainText(children)).replace(/\s+/g, ' ').trim()
  const tip = help ?? hintFor(name)
  const heading = (
    <Tag id={id} className={className} data-testid={testId}>
      {children}
    </Tag>
  )
  if (!tip) return wrapClassName ? <div className={wrapClassName}>{heading}</div> : heading
  return (
    <HintTip tip={tip} label={name} className={wrapClassName} tight={tight} onDark={onDark}>
      {heading}
    </HintTip>
  )
}

/**
 * 접는 목차 한 덩어리 — 제목 줄(▸ · 제목 · 숫자 · ? · 오른쪽 행동) + 펼치면 내용.
 * id 는 화면 안에서 겹치지 않게(기억 열쇠). 설명(hint)을 안 주면 목차 이름으로 사전에서 찾는다.
 */
export function Fold({
  id,
  title,
  hint,
  count,
  countTone = 'neutral',
  defaultOpen = false,
  action,
  icon,
  headingId,
  tour,
  panel = false,
  summary,
  forceOpen = false,
  children,
  className = '',
  testId,
}: {
  id: string
  title: string
  hint?: string
  count?: number
  countTone?: 'neutral' | 'danger' | 'warning' | 'brand'
  defaultOpen?: boolean
  action?: ReactNode
  /** 제목 앞 작은 그림(오늘 화면의 색 칩) */
  icon?: ReactNode
  headingId?: string
  tour?: string
  /** 흰 카드 한 장으로(테두리 · 안쪽 여백) — 업체 상세의 카드들 */
  panel?: boolean
  /** 접혀 있을 때 제목 옆 한 줄 요약(예: 계약 1,200만원 · 3개월째) — 펼치지 않고도 핵심만 */
  summary?: ReactNode
  /** 이 목차로 데려온 경우(#주소 등) — 기억과 상관없이 펼친 채로 */
  forceOpen?: boolean
  children: ReactNode
  className?: string
  testId?: string
}) {
  const [open, setOpen] = useFold(id, defaultOpen, forceOpen)
  const bodyId = useId()
  const tip = hint ?? hintFor(title)
  const tone =
    countTone === 'danger' ? 'bg-danger-50 text-danger-700' : countTone === 'warning' ? 'bg-warning-50 text-warning-800' : countTone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
  return (
    <section
      data-fold={id}
      data-open={open ? '1' : '0'}
      data-testid={testId}
      data-tour={tour}
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col ${open ? 'gap-3' : ''} ${panel ? `rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-1 sm:px-4 ${open ? 'pb-4 sm:pb-5' : ''}` : ''} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-2">
        {/* 제목(h2) 안에 펼침 단추 — 화면 읽기 프로그램도 '제목 · 펼침' 으로 읽는다 */}
        <HintTip tip={tip} label={title} className="max-w-full">
          <h2 id={headingId} className="t-section min-w-0 text-slate-900">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen(!open)}
              data-testid="fold-toggle"
              className="tap flex min-h-11 min-w-0 items-center gap-1.5 text-left"
            >
              <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
              {/* 휴대폰에서는 색 칩을 뺀다 — 제목 · ? · '모두 보기' 가 한 줄에 들어가게 */}
              {icon && <span className="hidden shrink-0 sm:inline-flex">{icon}</span>}
              <span className="min-w-0 break-keep">{title}</span>
              {typeof count === 'number' && count > 0 && <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${tone}`}>{count}</span>}
            </button>
          </h2>
        </HintTip>
        {summary && !open && (
          <span data-testid="fold-summary" className="t-sub min-w-0 basis-full pb-2 pl-7 break-keep text-slate-500 [overflow-wrap:anywhere] sm:flex-[1_1_10rem] sm:basis-auto sm:pb-0 sm:pl-0">
            {summary}
          </span>
        )}
        {action && <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {open && (
        <div id={bodyId} className="flex min-w-0 flex-col gap-3">
          {children}
        </div>
      )}
    </section>
  )
}

/** 긴 화면 위 [모두 펼치기] · [모두 접기] */
export function FoldAllButton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`} data-testid="fold-all">
      <button type="button" onClick={() => foldAll(true)} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) px-2 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800" data-testid="fold-all-open">
        <ChevronsUpDown aria-hidden="true" className="size-4" /> 모두 펼치기
      </button>
      <button type="button" onClick={() => foldAll(false)} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) px-2 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800" data-testid="fold-all-close">
        <ChevronsDownUp aria-hidden="true" className="size-4" /> 모두 접기
      </button>
    </div>
  )
}
