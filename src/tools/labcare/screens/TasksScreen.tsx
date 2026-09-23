/**
 * 오늘 할 일 — 연구소 쪽에서 지금 챙길 것 (D-91).
 *
 * 이 화면은 아무것도 저장하지 않는다. 업체 기록과 이 모듈이 쌓은 것을 읽어
 * "지금 안 하면 문제가 되는 것" 만 급한 순으로 세운다(labTasks.ts).
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { INSPECTION_ITEMS } from '../lib/inspection'
import { currentMonth } from '../lib/noteDraft'
import { buildLabTasks, currentYear, type LabTask, type LabTaskKind } from '../lib/labTasks'
import type { LabInfoData } from '../lib/labInfo'

interface NoteData extends Record<string, unknown> {
  month: string
}
interface SurveyData extends Record<string, unknown> {
  year: number
  status: string
}
interface InspectionData extends Record<string, unknown> {
  checked: string[]
}

const KIND_TONE: Record<LabTaskKind, Tone> = {
  note: 'danger',
  survey: 'danger',
  researcher: 'warning',
  inspection: 'warning',
}

const KIND_LABEL: Record<LabTaskKind, string> = {
  note: '연구노트',
  survey: '활동조사',
  researcher: '인원',
  inspection: '현장조사',
}

export function TasksScreen() {
  const { loadClients } = useToolClient()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const notes = useModuleBucket<NoteData>('labcare', 'notes')
  const surveys = useModuleBucket<SurveyData>('labcare', 'surveys')
  const inspections = useModuleBucket<InspectionData>('labcare', 'inspections')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const month = currentMonth()
  const year = currentYear()

  const tasks = useMemo<LabTask[]>(() => {
    if (!clients || !info.rows || !notes.rows || !surveys.rows || !inspections.rows) return []
    return buildLabTasks({
      clients: clients.map((c) => ({ id: c.id, name: c.companyName })),
      labInfo: new Map(info.rows.map((r) => [r.clientId, r.data])),
      notedThisMonth: new Set(notes.rows.filter((n) => n.data.month === month).map((n) => n.clientId)),
      surveyedThisYear: new Set(
        surveys.rows.filter((s) => Number(s.data.year) === year && s.data.status === '제출 완료').map((s) => s.clientId),
      ),
      inspectionChecked: new Map(inspections.rows.map((r) => [r.clientId, r.data.checked ?? []])),
      urgentInspectionKeys: INSPECTION_ITEMS.filter((i) => i.emphasis).map((i) => i.key),
      month,
      year,
    })
  }, [clients, info.rows, notes.rows, surveys.rows, inspections.rows, month, year])

  if (!clients || !info.rows || !notes.rows || !surveys.rows || !inspections.rows) {
    return <p className="t-sub text-slate-400">할 일을 세는 중…</p>
  }

  const watched = info.rows.length
  const byKind = (k: LabTaskKind) => tasks.filter((t) => t.kind === k).length

  return (
    <div className="flex flex-col gap-5" data-testid="lab-tasks">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="보고 있는 연구소" value={`${watched}곳`} hint="연구소 정보를 적은 업체" />
        <MetricTile label={`${month} 노트 없음`} value={`${byKind('note')}곳`} tone={byKind('note') > 0 ? 'danger' : 'success'} />
        <MetricTile label={`${year} 활동조사 미제출`} value={`${byKind('survey')}곳`} tone={byKind('survey') > 0 ? 'danger' : 'success'} />
        <MetricTile
          label="인원·현장조사"
          value={`${byKind('researcher') + byKind('inspection')}건`}
          tone={byKind('researcher') + byKind('inspection') > 0 ? 'warning' : 'success'}
        />
      </div>

      {watched === 0 && (
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600">
            아직 연구소 정보를 적은 업체가 없습니다.{' '}
            <Link to="/tools/labcare/clients" className="font-bold text-brand-700 hover:underline">
              연구소 고객사
            </Link>{' '}
            에서 업체 하나에 연구소 정보를 적으면 여기부터 챙겨 드립니다.
          </p>
        </Surface>
      )}

      {watched > 0 && tasks.length === 0 ? (
        <Surface edge="success" showEdge>
          <p className="t-sub flex items-center gap-2 break-keep text-slate-700">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-emerald-600" />
            지금 급한 것은 없습니다. 이번 달 노트도, 올해 활동조사도 다 챙겼습니다.
          </p>
        </Surface>
      ) : (
        tasks.length > 0 && (
          <Section title="지금 챙길 것" count={tasks.length}>
            <ul className="flex flex-col gap-2" data-testid="lab-task-list">
              {tasks.map((t, i) => (
                <li key={`${t.clientId}-${t.kind}-${i}`}>
                  <Surface as="div" edge={KIND_TONE[t.kind]} showEdge padded={false}>
                    <Link to={t.to} className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                      <Badge tone={KIND_TONE[t.kind]}>{KIND_LABEL[t.kind]}</Badge>
                      <span className="t-sub font-bold text-slate-900">{t.clientName}</span>
                      <span className="t-sub min-w-0 flex-1 break-keep text-slate-700">{t.title}</span>
                      <span className="t-meta hidden break-keep text-slate-400 sm:inline">{t.detail}</span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                    </Link>
                  </Surface>
                </li>
              ))}
            </ul>
          </Section>
        )
      )}
    </div>
  )
}
