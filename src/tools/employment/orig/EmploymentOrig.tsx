/**
 * 원본 고용지원금 매니저 Pro 화면(SubsidyApp.jsx)을 이 OS 안에 세운다 (D-93).
 *
 * 원본의 데이터 층(Supabase 표 + useData 훅)이 하던 일을 여기서 한다:
 *   - 읽기: 고객 운영 업체 + 모듈 기록(employment/companies · employees · orig · calendar · programs)
 *   - 쓰기: 원본이 부르는 콜백(onSaveCompany · onPatchEmployee …) → 화면에 바로 반영하고 모듈 기록에 저장
 * 모양 바꾸기 규칙은 store.ts.
 *
 * 화면·업체는 OS 주소가 정한다 — 원본이 화면을 옮기면(onNav) 주소를 바꾼다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteRow, listRows, saveRow } from '../../../services/moduleData'
import { canUploadFiles, documentFileUrl, uploadModuleFile } from '../../../services/clientOpsService'
import { useToast } from '../../../components/ui/toastContext'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { useToolClient } from '../../shared/toolClientContext'
import SubsidyApp, { DEFAULT_PROGRAMS, PROGRAM_ENABLED_DEFAULTS } from './SubsidyApp.jsx'
import {
  MODULE,
  companyMetaOf,
  employeeRowData,
  matchOsClient,
  memosFromRow,
  osPickList,
  programsFromD91,
  toOrigCompany,
  toOrigEmployee,
  type Rec,
} from './store'
import './hr-orig.css'

interface Loaded {
  clients: ClientOpsRecord[]
  /** 업체 id → 모듈 기록(업체 한 줄) */
  metaRows: Map<string, { id: string; data: Rec }>
  companies: Rec[]
  employees: Rec[]
  programs: Record<string, Rec> | undefined
  programsRowId?: string
  profile: Rec
  profileRowId?: string
  memos: Record<string, unknown[]>
  memoRowId?: string
}

async function loadAll(workspaceId: string | null, clients: ClientOpsRecord[]): Promise<Loaded> {
  const [metaList, empList, origList, calList, progList] = await Promise.all([
    listRows(workspaceId, MODULE, 'companies'),
    listRows(workspaceId, MODULE, 'employees'),
    listRows(workspaceId, MODULE, 'orig'),
    listRows(workspaceId, MODULE, 'calendar'),
    listRows(workspaceId, MODULE, 'programs'),
  ])
  const byId = new Map(clients.map((c) => [c.id, c]))
  const metaRows = new Map<string, { id: string; data: Rec }>()
  for (const r of metaList) if (r.clientId) metaRows.set(r.clientId, { id: r.id, data: r.data })
  const employeesAll = empList.filter((r) => byId.has(r.clientId)).map((r) => toOrigEmployee(r))

  // 업체 = 고용지원금 기록이 있는 고객 운영 업체 (업체 줄이 있거나 · 직원이 있거나). 지운 업체(removedAt)는 뺀다
  const ids = new Set<string>()
  for (const [cid, row] of metaRows) if (byId.has(cid) && !row.data.removedAt) ids.add(cid)
  for (const e of employeesAll) {
    const cid = String(e.companyId)
    if (!metaRows.get(cid)?.data.removedAt) ids.add(cid)
  }
  const companies = [...ids]
    .map((cid) => byId.get(cid))
    .filter((c): c is ClientOpsRecord => !!c && c.archivedAt === null)
    .map((c) => toOrigCompany(c, metaRows.get(c.id)?.data))
  const visible = new Set(companies.map((c) => String(c.id)))

  const progRow = origList.find((r) => r.data.key === 'programs')
  const profRow = origList.find((r) => r.data.key === 'profile')
  const calRow = calList[0]
  return {
    clients,
    metaRows,
    companies,
    employees: employeesAll.filter((e) => visible.has(String(e.companyId))),
    programs:
      progRow && progRow.data.value && typeof progRow.data.value === 'object'
        ? (progRow.data.value as Record<string, Rec>)
        : programsFromD91(progList, DEFAULT_PROGRAMS as Record<string, Rec>, PROGRAM_ENABLED_DEFAULTS as Record<string, boolean>),
    programsRowId: progRow?.id,
    profile: (profRow?.data.value as Rec | undefined) ?? { display_name: '', title: '', settings: { ddayAlert: 7 } },
    profileRowId: profRow?.id,
    memos: memosFromRow(calRow?.data),
    memoRowId: calRow?.id,
  }
}

