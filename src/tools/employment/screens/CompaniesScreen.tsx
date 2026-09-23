/**
 * 업체 관리 — 업체별 지원금 대상자 (D-91).
 *
 * 원본에는 업체 명단이 따로 있었다. 여기서는 **고객 운영의 업체를 그대로 쓴다.**
 * 이 화면이 갖는 것은 '그 업체의 지원금 대상 직원' 뿐이다.
 *
 * 한 사람을 넣으면 지원금 규칙표(programs.ts)가 회차표를 만들어 붙인다 —
 * 회차 신청 가능일은 입사일 + n개월이고, 지난 회차는 빨갛게 뜬다.
 *
 * 주민등록번호는 받지 않는다. 생년월일까지만 — 나이 요건 판정에 필요한 것은 그것뿐이다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Check, Copy, FolderOpen, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import type { ClientOpsRecord } from '../../../types/clientOps'
import type { EmpType } from '../lib/programs'
import { buildRounds } from '../lib/schedule'
import { addMo, fD, formatDday, getDdayFrom } from '../lib/dates'
import { fMan } from '../lib/format'
import { MIN_WAGE_MONTH_2026 } from '../lib/constants'
import {
  ELIG_CHECKS,
  EMP_STAGES,
  empRemaining,
  empNextDate,
  empNextDday,
  rollupByClient,
  summarizeEmployees,
  type EmpRecord,
  type EmpStage,
} from '../lib/empRecords'
import { useEmployees } from '../lib/useEmployees'
import { usePrograms, type ProgramView } from '../lib/usePrograms'
import { parseRosterFile } from '../lib/payrollDiagnosis'
import { fetchClientDocFile, hasDocFile } from '../../shared/clientDocFile'
import { ToolResultAttach } from '../../shared/ToolResultAttach'
import { clientReportText } from '../lib/clientReport'
import { useModuleBucket } from '../../shared/useModuleBucket'
import { toCompanyMeta, type CompanyMeta } from '../lib/companyMeta'
import { AgencyReportTab, CommissionTab, CompanyDocsTab, NotesTab, OverviewTab } from './CompanyTabs'
import { ExcelImportWizard } from './ExcelImportWizard'

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DETAIL_TABS = [
  { key: 'overview', label: '📋 개요' },
  { key: 'employees', label: '👤 직원' },
  { key: 'docs', label: '📁 업체 서류' },
  { key: 'commission', label: '🧾 수수료 정산' },
  { key: 'notes', label: '📝 업무 일지' },
  { key: 'agency', label: '📊 기관 보고서' },
] as const
type DetailTab = (typeof DETAIL_TABS)[number]['key']

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

const EMP_TYPES: EmpType[] = ['정규직', '계약직', '인턴', '대체인력']

export function CompaniesScreen() {
  const { loadClients, clientId } = useToolClient()
  const { employees, save, remove } = useEmployees()
  const { programs, enabled } = usePrograms()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(clientId)
  const [wizard, setWizard] = useState(false)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const today = useMemo(() => new Date(), [])
  const rollup = useMemo(() => rollupByClient(employees ?? [], today), [employees, today])

  if (clients === null || employees === null || programs === null) {
    return <p className="t-sub text-slate-400">업체 기록을 읽는 중…</p>
  }

  const open = openId ? clients.find((c) => c.id === openId) : undefined
  if (open) {
    return (
      <ClientEmployees
        client={open}
        employees={employees.filter((e) => e.clientId === open.id)}
        programs={programs}
        choices={enabled.length > 0 ? enabled : programs}
        onBack={() => setOpenId(null)}
        onSave={save}
        onRemove={remove}
        today={today}
      />
    )
  }

  const totals = summarizeEmployees(employees, today)

  return (
    <div className="flex flex-col gap-5" data-testid="emp-companies">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="업체" value={`${clients.length}곳`} hint="고객 운영에 있는 업체" />
        <MetricTile label="지원금 대상자" value={`${totals.active}명`} hint="퇴사 제외" />
        <MetricTile
          label="아직 못 받은 돈"
          value={fMan(totals.pipeline)}
          hint="남은 회차 예정액"
          tone={totals.pipeline > 0 ? 'brand' : 'neutral'}
        />
        <MetricTile
          label="신청이 지난 회차"
          value={`${totals.overdue}건`}
          hint={totals.overdueAmount > 0 ? fMan(totals.overdueAmount) : '없음'}
          tone={totals.overdue > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {clients.length === 0 && (
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600">
            아직 업체가 없습니다.{' '}
            <Link to="/ops/clients" className="font-bold text-brand-700 hover:underline">
              고객 운영
            </Link>{' '}
            에서 업체를 만들면 여기에 그대로 나타납니다.
          </p>
        </Surface>
      )}

      {wizard ? (
        <ExcelImportWizard clients={clients} programs={programs} employees={employees} onSave={save} onClose={() => setWizard(false)} />
      ) : (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setWizard(true)} data-testid="emp-excel-open">
            📥 엑셀로 여러 업체 대상자 한 번에 넣기
          </Button>
        </div>
      )}

      <Section title="업체" count={clients.length}>
        <ul className="flex flex-col gap-2">
          {clients.map((c) => {
            const r = rollup.get(c.id)
            const tone: Tone = r && r.overdue > 0 ? 'danger' : r && r.active > 0 ? 'brand' : 'neutral'
            return (
              <li key={c.id}>
                <Surface as="div" edge={tone} showEdge={tone !== 'neutral'} padded={false}>
                  <button
                    type="button"
                    onClick={() => setOpenId(c.id)}
                    data-client={c.id}
                    className="tap flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 text-left"
                  >
                    <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                    <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                    <span className="t-meta text-slate-500">대상자 {r?.active ?? 0}명</span>
                    {r && r.pipeline > 0 && <span className="t-meta text-slate-500">예정 {fMan(r.pipeline)}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {r?.nextDate && (
                        <span className="t-meta text-slate-400">
                          다음 {fD(r.nextDate)} {formatDday(r.nextDday)}
                        </span>
                      )}
                      {r && r.overdue > 0 && <Badge tone="danger">지난 회차 {r.overdue}</Badge>}
                    </span>
                  </button>
                </Surface>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 한 곳 — 대상자 목록·추가                                          */
