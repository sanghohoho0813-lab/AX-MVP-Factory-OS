import { FileText } from 'lucide-react'
import type { SnapshotPlacement } from '../../types/survey'
import type {
  RepeatTableAnswer,
  SurveyAnswerValue,
  SurveyFileMetadata,
} from '../../types/surveyRuntime'
import { formatDate, formatKrw } from '../../lib/format'

function optionLabel(placement: SnapshotPlacement, value: string): string {
  return placement.options.find((o) => o.value === value)?.label ?? value
}

function isFileMeta(value: SurveyAnswerValue): value is SurveyFileMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'localOnly' in value
  )
}

export function FileMetadataDisplay({ file }: { file: SurveyFileMetadata }) {
  const sizeLabel =
    file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
      : `${Math.round(file.size / 1024)}KB`
  return (
    <div className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2">
      <FileText aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-slate-700">{file.name}</p>
        <p className="text-xs text-slate-400">
          {sizeLabel} · {file.type || '형식 미상'}
        </p>
      </div>
      <span className="ml-auto shrink-0 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-700">
        실제 파일 미보관
      </span>
    </div>
  )
}

interface SurveyAnswerDisplayProps {
  placement: SnapshotPlacement
  value: SurveyAnswerValue | undefined
}

/** 질문 유형별 응답 값을 사람이 읽기 쉬운 형태로 표시 */
export function SurveyAnswerDisplay({ placement, value }: SurveyAnswerDisplayProps) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-[13px] text-slate-400">미응답</span>
  }

  switch (placement.type) {
    case 'single_choice':
    case 'yes_no':
    case 'scale_5':
      return (
        <span className="text-sm text-slate-800">
          {optionLabel(placement, String(value))}
        </span>
      )
    case 'multiple_choice':
      if (Array.isArray(value)) {
        if (value.length === 0)
          return <span className="text-[13px] text-slate-400">미응답</span>
        return (
          <div className="flex flex-wrap gap-1.5">
            {(value as string[]).map((v) => (
              <span
                key={v}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
              >
                {optionLabel(placement, v)}
              </span>
            ))}
          </div>
        )
      }
      return <span className="text-sm text-slate-800">{String(value)}</span>
    case 'currency':
      return (
        <span className="text-sm text-slate-800">
          {formatKrw(Number(value) || 0)}
        </span>
      )
    case 'number':
      return (
        <span className="text-sm text-slate-800">
          {Number(value).toLocaleString('ko-KR')}
        </span>
      )
    case 'date':
      return <span className="text-sm text-slate-800">{formatDate(String(value))}</span>
    case 'ranking':
      if (Array.isArray(value)) {
        return (
          <ol className="flex flex-col gap-1">
            {(value as string[]).map((v, i) => (
              <li key={v} className="text-sm text-slate-800">
                <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                {optionLabel(placement, v)}
              </li>
            ))}
          </ol>
        )
      }
      return null
    case 'repeat_table':
      if (Array.isArray(value) && !isFileMeta(value)) {
        const rows = value as RepeatTableAnswer[]
        const cols = [...placement.repeatTableColumns].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        )
        if (rows.length === 0)
          return <span className="text-[13px] text-slate-400">미응답</span>
        return (
          <div className="overflow-x-auto rounded-(--radius-control) border border-slate-200">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {cols.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className="border-b border-slate-200 px-3 py-1.5 text-left text-xs font-medium text-slate-500"
                    >
                      {c.label}
                      {c.unit && <span className="text-slate-400"> ({c.unit})</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    {cols.map((c) => (
                      <td key={c.id} className="px-3 py-1.5 text-slate-700">
                        {row[c.id] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      return null
    case 'file':
      if (isFileMeta(value)) return <FileMetadataDisplay file={value} />
      return <span className="text-[13px] text-slate-400">미응답</span>
    case 'long_text':
      return (
        <p className="text-sm break-keep whitespace-pre-wrap text-slate-800">
          {String(value)}
        </p>
      )
    default:
      return <span className="text-sm break-keep text-slate-800">{String(value)}</span>
  }
}
