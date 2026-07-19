import { Upload } from 'lucide-react'
import type { RendererProps } from './types'

/** 파일 첨부 — 미리보기에서는 실제 업로드 없이 첨부 UI만 표시 */
export function FileQuestion({ disabled }: RendererProps) {
  return (
    <div className="flex items-center gap-3 rounded-(--radius-control) border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400"
      >
        <Upload className="size-4" />
      </span>
      <div className="min-w-0">
        <button
          type="button"
          disabled={disabled}
          className="cursor-not-allowed rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-500"
        >
          파일 선택
        </button>
        <p className="mt-1 text-xs text-slate-400">
          미리보기에서는 실제 업로드가 동작하지 않습니다.
        </p>
      </div>
    </div>
  )
}
