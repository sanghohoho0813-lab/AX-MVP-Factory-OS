import { Plus, Trash2 } from 'lucide-react'
import type { RendererProps } from './types'

/** 표 반복 입력 — 행 추가·삭제 시뮬레이션 */
export function RepeatTableQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const columns = [...question.repeatTableColumns].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  )
  const rows = answer?.kind === 'table' ? answer.rows : []

  const setRows = (next: Array<Record<string, string>>) =>
    onAnswer({ kind: 'table', rows: next })
  const addRow = () => setRows([...rows, {}])
  const removeRow = (index: number) =>
    setRows(rows.filter((_, i) => i !== index))
  const updateCell = (index: number, colId: string, value: string) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, [colId]: value } : row)))

  return (
    <div>
      <div className="overflow-x-auto rounded-(--radius-control) border border-slate-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="border-b border-slate-200 px-3 py-2 text-left text-[0.875rem] font-medium text-slate-500"
                >
                  {col.label}
                  {col.unit && <span className="text-slate-400"> ({col.unit})</span>}
                  {col.required && <span className="text-danger-500"> *</span>}
                </th>
              ))}
              <th className="w-10 border-b border-slate-200" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-4 text-center text-[13px] text-slate-400"
                >
                  행 추가를 눌러 입력을 시작하세요.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-100 last:border-0">
                  {columns.map((col) => (
                    <td key={col.id} className="px-2 py-1.5">
                      <input
                        aria-label={`${index + 1}행 ${col.label}`}
                        type={
                          col.fieldType === 'number' || col.fieldType === 'currency'
                            ? 'text'
                            : col.fieldType === 'date'
                              ? 'date'
                              : col.fieldType === 'time'
                                ? 'time'
                                : 'text'
                        }
                        inputMode={
                          col.fieldType === 'number' || col.fieldType === 'currency'
                            ? 'numeric'
                            : undefined
                        }
                        value={row[col.id] ?? ''}
                        disabled={disabled}
                        onChange={(e) => updateCell(index, col.id, e.target.value)}
                        className="h-9 w-full min-w-24 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500"
                      />
                    </td>
                  ))}
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      aria-label={`${index + 1}행 삭제`}
                      disabled={disabled}
                      onClick={() => removeRow(index)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={addRow}
        className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
      >
        <Plus aria-hidden="true" className="size-3.5" />행 추가
      </button>
    </div>
  )
}
