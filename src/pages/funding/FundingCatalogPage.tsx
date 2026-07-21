import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, FileText, Landmark, Plus } from 'lucide-react'
import type {
  Institution,
  InstitutionCategory,
  InstitutionInput,
  SupportProgram,
  SupportProgramInput,
  SupportType,
} from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import {
  computeInstitutionFreshness,
  computeProgramFreshness,
} from '../../services/funding/freshnessEngine'
import {
  INSTITUTION_CATEGORIES,
  INSTITUTION_CATEGORY_META,
  SUPPORT_TYPE_META,
  SUPPORT_TYPES,
} from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  FreshnessBadge,
  InstitutionCategoryBadge,
  SourceStatusBadge,
  SupportTypeBadge,
} from '../../components/funding/badges'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500'

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function emptyInstitutionInput(name: string, category: InstitutionCategory, description: string, officialUrl: string): InstitutionInput {
  return {
    name,
    shortName: '',
    category,
    description,
    officialUrl,
    contactChannels: [],
    regions: [],
    targetIndustries: [],
    targetCompanyStages: [],
    targetCompanySizes: [],
    typicalReviewFocus: [],
    requiredBaselineEvidence: [],
    cautionNotes: '',
    sourceStatus: 'user_entered',
    lastVerifiedAt: null,
    validUntil: null,
    archivedAt: null,
  }
}

function emptyProgramInput(
  institutionId: string,
  name: string,
  supportType: SupportType,
  summary: string,
  amountDescription: string,
  scheduleDescription: string,
  officialUrl: string,
): SupportProgramInput {
  return {
    institutionId,
    name,
    supportType,
    summary,
    targetCompanies: '',
    targetIndustries: [],
    regions: [],
    companyAgeRules: '공식 공고 확인 필요',
    revenueRules: '공식 공고 확인 필요',
    employeeRules: '공식 공고 확인 필요',
    creditRules: '공식 공고 확인 필요',
    technologyRules: '공식 공고 확인 필요',
    certificationRules: '공식 공고 확인 필요',
    requiredDocuments: [],
    reviewFocus: [],
    disqualifiers: [],
    supportDescription: '',
    amountDescription,
    costShareDescription: '',
    scheduleDescription,
    applicationMethod: '',
    officialUrl,
    announcementUrl: '',
    sourceStatus: 'user_entered',
    lastVerifiedAt: null,
    validUntil: null,
    notes: '',
    isTemplate: false,
    archivedAt: null,
  }
}

