/**
 * 전역 빠른 이동 검색. 상단 검색을 누르거나 Ctrl/Cmd+K, `/` 로 연다.
 * 고객 관리 업체(D-120 — 대표자 · 사업자번호 · 전화 뒷자리로도)·고객사·프로젝트·지금 해야 할 일·도구함·결과 자료를
 * 그룹으로 찾아 실제 화면으로 이동한다.
 * 외부 라이브러리 없이 구현한다.
 *
 * D-647 여기에는 머리줄 단추 · 단축키 · 여닫기만 — 찾기 창 속(SearchDialog · 화면 이름 표 · 안내 글)은 열 때 받는다.
 * 화면을 그린 뒤 한가할 때 미리 받아 두어 Ctrl+K 를 바로 눌러도 기다리지 않게.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { useBackToClose } from '../../lib/backToClose'

const loadSearchDialog = () => import('./SearchDialog')
const SearchDialog = lazy(() => loadSearchDialog().then((m) => ({ default: m.SearchDialog })))

/** 창 속을 받는 동안 — 같은 자리 · 같은 이름의 틀(바깥을 누르면 닫힘) */
function SearchLoading({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-navy-950/40 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="빠른 이동 검색">
      <button type="button" aria-label="검색 닫기" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative flex w-full max-w-xl items-center gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 shadow-(--shadow-overlay)">
        <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
        <p className="flex h-14 items-center text-[1rem] text-slate-400" data-testid="search-loading">찾기 준비 중…</p>
      </div>
    </div>,
    document.body,
  )
}

/**
 * compact: 좁은 화면(1360px 아래)용 '찾기' 단추(D-120) — 예전에는 그 폭에서 검색 칸이 사라지고 Ctrl+K 로만 열렸다.
 * 단축키는 넓은 칸 하나만 듣는다(두 곳이 함께 열리지 않게).
 */
export function GlobalSearch({ compact = false }: { compact?: boolean } = {}) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  useBackToClose(open, close)

  // D-647 화면을 그린 뒤 한가할 때 창 속을 미리 받아 둔다(누르면 바로 · 못 받아도 누를 때 다시)
  useEffect(() => {
    if (compact) return
    const go = () => void loadSearchDialog().catch(() => {})
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(go, 1500)
    return () => window.clearTimeout(t)
  }, [compact])

  // 전역 단축키
  // D-94: 붙잡는 단계(capture)에서 먼저 듣는다 — 검색 창이 열려 있을 때 Esc 는 검색 창만 닫고,
  // 그 아래 모듈 창(영업 고객 등록 등)까지 같이 닫히지 않게 전파를 멈춘다.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  useEffect(() => {
    if (compact) return
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if (cmdK || slash) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setOpen(true)
      } else if (e.key === 'Escape' && openRef.current) {
        e.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, compact])
  // compact 는 열려 있을 때만 Esc 를 듣는다
  useEffect(() => {
    if (!compact || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [compact, open, close])

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerEnter={() => void loadSearchDialog().catch(() => {})}
          aria-label="찾기 — 업체 · 대표 · 전화번호 · 화면 이름"
          data-testid="search-compact"
          className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-600 hover:bg-slate-100 hover:text-slate-800 sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <Search aria-hidden="true" className="size-5" />
          <span className="hidden text-[0.9375rem] font-medium sm:inline">찾기</span>
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
          onPointerEnter={() => void loadSearchDialog().catch(() => {})}
        data-guide="fn-search"
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 text-[0.9375rem] text-slate-400 hover:border-slate-300"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        {/* min-w-0 이 없으면 좁은 화면에서 글자가 칸 밖으로 삐져나와 옆 버튼을 덮는다 */}
        <span className="min-w-0 truncate">업체·대표·전화·화면 찾기</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[0.875rem] font-medium text-slate-400 2xl:inline">Ctrl K</kbd>
      </button>
      )}

      {/* D-94: body 로 띄운다 — 머리줄 안에 있으면 머리줄 층(z) 에 갇혀 모듈 창(영업 고객 등록 등) 뒤에 깔렸다 */}
      {open && (
        <Suspense fallback={<SearchLoading onClose={close} />}>
          <SearchDialog onClose={close} />
        </Suspense>
      )}
    </>
  )
}
