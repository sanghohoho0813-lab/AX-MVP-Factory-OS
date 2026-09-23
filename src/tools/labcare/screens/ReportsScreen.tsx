/**
 * 고객 리포트 — 이번 달 상태를 글 한 장으로 (D-91).
 *
 * 업체를 고르면 이 모듈이 아는 것(연구소 정보·이번 달 노트·활동조사·현장조사 준비)을 모아
 * 보낼 수 있는 글을 만든다. 함께 검토할 혜택은 원본의 문장 그대로 고른다.
 * 만든 글은 복사하거나 업체 기록에 붙인다 — 붙이면 고객 플랫폼으로 발행할 수 있다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Printer } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import { ToolResultAttach } from '../../shared/ToolResultAttach'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { INSPECTION_ITEMS } from '../lib/inspection'
import { BENEFIT_OPTIONS } from '../lib/report'
import { currentMonth, type NoteStatus } from '../lib/noteDraft'
import { currentYear } from '../lib/labTasks'
import { emptyLabInfo, type LabInfoData } from '../lib/labInfo'
import { monthlyReportText } from '../lib/monthlyReport'

interface ProjectData extends Record<string, unknown> {
  name: string
}
interface NoteData extends Record<string, unknown> {
  projectId: string
  month: string
  status: NoteStatus
}
interface SurveyData extends Record<string, unknown> {
  year: number
  status: string
}
interface InspectionData extends Record<string, unknown> {
  checked: string[]
}

export function ReportsScreen() {
  const { loadClients, clientId } = useToolClient()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const projects = useModuleBucket<ProjectData>('labcare', 'projects')
  const notes = useModuleBucket<NoteData>('labcare', 'notes')
  const surveys = useModuleBucket<SurveyData>('labcare', 'surveys')
  const inspections = useModuleBucket<InspectionData>('labcare', 'inspections')

  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [picked, setPicked] = useState(clientId ?? '')
  const [month, setMonth] = useState(currentMonth())
  const [benefits, setBenefits] = useState<string[]>(['policyFund', 'employTax'])
  const [copied, setCopied] = useState(false)

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

  const ready = clients !== null && info.rows !== null && projects.rows !== null && notes.rows !== null && surveys.rows !== null && inspections.rows !== null

  const text = useMemo(() => {
    if (!ready) return ''
    const client = clients?.find((c) => c.id === picked)
    if (!client) return ''
    const labInfo = (info.rows ?? []).find((r) => r.clientId === picked)?.data ?? emptyLabInfo()
    const monthNotes = (notes.rows ?? [])
      .filter((n) => n.clientId === picked && n.data.month === month)
      .map((n) => ({
        projectName: (projects.rows ?? []).find((p) => p.id === n.data.projectId)?.data.name ?? '과제 미지정',
        status: String(n.data.status),
      }))
    const survey = (surveys.rows ?? []).find((s) => s.clientId === picked && Number(s.data.year) === currentYear())
    const checked = (inspections.rows ?? []).find((r) => r.clientId === picked)?.data.checked ?? []
    return monthlyReportText({
      companyName: client.companyName,
      month,
      info: labInfo,
      notes: monthNotes,
      inspection: { done: INSPECTION_ITEMS.filter((i) => checked.includes(i.key)).length, total: INSPECTION_ITEMS.length },
      surveyStatus: `${currentYear()}년 ${survey?.data.status ?? '미제출'}`,
      benefitKeys: benefits,
    })
  }, [ready, clients, picked, month, info.rows, notes.rows, projects.rows, surveys.rows, inspections.rows, benefits])

  if (!ready) return <p className="t-sub text-slate-400">리포트 재료를 읽는 중…</p>

  const client = clients?.find((c) => c.id === picked)
  const monthNoteCount = (notes.rows ?? []).filter((n) => n.clientId === picked && n.data.month === month).length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 긁는다 */
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lab-reports">
      <Surface>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">업체</span>
            <select
              aria-label="리포트 업체"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
            >
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">대상 월</span>
            <input
              type="month"
              aria-label="리포트 대상 월"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
            />
          </label>
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label={`${month} 연구노트`} value={`${monthNoteCount}장`} tone={monthNoteCount > 0 ? 'success' : 'warning'} />
        <MetricTile label="함께 검토할 것" value={`${benefits.length}개`} hint="아래에서 고른 것" />
        <MetricTile label="리포트 길이" value={`${text.split('\n').length}줄`} />
      </div>

      <Section title="함께 검토해 볼 것" count={BENEFIT_OPTIONS.length}>
        <div className="flex flex-wrap gap-1.5" data-testid="lab-report-benefits">
          {BENEFIT_OPTIONS.map((o) => {
            const on = benefits.includes(o.key)
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                onClick={() => setBenefits((cur) => (on ? cur.filter((k) => k !== o.key) : cur.concat([o.key])))}
                className={`tap rounded-full border px-2.5 py-1 t-meta font-medium ${
                  on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        title="리포트"
        action={
          <span className="flex gap-2">
            <Button size="sm" onClick={() => void copy()}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? '복사됨' : '복사'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄
            </Button>
          </span>
        }
      >
        <Surface>
          <pre className="t-meta max-h-96 overflow-auto whitespace-pre-wrap break-keep text-slate-600" data-testid="lab-report-text">
            {text}
          </pre>
        </Surface>
      </Section>

      {client && text && (
        <ToolResultAttach
          toolKey="labcare"
          title={`${month} 사후관리 리포트`}
          verdict={null}
          verdictLabel={monthNoteCount > 0 ? '연구노트 있음' : '연구노트 없음'}
          summary={text}
          data={{ tab: 'reports', clientId: client.id, month }}
          presetClientId={client.id}
        />
      )}

      <p className="t-meta break-keep text-slate-400">
        업체 기록에 붙이면{' '}
        {client ? (
          <Link to={`/ops/clients/${client.id}`} className="font-medium text-brand-700 hover:underline">
            업체 상세
          </Link>
        ) : (
          '업체 상세'
        )}{' '}
        에 남고, 거기서 고객 플랫폼으로 발행할 수 있습니다.
      </p>
    </div>
  )
}
