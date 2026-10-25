/**
 * D-287 화면 꾸미기 — 칸 순서 바꾸기 · 오늘만 숨기기 · 계속 숨기기 (기억 · 규칙은 lib/pageLayout.ts).
 *
 *   <ArrangeArea page="today" title="오늘">
 *     <ArrangeItem id="kpis" label="숫자 다섯 칸">…</ArrangeItem>
 *     <ArrangeItem id="agenda" label="다가오는 마감 · 약속" span="wide">…</ArrangeItem>
 *   </ArrangeArea>
 *
 *  - 화면은 칸을 기본 순서대로 넘긴다. 사람이 바꾼 순서 · 숨김만 여기서 덧씌운다(바꾼 적 없으면 예전 화면 그대로).
 *  - span: 'wide' · 'narrow' · 'half' 칸은 바로 옆 칸과 PC 에서 한 줄에 나란히(넓음 + 좁음 = 7 : 5, 그 밖은 반반). 짝이 없으면 한 줄 전체.
 *  - 칸 안이 비면(그릴 것이 없으면) 자리도 차지하지 않는다(empty:hidden).
 *  - [화면 꾸미기] 단추는 경로 줄 오른쪽(AppShell) — 이 화면에 꾸밀 칸이 있을 때만. 숨긴 칸이 있으면 화면 맨 아래에 '숨긴 칸 n개 · 다시 보기'.
 */
import { Children, isValidElement, useEffect, useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpToLine, EyeOff, SlidersHorizontal } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { arrangeIds, hiddenIds, isCustomized, moveSection, resetLayout, setSectionVisibility, usePageLayout, visibilityOf, type SectionVisibility } from '../../lib/pageLayout'

type Span = 'full' | 'wide' | 'narrow' | 'half'

export interface ArrangeItemProps {
  id: string
  /** 꾸미기 창에 보일 이름(화면의 칸 제목과 같게) */
  label: string
  /** 꾸미기 창에서 이름 아래 한 줄(무슨 칸인지) */
  hint?: string
  span?: Span
  children: ReactNode
}

/** 표시용 — ArrangeArea 가 props 를 읽어 그린다 */
export function ArrangeItem(props: ArrangeItemProps) {
  return <>{props.children}</>
}

interface Known {
  id: string
  label: string
  hint?: string
}

/* ---- 지금 화면의 꾸밀 칸(경로 줄의 [화면 꾸미기] 단추가 읽는다) ---- */
let current: { page: string; title: string; items: Known[] } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
let openSheet: ((v: boolean) => void) | null = null

function useCurrentArrange() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
}

/** 화면 맨 아래 '숨긴 칸 · 다시 보기' 도 같은 창을 연다 */
export function openArrangeSheet() {
  openSheet?.(true)
}

const PAIR: Record<string, string> = {
  'wide+narrow': 'xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
  'narrow+wide': 'xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]',
}

export function ArrangeArea({ page, title, children, className = 'flex flex-col gap-6', pairGap = 'gap-6' }: { page: string; title: string; children: ReactNode; className?: string; pairGap?: string }) {
  const layout = usePageLayout(page)
  const items = useMemo(() => {
    const out: ArrangeItemProps[] = []
    Children.forEach(children, (c) => {
      if (isValidElement(c) && c.type === ArrangeItem) out.push((c as ReactElement<ArrangeItemProps>).props)
    })
    return out
  }, [children])
  const defaults = useMemo(() => items.map((i) => i.id), [items])
  const known = useMemo(() => items.map(({ id, label, hint }) => ({ id, label, hint })), [items])
  const knownKey = JSON.stringify(known)

  // 경로 줄 [화면 꾸미기] 에 이 화면을 알린다(떠나면 지운다)
  useEffect(() => {
    current = { page, title, items: JSON.parse(knownKey) as Known[] }
    emit()
    return () => {
      if (current?.page === page) {
        current = null
        emit()
      }
    }
  }, [page, title, knownKey])

  const byId = new Map(items.map((i) => [i.id, i]))
  const order = arrangeIds(defaults, layout).filter((id) => visibilityOf(layout, id) === 'show')
  const hidden = hiddenIds(defaults, layout)

  // 넓음 · 좁음 · 반 칸은 바로 다음 칸과 짝(PC 한 줄) — 짝이 없으면 한 줄 전체
  const rows: ArrangeItemProps[][] = []
  for (let i = 0; i < order.length; i++) {
    const a = byId.get(order[i])
    if (!a) continue
    const b = i + 1 < order.length ? byId.get(order[i + 1]) : undefined
    if ((a.span ?? 'full') !== 'full' && b && (b.span ?? 'full') !== 'full') {
      rows.push([a, b])
      i++
    } else rows.push([a])
  }
  const cell = (it: ArrangeItemProps) => (
    <div key={it.id} data-arrange-item={it.id} className="min-w-0 empty:hidden">
      {it.children}
    </div>
  )

  return (
    <div className={className} data-arrange={page}>
      {rows.map((r) =>
        r.length === 1 ? (
          cell(r[0])
        ) : (
          <div key={`${r[0].id}+${r[1].id}`} data-arrange-pair="" className={`grid grid-cols-1 ${pairGap} ${PAIR[`${r[0].span}+${r[1].span}`] ?? 'xl:grid-cols-2'} [&:not(:has(>:not(:empty)))]:hidden`}>
            {cell(r[0])}
            {cell(r[1])}
          </div>
        ),
      )}
      {hidden.length > 0 && (
        <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 break-keep text-slate-500" data-testid="arrange-hidden">
          <EyeOff aria-hidden="true" className="size-4 shrink-0" />
          숨긴 칸 {hidden.length}개 · {hidden.map((id) => byId.get(id)?.label ?? id).join(' · ')}
          <button type="button" onClick={openArrangeSheet} className="tap font-semibold text-brand-700 hover:underline" data-testid="arrange-hidden-open">
            다시 보기 · 꾸미기
          </button>
        </p>
      )}
      {isCustomized(layout) && <span className="sr-only">이 화면은 순서나 숨김을 바꿔 두었습니다</span>}
    </div>
  )
}

