/**
 * 현장조사 대비 — 통보받고 준비하면 늦다 (D-91).
 *
 * 원본(app/inspection)의 12항목 체크리스트를 업체별로 저장되게 옮겼다.
 * 원본은 화면에서만 체크되고 저장되지 않았다 — 여기서는 업체마다 남는다.
 *
 * 세 갈래로 본다: 사람 · 공간 · 활동. 별표(핵심)가 빠져 있으면 '오늘 할 일' 에도 올라간다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { INSPECTION_ITEMS, INSPECTION_POINTS } from '../lib/inspection'
import type { LabInfoData } from '../lib/labInfo'

interface InspectionData extends Record<string, unknown> {
  checked: string[]
  memo: string
}

export function InspectionScreen() {
  const { loadClients, clientId } = useToolClient()
  const { showToast } = useToast()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const inspections = useModuleBucket<InspectionData>('labcare', 'inspections')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [picked, setPicked] = useState(clientId ?? '')

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      const live = list.filter((c) => c.archivedAt === null)
      if (!alive) return
      setClients(live)
      setPicked((cur) => cur || live[0]?.id || '')
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const row = useMemo(() => (inspections.rows ?? []).find((r) => r.clientId === picked), [inspections.rows, picked])
  const checked = useMemo(() => new Set(row?.data.checked ?? []), [row])

  if (clients === null || info.rows === null || inspections.rows === null) {
    return <p className="t-sub text-slate-400">현장조사 준비 상태를 읽는 중…</p>
  }

  const client = clients.find((c) => c.id === picked)
  const labInfo = (info.rows ?? []).find((r) => r.clientId === picked)?.data
  const done = INSPECTION_ITEMS.filter((i) => checked.has(i.key)).length
  const rate = Math.round((done / INSPECTION_ITEMS.length) * 100)
  const missingUrgent = INSPECTION_ITEMS.filter((i) => i.emphasis && !checked.has(i.key))
  const tone: Tone = rate >= 80 ? 'success' : rate >= 50 ? 'brand' : 'warning'

  const toggle = async (key: string) => {
    if (!client) return
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    await inspections.save({ id: row?.id, clientId: client.id, data: { checked: [...next], memo: row?.data.memo ?? '' } })
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lab-inspection">
      <Surface>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">점검할 업체</span>
            <select
              aria-label="점검할 업체"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
            {labInfo && (
              <span className="t-meta mt-1 block text-slate-500">
                {labInfo.labType} · {labInfo.labName || '연구소 이름 미입력'}
              </span>
            )}
          </label>
          <div className="flex items-center gap-3">
            <MetricTile label="실사 대비 준비도" value={`${rate}%`} hint={`${done}/${INSPECTION_ITEMS.length} 항목`} tone={tone} />
          </div>
        </div>
      </Surface>

      {missingUrgent.length > 0 && (
        <Surface edge="danger" showEdge>
          <p className="t-sub break-keep text-slate-700" data-testid="lab-inspection-urgent">
            <b className="text-rose-700">핵심 항목 {missingUrgent.length}건</b>이 아직 준비되지 않았습니다 —{' '}
            {missingUrgent.map((i) => i.label).join(' · ')}
          </p>
        </Surface>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {INSPECTION_POINTS.map((p) => {
          const items = INSPECTION_ITEMS.filter((i) => i.point === p.id)
          const pointDone = items.filter((i) => checked.has(i.key)).length
          return (
            <div key={p.id} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 p-3" data-point={p.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="t-body font-bold text-slate-900">
                  <span aria-hidden="true">{p.icon}</span> {p.title}
                </span>
                <span className="t-meta tabular-nums text-slate-500">
                  {pointDone}/{items.length}
                </span>
              </div>
              <p className="t-meta break-keep text-slate-500">{p.desc}</p>
              <ul className="flex flex-col gap-1.5">
                {items.map((i) => (
                  <li key={i.key}>
                    <label className="tap flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked.has(i.key)}
                        onChange={() => void toggle(i.key)}
                        aria-label={i.label}
                        data-item={i.key}
                        className="mt-1 size-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="t-sub break-keep text-slate-800">
                          {i.label}
                          {i.emphasis && <Badge tone="danger" className="ml-1">핵심</Badge>}
                        </span>
                        <span className="t-meta block break-keep text-slate-500">{i.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <Section title="메모">
        <Surface>
          <textarea
            aria-label="현장조사 메모"
            rows={3}
            defaultValue={row?.data.memo ?? ''}
            onBlur={async (e) => {
              if (!client) return
              await inspections.save({ id: row?.id, clientId: client.id, data: { checked: [...checked], memo: e.target.value } })
              showToast('메모를 저장했습니다.')
            }}
            placeholder="사진 어디에 있는지, 누가 언제 확인했는지 등"
            className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
          />
        </Surface>
      </Section>

      <p className="t-meta break-keep text-slate-400">
        현장조사를 거부·방해·기피하면 인정이 취소될 수 있습니다. 서류는{' '}
        {client ? (
          <Link to={`/ops/clients/${client.id}?tab=docs`} className="font-medium text-brand-700 hover:underline">
            업체 서류함
          </Link>
        ) : (
          '업체 서류함'
        )}
        에 모아 두세요.
      </p>

      <div className="flex">
        <Button variant="ghost" size="sm" onClick={() => void inspections.reload()}>
          다시 읽기
        </Button>
      </div>
    </div>
  )
}
