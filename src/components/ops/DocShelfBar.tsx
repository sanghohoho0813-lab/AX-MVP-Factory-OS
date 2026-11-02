/**
 * 서류 탭 위 한 줄 — 손볼 것만 센다 (D-147).
 * 확인 필요(기타 칸) · 겹친 서류 · 만료 · 지금 필요한데 없음. 누르면 그 칸으로 간다(차례로 돈다).
 */
import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Copy, FileWarning, FileX, Paperclip } from 'lucide-react'
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

/**
 * D-488 '무슨 서류인지 확인' 모음 — 기타 칸마다 큰 카드(PC 약 310px · 휴대폰 약 670px)가 하나씩이라 여러 개면 한참 내려야 했다(대표).
 * 목차 보기 맨 위 판 하나에 한 줄씩(파일 이름 · 고르기 · 자세히). 고르면 맞는 칸으로 옮기고 그 줄은 사라진다.
 * [자세히] 를 누르면 예전 카드가 목차에 펼쳐진다(파일 교체 · 지우기 · 이름 고치기). 지운 기능 없음.
 */
export function OtherDocsPanel({
  record,
  openKeys,
  onMove,
  onDetail,
}: {
  record: ClientOpsRecord
  /** 카드를 펼친 칸 — 그 칸의 이름표(id)는 카드가 가진다 */
  openKeys: ReadonlySet<string>
  onMove: (next: ClientOpsRecord, to: string, key: DocumentKey) => void
  onDetail: (key: DocumentKey) => void
}) {
  const items = allDocumentMetas(record).filter((m) => isOtherCell(m.label) && !!record.documents[m.key]?.fileName)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="other-docs-title" data-testid="other-docs" className="flex flex-col rounded-(--radius-panel) border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 pt-3 pb-2">
        <h3 id="other-docs-title" className="t-body font-bold text-slate-900">
          무슨 서류인지 확인 <span className="text-warning-700">{items.length}개</span>
        </h3>
        <p className="t-sub break-keep text-slate-500">제목만으로는 몰라 기타 칸에 모았어요. 고르면 맞는 칸으로 옮깁니다</p>
      </div>
      <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
        {items.map((m) => (
          <li key={m.key} id={openKeys.has(m.key) ? undefined : `doc-card-${m.key}`} tabIndex={-1} data-other-row={m.key} className="scroll-mt-24 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset">
            <DocKindPicker record={record} docKey={m.key} onMove={onMove} variant="row" onDetail={openKeys.has(m.key) ? undefined : () => onDetail(m.key)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** '기타 · 확인 필요' 칸 — 무슨 서류인지 고르면 맞는 칸으로 옮긴다 */
export function DocKindPicker({
  record,
  docKey,
  onMove,
  variant = 'box',
  onDetail,
}: {
  record: ClientOpsRecord
  docKey: DocumentKey
  /** key — 옮겨 간 칸(D-489 다시 읽기) */
  onMove: (next: ClientOpsRecord, to: string, key: DocumentKey) => void
  /** D-488 'row' = 모음 판 안 한 줄(파일 이름 · 고르기 · 자세히) */
  variant?: 'box' | 'row'
  onDetail?: () => void
}) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const meta = allDocumentMetas(record).find((m) => m.key === docKey)
  useEffect(() => setTyping(false), [docKey])
  if (!meta || !isOtherCell(meta.label) || !record.documents[docKey]?.fileName) return null
  const targets = moveTargets(record, docKey)
  const go = (value: string) => {
    const out = moveDocTo(record, docKey, value)
    if (out) onMove(out.record, out.to, out.key)
  }
  const row = variant === 'row'
  const fileName = record.documents[docKey]?.fileName ?? ''
  return (
    <div
      // 휴대폰: 1줄 = 파일 이름 · 자세히, 2줄 = 고르기 / PC: 한 줄(이름 · 고르기 · 자세히)
      className={row ? 'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:flex sm:flex-row sm:items-center' : 'flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white p-3'}
      data-testid={`doc-kind-${docKey}`}
    >
      {row ? (
        <label className="t-sub flex min-w-0 flex-1 items-center gap-1.5 text-slate-800 sm:order-1" htmlFor={`kind-${docKey}`} title={fileName}>
          <Paperclip aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 truncate font-semibold">{fileName}</span>
          <span className="sr-only">— 무슨 서류인가요? 고르면 맞는 칸으로 옮깁니다</span>
        </label>
      ) : (
        <label className="t-sub font-semibold break-keep text-warning-800" htmlFor={`kind-${docKey}`}>
          무슨 서류인가요? 고르면 맞는 칸으로 옮깁니다
        </label>
      )}
      {row && onDetail && !typing && (
        <button type="button" onClick={onDetail} className="tap t-sub shrink-0 font-semibold text-brand-700 hover:underline sm:order-3" data-testid={`other-detail-${docKey}`}>
          자세히
        </button>
      )}
      {typing ? (
        <div className={`flex flex-wrap items-center gap-2 ${row ? 'col-span-2 sm:order-2 sm:flex-1' : ''}`}>
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
          className={`t-body min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 ${row ? 'col-span-2 w-full sm:order-2 sm:w-64 sm:shrink-0' : 'w-full'}`}
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
