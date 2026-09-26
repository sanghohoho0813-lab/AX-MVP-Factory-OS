/**
 * 업체 상세 › 영업 (D-114) — 이 업체가 영업 어디쯤 왔는지, 어디서 왔고 무엇에 관심 있는지.
 *
 * 기업컨설팅 OS 의 고객 카드 '기본정보 · 영업 단계' 를 운영 OS 모양으로 옮겼다.
 * 계약 전 업체(잠재고객)는 펼친 채로, 계약 고객은 접어 둔다 — 계약 뒤에는 영업보다 업무 · 수금이 먼저다.
 * 단계는 고르는 순간 저장, 나머지 칸은 '저장' 으로 한 번에.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KanbanSquare, Presentation } from 'lucide-react'
import { Disclosure } from '../ui/primitives'
import { Button } from '../ui/Button'
import { daysInStage, isProspect, salesStageOf, withSalesInfo, withSalesStage } from '../../services/salesPipeline'
import { SALES_INTERESTS, SALES_SOURCES } from '../../content/salesCatalog'
import { formatKrwCompact } from '../../lib/format'
import { SALES_STAGE_LABEL, SALES_STAGE_ORDER, type ClientOpsRecord, type SalesStage } from '../../types/clientOps'

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

interface Draft {
  source: string
  referrer: string
  concern: string
  feeManwon: string
  interests: string[]
}

function draftOf(r: ClientOpsRecord): Draft {
  const s = r.sales
  return {
    source: s?.source ?? '',
    referrer: s?.referrer ?? '',
    concern: s?.concern ?? '',
    feeManwon: s?.expectedFee ? String(Math.round(s.expectedFee / 10_000)) : '',
    interests: s?.interests ?? [],
  }
}

export function ClientSalesCard({ record, onSave }: { record: ClientOpsRecord; onSave: (next: ClientOpsRecord) => void }) {
  const stage = salesStageOf(record)
  const prospect = isProspect(record)
  const [draft, setDraft] = useState<Draft>(() => draftOf(record))
  const base = useMemo(() => draftOf(record), [record])
  // 저장되어 영업 칸 값이 바뀌면 칸도 새 값으로 (렌더 중에 맞춘다 — 효과로 한 번 더 그리지 않게).
  // D-120: 기록 객체가 아니라 '값' 으로 비교한다 — 회사 정보 등 다른 칸을 저장해도 적던 영업 칸이 지워지지 않게
  const baseKey = JSON.stringify(base)
  const [seen, setSeen] = useState(baseKey)
  if (seen !== baseKey) {
    setSeen(baseKey)
    setDraft(base)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  const days = daysInStage(record)
  const s = record.sales

  const hint = [
    SALES_STAGE_LABEL[stage],
    s?.source,
    s?.expectedFee ? `예상 ${formatKrwCompact(s.expectedFee)}` : '',
  ].filter(Boolean).join(' · ')

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const save = () => {
    const fee = parseInt(draft.feeManwon, 10)
    onSave(
      withSalesInfo(record, {
        source: draft.source,
        referrer: draft.referrer,
        concern: draft.concern,
        interests: draft.interests,
        expectedFee: Number.isFinite(fee) && fee > 0 ? fee * 10_000 : null,
      }),
    )
  }

  return (
    <div data-testid="client-sales-card">
      <Disclosure title="영업" hint={hint} defaultOpen={prospect}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <label className="block min-w-44 flex-1 text-[0.85rem] text-slate-500 sm:max-w-xs">
              영업 단계
              <select
                value={stage}
                aria-label="영업 단계"
                onChange={(e) => onSave(withSalesStage(record, e.target.value as SalesStage))}
                className={`${inputClass} font-semibold`}
              >
                {SALES_STAGE_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {SALES_STAGE_LABEL[st]}
                  </option>
                ))}
              </select>
            </label>
            <p className="t-sub pb-2 text-slate-500">
              {days !== null ? (days === 0 ? '오늘 옮김' : `이 단계 ${days}일째`) : '단계를 옮긴 기록 없음'}
              {prospect && stage !== 'contracted' ? ' · 계약 완료로 옮기면 계약 고객이 됩니다' : ''}
            </p>
            <span className="ml-auto flex items-center gap-3 pb-2">
              <Link to={`/sales/meeting?client=${record.id}`} className="t-sub inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                <Presentation aria-hidden="true" className="size-4" />
                미팅 준비
              </Link>
              <Link to="/sales/board" className="t-sub inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                <KanbanSquare aria-hidden="true" className="size-4" />
                영업 보드
              </Link>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-[0.85rem] text-slate-500">
              유입 경로
              <select value={draft.source} onChange={(e) => set('source', e.target.value)} className={inputClass}>
                <option value="">선택</option>
                {[...new Set([...SALES_SOURCES, ...(draft.source ? [draft.source] : [])])].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="block text-[0.85rem] text-slate-500">
              소개한 사람
              <input value={draft.referrer} onChange={(e) => set('referrer', e.target.value)} className={inputClass} />
            </label>
            <label className="block text-[0.85rem] text-slate-500">
              예상 수임료 (만원)
              <input value={draft.feeManwon} inputMode="numeric" onChange={(e) => set('feeManwon', e.target.value.replace(/[^0-9]/g, ''))} className={inputClass} />
            </label>
            <label className="block text-[0.85rem] text-slate-500 sm:col-span-3">
              대표 고민 한 줄
              <input value={draft.concern} onChange={(e) => set('concern', e.target.value)} className={inputClass} />
            </label>
          </div>

          <fieldset>
            <legend className="text-[0.85rem] text-slate-500">관심사</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[...new Set([...SALES_INTERESTS, ...draft.interests])].map((x) => {
                const on = draft.interests.includes(x)
                return (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('interests', on ? draft.interests.filter((v) => v !== x) : [...draft.interests, x])}
                    className={`tap t-meta rounded-full border px-2.5 py-1 font-medium ${on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {x}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(base)}>
                되돌리기
              </Button>
            )}
            <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>
              영업 정보 저장
            </Button>
          </div>
        </div>
      </Disclosure>
    </div>
  )
}
