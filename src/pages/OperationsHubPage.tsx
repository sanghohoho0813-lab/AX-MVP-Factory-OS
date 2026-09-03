import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarDays,
  CirclePlus,
  ClipboardCheck,
  Download,
  RefreshCw,
  Search,
  Upload,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getDataModeConfig } from '../data/dataMode'
import { CloudUpload } from 'lucide-react'
import { createClient, listClients, readLocalClients, replaceAllClients } from '../services/clientOpsService'
import { downloadBackup, mergeBackup, parseBackup, type MergeMode } from '../services/clientOpsBackup'
import {
  buildAllAlerts,
  clientOpsProgress,
  sortClientsByUrgency,
  summarizeAlerts,
} from '../services/clientOpsAlerts'
import { DUE_SOON_DAYS, SERVICES } from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'
import { formatKrw } from '../lib/format'
import type { ClientOpsRecord, OpsAlert, AlertSeverity } from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  AlertRow,
  ClientStatusChip,
  SEVERITY_META,
  ServiceCell,
  StatTile,
  cellStateFor,
} from '../components/ops/opsParts'
import { ACCENT_CLASS, SERVICE_STATUS_LABEL } from '../content/clientOpsCatalog'

const SEVERITY_TABS: { key: AlertSeverity | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'critical', label: '지금 처리' },
  { key: 'warning', label: '곧 처리' },
  { key: 'info', label: '참고' },
]

function OperationsHubContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<AlertSeverity | 'all'>('all')
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [form, setForm] = useState({ companyName: '', contactName: '', contactPhone: '', businessNumber: '' })
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [leftover, setLeftover] = useState<ClientOpsRecord[]>([])
  const [migrating, setMigrating] = useState(false)
  /** 백업 파일을 읽은 뒤 합칠지/바꿀지 묻는 단계 */
  const [restorePrompt, setRestorePrompt] = useState<ClientOpsRecord[] | null>(null)
  const { showToast } = useToast()
  const restoreRef = useRef<HTMLInputElement>(null)

  const today = todayLocalDate()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setRecords(await listClients(workspaceId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고객 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  // 클라우드 모드인데 이 브라우저에 예전 로컬 데이터가 남아 있으면 옮기도록 안내한다
  useEffect(() => {
    if (getDataModeConfig().mode !== 'supabase') return
    try {
      setLeftover(readLocalClients())
    } catch {
      setLeftover([])
    }
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (!showArchived && r.archivedAt !== null) return false
      if (showArchived && r.archivedAt === null) return false
      if (q === '') return true
      return [r.companyName, r.contactName, r.businessNumber, r.industry, r.businessAddress]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [records, query, showArchived])
  const archivedCount = records.filter((r) => r.archivedAt !== null).length

  const ordered = useMemo(() => sortClientsByUrgency(visible, today), [visible, today])
  const alerts = useMemo(() => buildAllAlerts(records, today), [records, today])
  const summary = useMemo(() => summarizeAlerts(alerts), [alerts])
  const visibleAlerts = useMemo(
    () => (tab === 'all' ? alerts : alerts.filter((a) => a.severity === tab)),
    [alerts, tab],
  )
  const shownAlerts = showAllAlerts ? visibleAlerts : visibleAlerts.slice(0, 8)

  const money = useMemo(() => {
    let unpaid = 0
    let overdueCount = 0
    for (const r of records) {
      const p = clientOpsProgress(r, today)
      unpaid += p.unpaidAmount
      overdueCount += p.overduePayments
    }
    return { unpaid, overdueCount }
  }, [records, today])

  const activeCount = records.filter((r) => r.status === 'active' || r.status === 'waiting').length

  const openAlert = (a: OpsAlert) => navigate(`/ops/clients/${a.clientId}`)

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setRestorePrompt(parseBackup(await file.text()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '백업을 불러오지 못했습니다.')
    } finally {
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  const applyRestore = async (mode: MergeMode) => {
    const incoming = restorePrompt
    if (!incoming) return
    setRestoring(true)
    setError('')
    try {
      const result = mergeBackup(records, incoming, mode)
      await replaceAllClients(workspaceId, result.records)
      await load()
      setRestorePrompt(null)
      showToast(
        mode === 'merge'
          ? `복원했습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳 · 유지 ${result.kept}곳`
          : `백업 내용으로 바꿨습니다. 고객 ${result.records.length}곳`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '백업을 불러오지 못했습니다.')
    } finally {
      setRestoring(false)
    }
  }

  const migrateLocal = async () => {
    if (leftover.length === 0) return
    setMigrating(true)
    setError('')
    try {
      const result = mergeBackup(records, leftover, 'merge')
      await replaceAllClients(workspaceId, result.records)
      await load()
      setLeftover([])
      showToast(`이 브라우저에 있던 고객 ${leftover.length}곳을 클라우드로 옮겼습니다. 추가 ${result.added}곳 · 갱신 ${result.updated}곳. 브라우저 원본은 그대로 남아 있습니다.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '옮기지 못했습니다.')
    } finally {
      setMigrating(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.companyName.trim()) return
    try {
      setSaving(true)
      const record = await createClient(workspaceId, form)
      navigate(`/ops/clients/${record.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고객을 등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="고객 운영 현황"
        description={`오늘 ${today} · 여러 업체를 한 화면에서 보고, 빠뜨린 일이 없는지 확인합니다.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/ops/calendar')}>
              <CalendarDays aria-hidden="true" className="size-4" />
              일정
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                downloadBackup(records, today)
                setError('')
              }}
              disabled={records.length === 0}
            >
              <Download aria-hidden="true" className="size-4" />
              백업 내려받기
            </Button>
            <Button variant="secondary" onClick={() => restoreRef.current?.click()} disabled={restoring}>
              <Upload aria-hidden="true" className="size-4" />
              {restoring ? '복원 중…' : '백업 불러오기'}
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw aria-hidden="true" className="size-4" />
              새로고침
            </Button>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <CirclePlus aria-hidden="true" className="size-4" />새 업체 등록
            </Button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700"
        >
          {error}
        </div>
      )}

      {leftover.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-(--radius-panel) border border-brand-200 bg-brand-50/70 px-4 py-3.5">
          <CloudUpload aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1 text-[0.98rem] break-keep text-slate-800">
            이 브라우저에 예전에 입력한 고객 <strong>{leftover.length}곳</strong>이 남아 있습니다. 클라우드로 옮기면 휴대폰·다른 PC에서도 볼 수 있습니다.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="primary" onClick={() => void migrateLocal()} disabled={migrating}>
              <CloudUpload aria-hidden="true" className="size-4" />
              {migrating ? '옮기는 중…' : '클라우드로 옮기기'}
            </Button>
            <Button variant="ghost" onClick={() => setLeftover([])}>
              나중에
            </Button>
          </div>
        </div>
      )}

      <input
        ref={restoreRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onRestoreFile(e.target.files?.[0])}
      />

      <Modal
        open={restorePrompt !== null}
        title="백업 불러오기"
        onClose={() => { if (!restoring) setRestorePrompt(null) }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestorePrompt(null)} disabled={restoring}>취소</Button>
            <Button variant="secondary" onClick={() => void applyRestore('replace')} disabled={restoring}>백업 내용으로 전부 바꾸기</Button>
            <Button variant="primary" onClick={() => void applyRestore('merge')} disabled={restoring}>{restoring ? '복원 중…' : '지금 데이터와 합치기'}</Button>
          </>
        }
      >
        <p className="text-[0.98rem] break-keep text-slate-700">백업에 고객 {restorePrompt?.length ?? 0}곳이 들어 있습니다.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.92rem] break-keep text-slate-600">
          <li><strong>합치기</strong> — 같은 업체는 최근에 수정한 쪽을 남기고, 없던 업체는 추가합니다.</li>
          <li><strong>전부 바꾸기</strong> — 지금 목록을 지우고 백업 내용으로 채웁니다. 되돌릴 수 없습니다.</li>
        </ul>
      </Modal>

      {/* 검색 · 보관 */}
      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="업체명·대표자·사업자번호로 찾기"
              aria-label="업체 검색"
              className="w-full rounded-(--radius-control) border border-slate-300 py-2 pr-3 pl-9 text-[0.98rem] focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            aria-pressed={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-2 text-[0.92rem] font-medium ${
              showArchived
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Archive aria-hidden="true" className="size-4" />
            보관함 {archivedCount}
          </button>
          {query !== '' && (
            <span className="text-[0.9rem] text-slate-500">{visible.length}곳 찾음</span>
          )}
        </div>
      )}

      {/* 요약 */}
      <section aria-label="요약" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="지금 처리할 일"
          value={`${summary.critical}건`}
          tone={summary.critical > 0 ? 'danger' : 'success'}
          hint={summary.critical > 0 ? '마감이 지났거나 서류가 없습니다' : '급한 일이 없습니다'}
          icon={AlertTriangle}
        />
        <StatTile
          label="곧 처리할 일"
          value={`${summary.warning}건`}
          tone={summary.warning > 0 ? 'warning' : 'neutral'}
          hint={`${DUE_SOON_DAYS}일 이내 마감·만료`}
          icon={ClipboardCheck}
        />
        <StatTile label="관리 중인 업체" value={`${activeCount}곳`} hint={`전체 ${records.length}곳`} icon={Building2} />
        <StatTile
          label="아직 못 받은 돈"
          value={formatKrw(money.unpaid)}
          tone={money.overdueCount > 0 ? 'danger' : 'neutral'}
          hint={money.overdueCount > 0 ? `예정일 지난 건 ${money.overdueCount}건` : '연체 없음'}
          icon={Wallet}
        />
      </section>

      {/* A. 지금 챙길 것 */}
      <section
        aria-labelledby="ops-alerts"
        className={`flex-col gap-3 ${records.length === 0 ? 'hidden' : 'flex'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ops-alerts" className="text-[1.3rem] font-bold text-slate-900">
            지금 챙길 것
          </h2>
          <div className="flex flex-wrap gap-1">
            {SEVERITY_TABS.map((t) => {
              const count =
                t.key === 'all'
                  ? alerts.length
                  : alerts.filter((a) => a.severity === t.key).length
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tab === t.key}
                  onClick={() => {
                    setTab(t.key)
                    setShowAllAlerts(false)
                  }}
                  className={`rounded-(--radius-control) border px-3 py-1.5 text-[0.9rem] font-medium ${
                    tab === t.key
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label} {count}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-8 text-[0.95rem] text-slate-500">
            불러오는 중…
          </p>
        ) : visibleAlerts.length === 0 ? (
          <div className="rounded-(--radius-panel) border border-success-200 bg-success-50/60 px-5 py-8 text-center">
            <ClipboardCheck aria-hidden="true" className="mx-auto size-8 text-success-600" />
            <p className="mt-2 text-[1.05rem] font-semibold text-slate-800">
              {tab === 'all' ? '지금 급하게 챙길 일이 없습니다' : '이 분류에는 항목이 없습니다'}
            </p>
            <p className="mt-1 text-[0.95rem] break-keep text-slate-600">
              {tab === 'all'
                ? '마감이 지난 일, 빠진 서류, 못 받은 돈이 모두 없습니다.'
                : '다른 분류를 눌러 확인해 보세요.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {shownAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} onOpen={openAlert} />
              ))}
            </ul>
            {visibleAlerts.length > shownAlerts.length && (
              <button
                type="button"
                onClick={() => setShowAllAlerts(true)}
                className="self-start rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.92rem] font-medium text-slate-600 hover:bg-slate-50"
              >
                {visibleAlerts.length - shownAlerts.length}건 더 보기
              </button>
            )}
          </>
        )}
      </section>

      {/* B. 업체별 현황표 */}
      <section aria-labelledby="ops-matrix" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ops-matrix" className="text-[1.3rem] font-bold text-slate-900">
            업체별 현황표
          </h2>
          <p className="text-[0.9rem] text-slate-500">칸을 누르면 해당 업체 화면으로 이동합니다.</p>
        </div>

        {records.length === 0 ? (
          <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
            <Building2 aria-hidden="true" className="mx-auto size-9 text-brand-400" />
            <p className="mt-3 text-[1.25rem] font-bold text-slate-900">첫 업체를 등록해 보세요</p>
            <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">
              업체를 만들면 법인설립·업종추가·특허·벤처인증·AX 개발·정책자금 6가지 업무와 서류 10종이 자동으로 준비됩니다.
              이후에는 마감이 지났거나 서류가 빠진 것을 이 화면이 알아서 찾아 올려 드립니다.
            </p>
            <Button variant="primary" className="mt-5" onClick={() => setFormOpen(true)}>
              <CirclePlus aria-hidden="true" className="size-4" />첫 업체 등록
            </Button>
          </div>
        ) : (
          <>
          {/* 모바일: 카드 목록 (표 가로 스크롤 대신) */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {ordered.map((record) => {
              const p = clientOpsProgress(record, today)
              const critical = summary.criticalByClient[record.id] ?? 0
              const openServices = SERVICES.filter((s) => {
                const st = record.services[s.key].status
                return st !== 'not_started' && st !== 'not_applicable'
              })
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/ops/clients/${record.id}`)}
                    className="flex w-full flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[1.1rem] font-bold break-keep text-slate-900">
                        {record.companyName || '(이름 없음)'}
                      </span>
                      {critical > 0 && (
                        <span className="rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 text-[0.78rem] font-bold text-danger-700">
                          지금 처리 {critical}건
                        </span>
                      )}
                      <ClientStatusChip status={record.status} />
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {openServices.length === 0 ? (
                        <span className="text-[0.9rem] text-slate-500">아직 시작한 업무가 없습니다</span>
                      ) : (
                        openServices.map((s) => {
                          const cell = cellStateFor(record, s.key, today, DUE_SOON_DAYS)
                          const danger = cell.overdue || cell.blocked
                          return (
                            <span
                              key={s.key}
                              className={`rounded-full border px-2 py-0.5 text-[0.82rem] font-medium ${
                                danger
                                  ? 'border-danger-200 bg-danger-50 text-danger-700'
                                  : cell.dueSoon
                                    ? 'border-warning-200 bg-warning-50 text-warning-800'
                                    : cell.status === 'done'
                                      ? 'border-success-200 bg-success-50 text-success-700'
                                      : ACCENT_CLASS[s.accent].chip
                              }`}
                            >
                              {s.shortLabel} · {cell.blocked ? '서류 없음' : SERVICE_STATUS_LABEL[cell.status]}
                            </span>
                          )
                        })
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-slate-500">
                      <span>진행 {p.percent}%</span>
                      <span>
                        서류 {p.documentsUsable}/{p.documentsTotal}
                      </span>
                      {p.unpaidAmount > 0 && (
                        <span className={p.overduePayments > 0 ? 'font-semibold text-danger-700' : ''}>
                          미수금 {formatKrw(p.unpaidAmount)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* 데스크톱: 현황표 */}
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white lg:block">
            <table className="w-full min-w-[900px] border-collapse">
              <caption className="sr-only">업체별 표준 업무 진행 현황</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-slate-50/80 px-4 py-3 text-left text-[0.92rem] font-semibold text-slate-600"
                  >
                    업체
                  </th>
                  {SERVICES.map((s) => (
                    <th
                      key={s.key}
                      scope="col"
                      className="px-2 py-3 text-center text-[0.92rem] font-semibold text-slate-600"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className={`size-2 rounded-full ${ACCENT_CLASS[s.accent].dot}`} />
                        {s.shortLabel}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-3 text-center text-[0.92rem] font-semibold text-slate-600">
                    서류
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-[0.92rem] font-semibold text-slate-600">
                    미수금
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((record) => {
                  const p = clientOpsProgress(record, today)
                  const critical = summary.criticalByClient[record.id] ?? 0
                  return (
                    <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-4 py-3 text-left align-top"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/ops/clients/${record.id}`)}
                          className="text-left"
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[1.02rem] font-bold break-keep text-slate-900 hover:text-brand-700 hover:underline">
                              {record.companyName || '(이름 없음)'}
                            </span>
                            {critical > 0 && (
                              <span className="rounded-full border border-danger-200 bg-danger-100 px-1.5 py-0.5 text-[0.78rem] font-bold text-danger-700">
                                !{critical}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <ClientStatusChip status={record.status} />
                            <span className="text-[0.85rem] text-slate-500">진행 {p.percent}%</span>
                          </span>
                        </button>
                      </th>

                      {SERVICES.map((s) => (
                        <td key={s.key} className="px-1.5 py-3 align-top">
                          <ServiceCell
                            cell={cellStateFor(record, s.key, today, DUE_SOON_DAYS)}
                            label={s.label}
                            onClick={() => navigate(`/ops/clients/${record.id}#${s.key}`)}
                          />
                        </td>
                      ))}

                      <td className="px-3 py-3 text-center align-top">
                        <span
                          className={`text-[0.95rem] font-semibold ${
                            p.documentsUsable < p.documentsTotal ? 'text-slate-800' : 'text-success-700'
                          }`}
                        >
                          {p.documentsUsable}/{p.documentsTotal}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <span
                          className={`text-[0.95rem] font-semibold ${
                            p.overduePayments > 0 ? 'text-danger-700' : 'text-slate-700'
                          }`}
                        >
                          {p.unpaidAmount > 0 ? formatKrw(p.unpaidAmount) : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* 범례 */}
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem] text-slate-500 lg:flex">
          <span className="font-medium text-slate-600">표 보는 법:</span>
          <span>완료 = 끝난 업무</span>
          <span>진행/준비/접수 = 하는 중</span>
          <span>대기 = 고객 회신 기다리는 중</span>
          <span className="text-danger-700">빨강 = 마감 지났거나 서류가 없어 막힘</span>
          <span className="text-warning-800">노랑 = 마감 임박</span>
        </div>
      </section>

      {/* 새 업체 등록 */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-4 sm:items-center">
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-(--radius-panel) bg-white p-6 shadow-(--shadow-overlay)"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[1.3rem] font-bold text-slate-900">새 업체 등록</h2>
              <button
                type="button"
                className="text-[0.95rem] text-slate-500 hover:text-slate-800"
                onClick={() => setFormOpen(false)}
              >
                닫기
              </button>
            </div>
            <p className="mt-1 text-[0.95rem] break-keep text-slate-500">
              업체명만 넣어도 됩니다. 나머지는 나중에 채울 수 있습니다.
            </p>
            <div className="mt-5 grid gap-4">
              <label className="text-[0.95rem] font-medium text-slate-700">
                업체명
                <input
                  autoFocus
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-[0.95rem] font-medium text-slate-700">
                  대표자·담당자
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                </label>
                <label className="text-[0.95rem] font-medium text-slate-700">
                  휴대폰번호
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                  />
                </label>
              </div>
              <label className="text-[0.95rem] font-medium text-slate-700">
                사업자등록번호
                <input
                  value={form.businessNumber}
                  onChange={(e) => setForm({ ...form, businessNumber: e.target.value })}
                  placeholder="000-00-00000"
                  className="mt-1.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? '등록 중…' : '등록하고 열기'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <p className="pb-2 text-[0.85rem] text-slate-400">
        {SEVERITY_META.critical.label}·{SEVERITY_META.warning.label} 판단 기준: 마감 {DUE_SOON_DAYS}일 이내, 서류 유효기간 30일 이내,
        고객 회신 7일 이상 대기.
      </p>
    </div>
  )
}

function CloudOperationsHub() {
  const { currentWorkspaceId } = useAuth()
  return <OperationsHubContent workspaceId={currentWorkspaceId} />
}

export function OperationsHubPage() {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudOperationsHub />
  ) : (
    <OperationsHubContent workspaceId={null} />
  )
}
