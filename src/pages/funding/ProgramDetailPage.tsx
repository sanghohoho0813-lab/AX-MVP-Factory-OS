import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Pencil } from 'lucide-react'
import type { SourceStatus, SupportProgram } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { computeProgramFreshness } from '../../services/funding/freshnessEngine'
import { SOURCE_STATUS_META, SOURCE_STATUSES } from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Modal } from '../../components/ui/Modal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { FreshnessBadge, SourceStatusBadge, SupportTypeBadge } from '../../components/funding/badges'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500'

function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}
function dateInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-[13px] font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm break-keep text-slate-700">{children}</dd>
    </div>
  )
}

function Text({ value }: { value: string }) {
  return value ? <span>{value}</span> : <span className="text-slate-400">공식 공고 확인 필요</span>
}

function StringList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-slate-400">{empty}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] text-slate-600">{item}</span>
      ))}
    </div>
  )
}

export function ProgramDetailPage() {
  const { programId = '' } = useParams()
  const navigate = useNavigate()
  const version = useStoreVersion()
  const { showToast } = useToast()
  const [editOpen, setEditOpen] = useState(false)

  const { program, institutionName } = useMemo(() => {
    const prog = supportProgramRepository.getById(programId)
    return {
      program: prog,
      institutionName: prog ? institutionRepository.getById(prog.institutionId)?.name ?? null : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, version])

  if (!program) {
    return (
      <NotFoundState
        title="프로그램을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로그램입니다."
        backTo="/funding/catalog"
        backLabel="기관·프로그램 목록으로"
      />
    )
  }

  const freshness = computeProgramFreshness(program)

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/funding/catalog"
        backLabel="기관·프로그램 목록"
        title={program.name}
        badges={
          <>
            <SupportTypeBadge type={program.supportType} />
            <SourceStatusBadge status={program.sourceStatus} />
            <FreshnessBadge status={freshness} />
            {program.isTemplate && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">검토용 템플릿 · 실제 공고 아님</span>
            )}
          </>
        }
        meta={
          program.institutionId ? (
            <button
              type="button"
              onClick={() => navigate(`/funding/catalog/institutions/${program.institutionId}`)}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              {institutionName ?? '기관 보기'}
            </button>
          ) : (
            <span>기관 미연결</span>
          )
        }
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" className="size-4" />
            정보 수정
          </Button>
        }
      />

      <div
        aria-live="polite"
        className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
        <p className="text-[13px] break-keep text-warning-800">
          지원 규모·금리·한도·접수 일정은 공식 공고 확인 필요 항목입니다. 이 화면은 실제 공고가 아니며 승인 여부·금액을 보장하지 않습니다.
        </p>
      </div>

      <Panel title="프로그램 개요">
        <dl className="flex flex-col">
          <InfoRow label="지원 유형"><SupportTypeBadge type={program.supportType} /></InfoRow>
          <InfoRow label="연결 기관">
            {program.institutionId ? (
              <button type="button" onClick={() => navigate(`/funding/catalog/institutions/${program.institutionId}`)} className="font-medium text-brand-600 hover:text-brand-700 hover:underline">
                {institutionName ?? '기관 보기'}
              </button>
            ) : (
              <span className="text-slate-400">기관 미연결</span>
            )}
          </InfoRow>
          <InfoRow label="요약">{program.summary || <span className="text-slate-400">요약 없음</span>}</InfoRow>
          <InfoRow label="지원 대상">{program.targetCompanies || <span className="text-slate-400">공식 공고 확인 필요</span>}</InfoRow>
          <InfoRow label="지원 내용">{program.supportDescription || <span className="text-slate-400">공식 공고 확인 필요</span>}</InfoRow>
          <InfoRow label="지원 규모(설명)"><Text value={program.amountDescription} /></InfoRow>
          <InfoRow label="접수 일정(설명)"><Text value={program.scheduleDescription} /></InfoRow>
          <InfoRow label="신청 방법">{program.applicationMethod || <span className="text-slate-400">공식 공고 확인 필요</span>}</InfoRow>
        </dl>
      </Panel>

      <Panel title="요건·심사 (참고용 · 공식 공고 확인 필요)">
        <dl className="flex flex-col">
          <InfoRow label="업력 요건"><Text value={program.companyAgeRules} /></InfoRow>
          <InfoRow label="매출 요건"><Text value={program.revenueRules} /></InfoRow>
          <InfoRow label="종업원 요건"><Text value={program.employeeRules} /></InfoRow>
          <InfoRow label="신용 요건"><Text value={program.creditRules} /></InfoRow>
          <InfoRow label="기술 요건"><Text value={program.technologyRules} /></InfoRow>
          <InfoRow label="인증 요건"><Text value={program.certificationRules} /></InfoRow>
          <InfoRow label="필요 서류"><StringList items={program.requiredDocuments} empty="공식 공고 확인 필요" /></InfoRow>
          <InfoRow label="심사 초점"><StringList items={program.reviewFocus} empty="공식 공고 확인 필요" /></InfoRow>
          <InfoRow label="결격 사유"><StringList items={program.disqualifiers} empty="공식 공고 확인 필요" /></InfoRow>
        </dl>
      </Panel>

      <Panel title="출처·최신성">
        <dl className="flex flex-col">
          <InfoRow label="출처 상태"><SourceStatusBadge status={program.sourceStatus} /></InfoRow>
          <InfoRow label="최신성"><FreshnessBadge status={freshness} /></InfoRow>
          <InfoRow label="확인일">{program.lastVerifiedAt ? formatDate(program.lastVerifiedAt) : <span className="text-warning-700">확인일 없음</span>}</InfoRow>
          <InfoRow label="유효기간">{program.validUntil ? formatDate(program.validUntil) : <span className="text-slate-400">유효기간 없음</span>}</InfoRow>
          <InfoRow label="공식 URL">
            {program.officialUrl ? (
              <a href={program.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                {program.officialUrl}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning-700"><AlertTriangle aria-hidden="true" className="size-3.5" />공식 URL 없음</span>
            )}
          </InfoRow>
          <InfoRow label="공고 URL">
            {program.announcementUrl ? (
              <a href={program.announcementUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                {program.announcementUrl}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning-700"><AlertTriangle aria-hidden="true" className="size-3.5" />공고 URL 없음</span>
            )}
          </InfoRow>
        </dl>
      </Panel>

      <EditProgramModal
        open={editOpen}
        program={program}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          showToast('프로그램 정보를 저장했습니다.')
        }}
        onError={(message) => showToast(message)}
      />
    </div>
  )
}

