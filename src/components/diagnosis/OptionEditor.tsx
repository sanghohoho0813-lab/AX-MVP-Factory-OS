import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { QuestionOption, RiskSignalLevel } from '../../types/survey'
import { RISK_SIGNAL_LEVELS, RISK_SIGNAL_META } from '../../lib/surveyMeta'
import { generateId } from '../../storage/localStore'

interface OptionEditorProps {
  options: QuestionOption[]
  onChange: (options: QuestionOption[]) => void
  error?: string
}

/** 선택형 질문의 선택지 편집 — 라벨·내부값·점수·위험신호·순서 */
export function OptionEditor({ options, onChange, error }: OptionEditorProps) {
  const sorted = [...options].sort((a, b) => a.orderIndex - b.orderIndex)

  const reindex = (list: QuestionOption[]): QuestionOption[] =>
    list.map((o, i) => ({ ...o, orderIndex: i }))

  const update = (id: string, patch: Partial<QuestionOption>) => {
    onChange(reindex(sorted.map((o) => (o.id === id ? { ...o, ...patch } : o))))
  }
  const add = () => {
    onChange(
      reindex([
        ...sorted,
        {
          id: generateId(),
          label: '',
          value: '',
          score: 0,
          riskSignal: 'none',
          orderIndex: sorted.length,
        },
      ]),
    )
  }
  const remove = (id: string) => onChange(reindex(sorted.filter((o) => o.id !== id)))
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
        <span className="text-[13px] font-medium text-slate-700">선택지</span>
        <button
          type="button"
          onClick={add}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          선택지 추가
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-4 text-center text-[13px] text-slate-400">
          선택지를 추가해 주세요. (최소 2개)
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[0.875rem] text-slate-400">
                <th scope="col" className="pb-1.5 pl-1 font-medium">순서</th>
                <th scope="col" className="pb-1.5 font-medium">라벨</th>
                <th scope="col" className="pb-1.5 font-medium">내부값</th>
                <th scope="col" className="pb-1.5 font-medium">점수</th>
                <th scope="col" className="pb-1.5 font-medium">위험 신호</th>
                <th scope="col" className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((option, index) => (
                <tr key={option.id} className="align-middle">
                  <td className="py-1 pr-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`${index + 1}번 선택지 위로`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronUp aria-hidden="true" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${index + 1}번 선택지 아래로`}
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
                      aria-label={`${index + 1}번 선택지 라벨`}
                      value={option.label}
                      onChange={(e) => update(option.id, { label: e.target.value })}
                      className="h-9 w-full min-w-32 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-500"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`${index + 1}번 선택지 내부값`}
                      value={option.value}
                      onChange={(e) => update(option.id, { value: e.target.value })}
                      className="h-9 w-full min-w-24 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-500"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      aria-label={`${index + 1}번 선택지 점수`}
                      value={option.score}
                      onChange={(e) =>
                        update(option.id, { score: Number(e.target.value) || 0 })
                      }
                      className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={`${index + 1}번 선택지 위험 신호`}
                      value={option.riskSignal}
                      onChange={(e) =>
                        update(option.id, {
                          riskSignal: e.target.value as RiskSignalLevel,
                        })
                      }
                      className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500"
                    >
                      {RISK_SIGNAL_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {RISK_SIGNAL_META[level].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`${index + 1}번 선택지 삭제`}
                      onClick={() => remove(option.id)}
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
      {error && <p className="mt-1 text-[0.875rem] text-danger-600">{error}</p>}
    </div>
  )
}
