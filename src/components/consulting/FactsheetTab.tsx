/**
 * 사실표 — 숫자·사실의 단일 원본. 값 · 상태 · 출처 · 기준일 · 산식.
 * 묶음별 접기. focus 가 오면 그 항목이 열린 묶음 안에서 표시된다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Badge, Disclosure, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { FACT_SECTION_LABEL, FACT_STATUS_LABEL, FACT_STATUS_ORDER, emptyFact, factCompleteness, factsBySection, factsheetToText, seedFactsFromClient } from '../../domain/consulting/factsheetSchema'
import { nowIso } from '../../lib/appClock'
import { listClients } from '../../services/clientOpsService'
import type { FactKey, FactStatus, FactValue } from '../../types/consulting'
import { CopyButton, MiniProgress, SelectField, TextField } from './studioParts'

const STATUS_TONE: Record<FactStatus, 'success' | 'warning' | 'neutral' | 'brand' | 'danger'> = {
  confirmed: 'success',
  unverified: 'warning',
  planned: 'neutral',
  demo: 'danger',
  future: 'brand',
}

export function FactsheetTab({ focus }: { focus?: string }) {
  const { project: p, update, workspaceId, toast } = useEditor()
  const c = factCompleteness(p.factsheet)
  const [openKey, setOpenKey] = useState<FactKey | null>((focus as FactKey) ?? null)
  const groups = useMemo(() => factsBySection(), [])
  const focusSection = groups.find((g) => g.facts.some((f) => f.key === focus))?.section

  useEffect(() => {
    if (focus) setOpenKey(focus as FactKey)
  }, [focus])

  const setFact = (key: FactKey, patch: Partial<FactValue>) =>
    update((cur) => ({ ...cur, factsheet: { ...cur.factsheet, [key]: { ...(cur.factsheet[key] ?? emptyFact()), ...patch, updatedAt: nowIso() } } }))

  const pull = async () => {
    try {
      const client = (await listClients(workspaceId)).find((x) => x.id === p.clientId)
      if (!client) {
        toast('고객 기록을 찾지 못했습니다.')
        return
      }
      update((cur) => ({ ...cur, factsheet: seedFactsFromClient(cur.factsheet, client, nowIso()) }))
      toast('고객 기록에서 빈 칸을 채웠습니다.')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '가져오지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="t-section text-slate-900">사실표 (VENTURE FACTSHEET)</h2>
            <p className="t-sub mt-1 break-keep text-slate-500">
              사업계획서·인포그래픽·실사 Script·MVP 데이터가 서로 다른 숫자를 쓰지 않게 하는 원본입니다. 숫자에는 기준연도·출처·산식을 붙입니다.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <MiniProgress value={c.filled} max={c.total} label="채운 항목" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void pull()}>고객 기록에서 빈 칸 채우기</Button>
          <CopyButton text={factsheetToText(p.factsheet)} label="전체 복사" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FACT_STATUS_ORDER.map((s) => (
            <Badge key={s} tone={STATUS_TONE[s]}>{FACT_STATUS_LABEL[s]}</Badge>
          ))}
          <span className="t-meta text-slate-500">시연용 값은 실적처럼 쓰이면 안 됩니다. 미확인 값은 서류로 확인한 뒤 확정으로 바꿉니다.</span>
        </div>
      </Surface>

      {groups.map(({ section, facts }) => (
        <Disclosure
          key={section}
          title={FACT_SECTION_LABEL[section]}
          hint={`${c.bySection[section].filled}/${c.bySection[section].total}`}
          defaultOpen={section === (focusSection ?? 'company')}
        >
          <div className="flex flex-col gap-2">
            {facts.map((f) => {
              const v = p.factsheet[f.key] ?? emptyFact()
              const open = openKey === f.key
              const filled = v.value.trim() !== ''
              return (
                <div key={f.key} id={`fact-${f.key}`} className={`rounded-(--radius-card) border ${open ? 'border-brand-300' : 'border-slate-200'} bg-white`}>
                  <button type="button" onClick={() => setOpenKey(open ? null : f.key)} className="tap flex w-full items-start gap-3 px-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="t-sub block text-slate-500">{f.label}</span>
                      <span className={`t-body block break-keep ${filled ? 'text-slate-900' : 'text-slate-400'}`}>{filled ? v.value : f.placeholder || '비어 있음'}</span>
                      {(v.source || v.asOfDate) && <span className="t-meta block text-slate-400">{[v.asOfDate, v.source ? `출처: ${v.source}` : ''].filter(Boolean).join(' · ')}</span>}
                    </span>
                    {filled && <Badge tone={STATUS_TONE[v.status]}>{FACT_STATUS_LABEL[v.status]}</Badge>}
                  </button>
                  {open && (
                    <div className="grid gap-3 border-t border-slate-100 px-3 py-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <TextField id={`fact-input-${f.key}`} label="값" value={v.value} multiline={f.multiline} rows={2} placeholder={f.placeholder} onCommit={(val) => setFact(f.key, { value: val })} />
                      </div>
                      <SelectField label="상태" value={v.status} options={FACT_STATUS_ORDER.map((s) => ({ value: s, label: FACT_STATUS_LABEL[s] }))} onChange={(s) => setFact(f.key, { status: s })} />
                      <TextField label="기준일" type="date" value={v.asOfDate} onCommit={(val) => setFact(f.key, { asOfDate: val })} />
                      <TextField label="출처" value={v.source} placeholder="등기부 · 재무제표 · 통계청 · 인터뷰 …" onCommit={(val) => setFact(f.key, { source: val })} />
                      <TextField label={f.numeric ? '산식 · 비고' : '비고'} value={v.note} placeholder={f.numeric ? '예: 2,800개 × 3% × 360만원' : ''} onCommit={(val) => setFact(f.key, { note: val })} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Disclosure>
      ))}
    </div>
  )
}
