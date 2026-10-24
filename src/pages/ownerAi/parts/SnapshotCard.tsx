/**
 * 회사 한눈에(예전 이름 업체 Snapshot) — 13칸. 모르는 칸은 '미확인'(추측해서 채우지 않는다). 값마다 어디서 왔는지 작게.
 * 휴대폰에서는 앞 3칸(회사명 · 업종 · 업력)만 먼저, 나머지는 '모두 보기' — AI-1 '어떤 도움을 줄까요?' 가 첫 화면에 더 가깝게.
 */
import { useState } from 'react'
import type { SnapshotField } from '../../../services/ownerAi/context'
import { Surface } from '../../../components/ui/primitives'

/** 휴대폰에서 먼저 보이는 칸 수 */
const PHONE_FIRST = 3

export function SnapshotCard({ fields }: { fields: SnapshotField[] }) {
  const [all, setAll] = useState(false)
  const known = fields.filter((f) => f.known).length
  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-section break-keep text-slate-900">회사 한눈에</h2>
        <span className="t-sub text-slate-500" data-testid="snapshot-known">
          {fields.length}칸 중 {known}칸 확인 · 나머지 미확인
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="snapshot-fields">
        {fields.map((f, i) => (
          <div key={f.key} className={`min-w-0 ${!all && i >= PHONE_FIRST ? 'hidden sm:block' : ''}`} data-snapshot={f.key}>
            <dt className="t-meta font-medium text-slate-500">{f.label}</dt>
            <dd className={`t-body break-words ${f.known ? 'text-slate-900' : 'text-slate-600'}`}>
              {f.value}
              {f.known && f.source && <span className="t-meta ml-1.5 text-slate-600">· {f.source}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {!all && fields.length > PHONE_FIRST && (
        <button type="button" onClick={() => setAll(true)} className="t-sub tap min-h-11 self-start font-semibold text-brand-700 sm:hidden">
          모두 보기({fields.length}칸)
        </button>
      )}
    </Surface>
  )
}