/* ------------------------------------------------------------------ */

interface EditForm {
  id?: string
  name: string
  hireDate: string
  birthDate: string
  empType: EmpType
  programId: string
  stage: EmpStage
  memo: string
  salary: string
  gender: '' | '남' | '여'
  militaryMonths: string
  eligChecks: Record<string, boolean>
}

function emptyForm(programId: string): EditForm {
  return { name: '', hireDate: '', birthDate: '', empType: '정규직', programId, stage: 'preparing', memo: '', salary: '', gender: '', militaryMonths: '', eligChecks: {} }
}

function ClientEmployees({
  client,
  employees,
  programs,
  choices,
  onBack,
  onSave,
  onRemove,
  today,
}: {
  client: ClientOpsRecord
  employees: EmpRecord[]
  /** 이름을 찾기 위한 전체 목록 (끈 것도 들어 있다) */
  programs: ProgramView[]
  /** 새로 고를 수 있는 것 — 켜 둔 지원금만 */
  choices: ProgramView[]
  onBack: () => void
  onSave: (input: Omit<EmpRecord, 'id'> & { id?: string }) => Promise<EmpRecord>
  onRemove: (id: string) => Promise<void>
  today: Date
}) {
  const programOf = (id: string) => programs.find((p) => p.id === id)
  const { showToast } = useToast()
  const [form, setForm] = useState<EditForm | null>(null)
  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const sum = summarizeEmployees(employees, today)
  const [tab, setTab] = useState<DetailTab>('employees')
  const metaBucket = useModuleBucket<CompanyMeta>('employment', 'companies')
  const metaRow = metaBucket.rows?.find((r) => r.clientId === client.id)
  const meta = toCompanyMeta(metaRow?.data)
  const patchMeta = async (next: Partial<CompanyMeta>) => {
    await metaBucket.save({ id: metaRow?.id, clientId: client.id, data: { ...meta, ...next } })
  }
  const [view, setView] = useState<'card' | 'table'>('card')
  const [wizard, setWizard] = useState(false)
  const [roundEdit, setRoundEdit] = useState<{ empId: string; index: number; received: string; paidDate: string; note: string } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)

  const report = clientReportText({
    companyName: client.companyName,
    employees,
    programName: (id) => programOf(id)?.name ?? '지원금 미지정',
    today,
  })

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 긁는다 */
    }
  }

  /** 4대보험 명부(엑셀·CSV·PDF) → 이 업체 대상자로 한 번에 */
  const importRoster = async (file: File) => {
    setBusy('명부를 읽는 중…')
    try {
      const r = await parseRosterFile(file)
      if (!r.ok || !r.employees || r.employees.length === 0) {
        showToast('명부에서 사람을 찾지 못했습니다. 화면에서 한 명씩 넣어 주세요.')
        return
      }
      const program = choices[0]
      const have = new Set(employees.map((e) => e.name))
      let added = 0
      for (const row of r.employees) {
        const name = (row.name || '').trim()
        if (!name || have.has(name)) continue
        have.add(name)
        await onSave({
          clientId: client.id,
          name,
          hireDate: row.hireDate ?? '',
          birthDate: row.birthDate ?? '',
          empType: '정규직',
          programId: program?.id ?? '',
          stage: 'preparing',
          rounds: buildRounds(program ?? { rounds: [] }),
          docs: (program?.employeeDocs ?? []).map((n) => ({ name: n, done: false })),
          memo: '4대보험 명부에서 가져옴',
        })
        added += 1
      }
      showToast(added > 0 ? `${added}명을 넣었습니다. 지원금 종류는 한 사람씩 고쳐 주세요.` : '이미 다 들어 있는 사람들입니다.')
    } catch {
      showToast('명부를 읽지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  const importFromDocs = async () => {
    setBusy('서류함에서 명부를 가져오는 중…')
    try {
      const got = await fetchClientDocFile(client, 'payrollRoster')
      if (!got) {
        showToast('서류함에 4대보험 명부 파일이 없습니다.')
        return
      }
      await importRoster(got.file)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '서류함 파일을 가져오지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  const submit = async () => {
    if (!form) return
    if (!form.name.trim()) {
      showToast('이름을 적어 주세요.')
      return
    }
    const program = programOf(form.programId)
    const prev = form.id ? employees.find((e) => e.id === form.id) : undefined
    // 지원금 종류가 그대로면 회차(지급 체크)를 지키고, 바뀌었으면 새 회차표로 갈아 끼운다
    const rounds = prev && prev.programId === form.programId ? prev.rounds : buildRounds(program ?? { rounds: [] })
    await onSave({
      id: form.id,
      clientId: client.id,
      name: form.name.trim(),
      hireDate: form.hireDate,
      birthDate: form.birthDate,
      empType: form.empType,
      programId: form.programId,
      stage: form.stage,
      rounds,
      docs: prev?.docs ?? (program?.employeeDocs ?? []).map((name) => ({ name, done: false })),
      memo: form.memo,
      salary: Number(form.salary.replace(/[^\d]/g, '')) || 0,
      gender: form.gender,
      militaryMonths: Number(form.militaryMonths) || 0,
      eligChecks: form.eligChecks,
    })
    showToast(form.id ? '대상자를 고쳤습니다.' : '대상자를 넣었습니다.')
    setForm(null)
  }

  const toggleRound = async (emp: EmpRecord, index: number) => {
    const rounds = emp.rounds.map((r, i) =>
      i === index ? { ...r, isPaid: !r.isPaid, received: !r.isPaid ? r.amount : 0, paidDate: !r.isPaid ? todayYmd() : '' } : r,
    )
    await onSave({ ...emp, rounds })
  }

  const toggleDoc = async (emp: EmpRecord, index: number) => {
    const docs = emp.docs.map((d, i) => (i === index ? { ...d, done: !d.done } : d))
    await onSave({ ...emp, docs })
  }

  const setStage = async (emp: EmpRecord, stage: EmpStage) => {
    await onSave({ ...emp, stage })
  }

  return (
    <div className="flex flex-col gap-5" data-testid="emp-company-detail" data-client={client.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="size-4" /> 업체 목록
        </Button>
        <span className="t-card font-bold text-slate-900">{client.companyName}</span>
        <Link to={`/ops/clients/${client.id}`} className="t-meta text-brand-700 hover:underline">
          업체 기록 보기
        </Link>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {hasDocFile(client, 'payrollRoster') && (
            <Button variant="ghost" size="sm" onClick={() => void importFromDocs()} disabled={busy !== ''} data-testid="emp-import-docs">
              <FolderOpen aria-hidden="true" className="size-4" /> 서류함 명부로 한 번에
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== ''} data-testid="emp-import">
            <Upload aria-hidden="true" className="size-4" /> 명부 파일로 한 번에
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt,.pdf"
            className="hidden"
            aria-label="4대보험 명부 파일"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importRoster(f)
              e.target.value = ''
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => { setTab('employees'); setWizard(true) }}>
            📥 엑셀 마법사
          </Button>
          <Button size="sm" onClick={() => setForm(emptyForm(choices[0]?.id ?? ''))} data-testid="emp-add">
            <UserPlus aria-hidden="true" className="size-4" /> 대상자 넣기
          </Button>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="대상자" value={`${sum.active}명`} hint="퇴사 제외" />
        <MetricTile label="받은 돈" value={fMan(sum.received)} hint="지급 완료 회차" tone={sum.received > 0 ? 'success' : 'neutral'} />
        <MetricTile label="남은 예정액" value={fMan(sum.pipeline)} hint="아직 안 받은 회차" />
        <MetricTile
          label="지난 회차"
          value={`${sum.overdue}건`}
          hint={sum.overdue > 0 ? fMan(sum.overdueAmount) : sum.next7 > 0 ? `7일 안 ${sum.next7}건` : '없음'}
          tone={sum.overdue > 0 ? 'danger' : sum.next7 > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2" role="tablist" data-testid="emp-detail-tabs">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-tab={t.key}
            onClick={() => setTab(t.key)}
            className={`tap t-sub rounded-(--radius-control) px-3 py-1.5 font-bold ${tab === t.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t.label}
            {t.key === 'employees' ? ` (${employees.length})` : t.key === 'notes' && meta.notes.length ? ` (${meta.notes.length})` : ''}
          </button>
        ))}
      </div>

      {tab !== 'employees' && metaBucket.rows === null && <p className="t-sub text-slate-400">읽는 중…</p>}
      {tab !== 'employees' && metaBucket.rows !== null && (() => {
        const props = { client, meta, patch: patchMeta, employees, programs, today }
        if (tab === 'overview') return <OverviewTab {...props} />
        if (tab === 'docs') return <CompanyDocsTab {...props} />
        if (tab === 'commission') return <CommissionTab {...props} />
        if (tab === 'notes') return <NotesTab {...props} />
        return <AgencyReportTab {...props} />
      })()}

      {tab === 'employees' && wizard && (
        <ExcelImportWizard clients={[{ id: client.id, companyName: client.companyName, businessNumber: client.businessNumber }]} programs={programs} employees={employees} onSave={onSave} fixedClientId={client.id} onClose={() => setWizard(false)} />
      )}

      {tab === 'employees' && form && (
        <Surface>
          <div className="flex flex-col gap-3">
            <span className="t-section text-slate-900">{form.id ? '대상자 고치기' : '대상자 넣기'}</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">이름</span>
                <input aria-label="이름" value={form.name} onChange={(e) => set('name', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">입사일</span>
                <input type="date" aria-label="입사일" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">생년월일 (나이 요건)</span>
                <input type="date" aria-label="생년월일" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">고용 형태</span>
                <select aria-label="고용 형태" value={form.empType} onChange={(e) => set('empType', e.target.value as EmpType)} className={`mt-1 ${inputCls}`}>
                  {EMP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">지원금 종류</span>
                <select aria-label="지원금 종류" value={form.programId} onChange={(e) => set('programId', e.target.value)} className={`mt-1 ${inputCls}`}>
                  {choices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">월 급여 (원)</span>
                <input aria-label="월 급여" inputMode="numeric" value={form.salary} onChange={(e) => set('salary', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">단계</span>
                <select aria-label="단계" value={form.stage} onChange={(e) => set('stage', e.target.value as EmpStage)} className={`mt-1 ${inputCls}`}>
                  {EMP_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">성별</span>
                <select aria-label="성별" value={form.gender} onChange={(e) => set('gender', e.target.value as EditForm['gender'])} className={`mt-1 ${inputCls}`}>
                  <option value="">선택 안 함</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">군복무 (개월 · 청년 나이 상한 연장)</span>
                <input aria-label="군복무 개월" inputMode="numeric" value={form.militaryMonths} onChange={(e) => set('militaryMonths', e.target.value.replace(/[^\d]/g, ''))} className={`mt-1 ${inputCls}`} />
              </label>
            </div>
            {Number(form.salary.replace(/[^\d]/g, '')) > 0 && Number(form.salary.replace(/[^\d]/g, '')) < MIN_WAGE_MONTH_2026 && (
              <p className="t-sub rounded-(--radius-control) bg-rose-50 px-3 py-2 break-keep text-danger-700" data-testid="emp-minwage-warn">
                ⚠️ 최저임금 미달 가능성이 있습니다. {programOf(form.programId)?.name?.includes('청년일자리도약') ? '최저임금 미달 가능성이 있어 청년일자리도약장려금 진행이 어려울 수 있습니다. ' : ''}(2026 월 환산 {MIN_WAGE_MONTH_2026.toLocaleString()}원)
              </p>
            )}
            {(() => {
              const info = meta.programInfos.find((x) => x.programId === form.programId)
              if (!info) return null
              const quota = Number(info.quota) || 0
              const cur = employees.filter((e) => e.programId === form.programId && e.stage !== 'resigned' && e.id !== form.id).length
              return (
                <p className={`t-sub rounded-(--radius-control) px-3 py-2 break-keep ${quota > 0 && cur + 1 > quota ? 'bg-rose-50 text-danger-700' : 'bg-slate-50 text-slate-600'}`}>
                  👥 {quota > 0 ? `지원한도: ${quota}명 (현재 ${cur}명 → 추가시 ${cur + 1}명)` : '지원한도 미입력'} · {info.agreementDate ? `협약 체결됨 ${fD(info.agreementDate)}` : '⚠️ 협약 미체결 — 신청 전 협약 필요'}
                  {info.applyDate && form.hireDate && (() => {
                    const diff = Math.abs((new Date(form.hireDate).getTime() - new Date(info.applyDate).getTime()) / (30.44 * 86400000))
                    return diff <= 3 ? ' · ✅ 참여신청일 기준 전후 3개월 이내' : ' · ⚠️ 참여신청일 기준 전후 3개월 범위 벗어남 — 운영기관 확인'
                  })()}
                </p>
              )
            })()}
            <div className="flex flex-col gap-1">
              <span className="t-sub font-medium text-slate-600">신청 전 확인</span>
              <div className="grid gap-1 sm:grid-cols-2">
                {ELIG_CHECKS.map((c) => (
                  <label key={c} className="t-sub flex items-center gap-2 text-slate-700">
                    <input type="checkbox" checked={!!form.eligChecks[c]} onChange={() => set('eligChecks', { ...form.eligChecks, [c]: !form.eligChecks[c] })} className="size-4" />
                    {c}
                  </label>
                ))}
              </div>
              <span className="t-meta text-slate-400">운영기관 또는 공고문 기준 추가 확인 필요</span>
            </div>
            <label className="block">
              <span className="t-sub font-medium text-slate-600">메모</span>
              <textarea aria-label="메모" rows={2} value={form.memo} onChange={(e) => set('memo', e.target.value)} className={`mt-1 ${inputCls}`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={submit} data-testid="emp-save">
                <Plus aria-hidden="true" className="size-4" /> 저장
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                그만두기
              </Button>
            </div>
            <p className="t-meta break-keep text-slate-400">주민등록번호는 넣지 않습니다. 나이 요건 판정에는 생년월일이면 충분합니다.</p>
          </div>
        </Surface>
      )}

      {tab === 'employees' && (employees.length === 0 ? (
        <Surface>
          <p className="t-sub break-keep text-slate-600">
            이 업체에는 아직 지원금 대상자가 없습니다. 위의 <b>대상자 넣기</b> 로 한 사람을 넣으면
            지원금 회차표가 입사일 기준으로 붙습니다.
          </p>
        </Surface>
      ) : (
        <Section
          title="대상자"
          count={employees.length}
          action={
            <span className="flex gap-1">
              <Button size="sm" variant={view === 'card' ? 'primary' : 'ghost'} onClick={() => setView('card')}>
                🗃️ 카드
              </Button>
              <Button size="sm" variant={view === 'table' ? 'primary' : 'ghost'} onClick={() => setView('table')} data-testid="emp-view-table">
                📋 표
              </Button>
            </span>
          }
        >
          {view === 'table' && (
            <div className="flex flex-col gap-2" data-testid="emp-table-wrap">
              {selected.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-brand-50 px-3 py-2">
                  <span className="t-sub font-bold">{selected.length}명 선택</span>
                  <span className="t-meta text-slate-500">상태 일괄 변경</span>
                  {EMP_STAGES.map((st) => (
                    <Button
                      key={st.key}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void Promise.all(employees.filter((e) => selected.includes(e.id)).map((e) => onSave({ ...e, stage: st.key }))).then(() => {
                          showToast(`${selected.length}명 상태가 변경되었습니다.`)
                          setSelected([])
                        })
                      }}
                    >
                      {st.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const rows = employees.filter((e) => selected.includes(e.id)).map((e) => [e.name, EMP_STAGES.find((x) => x.key === e.stage)?.label ?? '', programOf(e.programId)?.name ?? '', e.hireDate].join('\t'))
                      void navigator.clipboard?.writeText(rows.join('\n')).catch(() => undefined)
                      showToast('표로 복사했습니다.')
                    }}
                  >
                    표로 복사
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto rounded-(--radius-panel) border border-slate-200">
                <table className="w-full min-w-[44rem] t-sub" data-testid="emp-table">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label="모두 고르기"
                          checked={selected.length === employees.length && employees.length > 0}
                          onChange={() => setSelected(selected.length === employees.length ? [] : employees.map((e) => e.id))}
                        />
                      </th>
                      <th className="px-2 py-2">이름</th>
                      <th className="px-2 py-2">지원금</th>
                      <th className="px-2 py-2">상태</th>
                      <th className="px-2 py-2">입사일</th>
                      <th className="px-2 py-2">나이</th>
                      <th className="px-2 py-2">다음 신청</th>
                      <th className="px-2 py-2 text-right">받은 돈</th>
                      <th className="px-2 py-2 text-right">남은 예정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => {
                      const dd = empNextDday(e, today)
                      const age = e.birthDate ? Math.floor((new Date(e.hireDate || todayYmd()).getTime() - new Date(e.birthDate).getTime()) / (365.25 * 86400000)) : null
                      return (
                        <tr key={e.id} className="border-t border-slate-100">
                          <td className="px-2 py-2">
                            <input type="checkbox" aria-label={`${e.name} 고르기`} checked={selected.includes(e.id)} onChange={() => setSelected((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]))} />
                          </td>
                          <td className="px-2 py-2 font-bold">{e.name}</td>
                          <td className="px-2 py-2">{programOf(e.programId)?.name ?? '-'}</td>
                          <td className="px-2 py-2">{EMP_STAGES.find((x) => x.key === e.stage)?.label}</td>
                          <td className="px-2 py-2">{e.hireDate ? fD(e.hireDate) : '-'}</td>
                          <td className="px-2 py-2">{age !== null && !Number.isNaN(age) ? `${age}세` : '-'}</td>
                          <td className="px-2 py-2">{dd !== null ? <Badge tone={dd < 0 ? 'danger' : dd <= 7 ? 'warning' : 'neutral'}>{formatDday(dd)}</Badge> : '-'}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{fMan(e.rounds.reduce((x, r) => x + (r.isPaid ? r.received || r.amount || 0 : 0), 0))}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{fMan(empRemaining(e))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ul className={`flex flex-col gap-3 ${view === 'table' ? 'hidden' : ''}`} data-testid="emp-list">
            {employees.map((emp) => {
              const program = programOf(emp.programId)
              const dd = empNextDday(emp, today)
              const tone: Tone = dd !== null && dd < 0 ? 'danger' : dd !== null && dd <= 7 ? 'warning' : 'neutral'
              return (
                <li key={emp.id}>
                  <Surface as="div" edge={tone} showEdge={tone !== 'neutral'}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="t-card font-bold text-slate-900">{emp.name}</span>
                        <Badge tone="neutral">{program?.name ?? '지원금 미지정'}</Badge>
                        <span className="t-meta text-slate-500">{emp.empType}</span>
                        {emp.hireDate && <span className="t-meta text-slate-500">입사 {fD(emp.hireDate)}</span>}
                        <span className="t-meta text-slate-500">남은 예정 {fMan(empRemaining(emp))}</span>
                        {empNextDate(emp) && (
                          <Badge tone={tone}>
                            다음 {fD(empNextDate(emp))} {formatDday(dd)}
                          </Badge>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          <select
                            aria-label={`${emp.name} 단계`}
                            value={emp.stage}
                            onChange={(e) => void setStage(emp, e.target.value as EmpStage)}
                            className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1 t-meta text-slate-700"
                          >
                            {EMP_STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setForm({
                                id: emp.id,
                                name: emp.name,
                                hireDate: emp.hireDate,
                                birthDate: emp.birthDate,
                                empType: emp.empType,
                                programId: emp.programId || choices[0]?.id || '',
                                stage: emp.stage,
                                memo: emp.memo,
                                salary: emp.salary ? String(emp.salary) : '',
                                gender: emp.gender ?? '',
                                militaryMonths: emp.militaryMonths ? String(emp.militaryMonths) : '',
                                eligChecks: emp.eligChecks ?? {},
                              })
                            }
                          >
                            고치기
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void onRemove(emp.id)} aria-label={`${emp.name} 지우기`}>
                            <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                          </Button>
                        </span>
                      </div>

                      {emp.rounds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5" data-testid="emp-rounds">
                          {emp.rounds.map((r, i) => {
                            const date = emp.hireDate ? addMo(emp.hireDate, r.month) : ''
                            const rdd = date ? getDdayFrom(date, today) : null
                            const late = !r.isPaid && rdd !== null && rdd < 0
                            return (
                              <button
                                key={`${r.label}-${i}`}
                                type="button"
                                onClick={() => void toggleRound(emp, i)}
                                aria-pressed={r.isPaid}
                                className={`tap rounded-(--radius-control) border px-2.5 py-1.5 t-meta font-medium ${
                                  r.isPaid
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : late
                                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                                      : 'border-slate-300 bg-white text-slate-600'
                                }`}
                              >
                                {r.label} {date ? fD(date) : ''} {r.isPaid ? `· 받음${r.received && r.received !== r.amount ? ` ${fMan(r.received)}` : ''}` : `· ${fMan(r.amount)}`}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {emp.rounds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="t-meta text-slate-400">💳 수령 확인</span>
                          {emp.rounds.map((r, i) => (
                            <button
                              key={`e-${r.label}-${i}`}
                              type="button"
                              className="t-meta rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50"
                              onClick={() => setRoundEdit({ empId: emp.id, index: i, received: String(r.received || r.expectedAmount || r.amount || 0), paidDate: r.paidDate || todayYmd(), note: r.note ?? '' })}
                            >
                              {r.label} ✎
                            </button>
                          ))}
                        </div>
                      )}
                      {roundEdit && roundEdit.empId === emp.id && (
                        <div className="flex flex-wrap items-end gap-2 rounded-(--radius-control) bg-slate-50 p-2.5" data-testid="emp-round-editor">
                          <span className="t-sub font-bold">💳 {emp.name} · {emp.rounds[roundEdit.index]?.label}</span>
                          <label className="block">
                            <span className="t-meta text-slate-500">실제 수령액(원)</span>
                            <input aria-label="실제 수령액" inputMode="numeric" value={roundEdit.received} onChange={(e) => setRoundEdit({ ...roundEdit, received: e.target.value.replace(/[^\d]/g, '') })} className={inputCls} />
                          </label>
                          <label className="block">
                            <span className="t-meta text-slate-500">수령일</span>
                            <input type="date" aria-label="수령일" value={roundEdit.paidDate} onChange={(e) => setRoundEdit({ ...roundEdit, paidDate: e.target.value })} className={inputCls} />
                          </label>
                          <label className="block min-w-40 flex-1">
                            <span className="t-meta text-slate-500">메모</span>
                            <input aria-label="입금 메모" value={roundEdit.note} onChange={(e) => setRoundEdit({ ...roundEdit, note: e.target.value })} placeholder="입금 메모..." className={inputCls} />
                          </label>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              const rounds = emp.rounds.map((r, i) => (i === roundEdit.index ? { ...r, isPaid: true, received: Number(roundEdit.received) || 0, paidDate: roundEdit.paidDate, note: roundEdit.note } : r))
                              void onSave({ ...emp, rounds }).then(() => showToast('회차 지급 상태가 저장되었습니다.'))
                              setRoundEdit(null)
                            }}
                          >
                            ✅ 수령 확인
                          </Button>
                          {emp.rounds[roundEdit.index]?.isPaid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const rounds = emp.rounds.map((r, i) => (i === roundEdit.index ? { ...r, isPaid: false, received: 0, paidDate: '' } : r))
                                void onSave({ ...emp, rounds })
                                setRoundEdit(null)
                              }}
                            >
                              ❌ 미수령으로
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setRoundEdit(null)}>
                            취소
                          </Button>
                        </div>
                      )}

                      {emp.docs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {emp.docs.map((d, i) => (
                            <button
                              key={`${d.name}-${i}`}
                              type="button"
                              onClick={() => void toggleDoc(emp, i)}
                              aria-pressed={d.done}
                              className={`tap rounded-full border px-2.5 py-1 t-meta ${
                                d.done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'
                              }`}
                            >
                              {d.done ? '✓ ' : ''}
                              {d.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {emp.memo && <p className="t-meta break-keep text-slate-500">{emp.memo}</p>}
                    </div>
                  </Surface>
                </li>
              )
            })}
          </ul>
        </Section>
      ))}

      {busy !== '' && <p className="t-sub text-slate-500">{busy}</p>}

      {tab === 'employees' && employees.length > 0 && (
        <Section
          title="고객 보고서"
          action={
            <Button size="sm" onClick={() => void copyReport()}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? '복사됨' : '보고서 복사'}
            </Button>
          }
        >
          <Surface>
            <pre className="t-meta max-h-72 overflow-auto whitespace-pre-wrap break-keep text-slate-600" data-testid="emp-report">
              {report}
            </pre>
          </Surface>
          <div className="pt-3">
            <ToolResultAttach
              toolKey="employment"
              title="고용지원금 진행 현황"
              verdict={null}
              verdictLabel={`대상자 ${sum.active}명 · 남은 예정 ${fMan(sum.pipeline)}`}
              summary={report}
              data={{ tab: 'companies', clientId: client.id, employees: employees.length }}
              presetClientId={client.id}
            />
          </div>
        </Section>
      )}
    </div>
  )
}
