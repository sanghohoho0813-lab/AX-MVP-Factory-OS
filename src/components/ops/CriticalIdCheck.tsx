/**
 * D-492 중요 번호 — 처음 한 번만 확인(사업자등록번호 · 법인등록번호 · 설립일).
 * 서류에서 읽어 넣은 값 가운데 아직 사람이 보지 않은 것만 한 판에. 맞아요 → 다시 묻지 않음 · 고치기 → 그 자리에서 고쳐 저장.
 * 없으면 아무것도 그리지 않는다(첫 화면을 늘리지 않게).
 */
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { criticalIdsToConfirm, withCriticalConfirmed } from '../../services/criticalIds'
import { withFactConfirmed, withProfileFieldEdit } from '../../services/customerFacts'
import { formatBusinessNumber } from '../../lib/format'

export function CriticalIdCheck({ record, now, onSave }: { record: ClientOpsRecord; now: () => string; onSave: (next: ClientOpsRecord, message: string) => void }) {
  const rows = criticalIdsToConfirm(record)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="critical-ids-title" data-testid="critical-ids" className="flex flex-col rounded-(--radius-panel) border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 pt-3.5 pb-2.5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <h3 id="critical-ids-title" className="t-body font-bold break-keep text-slate-900">
            중요 번호 — 처음 한 번만 원본과 맞춰 주세요
          </h3>
          <p className="t-sub break-keep text-slate-500">서류에서 읽어 넣었어요. 맞으면 [맞아요] — 다시 묻지 않아요.</p>
        </div>
        {rows.length > 1 && (
          <button
            type="button"
            onClick={() => onSave(withCriticalConfirmed(record, rows.map((r) => r.key), now()), `중요 번호 ${rows.length}개를 확인했습니다.`)}
            className="tap t-sub min-h-11 shrink-0 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700"
            data-testid="critical-ids-all"
          >
            모두 맞아요
          </button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
        {rows.map((r) => (
          <li key={r.key} data-critical={r.key} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="t-meta font-semibold text-slate-500">
                {r.label} <span className="font-normal">· {r.from}에서 읽음</span>
              </span>
              {editing === r.key ? (
                <input
                  autoFocus
                  aria-label={`${r.label} 고치기`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  inputMode={r.key === 'establishedAt' ? 'text' : 'numeric'}
                  placeholder={r.key === 'establishedAt' ? '2019-02-27' : ''}
                  className="t-body mt-1 min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 tabular-nums sm:max-w-xs"
                  data-testid={`critical-input-${r.key}`}
                />
              ) : (
                <span className="text-[1.2rem] font-bold tracking-wide text-slate-900 tabular-nums" data-testid={`critical-value-${r.key}`}>
                  {r.display}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-wrap items-center gap-2">
              {editing === r.key ? (
                <>
                  <button
                    type="button"
                    disabled={draft.trim() === ''}
                    onClick={() => {
                      const v = r.key === 'businessNumber' ? formatBusinessNumber(draft.trim()) : draft.trim()
                      const t = now()
                      onSave(withFactConfirmed(withProfileFieldEdit(record, r.key, v, t), r.key, t), `${r.label}을 고쳤습니다.`)
                      setEditing(null)
                    }}
                    className="tap t-sub min-h-11 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white disabled:opacity-50"
                    data-testid={`critical-save-${r.key}`}
                  >
                    저장
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="tap t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-slate-700">
                    취소
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSave(withCriticalConfirmed(record, [r.key], now()), `${r.label} 확인했습니다.`)}
                    className="tap t-sub min-h-11 rounded-(--radius-control) border border-brand-600 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50"
                    data-testid={`critical-yes-${r.key}`}
                  >
                    맞아요
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(r.value)
                      setEditing(r.key)
                    }}
                    className="tap t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50"
                    data-testid={`critical-edit-${r.key}`}
                  >
                    고치기
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
