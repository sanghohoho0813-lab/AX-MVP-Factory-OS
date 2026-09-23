/**
 * 원본 기업부설연구소 OS 화면 틀 (D-92).
 *
 * 연구소 모듈의 화면은 이제 원본(ccs-post-management)의 화면을 거의 그대로 쓴다 — 글자·배치·색까지.
 * 이 틀이 하는 일:
 *   1) 고객 운영 업체 목록과 모듈 기록을 한 번 읽어 원본 저장소(store)를 채운다
 *   2) D-91 에서 쌓은 연구소 기록(labInfo·projects·notes·surveys)이 있으면 원본 모양으로 한 번 옮긴다
 *   3) 목차의 화면 키 → 원본 화면 (고객사 상세·점검·리포트는 ?cid= 로 고른다)
 */

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listRows } from '../../../services/moduleData'
import { useToolClient } from '../../shared/toolClientContext'
import { hydrateLabStore } from './store'
import { getClients } from './lib/storage'
import StatusBadge from './components/StatusBadge'
import { getLatestCheck } from './lib/storage'
import DashboardPage from './pages/dashboard'
import TasksPage from './pages/tasks'
import ClientsPage from './pages/clients'
import ClientDetailPage from './pages/clientDetail'
import ClientCheckPage from './pages/clientCheck'
import ClientReportPage from './pages/clientReport'
import AssessmentPage from './pages/assessment'
import SetupDocumentsPage from './pages/setupDocuments'
import OrgDiagramPage from './pages/orgDiagram'
import NotesPage from './pages/notes'
import ChangesPage from './pages/changes'
import ActivitySurveyPage from './pages/activitySurvey'
import InspectionPage from './pages/inspection'
import ReportsPage from './pages/reports'
import ResourcesPage from './pages/resources'
import SettingsPage from './pages/settings'

/** D-91 모듈 기록 → 원본 저장소 모양 */
async function legacyFromD91(workspaceId: string | null): Promise<Record<string, unknown>> {
  const [info, projects, notes, surveys] = await Promise.all([
    listRows(workspaceId, 'labcare', 'labInfo'),
    listRows(workspaceId, 'labcare', 'projects'),
    listRows(workspaceId, 'labcare', 'notes'),
    listRows(workspaceId, 'labcare', 'surveys'),
  ])
  const now = new Date().toISOString()
  const clients = info.map((r) => {
    const d = r.data as Record<string, unknown>
    const researchers = Array.isArray(d.researchers) ? (d.researchers as Array<{ dedicated?: boolean }>) : []
    return {
      id: r.clientId,
      name: '',
      industry: '',
      labType: d.labType === '연구개발전담부서' ? '연구개발전담부서' : '기업부설연구소',
      ceoName: '',
      address: '',
      certifiedDate: typeof d.certifiedDate === 'string' ? d.certifiedDate : '',
      researcherCount: researchers.filter((x) => x.dedicated !== false).length,
      labName: typeof d.labName === 'string' ? d.labName : '',
      consultant: '',
      labRegistrationNumber: typeof d.registrationNumber === 'string' ? d.registrationNumber : '',
      note: typeof d.memo === 'string' ? d.memo : '',
      createdAt: r.updatedAt || now,
      source: 'manual',
    }
  })
  const surveyByClient = new Map<string, { clientId: string; years: Record<string, string>; logs: { at: string; text: string }[] }>()
  for (const r of surveys) {
    const d = r.data as Record<string, unknown>
    const cur = surveyByClient.get(r.clientId) ?? { clientId: r.clientId, years: {}, logs: [] }
    const st = String(d.status ?? '')
    cur.years[String(d.year ?? '')] = /완료|제출함/.test(st) ? '제출 완료' : /요청/.test(st) ? '자료 요청 중' : '제출 전'
    if (typeof d.memo === 'string' && d.memo) cur.logs.push({ at: String(d.submittedAt || now).slice(0, 10), text: d.memo })
    surveyByClient.set(r.clientId, cur)
  }
  return {
    'pmsaas:clients:v1': clients,
    'pmsaas:projects:v1': projects.map((r) => ({ ...(r.data as Record<string, unknown>), id: r.id, clientId: r.clientId })),
    'pmsaas:notes:v1': notes.map((r) => ({ ...(r.data as Record<string, unknown>), id: r.id, clientId: r.clientId })),
    'pmsaas:survey:v1': [...surveyByClient.values()],
  }
}

/** 원본에는 따로 없던 '월간 점검' 목차 칸 — 고객사를 고르면 원본 점검 화면으로 */
function CheckPicker() {
  const clients = getClients()
  return (
    <div className="flex flex-col gap-4" data-testid="lab-check-picker">
      <div>
        <h1 className="t-page text-slate-900">월간 점검</h1>
        <p className="t-sub mt-1 text-slate-600">고객사를 고르면 8문항 월간 점검 → 위험도 화면이 열립니다.</p>
      </div>
      {clients.length === 0 ? (
        <p className="t-sub text-slate-500">
          연구소 고객사가 아직 없습니다. <Link to="/tools/labcare/clients" className="font-bold text-navy-700 underline">고객사 관리</Link> 에서 고객 운영 업체를 연구소 고객사로 추가하세요.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link to={`/tools/labcare/check?cid=${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50">
                <span>
                  <b className="text-base text-slate-900">{c.name}</b>
                  <span className="ml-2 text-sm text-slate-500">{c.labType}</span>
                </span>
                <StatusBadge status={getLatestCheck(c.id)?.level ?? '미점검'} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function OrigLabcare({ section }: { section: string }) {
  const { loadClients, workspaceId } = useToolClient()
  const [ready, setReady] = useState(false)
  const [params] = useSearchParams()
  const cid = params.get('cid')

  useEffect(() => {
    let alive = true
    void loadClients()
      .then((list) => hydrateLabStore({ workspaceId, clients: list, legacy: () => legacyFromD91(workspaceId) }))
      .catch(() => undefined)
      .then(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId])

  if (!ready) return <p className="t-sub text-slate-400">연구소 기록을 읽는 중…</p>

  const key = `${section}:${cid ?? ''}`
  return (
    <div className="lab-orig @container" data-testid="lab-orig" data-section={section} key={key}>
      {section === 'dashboard' && <DashboardPage />}
      {section === 'tasks' && <TasksPage />}
      {section === 'clients' && (cid ? <ClientDetailPage /> : <ClientsPage />)}
      {section === 'assessment' && <AssessmentPage />}
      {section === 'setup-docs' && <SetupDocumentsPage />}
      {section === 'org-diagram' && <OrgDiagramPage />}
      {section === 'notes' && <NotesPage />}
      {section === 'changes' && <ChangesPage />}
      {section === 'survey' && <ActivitySurveyPage />}
      {section === 'check' && (cid ? <ClientCheckPage /> : <CheckPicker />)}
      {section === 'inspection' && <InspectionPage />}
      {section === 'reports' && (cid ? <ClientReportPage /> : <ReportsPage />)}
      {section === 'resources' && <ResourcesPage />}
      {section === 'settings' && <SettingsPage />}
    </div>
  )
}