function EditProgramModal({
  open,
  program,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  program: SupportProgram
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}) {
  const [officialUrl, setOfficialUrl] = useState(program.officialUrl)
  const [announcementUrl, setAnnouncementUrl] = useState(program.announcementUrl)
  const [amountDescription, setAmountDescription] = useState(program.amountDescription)
  const [scheduleDescription, setScheduleDescription] = useState(program.scheduleDescription)
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(program.sourceStatus)
  const [lastVerifiedAt, setLastVerifiedAt] = useState(isoToDateInput(program.lastVerifiedAt))
  const [validUntil, setValidUntil] = useState(isoToDateInput(program.validUntil))

  const submit = () => {
    try {
      supportProgramRepository.update(program.id, {
        officialUrl: officialUrl.trim(),
        announcementUrl: announcementUrl.trim(),
        amountDescription: amountDescription.trim(),
        scheduleDescription: scheduleDescription.trim(),
        sourceStatus,
        lastVerifiedAt: dateInputToIso(lastVerifiedAt),
        validUntil: dateInputToIso(validUntil),
      })
      onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : '프로그램 정보 저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <Modal
      open={open}
      title="프로그램 정보 수정"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-url" className="text-[13px] font-medium text-slate-700">공식 URL</label>
          <input id="prog-edit-url" className={inputClass} value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-announce" className="text-[13px] font-medium text-slate-700">공고 URL</label>
          <input id="prog-edit-announce" className={inputClass} value={announcementUrl} onChange={(e) => setAnnouncementUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-amount" className="text-[13px] font-medium text-slate-700">지원 규모(설명)</label>
          <input id="prog-edit-amount" className={inputClass} value={amountDescription} onChange={(e) => setAmountDescription(e.target.value)} placeholder="공식 공고 확인 필요" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-schedule" className="text-[13px] font-medium text-slate-700">접수 일정(설명)</label>
          <input id="prog-edit-schedule" className={inputClass} value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} placeholder="공식 공고 확인 필요" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-source" className="text-[13px] font-medium text-slate-700">출처 상태</label>
          <select id="prog-edit-source" className={inputClass} value={sourceStatus} onChange={(e) => setSourceStatus(e.target.value as SourceStatus)}>
            {SOURCE_STATUSES.map((s) => (
              <option key={s} value={s}>{SOURCE_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-verified" className="text-[13px] font-medium text-slate-700">확인일</label>
          <input id="prog-edit-verified" type="date" className={inputClass} value={lastVerifiedAt} onChange={(e) => setLastVerifiedAt(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prog-edit-valid" className="text-[13px] font-medium text-slate-700">유효기간</label>
          <input id="prog-edit-valid" type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
