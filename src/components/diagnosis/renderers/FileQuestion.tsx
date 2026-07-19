import { FileText, Upload, X } from 'lucide-react'
import { useRef } from 'react'
import type { RendererProps } from './types'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const BLOCKED_EXT = /\.(exe|bat|cmd|sh|msi|com|scr|dll|js|jar)$/i

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

/**
 * 파일 첨부 — 실제 업로드 없이 메타데이터만 저장(localOnly).
 * File 객체·Blob·base64는 저장하지 않는다.
 */
export function FileQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const file = answer?.kind === 'file' ? answer.file : null

  const handleSelect = (fileList: FileList | null) => {
    const picked = fileList?.[0]
    if (!picked) return
    if (BLOCKED_EXT.test(picked.name)) {
      onAnswer({ kind: 'file', file: null })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    onAnswer({
      kind: 'file',
      file: {
        name: picked.name,
        size: picked.size,
        type: picked.type || 'application/octet-stream',
        lastModified: picked.lastModified,
        localOnly: true,
        selectedAt: new Date().toISOString(),
      },
    })
  }

  const oversize = file !== null && file.size > MAX_SIZE

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        aria-label={`${question.text} 파일 선택`}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.files)}
        className="sr-only"
        id={`file-${question.id}`}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand-600"
          >
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400">
              {formatSize(file.size)} · {file.type || '알 수 없음'}
            </p>
            {oversize && (
              <p className="mt-0.5 text-xs text-danger-600">
                10MB를 초과하는 파일입니다. 다른 파일을 선택해 주세요.
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="선택한 파일 제거"
            disabled={disabled}
            onClick={() => {
              onAnswer({ kind: 'file', file: null })
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={`file-${question.id}`}
          className="flex cursor-pointer items-center gap-3 rounded-(--radius-control) border border-dashed border-slate-300 bg-slate-50 px-4 py-4 hover:border-brand-400"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400"
          >
            <Upload className="size-4" />
          </span>
          <span className="text-sm font-medium text-slate-600">
            파일 선택 (최대 10MB, 문서·이미지)
          </span>
        </label>
      )}
      <p className="mt-1.5 text-xs break-keep text-slate-400">
        현재 테스트 모드에서는 파일 원본이 업로드되지 않고 파일 정보만 저장됩니다.
        실제 파일 업로드는 Supabase Storage 연결 후 제공됩니다.
      </p>
    </div>
  )
}