export function EmploymentOrig({
  view,
  companyId,
  onNav,
  focusClient,
}: {
  view: string
  companyId: string | null
  onNav: (next: { view?: string; company?: string | null }) => void
  /** 업체 상세에서 연 도구(?client=) — 등록된 업체면 그 업체 화면으로, 아니면 추가 창에 골라 둔다 (D-94) */
  focusClient?: string | null
}) {
  const { loadClients, workspaceId } = useToolClient()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<Loaded | null>(null)
  const ref = useRef<Loaded | null>(null)
  /** 엑셀로 들여온 업체의 임시 id → 고객 운영 업체 id */
  const remap = useRef(new Map<string, string>())

  useEffect(() => {
    let alive = true
    void loadClients()
      .then((list) => loadAll(workspaceId, list))
      .then((d) => {
        if (!alive) return
        ref.current = d
        setData(d)
      })
      .catch(() => {
        if (alive) showToast('고용지원금 기록을 읽지 못했습니다. 새로고침해 주세요.')
      })
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId, showToast])

  const commit = useCallback((next: Loaded) => {
    ref.current = next
    setData(next)
  }, [])
  const fail = useCallback((e: unknown) => showToast(`저장하지 못했습니다: ${e instanceof Error ? e.message : '오류'}`), [showToast])

  /* ---------------- 업체 ---------------- */
  const persistCompany = useCallback(
    async (company: Rec) => {
      const cur = ref.current
      if (!cur) return
      const cid = String(company.id)
      const os = cur.clients.find((c) => c.id === cid)
      const row = cur.metaRows.get(cid)
      const saved = await saveRow(workspaceId, MODULE, 'companies', { id: row?.id, clientId: cid, data: companyMetaOf(company, os) })
      ref.current?.metaRows.set(cid, { id: saved.id, data: saved.data })
    },
    [workspaceId],
  )

  const saveCompany = useCallback(
    async (comp: Rec) => {
      const cur = ref.current
      if (!cur) return
      const os = cur.clients.find((c) => c.id === comp.id)
      if (!os) throw new Error('고객 관리에 없는 업체입니다. 고객 관리에서 먼저 등록해 주세요.')
      const prev = cur.metaRows.get(os.id)?.data
      const merged = toOrigCompany(os, { ...(prev ?? {}), ...comp, removedAt: undefined })
      const companies = cur.companies.some((c) => c.id === os.id) ? cur.companies.map((c) => (c.id === os.id ? merged : c)) : [...cur.companies, merged]
      commit({ ...cur, companies })
      await persistCompany(merged)
    },
    [commit, persistCompany],
  )

  const patchCompany = useCallback(
    (id: string, patch: Rec) => {
      const cur = ref.current
      if (!cur) return
      let next: Rec | undefined
      const companies = cur.companies.map((c) => {
        if (c.id !== id) return c
        next = { ...c, ...patch, id: c.id, name: c.name }
        return next
      })
      commit({ ...cur, companies })
      if (next) void persistCompany(next).catch(fail)
    },
    [commit, persistCompany, fail],
  )

  /** 업체 지우기 = 고용지원금 목록에서만 뺀다(기록은 남는다 · 다시 고르면 돌아온다). 고객 운영 업체는 그대로 */
  const removeCompanies = useCallback(
    async (ids: string[]) => {
      const cur = ref.current
      if (!cur) return
      const gone = new Set(ids)
      commit({ ...cur, companies: cur.companies.filter((c) => !gone.has(String(c.id))), employees: cur.employees.filter((e) => !gone.has(String(e.companyId))) })
      for (const id of ids) {
        const row = cur.metaRows.get(id)
        const saved = await saveRow(workspaceId, MODULE, 'companies', { id: row?.id, clientId: id, data: { ...(row?.data ?? {}), removedAt: new Date().toISOString() } })
        ref.current?.metaRows.set(id, { id: saved.id, data: saved.data })
      }
    },
    [commit, workspaceId],
  )

  /* ---------------- 직원 ---------------- */
  const saveEmployee = useCallback(
    async (emp: Rec) => {
      const cur = ref.current
      if (!cur) return
      const e: Rec = { ...emp, companyId: remap.current.get(String(emp.companyId)) ?? emp.companyId }
      const employees = cur.employees.some((x) => x.id === e.id) ? cur.employees.map((x) => (x.id === e.id ? e : x)) : [...cur.employees, e]
      commit({ ...cur, employees })
      await saveRow(workspaceId, MODULE, 'employees', { id: String(e.id), clientId: String(e.companyId), data: employeeRowData(e) })
    },
    [commit, workspaceId],
  )

  const patchEmployee = useCallback(
    (id: string, patch: Rec) => {
      const cur = ref.current
      if (!cur) return
      let next: Rec | undefined
      const employees = cur.employees.map((e) => {
        if (e.id !== id) return e
        next = { ...e, ...patch }
        return next
      })
      commit({ ...cur, employees })
      if (next) void saveRow(workspaceId, MODULE, 'employees', { id, clientId: String(next.companyId), data: employeeRowData(next) }).catch(fail)
    },
    [commit, workspaceId, fail],
  )

  const deleteEmployees = useCallback(
    async (ids: string[]) => {
      const cur = ref.current
      if (!cur) return
      const gone = new Set(ids)
      commit({ ...cur, employees: cur.employees.filter((e) => !gone.has(String(e.id))) })
      for (const id of ids) await deleteRow(workspaceId, MODULE, 'employees', id)
    },
    [commit, workspaceId],
  )

  /* ---------------- 엑셀로 한꺼번에 ---------------- */
  const bulkCompanies = useCallback(
    async (comps: Rec[]) => {
      const cur = ref.current
      if (!cur) return
      const live = cur.clients.filter((c) => c.archivedAt === null)
      const missing: string[] = []
      const pairs: Array<[Rec, ClientOpsRecord]> = []
      for (const comp of comps) {
        const os = matchOsClient(comp, live)
        if (os) pairs.push([comp, os])
        else missing.push(String(comp.name || '(이름 없음)'))
      }
      if (missing.length) {
        throw new Error(`고객 관리에 없는 업체 ${missing.length}곳(${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' 외' : ''}) — 고객 관리에 먼저 등록한 뒤 다시 올려 주세요`)
      }
      for (const [comp, os] of pairs) {
        remap.current.set(String(comp.id), os.id)
        await saveCompany({ ...comp, id: os.id })
      }
    },
    [saveCompany],
  )

  const bulkEmployees = useCallback(
    async (emps: Rec[]) => {
      for (const e of emps) await saveEmployee(e)
    },
    [saveEmployee],
  )

  /* ---------------- 지원금 표 · 프로필 · 달력 ---------------- */
  const saveOrigKey = useCallback(
    async (key: 'programs' | 'profile', value: Rec) => {
      const cur = ref.current
      if (!cur) return
      const rowId = key === 'programs' ? cur.programsRowId : cur.profileRowId
      const saved = await saveRow(workspaceId, MODULE, 'orig', { id: rowId, clientId: '', data: { key, value } })
      if (ref.current) {
        if (key === 'programs') ref.current.programsRowId = saved.id
        else ref.current.profileRowId = saved.id
      }
    },
    [workspaceId],
  )

  const savePrograms = useCallback(
    (map: Record<string, Rec>) => {
      const cur = ref.current
      if (!cur) return
      commit({ ...cur, programs: map })
      void saveOrigKey('programs', map).catch(fail)
    },
    [commit, saveOrigKey, fail],
  )

  const updateProfile = useCallback(
    (p: Rec) => {
      const cur = ref.current
      if (!cur) return
      const profile = { ...cur.profile, ...p }
      commit({ ...cur, profile })
      void saveOrigKey('profile', profile).catch(fail)
    },
    [commit, saveOrigKey, fail],
  )

  const saveMemo = useCallback(
    (dateKey: string, list: unknown[]) => {
      const cur = ref.current
      if (!cur) return
      const memos = { ...cur.memos, [dateKey]: list }
      if (!list.length) delete memos[dateKey]
      commit({ ...cur, memos })
      void saveRow(workspaceId, MODULE, 'calendar', { id: cur.memoRowId, clientId: '', data: { memos } })
        .then((saved) => {
          if (ref.current) ref.current.memoRowId = saved.id
        })
        .catch(fail)
    },
    [commit, workspaceId, fail],
  )

  /* ---------------- 파일 ---------------- */
  // 클라우드면 고객 운영 서류와 같은 보관함에. 이 브라우저에만 저장하는 모드면 원본처럼 파일을 기록 안에 담는다
  const uploadFn = useMemo(
    () =>
      canUploadFiles()
        ? async (cid: string, empId: string | null, file: File) => {
            const ext = (file.name.split('.').pop() || 'dat').toLowerCase()
            const { storagePath } = await uploadModuleFile(workspaceId, cid, `employment/${empId || 'company'}`, file)
            return { id: storagePath.split('/').pop() || ext, name: file.name, storagePath, type: file.type }
          }
        : undefined,
    [workspaceId],
  )
  const getUrlFn = useCallback((path: string) => documentFileUrl(path), [])

  // D-94: 업체 상세에서 열었으면 그 업체로 바로 — 한 번만(그 뒤에는 사용자가 옮긴 화면을 존중한다)
  const focused = useRef<string | null>(null)
  const [openAddFor, setOpenAddFor] = useState<string | null>(null)
  useEffect(() => {
    if (!data || !focusClient || focused.current === focusClient) return
    focused.current = focusClient
    // 주소가 다른 업체를 가리키면 그쪽이 우선. ‘업체 관리’ 는 업체 id 를 그대로 넘기므로 같은 업체면 계속 간다
    if (companyId && companyId !== focusClient) return
    if (data.companies.some((c) => c.id === focusClient)) {
      if (view === 'dashboard' || view === 'company') onNav({ view: 'company', company: focusClient })
    } else if (data.clients.some((c) => c.id === focusClient && !c.archivedAt)) {
      setOpenAddFor(focusClient)
    }
  }, [data, focusClient, companyId, view, onNav])

  const call = useCallback(
    <A extends unknown[]>(fn: (...a: A) => Promise<void>) =>
      (...a: A) => {
        void fn(...a).catch(fail)
      },
    [fail],
  )

  if (!data) return <p className="t-sub text-slate-400">고용지원금 기록을 읽는 중…</p>

  const registered = new Set(data.companies.map((c) => String(c.id)))

  return (
    <div className="hr-orig">
      <SubsidyApp
        view={view}
        companyId={companyId && registered.has(companyId) ? companyId : null}
        onNav={onNav}
        onBack={() => void navigate(-1)}
        openAddFor={openAddFor}
        onOpenAddDone={() => setOpenAddFor(null)}
        osClients={osPickList(data.clients, registered)}
        companies={data.companies}
        employees={data.employees}
        programs={data.programs}
        calendarMemos={data.memos}
        profile={data.profile}
        orgName=""
        subStatus="active"
        plan="agency"
        uploadFn={uploadFn}
        getUrlFn={getUrlFn}
        onSaveCompany={call(saveCompany)}
        onPatchCompany={patchCompany}
        onDeleteCompany={(id: string) => void removeCompanies([id]).catch(fail)}
        onSaveEmployee={call(saveEmployee)}
        onPatchEmployee={patchEmployee}
        onDeleteEmployee={(id: string) => void deleteEmployees([id]).catch(fail)}
        onBulkSaveCompanies={bulkCompanies}
        onBulkSaveEmployees={bulkEmployees}
        onDeleteSampleRows={async (empIds: string[], compIds: string[]) => {
          if (empIds.length) await deleteEmployees(empIds)
          if (compIds.length) await removeCompanies(compIds.map((id) => remap.current.get(id) ?? id))
        }}
        onSavePrograms={savePrograms}
        onSaveMemo={saveMemo}
        onUpdateProfile={updateProfile}
      />
    </div>
  )
}
