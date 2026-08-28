import { useRef, useState } from 'react'
import { AlertTriangle, Check, FileUp, Loader2, X } from 'lucide-react'
import {
  DOC_SOURCE_LABEL,
  PARSED_FIELD_LABEL,
  parseKoreanBusinessDocument,
  type ParsedCompanyInfo,
} from '../../services/koreanDocParser'
import { EXTRACT_METHOD_LABEL, extractTextFromFile, type ExtractMethod } from '../../services/docTextExtract'
import { Button } from '../ui/Button'

type FieldKey = keyof Omit<ParsedCompanyInfo, 'source'>

const FIELD_ORDER: FieldKey[] = [
  'companyName',
  'businessNumber',
  'corporateNumber',
  'representativeName',
  'representativeBirth',
  'establishedAt',
  'address',
  'businessCategory',
  'businessItem',
]

export interface DocImportResult {
  picked: Partial<Record<FieldKey, string>>
}

/**
 * 사업자등록증·법인등기부등본을 올리거나 붙여넣어 기본 정보를 자동으로 채운다.
 * 읽은 값은 바로 덮어쓰지 않고, 항목별로 확인한 뒤 적용한다.
 */
export function DocImportModal({
  currentValues,
  onApply,
  onClose,
}: {
  currentValues: Partial<Record<FieldKey, string>>
  onApply: (result: DocImportResult) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null)
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const [parsed, setParsed] = useState<ParsedCompanyInfo | null>(null)
  const [method, setMethod] = useState<ExtractMethod | 'paste' | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const applyParsed = (p: ParsedCompanyInfo) => {
    setParsed(p)
    const next: Record<string, boolean> = {}
    for (const k of FIELD_ORDER) if (p[k]) next[k] = true
    setChecked(next)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    setParsed(null)
    setProgress({ ratio: 0, label: '준비 중' })
    try {
      const res = await extractTextFromFile(file, (ratio, label) => setProgress({ ratio, label }))
      setMethod(res.method)
      applyParsed(parseKoreanBusinessDocument(res.text))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `파일을 읽지 못했습니다: ${cause.message}`
          : '파일을 읽지 못했습니다. 텍스트 붙여넣기로 시도해 보세요.',
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const onParsePaste = () => {
    setError('')
    setMethod('paste')
    applyParsed(parseKoreanBusinessDocument(pasted))
  }

  const found = parsed ? FIELD_ORDER.filter((k) => parsed[k]) : []
  const pickedCount = found.filter((k) => checked[k]).length

  const apply = () => {
    if (!parsed) return
    const picked: Partial<Record<FieldKey, string>> = {}
    for (const k of found) if (checked[k]) picked[k] = String(parsed[k])
    onApply({ picked })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-navy-950/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="서류에서 정보 불러오기"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay)"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[1.3rem] font-bold text-slate-900">서류에서 정보 불러오기</h2>
            <p className="mt-0.5 text-[0.92rem] break-keep text-slate-500">
              사업자등록증·법인등기부등본을 올리면 회사명·사업자번호·대표자·설립일 등을 자동으로 읽습니다.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* 입력 방법 */}
          <div className="flex gap-1">
            {[
              { key: 'file' as const, label: '파일 올리기' },
              { key: 'paste' as const, label: '글자 붙여넣기' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-(--radius-control) border px-3 py-1.5 text-[0.92rem] font-medium ${
                  tab === t.key
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'file' ? (
            <div className="mt-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-(--radius-panel) border-2 border-dashed border-slate-300 px-5 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="size-7 animate-spin text-brand-600" />
                ) : (
                  <FileUp aria-hidden="true" className="size-7 text-brand-500" />
                )}
                <span className="text-[1.02rem] font-semibold text-slate-800">
                  {busy ? (progress?.label ?? '읽는 중…') : 'PDF 또는 사진 선택'}
                </span>
                <span className="text-[0.88rem] break-keep text-slate-500">
                  인터넷등기소·홈택스에서 받은 PDF는 거의 정확하게 읽습니다. 사진은 글자 인식(OCR)을 씁니다.
                </span>
              </button>
              {busy && progress && progress.ratio > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder={'서류의 글자를 복사해서 여기에 붙여넣으세요.\n예) 등록번호 : 214-88-01234\n     상호 : 주식회사 대한정밀'}
                className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[0.95rem] focus:border-brand-500 focus:outline-none"
              />
              <Button variant="secondary" className="mt-2" disabled={pasted.trim() === ''} onClick={onParsePaste}>
                글자에서 읽기
              </Button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2.5 text-[0.92rem] break-keep text-danger-700"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {/* 읽은 결과 */}
          {parsed && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[1.08rem] font-bold text-slate-900">읽은 내용</h3>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.82rem] text-slate-600">
                  {DOC_SOURCE_LABEL[parsed.source]}
                </span>
                {method && method !== 'paste' && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.82rem] text-slate-500">
                    {EXTRACT_METHOD_LABEL[method]}
                  </span>
                )}
              </div>

              {found.length === 0 ? (
                <p className="mt-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2.5 text-[0.92rem] break-keep text-warning-800">
                  읽을 수 있는 항목을 찾지 못했습니다. 사진이 흐리거나 기울어졌을 수 있습니다. "글자 붙여넣기"로 다시 시도해 보세요.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-[0.88rem] text-slate-500">
                    적용할 항목만 체크하세요. 체크한 값만 덮어씁니다.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {found.map((k) => {
                      const value = String(parsed[k])
                      const current = currentValues[k] ?? ''
                      const willOverwrite = current !== '' && current !== value
                      return (
                        <li key={k}>
                          <label className="flex items-start gap-2.5 rounded-(--radius-control) border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked[k] ?? false}
                              onChange={(e) => setChecked((s) => ({ ...s, [k]: e.target.checked }))}
                              className="mt-0.5 size-5 shrink-0 accent-brand-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[0.88rem] text-slate-500">{PARSED_FIELD_LABEL[k]}</span>
                              <span className="block text-[1rem] font-semibold break-keep text-slate-900">{value}</span>
                              {willOverwrite && (
                                <span className="mt-0.5 block text-[0.85rem] text-warning-800">
                                  기존 값 「{current}」을(를) 덮어씁니다
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5">
          <span className="text-[0.88rem] text-slate-500">
            {parsed ? `${pickedCount}개 항목 적용 예정` : '읽은 내용은 확인 후 적용됩니다'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" disabled={pickedCount === 0} onClick={apply}>
              <Check aria-hidden="true" className="size-4" />
              {pickedCount}개 적용하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
