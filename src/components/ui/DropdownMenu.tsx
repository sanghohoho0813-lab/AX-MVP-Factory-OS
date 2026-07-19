import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDismissable } from '../../lib/useDismissable'

export interface DropdownMenuItem {
  key: string
  label: string
  icon?: LucideIcon
  danger?: boolean
  onSelect: () => void
}

interface DropdownMenuProps {
  ariaLabel: string
  items: DropdownMenuItem[]
  align?: 'left' | 'right'
}

/** "더보기" 케밥 메뉴 — 키보드(Tab/Enter/ESC) 사용 가능 */
export function DropdownMenu({ ariaLabel, items, align = 'right' }: DropdownMenuProps) {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex size-9 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal aria-hidden="true" className="size-4.5" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={`absolute top-full z-30 mt-1 w-44 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay) ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                item.danger
                  ? 'text-danger-600 hover:bg-danger-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.icon && (
                <item.icon
                  aria-hidden="true"
                  className={`size-4 ${item.danger ? 'text-danger-500' : 'text-slate-400'}`}
                />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