export function FundingCatalogPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()
  const { showToast } = useToast()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [supportType, setSupportType] = useState('')

  const [instOpen, setInstOpen] = useState(false)
  const [progOpen, setProgOpen] = useState(false)

  const { institutions, programs } = useMemo(() => {
    return {
      institutions: institutionRepository.getAll(),
      programs: supportProgramRepository.getAll(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const instNameById = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions],
  )

  const q = query.trim().toLowerCase()
  const filteredInstitutions = institutions.filter((i) => {
    if (category && i.category !== category) return false
    if (q && !`${i.name} ${i.shortName} ${i.description}`.toLowerCase().includes(q)) return false
    return true
  })
  const filteredPrograms = programs.filter((p) => {
    if (supportType && p.supportType !== supportType) return false
    if (q && !`${p.name} ${p.summary}`.toLowerCase().includes(q)) return false
    return true
  })

  const hasActiveFilters = Boolean(query || category || supportType)
  const reset = () => {
    setQuery('')
    setCategory('')
    setSupportType('')
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/funding')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        기관·자금 연계
      </button>
      <PageHeader
        title="기관·프로그램 목록"
        description="연결을 검토할 기관과 지원 유형·프로그램을 모아 봅니다. 새 기관·프로그램을 직접 등록할 수 있습니다."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setInstOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              기관 등록
            </Button>
            <Button variant="primary" onClick={() => setProgOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              프로그램 등록
            </Button>
          </div>
        }
      />

      <div
        role="note"
        className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3"
      >
        <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
        <p className="text-[13px] break-keep text-warning-800">
          이 목록은 검토 참고용이며 실제 공고가 아닙니다. 실제 조건·금리·한도·접수기간은 각 기관의 공식 공고에서 반드시 확인해야 합니다.
        </p>
      </div>

      <FilterBar
        searchValue={query}
        searchPlaceholder="기관·프로그램명 검색"
        onSearchChange={setQuery}
        selects={[
          { key: 'category', ariaLabel: '기관 유형 필터', value: category, placeholder: '모든 기관 유형', onChange: setCategory, options: INSTITUTION_CATEGORIES.map((c) => ({ value: c, label: INSTITUTION_CATEGORY_META[c].label })) },
          { key: 'supportType', ariaLabel: '지원 유형 필터', value: supportType, placeholder: '모든 지원 유형', onChange: setSupportType, options: SUPPORT_TYPES.map((t) => ({ value: t, label: SUPPORT_TYPE_META[t].label })) },
        ]}
        onReset={reset}
        resultCount={filteredInstitutions.length + filteredPrograms.length}
        hasActiveFilters={hasActiveFilters}
      />

      <Panel title={`기관 목록 (${filteredInstitutions.length})`} flush>
        {filteredInstitutions.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={hasActiveFilters ? '조건에 맞는 기관이 없습니다' : '등록된 기관이 없습니다'}
            description={hasActiveFilters ? '필터를 초기화하면 전체 기관을 볼 수 있습니다.' : '기관 등록으로 검토할 기관을 추가하세요.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredInstitutions.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => navigate(`/funding/catalog/institutions/${inst.id}`)}
                aria-label={`${inst.name} 기관 상세`}
                className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold break-keep text-slate-900">{inst.name}</p>
                  <FreshnessBadge status={computeInstitutionFreshness(inst)} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <InstitutionCategoryBadge category={inst.category} />
                  <SourceStatusBadge status={inst.sourceStatus} />
                </div>
                {inst.typicalReviewFocus.length > 0 && (
                  <p className="line-clamp-2 text-xs text-slate-500">
                    참고 점검항목: {inst.typicalReviewFocus.join(', ')}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`지원 유형·프로그램 목록 (${filteredPrograms.length})`} flush>
        {filteredPrograms.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasActiveFilters ? '조건에 맞는 프로그램이 없습니다' : '등록된 프로그램이 없습니다'}
            description={hasActiveFilters ? '필터를 초기화하면 전체 프로그램을 볼 수 있습니다.' : '프로그램 등록으로 검토할 지원 프로그램을 추가하세요. 등록 정보는 실제 공고가 아닙니다.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500">프로그램</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500">지원 유형</th>
                  <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold text-slate-500 lg:table-cell">기관</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500">최신성</th>
                  <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold text-slate-500 xl:table-cell">출처</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrograms.map((prog) => (
                  <tr
                    key={prog.id}
                    tabIndex={0}
                    aria-label={`${prog.name} 프로그램 상세`}
                    onClick={() => navigate(`/funding/catalog/programs/${prog.id}`)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                        e.preventDefault()
                        navigate(`/funding/catalog/programs/${prog.id}`)
                      }
                    }}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{prog.name}</span>
                        {prog.isTemplate && (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">실제 공고 아님(템플릿)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><SupportTypeBadge type={prog.supportType} /></td>
                    <td className="hidden px-4 py-3.5 align-middle text-[13px] text-slate-600 lg:table-cell">{instNameById.get(prog.institutionId) ?? '알 수 없음'}</td>
                    <td className="px-4 py-3.5 align-middle"><FreshnessBadge status={computeProgramFreshness(prog)} /></td>
                    <td className="hidden px-4 py-3.5 align-middle xl:table-cell"><SourceStatusBadge status={prog.sourceStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <InstitutionCreateModal
        open={instOpen}
        onClose={() => setInstOpen(false)}
        onCreated={(inst) => {
          setInstOpen(false)
          showToast(`기관 "${inst.name}"을(를) 등록했습니다.`)
        }}
        onError={(message) => showToast(message)}
      />
      <ProgramCreateModal
        open={progOpen}
        institutions={institutions}
        onClose={() => setProgOpen(false)}
        onCreated={(prog) => {
          setProgOpen(false)
          showToast(`프로그램 "${prog.name}"을(를) 등록했습니다.`)
        }}
        onError={(message) => showToast(message)}
      />
    </div>
  )
}

function InstitutionCreateModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean
  onClose: () => void
  onCreated: (inst: Institution) => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<InstitutionCategory>('policy_finance')
  const [description, setDescription] = useState('')
  const [officialUrl, setOfficialUrl] = useState('')

  const resetForm = () => {
    setName('')
    setCategory('policy_finance')
    setDescription('')
    setOfficialUrl('')
  }

  const submit = () => {
    if (!name.trim()) {
      onError('기관명을 입력하세요.')
      return
    }
    try {
      const created = institutionRepository.create(
        emptyInstitutionInput(name.trim(), category, description.trim(), officialUrl.trim()),
      )
      resetForm()
      onCreated(created)
    } catch (err) {
      onError(err instanceof Error ? err.message : '기관 등록 중 오류가 발생했습니다.')
    }
  }

  return (
    <Modal
      open={open}
      title="기관 등록"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>등록</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="기관명" htmlFor="inst-name">
          <input id="inst-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: OO신용보증재단" />
        </Field>
        <Field label="기관 유형" htmlFor="inst-category">
          <select id="inst-category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as InstitutionCategory)}>
            {INSTITUTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{INSTITUTION_CATEGORY_META[c].label}</option>
            ))}
          </select>
        </Field>
        <Field label="설명" htmlFor="inst-desc">
          <textarea id="inst-desc" rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="기관 소개·역할" />
        </Field>
        <Field label="공식 URL" htmlFor="inst-url" hint="공식 누리집 주소를 입력하면 최신성 확인에 도움이 됩니다.">
          <input id="inst-url" className={inputClass} value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} placeholder="https://" />
        </Field>
        <p className="text-xs text-slate-400">출처 상태는 "직접 입력"으로 저장됩니다. 이후 상세 화면에서 확인일·유효기간을 갱신하세요.</p>
      </div>
    </Modal>
  )
}

function ProgramCreateModal({
  open,
  institutions,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean
  institutions: Institution[]
  onClose: () => void
  onCreated: (prog: SupportProgram) => void
  onError: (message: string) => void
}) {
  const [institutionId, setInstitutionId] = useState('')
  const [name, setName] = useState('')
  const [supportType, setSupportType] = useState<SupportType>('loan')
  const [summary, setSummary] = useState('')
  const [amountDescription, setAmountDescription] = useState('')
  const [scheduleDescription, setScheduleDescription] = useState('')
  const [officialUrl, setOfficialUrl] = useState('')

  const resetForm = () => {
    setInstitutionId('')
    setName('')
    setSupportType('loan')
    setSummary('')
    setAmountDescription('')
    setScheduleDescription('')
    setOfficialUrl('')
  }

  const submit = () => {
    if (!institutionId) {
      onError('연결할 기관을 선택하세요.')
      return
    }
    if (!name.trim()) {
      onError('프로그램명을 입력하세요.')
      return
    }
    try {
      const created = supportProgramRepository.create(
        emptyProgramInput(
          institutionId,
          name.trim(),
          supportType,
          summary.trim(),
          amountDescription.trim(),
          scheduleDescription.trim(),
          officialUrl.trim(),
        ),
      )
      resetForm()
      onCreated(created)
    } catch (err) {
      onError(err instanceof Error ? err.message : '프로그램 등록 중 오류가 발생했습니다.')
    }
  }

  return (
    <Modal
      open={open}
      title="프로그램 등록"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={institutions.length === 0}>등록</Button>
        </>
      }
    >
      {institutions.length === 0 ? (
        <p className="text-[13px] text-warning-700">먼저 기관을 등록해야 프로그램을 연결할 수 있습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="연결 기관" htmlFor="prog-inst">
            <select id="prog-inst" className={inputClass} value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
              <option value="">기관 선택</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </Field>
          <Field label="프로그램명" htmlFor="prog-name">
            <input id="prog-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 창업기업 운전자금 융자" />
          </Field>
          <Field label="지원 유형" htmlFor="prog-type">
            <select id="prog-type" className={inputClass} value={supportType} onChange={(e) => setSupportType(e.target.value as SupportType)}>
              {SUPPORT_TYPES.map((t) => (
                <option key={t} value={t}>{SUPPORT_TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
          <Field label="요약" htmlFor="prog-summary">
            <textarea id="prog-summary" rows={2} className={inputClass} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="프로그램 개요" />
          </Field>
          <Field label="지원 규모(설명)" htmlFor="prog-amount" hint="근거 없는 금액은 자동 생성하지 않습니다. 확인 전에는 비워 두세요.">
            <input id="prog-amount" className={inputClass} value={amountDescription} onChange={(e) => setAmountDescription(e.target.value)} placeholder="공식 공고 확인 필요" />
          </Field>
          <Field label="접수 일정(설명)" htmlFor="prog-schedule" hint="접수일은 자동으로 만들지 않습니다.">
            <input id="prog-schedule" className={inputClass} value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} placeholder="공식 공고 확인 필요" />
          </Field>
          <Field label="공식 URL" htmlFor="prog-url">
            <input id="prog-url" className={inputClass} value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} placeholder="https://" />
          </Field>
        </div>
      )}
    </Modal>
  )
}
