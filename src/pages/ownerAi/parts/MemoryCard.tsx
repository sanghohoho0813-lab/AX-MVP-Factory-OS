/**
 * 지금까지의 핵심 기억(Current Context) — 12칸. 덮어쓰지 않는다: 저장할 때마다 새 판(v1, v2 …), 예전 판은 그대로.
 * 채택한 결과 → '기억에 넣기' → 바뀌는 칸만 보여 주고 대표가 고친 뒤 저장.
 */
import { useMemo, useState } from 'react'
import { History, PencilLine, Sparkles } from 'lucide-react'
import { contextDiff } from '../../../services/ownerAi/memory'
import { CONTEXT_FIELDS, emptyContext, type ContextKey, type ContextSnapshot, type CurrentContext } from '../../../services/ownerAi/types'
import { Badge, Surface } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { fmtDateTime } from '../shared'
import { AiConfirm } from '../../../components/ai/AiConfirm'

const SOURCE_LABEL = (s: string) =>
  s === 'manual' ? '직접 고침' : s.startsWith('run:') ? '채택한 결과' : s === 'chatgpt' ? 'ChatGPT 붙여넣기' : s === 'ai:context_update' ? 'AI 로 정리' : s || '직접 고침'

export function MemoryCard({
  snapshots,
  busy,
  aiReady,
  onSave,
  onAiTidy,
}: {
  snapshots: ContextSnapshot[]
  busy: boolean
  aiReady: boolean
  onSave: (content: CurrentContext, source: string, note: string) => Promise<boolean>
  onAiTidy: () => void
}) {
  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null
  const ctx = latest?.content ?? emptyContext()
  const filled = CONTEXT_FIELDS.filter((f) => ctx[f.key].trim())
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState(false)
  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-section break-keep text-slate-900">지금까지의 기억</h2>
        <Badge tone={latest ? 'brand' : 'neutral'}>{latest ? `v${latest.version}` : '아직 없음'}</Badge>
      </div>
      {filled.length === 0 ? (
        <p className="t-sub break-keep text-slate-500" data-testid="memory-empty">
          아직 기억이 없습니다. 결과를 채택한 뒤 '기억에 넣기' 를 누르거나, 직접 적어 두면 다음 AI 작업이 이어서 씁니다.
        </p>
      ) : (
        <dl className="flex flex-col gap-2.5" data-testid="memory-fields">
          {filled.map((f) => (
            <div key={f.key} className="min-w-0" data-memory={f.key}>
              <dt className="t-meta font-medium text-slate-500">{f.label}</dt>
              <dd className="t-body break-words whitespace-pre-wrap text-slate-800">{ctx[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(true)} data-testid="memory-edit">
          <PencilLine aria-hidden="true" className="size-4" />
          직접 고치기
        </Button>
        <AiConfirm><Button size="sm" variant="ghost" disabled={busy || !aiReady} onClick={onAiTidy} title={aiReady ? '' : 'AI 기능 설정이 필요합니다.'} data-testid="memory-ai-tidy">
          <Sparkles aria-hidden="true" className="size-4" />
          AI 로 정리
        </Button></AiConfirm>
        {snapshots.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setHistory(true)} data-testid="memory-history">
            <History aria-hidden="true" className="size-4" />
            판 기록 {snapshots.length}
          </Button>
        )}
      </div>
      {editing && (
        <MemoryEditor
          title="기억 직접 고치기"
          current={ctx}
          proposed={ctx}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={async (content, note) => {
            if (await onSave(content, 'manual', note)) setEditing(false)
          }}
        />
      )}
      {history && <HistoryDialog snapshots={snapshots} onClose={() => setHistory(false)} />}
    </Surface>
  )
}

/** 기억 편집 창 — proposed 가 current 와 다른 칸은 '바뀜' 표시(기억에 넣기에서 쓴다) */
export function MemoryEditor({
  title,
  current,
  proposed,
  busy,
  note: initialNote = '',
  onClose,
  onSave,
}: {
  title: string
  current: CurrentContext
  proposed: CurrentContext
  busy: boolean
  note?: string
  onClose: () => void
  onSave: (content: CurrentContext, note: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<CurrentContext>(proposed)
  const [note, setNote] = useState(initialNote)
  const changed = useMemo(() => new Set(contextDiff(current, proposed).map((d) => d.key)), [current, proposed])
  const dirty = contextDiff(current, draft).length > 0
  const order: ContextKey[] = [...CONTEXT_FIELDS.filter((f) => changed.has(f.key)), ...CONTEXT_FIELDS.filter((f) => !changed.has(f.key))].map((f) => f.key)
  const label = (k: ContextKey) => CONTEXT_FIELDS.find((f) => f.key === k)?.label ?? k
  return (
    <Modal
      open
      size="lg"
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || !dirty} onClick={() => onSave(draft, note.trim())} data-testid="memory-save">
            새 판으로 저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-500">
          {changed.size ? `바뀌는 칸 ${changed.size}개를 위에 모았습니다. 고친 뒤 저장하면 새 판이 생기고 예전 판은 그대로 남습니다.` : '저장하면 새 판이 생기고 예전 판은 그대로 남습니다.'}
        </p>
        {order.map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="t-sub flex items-center gap-1.5 font-semibold text-slate-700">
              {label(k)}
              {changed.has(k) && <Badge tone="brand">바뀜</Badge>}
            </span>
            {changed.has(k) && current[k] && <span className="t-meta break-words whitespace-pre-wrap text-slate-400">예전: {current[k]}</span>}
            <textarea
              value={draft[k]}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              rows={changed.has(k) ? 4 : 2}
              maxLength={4000}
              data-memory-input={k}
              className={`t-body w-full rounded-(--radius-control) border px-3 py-2 ${changed.has(k) ? 'border-brand-400' : 'border-slate-300'}`}
            />
          </label>
        ))}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="이번 판 메모(선택)" className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3" />
      </div>
    </Modal>
  )
}

function HistoryDialog({ snapshots, onClose }: { snapshots: ContextSnapshot[]; onClose: () => void }) {
  const [pick, setPick] = useState<number>(snapshots.length - 1)
  const cur = snapshots[pick]
  const prev = pick > 0 ? snapshots[pick - 1].content : emptyContext()
  const diff = cur ? contextDiff(prev, cur.content) : []
  return (
    <Modal open size="lg" title="기억 판 기록" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}>
      <div className="flex flex-col gap-3" data-testid="memory-history-list">
        <div className="flex flex-wrap gap-1.5">
          {snapshots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={pick === i}
              onClick={() => setPick(i)}
              className={`tap t-sub min-h-11 rounded-full border px-3 font-semibold ${pick === i ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600'}`}
            >
              v{s.version}
            </button>
          ))}
        </div>
        {cur && (
          <>
            <p className="t-sub break-keep text-slate-600">
              v{cur.version} · {fmtDateTime(cur.createdAt)} · {SOURCE_LABEL(cur.source)}
              {cur.note ? ` · ${cur.note}` : ''}
            </p>
            {diff.length === 0 ? (
              <p className="t-sub text-slate-500">앞 판과 같습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {diff.map((d) => (
                  <li key={d.key} className="rounded-(--radius-control) border border-slate-200 px-3 py-2">
                    <p className="t-sub font-semibold text-slate-700">{d.label}</p>
                    {d.before && <p className="t-meta break-words whitespace-pre-wrap text-slate-400 line-through">{d.before}</p>}
                    <p className="t-body break-words whitespace-pre-wrap text-slate-800">{d.after || '(비움)'}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
