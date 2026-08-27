import {
  ArrowLeft,
  CircleDollarSign,
  ClipboardCheck,
  FileUp,
  FolderCheck,
  Landmark,
  Pencil,
} from 'lucide-react'
import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { organizationRepository, projectRepository } from '../repositories'
import { formatKrw } from '../lib/format'
import { useStoreVersion } from '../lib/useStoreVersion'
import {
  buildClientOperationsSummary,
  CLIENT_DOCUMENTS,
  CLIENT_SETUP_TASKS,
  getClientOperations,
  updateClientOperations,
  uploadClientDocument,
  type ClientDocumentKey,
} from '../services/clientOperationsService'
import { NotFoundState } from '../components/ui/NotFoundState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SummaryStrip } from '../components/ui/SummaryStrip'
import { TextField, inputClass } from '../components/form/fields'
import { useToast } from '../components/ui/toastContext'

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[0.78rem] font-semibold text-slate-400">{label}</dt><dd className="mt-1 text-[0.9rem] break-keep text-slate-700">{value || '-'}</dd></div>
}

function MoneyInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.82rem] font-semibold text-slate-600">{label}</span>
      <input type="number" min="0" inputMode="numeric" className={inputClass} value={value ?? ''} placeholder="금액 입력" onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
    </label>
  )
}

