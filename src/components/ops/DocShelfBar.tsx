/**
 * 서류 탭 위 한 줄 — 손볼 것만 센다 (D-147).
 * 확인 필요(기타 칸) · 겹친 서류 · 만료 · 지금 필요한데 없음. 누르면 그 칸으로 간다(차례로 돈다).
 */
import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Copy, FileWarning, FileX } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DocShelfSummary } from '../../services/docShelf'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { isOtherCell, moveDocTo, moveTargets } from '../../services/docShelf'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'

export function DocShelfBar({ summary, onJump }: { summary: DocShelfSummary; onJump: (key: DocumentKey) => void }) {
  // 같은 칩을 다시 누르면 다음 칸으로
  const turn = useRef<Record<string, number>>({})
  const chip = (id: string, keys: DocumentKey[], label: string, icon: ReactNode, tone: string) => {
    if (keys.length === 0) return null
    return (
      <button
        key={id}
        type="button"
        data-testid={`shelf-${id}`}
        onClick={() => {
          const i = (turn.current[id] ?? 0) % keys.length
          turn.current[id] = i + 1
          onJump(keys[i])
        }}
        className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-semibold ${tone}`}
      >
        {icon}
        {label}
      </button>
    )
  }
  const dupKeys = summary.dupGroups.flat()
  const none = summary.other.length + dupKeys.length + summary.expired.length + summary.missingNow.length === 0
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="doc-shelf">
      {none ? (
        <span className="t-sub text-success-700">손볼 서류가 없습니다.</span>
      ) : (
        <>
          <span className="t-sub font-semibold text-slate-700">손볼 것</span>
          {chip('missing', summary.missingNow, `지금 필요한데 없음 ${summary.missingNow.length}`, <FileX aria-hidden="true" className="size-4" />, 'border-danger-200 bg-danger-50 text-danger-700')}
          {chip('expired', summary.expired, `만료 ${summary.expired.length}`, <FileWarning aria-hidden="true" className="size-4" />, 'border-danger-200 bg-danger-50 text-danger-700')}
          {chip('other', summary.other, `무슨 서류인지 확인 ${summary.other.length}`, <CircleAlert aria-hidden="true" className="size-4" />, 'border-warning-200 bg-warning-50 text-warning-800')}
          {chip('dup', dupKeys, `겹친 서류 ${summary.dupGroups.length}묶음`, <Copy aria-hidden="true" className="size-4" />, 'border-slate-300 bg-white text-slate-700')}
        </>
      )}
    </div>
  )
}

/** '기타 · 확인 필요' 칸 — 무슨 서류인지 고르면 맞는 칸으로 옮긴다 */
export function DocKindPicker({
  record,
  docKey,
  onMove,
}: {
  record: ClientOpsRecord
  docKey: DocumentKey
  onMove: (next: ClientOpsRecord, to: string) => void
}) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const meta = allDocumentMetas(record).find((m) => m.key === docKey)
  useEffect(() => setTyping(false), [docKey])
  if (!meta || !isOtherCell(meta.label) || !record.documents[docKey]?.fileName) return null
  const targets = moveTargets(record, docKey)
  const go = (value: string) => {
    const out = moveDocTo(record, docKey, value)
    if (out) onMove(out.record, out.to)
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-warning-200 bg-warning-50/60 p-3" data-testid={`doc-kind-${docKey}`}>
      <label className="t-sub font-semibold break-keep text-warning-800" htmlFor={`kind-${docKey}`}>
        무슨 서류인가요? 고르면 맞는 칸으로 옮깁니다
      </label>
      {typing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            id={`kind-${docKey}`}
            aria-label="서류 이름 직접 적기"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 졸업증명서"
            className="t-body min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 sm:w-auto sm:flex-1"
          />
          <button
            type="button"
            disabled={draft.trim() === ''}
            onClick={() => go(`new:${draft.trim()}`)}
            className="tap t-sub min-h-11 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white disabled:opacity-50"
          >
            이 이름으로 옮기기
          </button>
          <button type="button" onClick={() => setTyping(false)} className="tap t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-slate-700">
            취소
          </button>
        </div>
      ) : (
        <select
          id={`kind-${docKey}`}
          aria-label={`${meta.label} 무슨 서류인지 고르기`}
          value=""
          onChange={(e) => {
            if (e.target.value === '__type__') setTyping(true)
            else if (e.target.value) go(e.target.value)
          }}
          className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3"
        >
          <option value="">고르기…</option>
          <optgroup label="이 업체에 있는 칸">
            {targets.filter((t) => t.kind === 'existing').map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="새 칸 만들기">
            {targets.filter((t) => t.kind === 'new').map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            <option value="__type__">직접 적기…</option>
          </optgroup>
        </select>
      )}
    </div>
  )
}
