import { useState } from 'react'
import { Check, ClipboardCopy, Copy, FileUp, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { profileAsText, profileFields } from '../../services/clientOpsProfile'
import { sortedNotes } from '../../services/clientOpsService'
import { Button } from '../ui/Button'

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 클립보드 차단 환경은 조용히 무시 */
  }
}

/** 자주 찾는 회사 정보 한눈에 — 카톡 뒤져볼 일을 없앤다 */
export function CompanyProfileCard({
  record,
  today,
  onImport,
  /** 접이식 구역 안에 들어갈 때 — 카드 안 카드가 되지 않도록 테두리·제목을 뺀다 */
  bare = false,
}: {
  record: ClientOpsRecord
  today: string
  onImport: () => void
  bare?: boolean
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const fields = profileFields(record, today)
  const filled = fields.filter((f) => !f.empty).length

  const copy = async (key: string, value: string) => {
    await copyText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  return (
    <section
      aria-labelledby="profile"
      className={bare ? '' : 'rounded-(--radius-panel) border border-slate-200 bg-white p-5'}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {!bare && (
            <h2 id="profile" className="t-section text-slate-900">
              회사 기본 정보
            </h2>
          )}
          <p className="t-sub break-keep text-slate-500">
            항목을 누르면 바로 복사됩니다. ({filled}/{fields.length} 입력됨)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={onImport}>
            <FileUp aria-hidden="true" className="size-3.5" />
            서류에서 불러오기
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void copy('__all', profileAsText(record, today))}>
            <ClipboardCopy aria-hidden="true" className="size-3.5" />
            {copiedKey === '__all' ? '복사됨' : '전체 복사'}
          </Button>
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-0 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-slate-200/70 py-2">
            <dt className="t-sub shrink-0 text-slate-500">{f.label}</dt>
            <dd className="min-w-0 text-right">
              {f.empty ? (
                <span className="text-[0.95rem] text-slate-300">미입력</span>
              ) : f.copyable ? (
                <button
                  type="button"
                  onClick={() => void copy(f.key, f.value)}
                  title="눌러서 복사"
                  className="group inline-flex max-w-full items-center gap-1 text-right"
                >
                  <span className="truncate text-[0.98rem] font-semibold text-slate-800 group-hover:text-brand-700 group-hover:underline">
                    {f.value}
                  </span>
                  {copiedKey === f.key ? (
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-success-600" />
                  ) : (
                    <Copy aria-hidden="true" className="size-3.5 shrink-0 text-slate-300 group-hover:text-brand-600" />
                  )}
                </button>
              ) : (
                <span className="text-[0.98rem] font-semibold break-keep text-slate-800">{f.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 메모                                                                 */
/* ------------------------------------------------------------------ */

export function NotesSection({
  record,
  onAdd,
  onEdit,
  onPin,
  onDelete,
}: {
  record: ClientOpsRecord
  onAdd: (text: string) => void
  onEdit: (id: string, text: string) => void
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const notes = sortedNotes(record)

  const add = () => {
    const t = draft.trim()
    if (t === '') return
    onAdd(t)
    setDraft('')
  }

  return (
    <section aria-labelledby="notes" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="notes" className="text-[1.3rem] font-bold text-slate-900">
          메모
        </h2>
        <p className="text-[0.9rem] text-slate-500">통화 내용·요청사항을 적어두세요. 수정·삭제할 수 있습니다.</p>
      </div>

      <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
          rows={2}
          placeholder="예: 9/3 대표님 통화 — 중소기업확인서 이번 주 안에 발급해서 보내주기로 함"
          className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[0.82rem] text-slate-500">Ctrl(⌘) + Enter 로도 추가됩니다</span>
          <Button variant="primary" size="sm" disabled={draft.trim() === ''} onClick={add}>
            <Plus aria-hidden="true" className="size-3.5" />
            메모 추가
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-6 text-[0.95rem] text-slate-500">
          아직 메모가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-(--radius-panel) border p-3.5 ${
                n.pinned ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              {editingId === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onEdit(n.id, editText.trim())
                        setEditingId(null)
                      }}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-[1rem] leading-relaxed break-keep whitespace-pre-wrap text-slate-800">
                    {n.text}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={n.pinned ? '고정 해제' : '위로 고정'}
                      title={n.pinned ? '고정 해제' : '위로 고정'}
                      onClick={() => onPin(n.id, !n.pinned)}
                      className={`rounded-(--radius-control) p-1.5 hover:bg-slate-100 ${
                        n.pinned ? 'text-brand-700' : 'text-slate-400'
                      }`}
                    >
                      {n.pinned ? (
                        <PinOff aria-hidden="true" className="size-4" />
                      ) : (
                        <Pin aria-hidden="true" className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="메모 수정"
                      title="수정"
                      onClick={() => {
                        setEditingId(n.id)
                        setEditText(n.text)
                      }}
                      className="rounded-(--radius-control) p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="메모 삭제"
                      title="삭제"
                      onClick={() => onDelete(n.id)}
                      className="rounded-(--radius-control) p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-1.5 text-[0.8rem] text-slate-400">
                {n.updatedAt.slice(0, 10)}
                {n.createdAt !== n.updatedAt ? ' 수정됨' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
