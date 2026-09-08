/**
 * 핵심 줄기 (One Core Thread) — 8칸 + 규칙 경고.
 * 특허·MVP·사업계획서·증빙·실사가 같은 기술을 말하는지 여기서 본다.
 */

import { Badge, Surface } from '../ui/primitives'
import { useEditor } from './editorContext'
import { CORE_THREAD_HINT, CORE_THREAD_KEYS, CORE_THREAD_LABEL } from '../../domain/consulting/projectModel'
import { coreThreadToText, coreThreadWarnings } from '../../domain/consulting/coreThread'
import { CopyButton, TextField } from './studioParts'

export function ThreadTab({ focus }: { focus?: string }) {
  const { project: p, update, goTo } = useEditor()
  const warnings = coreThreadWarnings(p)
  const real = warnings.filter((w) => w.severity !== 'info')

  return (
    <div className="flex flex-col gap-4">
      <Surface edge={real.some((w) => w.severity === 'p0') ? 'danger' : real.length > 0 ? 'warning' : 'success'} showEdge>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="t-section text-slate-900">핵심 줄기 (One Core Thread)</h2>
            <p className="t-sub mt-1 break-keep text-slate-500">
              현장문제 → 특허 → MVP 핵심기능 → 사업계획서 → 증빙 → 실사 답변이 같은 핵심기술을 설명해야 합니다. 서로 다르면 P0 입니다.
            </p>
          </div>
          <CopyButton text={coreThreadToText(p)} label="복사" />
        </div>
        {real.length === 0 ? (
          <p className="t-body mt-3 text-success-700">규칙 경고 없음. (점수가 아니라 낱말 겹침·상태 표현 규칙입니다)</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {real.map((w) => (
              <li key={w.code} className="t-body flex items-start gap-2 break-keep text-slate-700">
                <Badge tone={w.severity === 'p0' ? 'danger' : 'warning'}>{w.severity.toUpperCase()}</Badge>
                <button type="button" className="text-left hover:underline" onClick={() => goTo(w.tab, w.focus)}>
                  {w.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <div className="grid gap-3 md:grid-cols-2">
        {CORE_THREAD_KEYS.map((k, i) => (
          <div key={k} id={`thread-${k}`} className={`rounded-(--radius-card) border bg-white p-3 ${focus === k ? 'border-brand-400 ring-1 ring-brand-300' : 'border-slate-200'}`}>
            <TextField
              id={`thread-input-${k}`}
              label={`${i + 1}. ${CORE_THREAD_LABEL[k]}`}
              value={p.coreThread[k]}
              multiline
              rows={3}
              placeholder={CORE_THREAD_HINT[k]}
              onCommit={(v) => update((cur) => ({ ...cur, coreThread: { ...cur.coreThread, [k]: v } }))}
            />
          </div>
        ))}
      </div>

      <p className="t-meta break-keep text-slate-500">
        실패 예 (Master §35-1): 특허 = 작업지연 위험 분석 / MVP = 고객 예약 플랫폼 / 사업계획서 = 재고 최적화 — 핵심이 서로 다르면 서류가 많아도 설득력이 없습니다.
      </p>
    </div>
  )
}