/** 경로 줄 오른쪽 [화면 꾸미기] — 꾸밀 칸이 있는 화면에서만 보인다 */
export function ArrangeButton() {
  const cur = useCurrentArrange()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    openSheet = setOpen
    return () => {
      if (openSheet === setOpen) openSheet = null
    }
  }, [])
  if (!cur) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap t-sub inline-flex h-9 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
        data-testid="arrange-open"
        aria-haspopup="dialog"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4 text-slate-500" />
        <span>
          <span className="sm:hidden">꾸미기</span>
          <span className="hidden sm:inline">화면 꾸미기</span>
        </span>
      </button>
      {open && <ArrangeSheet page={cur.page} title={cur.title} items={cur.items} onClose={() => setOpen(false)} />}
    </>
  )
}

const VIS: { v: SectionVisibility; label: string }[] = [
  { v: 'show', label: '보이기' },
  { v: 'today', label: '오늘만 숨기기' },
  { v: 'off', label: '계속 숨기기' },
]

function ArrangeSheet({ page, title, items, onClose }: { page: string; title: string; items: Known[]; onClose: () => void }) {
  const layout = usePageLayout(page)
  const defaults = items.map((i) => i.id)
  const order = arrangeIds(defaults, layout)
  const byId = new Map(items.map((i) => [i.id, i]))
  return (
    <Modal
      open
      title={`화면 꾸미기 — ${title}`}
      onClose={onClose}
      footer={
        <>
          {isCustomized(layout) && (
            <Button variant="secondary" onClick={() => resetLayout(page)} data-testid="arrange-reset">
              처음대로
            </Button>
          )}
          <Button variant="primary" onClick={onClose} data-testid="arrange-done">
            다 됐어요
          </Button>
        </>
      }
    >
      <p className="t-sub break-keep text-slate-600">칸 순서를 바꾸거나 잠시 · 계속 숨길 수 있어요. 바로 화면에 반영되고, 이 기기에 기억해요. 지운 것은 없어요 — 숨긴 칸은 언제든 다시 보이게 할 수 있어요.</p>
      <ol className="mt-3 flex flex-col gap-2" data-testid="arrange-list">
        {order.map((id, i) => {
          const it = byId.get(id)
          if (!it) return null
          const v = visibilityOf(layout, id)
          return (
            <li key={id} data-arrange-row={id} data-state={v} className={`flex flex-col gap-2 rounded-(--radius-control) border px-3 py-2.5 ${v === 'show' ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="t-meta w-5 shrink-0 text-center font-semibold text-slate-400">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`t-body font-semibold break-keep [overflow-wrap:anywhere] ${v === 'show' ? 'text-slate-900' : 'text-slate-500'}`}>{it.label}</span>
                  {it.hint && <span className="t-meta break-keep text-slate-500">{it.hint}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <IconBtn label={`${it.label} 맨 위로`} disabled={i === 0} onClick={() => moveSection(page, defaults, id, 'top')} testId="arrange-top">
                    <ArrowUpToLine className="size-4" />
                  </IconBtn>
                  <IconBtn label={`${it.label} 위로`} disabled={i === 0} onClick={() => moveSection(page, defaults, id, 'up')} testId="arrange-up">
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label={`${it.label} 아래로`} disabled={i === order.length - 1} onClick={() => moveSection(page, defaults, id, 'down')} testId="arrange-down">
                    <ArrowDown className="size-4" />
                  </IconBtn>
                </span>
              </div>
              <div role="radiogroup" aria-label={`${it.label} 보이기`} className="grid grid-cols-3 gap-1 rounded-(--radius-control) bg-slate-100 p-0.5">
                {VIS.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={v === o.v}
                    data-vis={o.v}
                    onClick={() => setSectionVisibility(page, id, o.v)}
                    className={`tap t-meta min-h-9 rounded-[calc(var(--radius-control)-2px)] px-1.5 font-semibold break-keep ${v === o.v ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300' : 'text-slate-500 hover:bg-white/60'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}

function IconBtn({ label, disabled, onClick, children, testId }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode; testId: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="tap flex size-10 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-35"
    >
      {children}
    </button>
  )
}
