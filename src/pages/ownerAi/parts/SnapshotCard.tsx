/**
 * 회사 한눈에(예전 이름 업체 Snapshot) — 13칸. 모르는 칸은 '미확인'(추측해서 채우지 않는다). 값마다 어디서 왔는지 작게.
 * D-282 확인된 칸만 먼저 펼치고, 모르는 칸은 '확인 필요 n칸' 한 줄로 접는다(화면 규칙 §11-2 — 빈 칸을 늘어놓지 않는다).
 *   한 번 누르면 13칸이 그대로 다 나온다(지운 칸 없음). 위에 확인된 비율 막대.
 * 휴대폰에서는 확인된 칸 앞 3칸만 먼저, 나머지는 '모두 보기' — AI-1 '어떤 도움을 줄까요?' 가 첫 화면에 더 가깝게.
 */
import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import type { SnapshotField } from '../../../services/ownerAi/context'
import { Surface } from '../../../components/ui/primitives'
import { IconTile } from '../../../components/ui/visual'

/** 휴대폰에서 먼저 보이는 칸 수 */
const PHONE_FIRST = 3

export function SnapshotCard({ fields }: { fields: SnapshotField[] }) {
  const [all, setAll] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const knownFields = fields.filter((f) => f.known)
  const missing = fields.filter((f) => !f.known)
  const pct = fields.length ? Math.round((knownFields.length / fields.length) * 100) : 0
  // 아무것도 모르면 접을 것이 없다 — 그때는 전부 편다(§11-2)
  const openMissing = showMissing || knownFields.length === 0
  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={Building2} tone="blue" size="md" />
          <h2 className="t-section break-keep text-slate-900">회사 한눈에</h2>
        </div>
        <span className="t-sub text-slate-500" data-testid="snapshot-known">
          {fields.length}칸 중 {knownFields.length}칸 확인 · 나머지 미확인
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`회사 정보 ${pct}% 확인`}>
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-col gap-2.5" data-testid="snapshot-fields">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {knownFields.map((f, i) => (
            <div key={f.key} className={`min-w-0 ${!all && i >= PHONE_FIRST ? 'hidden sm:block' : ''}`} data-snapshot={f.key}>
              <dt className="t-meta font-medium text-slate-500">{f.label}</dt>
              <dd className="t-body break-words text-slate-900">
                {f.value}
                {f.source && <span className="t-meta ml-1.5 text-slate-600">· {f.source}</span>}
              </dd>
            </div>
          ))}
          {missing.map((f) => (
            <div key={f.key} className={`min-w-0 ${openMissing ? '' : 'hidden'}`} data-snapshot={f.key} data-missing>
              <dt className="t-meta font-medium text-slate-500">{f.label}</dt>
              <dd className="t-body break-words text-slate-600">{f.value}</dd>
            </div>
          ))}
        </dl>
        {missing.length > 0 && knownFields.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            aria-expanded={openMissing}
            className="tap flex w-full items-start gap-2 rounded-(--radius-control) border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-left hover:border-slate-400"
            data-testid="snapshot-missing"
          >
            <ChevronDown aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-slate-500 transition-transform ${openMissing ? 'rotate-180' : ''}`} />
            <span className="t-sub min-w-0 break-keep text-slate-700">
              <b className="text-slate-900">확인 필요 {missing.length}칸</b>(미확인) — {missing.map((f) => f.label).join(' · ')}
              <span className="ml-1 font-semibold text-brand-700">{openMissing ? '접기' : '펼쳐 보기'}</span>
            </span>
          </button>
        )}
      </div>
      {!all && knownFields.length > PHONE_FIRST && (
        <button type="button" onClick={() => setAll(true)} className="t-sub tap min-h-11 self-start font-semibold text-brand-700 sm:hidden">
          확인된 칸 모두 보기({knownFields.length}칸)
        </button>
      )}
    </Surface>
  )
}
