import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ExternalLink, FileText, Pencil } from 'lucide-react'
import type { Institution, SourceStatus } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { computeInstitutionFreshness, computeProgramFreshness } from '../../services/funding/freshnessEngine'
import { SOURCE_STATUS_META, SOURCE_STATUSES } from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Modal } from '../../components/ui/Modal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  FreshnessBadge,
  InstitutionCategoryBadge,
  SourceStatusBadge,
  SupportTypeBadge,
} from '../../components/funding/badges'

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

export function InstitutionDetailPage() {
  const { institutionId = '' } = useParams()
  const navigate = useNavigate()
  const version = useStoreVersion()
  const { showToast } = useToast()
  const [editOpen, setEditOpen] = useState(false)

  const { institution, programs } = useMemo(() => {
    const inst = institutionRepository.getById(institutionId)
    return {
      institution: inst,
      programs: inst ? supportProgramRepository.getByInstitutionId(inst.id) : [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, version])

  if (!institution) {
    return (
      <NotFoundState
        title="기관을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 기관입니다."
        backTo="/funding/catalog"
        backLabel="기관·프로그램 목록으로"
      />
    )
  }

  const freshness = computeInstitutionFreshness(institution)
  const staleWarning = freshness === 'unknown' || freshness === 'stale'

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/funding/catalog"
        backLabel="기관·프로그램 목록"
        title={institution.name}
        badges={
          <>
            <InstitutionCategoryBadge category={institution.category} />
            <SourceStatusBadge status={institution.sourceStatus} />
            <FreshnessBadge status={freshness} />
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" className="size-4" />
            정보 수정
          </Button>
        }
      />

      {staleWarning && (
        <div
          aria-live="polite"
          className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
          <p className="text-[13px] break-keep text-warning-800">확인일·유효기간을 확인해 최신성을 갱신하세요. 실제 조건은 공식 공고에서 확인해야 합니다.</p>
        </div>
      )}

      <Panel title="기관 정보">
        <dl className="flex flex-col">
          <InfoRow label="유형"><InstitutionCategoryBadge category={institution.category} /></InfoRow>
          <InfoRow label="설명">{institution.description || <span className="text-slate-400">설명 없음</span>}</InfoRow>
          <InfoRow label="공식 URL">
            {institution.officialUrl ? (
              <a href={institution.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                {institution.officialUrl}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning-700">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                공식 URL 없음
              </span>
            )}
          </InfoRow>
          <InfoRow label="최신성"><FreshnessBadge status={freshness} /></InfoRow>
          <InfoRow label="확인일">{institution.lastVerifiedAt ? formatDate(institution.lastVerifiedAt) : <span className="text-warning-700">확인일 없음</span>}</InfoRow>
          <InfoRow label="유효기간">{institution.validUntil ? formatDate(institution.validUntil) : <span className="text-slate-400">유효기간 없음</span>}</InfoRow>
          <InfoRow label="참고 점검항목"><StringList items={institution.typicalReviewFocus} empty="등록된 점검항목 없음" /></InfoRow>
          <InfoRow label="기본 준비 근거"><StringList items={institution.requiredBaselineEvidence} empty="등록된 항목 없음" /></InfoRow>
          <InfoRow label="지역"><StringList items={institution.regions} empty="전체·미지정" /></InfoRow>
          <InfoRow label="대상 업종"><StringList items={institution.targetIndustries} empty="전체·미지정" /></InfoRow>
          <InfoRow label="유의사항">{institution.cautionNotes || <span className="text-slate-400">등록된 유의사항 없음</span>}</InfoRow>
        </dl>
      </Panel>

      <Panel title={`이 기관의 프로그램 (${programs.length})`} flush>
        {programs.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400">등록된 프로그램이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {programs.map((prog) => (
              <li key={prog.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/funding/catalog/programs/${prog.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{prog.name}</p>
                      <p className="truncate text-[0.875rem] text-slate-400">{prog.summary || '요약 없음'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SupportTypeBadge type={prog.supportType} />
                    <FreshnessBadge status={computeProgramFreshness(prog)} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <EditInstitutionModal
        open={editOpen}
        institution={institution}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          showToast('기관 정보를 저장했습니다.')
        }}
        onError={(message) => showToast(message)}
      />
    </div>
  )
}

function EditInstitutionModal({
  open,
  institution,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  institution: Institution
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}) {
  const [officialUrl, setOfficialUrl] = useState(institution.officialUrl)
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(institution.sourceStatus)
  const [lastVerifiedAt, setLastVerifiedAt] = useState(isoToDateInput(institution.lastVerifiedAt))
  const [validUntil, setValidUntil] = useState(isoToDateInput(institution.validUntil))
  const [cautionNotes, setCautionNotes] = useState(institution.cautionNotes)

  const submit = () => {
    try {
      institutionRepository.update(institution.id, {
        officialUrl: officialUrl.trim(),
        sourceStatus,
        lastVerifiedAt: dateInputToIso(lastVerifiedAt),
        validUntil: dateInputToIso(validUntil),
        cautionNotes: cautionNotes.trim(),
      })
      onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : '기관 정보 저장 중 오류가 발생했습니다.')
    }
  }

  return (
    <Modal
      open={open}
      title="기관 정보 수정"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inst-edit-url" className="text-[13px] font-medium text-slate-700">공식 URL</label>
          <input id="inst-edit-url" className={inputClass} value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inst-edit-source" className="text-[13px] font-medium text-slate-700">출처 상태</label>
          <select id="inst-edit-source" className={inputClass} value={sourceStatus} onChange={(e) => setSourceStatus(e.target.value as SourceStatus)}>
            {SOURCE_STATUSES.map((s) => (
              <option key={s} value={s}>{SOURCE_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inst-edit-verified" className="text-[13px] font-medium text-slate-700">확인일</label>
          <input id="inst-edit-verified" type="date" className={inputClass} value={lastVerifiedAt} onChange={(e) => setLastVerifiedAt(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inst-edit-valid" className="text-[13px] font-medium text-slate-700">유효기간</label>
          <input id="inst-edit-valid" type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inst-edit-caution" className="text-[13px] font-medium text-slate-700">유의사항</label>
          <textarea id="inst-edit-caution" rows={3} className={inputClass} value={cautionNotes} onChange={(e) => setCautionNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
