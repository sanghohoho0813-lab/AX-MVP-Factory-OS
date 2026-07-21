import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  header: string
  /** th/td 공통 클래스 (열 숨김·정렬 등) */
  className?: string
  cell: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowAriaLabel?: (row: T) => string
}

/** 데스크톱 표 — 행 클릭·키보드 접근 가능 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowAriaLabel,
}: DataTableProps<T>) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={`px-4 py-3 text-left text-[0.875rem] font-semibold whitespace-nowrap text-slate-500 ${column.className ?? ''}`}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            tabIndex={onRowClick ? 0 : undefined}
            aria-label={rowAriaLabel?.(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      if (event.target === event.currentTarget) {
                        event.preventDefault()
                        onRowClick(row)
                      }
                    }
                  }
                : undefined
            }
            className={`border-b border-slate-100 last:border-0 ${
              onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
            }`}
          >
            {columns.map((column) => (
              <td key={column.key} className={`px-4 py-3.5 align-middle ${column.className ?? ''}`}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
