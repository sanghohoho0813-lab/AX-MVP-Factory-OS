import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type {
  RepeatColumnFieldType,
  RepeatTableColumn,
} from '../../types/survey'
import { REPEAT_COLUMN_TYPE_META } from '../../lib/surveyMeta'
import { generateId } from '../../storage/localStore'

interface RepeatTableColumnEditorProps {
  columns: RepeatTableColumn[]
  onChange: (columns: RepeatTableColumn[]) => void
  error?: string
}

const FIELD_TYPES: RepeatColumnFieldType[] = [
  'short_text',
  'number',
  'currency',
  'time',
  'date',
  'single_choice',
]

/** 표 반복 질문의 컬럼 편집 — 라벨·필드유형·필수·단위·순서 */
export function RepeatTableColumnEditor({
  columns,
  onChange,
  error,
}: RepeatTableColumnEditorProps) {
  const sorted = [...columns].sort((a, b) => a.orderIndex - b.orderIndex)
  const reindex = (list: RepeatTableColumn[]): RepeatTableColumn[] =>
    list.map((c, i) => ({ ...c, orderIndex: i }))

  const update = (id: string, patch: Partial<RepeatTableColumn>) =>
    onChange(reindex(sorted.map((c) => (c.id === id ? { ...c, ...patch } : c))))
  const add = () =>
    onChange(
      reindex([
        ...sorted,
        {
          id: generateId(),
          label: '',
          fieldType: 'short_text',
          required: false,
          unit: '',
          orderIndex: sorted.length,
        },
      ]),
    )
  const remove = (id: string) => onChange(reindex(sorted.filter((c) => c.id !== id)))
  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= sorted.length) return
    const copy = [...sorted]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    onChange(reindex(copy))
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-700">표 반복 컬럼</span>
        <button
          type="button"
          onClick={add}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          컬럼 추가
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-4 text-center text-[13px] text-slate-400">
          컬럼을 추가해 주세요. (최소 2개)
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th scope="col" className="pb-1.5 pl-1 font-medium">순서</th>
                <th scope="col" className="pb-1.5 font-medium">컬럼명</th>
                <th scope="col" className="pb-1.5 font-medium">필드 유형</th>
                <th scope="col" className="pb-1.5 font-medium">단위</th>
                <th scope="col" className="pb-1.5 font-medium">필수</th>
                <th scope="col" className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((column, index) => (
                <tr key={column.id} className="align-middle">
                  <td className="py-1 pr-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`${index + 1}번 컬럼 위로`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronUp aria-hidden="true" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${index + 1}번 컬럼 아래로`}
                        disabled={index === sorted.length - 1}
                        onClick={() => move(index, 1)}
                        className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronDown aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`${index + 1}번 컬럼명`}
                      value={column.label}
                      onChange={(e) => update(column.id, { label: e.target.value })}
                      className="h-9 w-full min-w-32 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-500"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={`${index + 1}번 컬럼 필드 유형`}
                      value={column.fieldType}
                      onChange={(e) =>
                        update(column.id, {
                          fieldType: e.target.value as RepeatColumnFieldType,
                        })
                      }
                      className="h-9 w-28 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft} value={ft}>
                          {REPEAT_COLUMN_TYPE_META[ft]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`${index + 1}번 컬럼 단위`}
                      value={column.unit}
                      placeholder="건, 분…"
                      onChange={(e) => update(column.id, { unit: e.target.value })}
                      className="h-9 w-20 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-500"
                    />
                  </td>
                  <td className="py-1 pr-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${index + 1}번 컬럼 필수 여부`}
                      checked={column.required}
                      onChange={(e) =>
                        update(column.id, { required: e.target.checked })
                      }
                      className="size-4 accent-brand-600"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`${index + 1}번 컬럼 삭제`}
                      onClick={() => remove(column.id)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  )
}