export function ClientOperationsWorkspacePage() {
  const { organizationId = '' } = useParams()
  const version = useStoreVersion()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocument = useRef<ClientDocumentKey | null>(null)

  void version
  const organization = organizationRepository.getById(organizationId)
  const projects = projectRepository.getByOrganizationId(organizationId)
  const record = organization ? getClientOperations(organization) : null

  if (!organization || !record) return <NotFoundState title="고객 운영 파일을 찾을 수 없습니다" description="고객사가 없거나 주소가 변경되었습니다." backTo="/ops/clients" backLabel="고객 운영으로 돌아가기" />

  const summary = buildClientOperationsSummary(record)
  const taskProgress = Math.round((summary.taskCompleted / summary.taskTotal) * 100)
  const docProgress = Math.round((summary.documentReceived / summary.documentTotal) * 100)
  const fundingProgress = Math.round((summary.fundingDocumentReceived / summary.fundingDocumentTotal) * 100)
  const currentProject = projects.find((project) => project.status === 'active' || project.status === 'waiting_client') ?? projects[0]

  const mutate = (callback: Parameters<typeof updateClientOperations>[1], message?: string) => {
    updateClientOperations(organization, callback)
    if (message) showToast(message)
  }
  const selectUpload = (key: ClientDocumentKey) => {
    pendingDocument.current = key
    fileInputRef.current?.click()
  }
  const upload = async (file: File | null) => {
    const key = pendingDocument.current
    pendingDocument.current = null
    if (!file || !key) return
    try {
      await uploadClientDocument(organization, key, file)
      showToast(`${file.name} 서류를 클라우드에 첨부했습니다.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '서류를 첨부하지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${organization.name} 운영 파일`}
        description="필수 업무, 수금, 서류, 정책자금 준비 상태를 고객사 단위로 관리합니다."
        actions={<><Link to="/ops/clients" className="inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-[0.95rem] font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft aria-hidden="true" className="size-4" />고객 운영</Link><Link to={`/clients/${organization.id}/edit`} className="inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-[0.95rem] font-medium text-slate-700 hover:bg-slate-50"><Pencil aria-hidden="true" className="size-4" />기본정보 수정</Link></>}
      />

      <SummaryStrip ariaLabel="고객 운영 파일 요약" items={[
        { key: 'tasks', label: '기본 업무 완료', value: summary.taskCompleted, unit: `/${summary.taskTotal}`, icon: ClipboardCheck, tone: taskProgress === 100 ? 'success' : 'info' },
        { key: 'documents', label: '서류 수령', value: summary.documentReceived, unit: `/${summary.documentTotal}`, icon: FolderCheck, tone: docProgress === 100 ? 'success' : 'warning' },
        { key: 'funding', label: '정책자금 증빙', value: summary.fundingDocumentReceived, unit: `/${summary.fundingDocumentTotal}`, icon: Landmark, tone: fundingProgress === 100 ? 'success' : 'accent' },
        { key: 'payment', label: '수금 확인 필요', value: summary.paymentAttentionCount, unit: '건', icon: CircleDollarSign, tone: summary.paymentAttentionCount ? 'danger' : 'success' },
      ]} />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <Panel title="기본 업무 진행">
            <p className="-mt-1 text-[0.88rem] text-slate-500">완료 체크와 일정·메모를 남겨 고객별 기본 세팅이 빠지지 않게 관리합니다.</p>
            <ol className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {CLIENT_SETUP_TASKS.map((task) => {
                const state = record.tasks[task.key]
                return <li key={task.key} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_150px_180px] lg:items-center">
                  <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={state.completed} onChange={(event) => mutate((current) => ({ ...current, tasks: { ...current.tasks, [task.key]: { ...current.tasks[task.key], completed: event.target.checked } } }), event.target.checked ? `${task.label} 완료 처리했습니다.` : `${task.label} 완료를 해제했습니다.`)} className="mt-1 size-4 accent-brand-600" /><span><span className="block text-[0.96rem] font-semibold text-slate-800">{task.label}</span><span className="mt-0.5 block text-[0.82rem] break-keep text-slate-500">{task.description}</span></span></label>
                  <input type="date" aria-label={`${task.label} 목표일`} value={state.dueDate} onChange={(event) => mutate((current) => ({ ...current, tasks: { ...current.tasks, [task.key]: { ...current.tasks[task.key], dueDate: event.target.value } } }), '목표일을 저장했습니다.')} className={inputClass} />
                  <input type="text" aria-label={`${task.label} 메모`} value={state.note} onChange={(event) => mutate((current) => ({ ...current, tasks: { ...current.tasks, [task.key]: { ...current.tasks[task.key], note: event.target.value } } }))} placeholder="다음 행동 또는 메모" className={inputClass} />
                </li>
              })}
            </ol>
          </Panel>

          <Panel title="필수 자료 수령·첨부">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[0.88rem] text-slate-500">수령 여부를 먼저 체크하고, 파일은 Supabase Storage에만 첨부합니다.</p><StatusBadge tone="neutral">인증서 비밀번호는 저장하지 않음</StatusBadge></div>
            <input ref={fileInputRef} type="file" className="sr-only" onChange={(event) => { void upload(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} />
            <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {CLIENT_DOCUMENTS.map((document) => {
                const state = record.documents[document.key]
                return <li key={document.key} className={`flex min-h-20 items-center gap-3 rounded-(--radius-card) border px-3.5 py-3 ${state.received ? 'border-success-200 bg-success-50/40' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" aria-label={`${document.label} 수령`} checked={state.received} onChange={(event) => mutate((current) => ({ ...current, documents: { ...current.documents, [document.key]: { ...current.documents[document.key], received: event.target.checked } } }), event.target.checked ? `${document.label} 수령 처리했습니다.` : `${document.label} 수령을 해제했습니다.`)} className="size-4 shrink-0 accent-brand-600" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[0.9rem] font-semibold text-slate-800">{document.label}</p><p className="mt-0.5 truncate text-[0.78rem] text-slate-500">{state.fileName ?? (document.requiredForFunding ? '정책자금 공통 증빙' : '수령 확인 필요')}</p></div>
                  <button type="button" onClick={() => selectUpload(document.key)} aria-label={`${document.label} 파일 첨부`} className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-brand-700"><FileUp aria-hidden="true" className="size-4" /></button>
                </li>
              })}
            </ul>
          </Panel>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="지금 확인할 것">
            <div className="rounded-(--radius-card) border border-brand-200 bg-brand-50/60 px-4 py-4"><p className="text-[0.82rem] font-semibold text-brand-700">운영 상태</p><p className="mt-1 text-[1.06rem] font-bold break-keep text-slate-900">{summary.paymentAttentionCount ? '수금 확인과 미수령 서류를 먼저 정리하세요.' : summary.missingLabels.length ? '미수령 서류를 한 번에 요청하세요.' : '기본 준비가 갖춰졌습니다.'}</p><p className="mt-2 text-[0.85rem] leading-relaxed break-keep text-slate-600">{summary.missingLabels.length ? `남은 자료: ${summary.missingLabels.join(', ')}` : '정책자금 또는 정부지원금 공고 확인 단계로 넘어갈 수 있습니다.'}</p></div>
            {currentProject && <Link to={`/projects/${currentProject.id}`} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.86rem] font-medium text-slate-700 hover:bg-slate-50">현재 프로젝트 열기</Link>}
          </Panel>

          <Panel title="계약·수금">
            <div className="grid grid-cols-2 gap-3"><MoneyInput label="계약금" value={record.contract.depositAmount} onChange={(amount) => mutate((current) => ({ ...current, contract: { ...current.contract, depositAmount: amount } }))} /><MoneyInput label="성공보수" value={record.contract.successFeeAmount} onChange={(amount) => mutate((current) => ({ ...current, contract: { ...current.contract, successFeeAmount: amount } }))} /></div>
            <div className="mt-4 space-y-3">
              {[['depositReceived', '계약금 수령', 'depositDueDate'] as const, ['successFeeReceived', '성공보수 수령', 'successFeeDueDate'] as const].map(([checkedKey, label, dueKey]) => <div key={checkedKey} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-3"><div className="flex items-center justify-between gap-2"><label className="inline-flex cursor-pointer items-center gap-2 text-[0.88rem] font-semibold text-slate-700"><input type="checkbox" checked={record.contract[checkedKey]} onChange={(event) => mutate((current) => ({ ...current, contract: { ...current.contract, [checkedKey]: event.target.checked } }), event.target.checked ? `${label} 완료 처리했습니다.` : `${label} 완료를 해제했습니다.`)} className="size-4 accent-brand-600" />{label}</label><span className="text-[0.78rem] text-slate-400">{checkedKey === 'depositReceived' ? formatKrw(record.contract.depositAmount ?? 0) : formatKrw(record.contract.successFeeAmount ?? 0)}</span></div><input type="date" aria-label={`${label} 예정일`} value={record.contract[dueKey]} onChange={(event) => mutate((current) => ({ ...current, contract: { ...current.contract, [dueKey]: event.target.value } }), '수금 예정일을 저장했습니다.')} className={`mt-2 ${inputClass}`} /></div>)}</div>
            <label className="mt-4 block"><span className="mb-1.5 block text-[0.82rem] font-semibold text-slate-600">수금 메모</span><textarea value={record.contract.note} onChange={(event) => mutate((current) => ({ ...current, contract: { ...current.contract, note: event.target.value } }))} rows={3} className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.9rem] text-slate-800" placeholder="세금계산서 발행, 입금 약속, 성공보수 기준 등을 기록" /></label>
          </Panel>

          <Panel title="기업 식별 정보">
            <dl className="grid grid-cols-1 gap-3"><Field label="사업자등록번호" value={organization.businessRegistrationNumber} /><Field label="대표자 연락처" value={record.representativePhone || organization.primaryContact.phone} /><Field label="사업장 주소" value={record.businessAddress || organization.address} /><Field label="법인번호" value={record.corporateNumber} /></dl>
            <div className="mt-4 border-t border-slate-100 pt-4"><TextField id="corporate-number" label="법인번호" value={record.corporateNumber} onChange={(event) => mutate((current) => ({ ...current, corporateNumber: event.target.value }))} /><TextField id="representative-phone" label="대표자 휴대폰" value={record.representativePhone} onChange={(event) => mutate((current) => ({ ...current, representativePhone: event.target.value }))} className="mt-3" /></div>
          </Panel>

          <Panel title="준비도"><div className="space-y-4">{[
            { label: '기본 업무', value: taskProgress, tone: 'info' as const },
            { label: '서류 수령', value: docProgress, tone: 'success' as const },
            { label: '정책자금 증빙', value: fundingProgress, tone: 'accent' as const },
          ].map((item) => <div key={item.label}><div className="flex justify-between text-[0.82rem] font-semibold text-slate-500"><span>{item.label}</span><span>{item.value}%</span></div><div className="mt-1.5"><ProgressBar value={item.value} tone={item.tone} label={item.label} /></div></div>)}</div></Panel>
        </aside>
      </section>
    </div>
  )
}
