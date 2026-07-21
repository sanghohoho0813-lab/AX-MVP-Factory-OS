import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ListChecks, Plus } from 'lucide-react'
import type {
  DocumentCategory,
  DocumentRequirementStatus,
  FundingDocumentRequirement,
  FundingStrategy,
} from '../../types/funding'
import type { DeliverablePackage } from '../../types/deliverables'
import {
  addDocumentRequirement,
  linkDeliverablePackage,
  setDocumentStatus,
  updateDocumentRequirement,
} from '../../services/fundingService'
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_META, INSTITUTION_SUBMISSION_NOTE } from '../../lib/fundingMeta'
import { deliverablePackageRepository, institutionRepository } from '../../repositories'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { DocumentStatusBadge } from '../../components/funding/badges'
import { FundingStrategyFrame, FundingNotFound, ReadOnlyNotice } from './fundingShared'

const INPUT_CLASS = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  company: '기업 일반',
  financial: '재무',
  tax: '세무',
  credit: '신용',
  technology: '기술',
  rnd: '연구개발',
  employment: '고용',
  certification: '인증',
  market: '시장·영업',
  contract: '계약',
  application: '신청서류',
  consent: '동의·개인정보',
  other: '기타',
}
const DOCUMENT_CATEGORY_ORDER = Object.keys(DOCUMENT_CATEGORY_LABEL) as DocumentCategory[]

function institutionName(id: string): string {
  return institutionRepository.getById(id)?.name ?? '기관 미확인'
}

function Chip({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'neutral' | 'info' }) {
  const cls: Record<typeof tone, string> = {
    danger: 'border-danger-200 bg-danger-50 text-danger-700',
    warning: 'border-warning-200 bg-warning-50 text-warning-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
    info: 'border-brand-200 bg-brand-50 text-brand-700',
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls[tone]}`}>
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 자료 추가 모달                                                        */
/* ------------------------------------------------------------------ */

interface DocDraft {
  category: DocumentCategory
  title: string
  description: string
  required: boolean
  officialFormRequired: boolean
  sensitive: boolean
}

function AddDocModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (draft: DocDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<DocDraft>({
    category: 'company',
    title: '',
    description: '',
    required: true,
    officialFormRequired: false,
    sensitive: false,
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(draft)
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      title="준비자료 추가"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !draft.title.trim()}>
            {saving ? '추가 중…' : '자료 추가'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">분류</span>
          <select
            className={INPUT_CLASS}
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as DocumentCategory }))}
          >
            {DOCUMENT_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">자료명</span>
          <input
            className={INPUT_CLASS}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="예: 최근 3개년 재무제표"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">필요한 이유</span>
          <textarea
            className={INPUT_CLASS}
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="어떤 요건 확인에 쓰이는지"
          />
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={draft.required}
            onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
          />
          <span className="text-[13px] break-keep text-slate-700">필수 자료</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={draft.officialFormRequired}
            onChange={(e) => setDraft((d) => ({ ...d, officialFormRequired: e.target.checked }))}
          />
          <span className="text-[13px] break-keep text-slate-700">기관 공식 양식 필요</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={draft.sensitive}
            onChange={(e) => setDraft((d) => ({ ...d, sensitive: e.target.checked }))}
          />
          <span className="text-[13px] break-keep text-slate-700">민감정보 포함 (재무·개인정보 등)</span>
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 담당·기한 편집 모달                                                   */
/* ------------------------------------------------------------------ */

interface OwnerDraft {
  ownerId: string
  dueDate: string
}

function EditOwnerModal({
  doc,
  onClose,
  onSubmit,
}: {
  doc: FundingDocumentRequirement
  onClose: () => void
  onSubmit: (docId: string, draft: OwnerDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<OwnerDraft>({ ownerId: doc.ownerId, dueDate: doc.dueDate })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(doc.id, draft)
    setSaving(false)
  }

  return (
    <Modal
      open={true}
      title="담당자·기한 편집"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-semibold text-slate-700">{doc.title}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">담당자</span>
          <input
            className={INPUT_CLASS}
            value={draft.ownerId}
            onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
            placeholder="담당자 이름 또는 역할"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">기한</span>
          <input
            type="date"
            className={INPUT_CLASS}
            value={draft.dueDate}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
          />
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 제출자료 연결 모달                                                    */
/* ------------------------------------------------------------------ */

function LinkPackageModal({
  doc,
  packages,
  onClose,
  onSubmit,
}: {
  doc: FundingDocumentRequirement
  packages: DeliverablePackage[]
  onClose: () => void
  onSubmit: (docId: string, packageId: string) => Promise<void>
}) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!selected) return
    setSaving(true)
    await onSubmit(doc.id, selected)
    setSaving(false)
  }

  return (
    <Modal
      open={true}
      title="제출자료 연결"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !selected}>
            {saving ? '연결 중…' : '연결'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] break-keep text-slate-600">
          Stage 10 제출자료 중 확정된 패키지를 <span className="font-semibold">{doc.title}</span>에 연결합니다.
        </p>
        {packages.length === 0 ? (
          <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13px] text-slate-500">
            확정된 제출자료 패키지가 없습니다. 먼저 제출자료 화면에서 패키지를 확정하세요.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">확정된 제출자료 패키지</legend>
            {packages.map((p) => (
              <label
                key={p.id}
                className="flex items-start gap-2 rounded-(--radius-card) border border-slate-200 px-3 py-2"
              >
                <input
                  type="radio"
                  name="deliverable-package"
                  className="mt-0.5 size-4"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium break-keep text-slate-800">{p.name}</span>
                  <span className="block text-xs text-slate-400">v{p.version}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 자료 행 (카드형 — 좁은 화면/큰 글씨 대응)                             */
/* ------------------------------------------------------------------ */

function DocRow({
  strategy,
  doc,
  projectId,
  readOnly,
  onStatus,
  onEditOwner,
  onLink,
}: {
  strategy: FundingStrategy
  doc: FundingDocumentRequirement
  projectId: string
  readOnly: boolean
  onStatus: (docId: string, status: DocumentRequirementStatus) => void
  onEditOwner: (doc: FundingDocumentRequirement) => void
  onLink: (doc: FundingDocumentRequirement) => void
}) {
  const target = doc.matchId
    ? institutionName(strategy.matches.find((m) => m.id === doc.matchId)?.institutionId ?? '')
    : '공통'

  return (
    <tr className="align-top">
      <th scope="row" className="px-3 py-3 text-left font-normal">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold break-keep text-slate-900">{doc.title}</span>
          {doc.description && (
            <span className="text-xs break-keep text-slate-500">{doc.description}</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {doc.required && <Chip label="필수" tone="danger" />}
            {doc.sensitive && <Chip label="민감정보" tone="warning" />}
            {doc.officialFormRequired && <Chip label="공식양식" tone="info" />}
          </div>
        </div>
      </th>
      <td className="px-3 py-3 text-[13px] break-keep text-slate-600">{target}</td>
      <td className="px-3 py-3">
        {readOnly ? (
          <DocumentStatusBadge status={doc.status} />
        ) : (
          <label className="flex flex-col gap-1">
            <span className="sr-only">{doc.title} 상태</span>
            <select
              className="rounded-(--radius-control) border border-slate-200 px-2 py-1 text-[13px]"
              value={doc.status}
              onChange={(e) => onStatus(doc.id, e.target.value as DocumentRequirementStatus)}
            >
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DOCUMENT_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </td>
      <td className="px-3 py-3 text-[13px] break-keep text-slate-600">
        <div className="flex flex-col gap-0.5">
          <span>{doc.ownerId || '담당 미지정'}</span>
          <span className="text-xs text-slate-400">{doc.dueDate ? `기한 ${doc.dueDate}` : '기한 미정'}</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onEditOwner(doc)}
              className="self-start text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              담당·기한 편집
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-[13px]">
        {doc.sourceDeliverablePackageId ? (
          <Link
            to={`/deliverables/projects/${projectId}/packages/${doc.sourceDeliverablePackageId}`}
            className="font-medium text-brand-600 underline hover:text-brand-700"
          >
            연결된 자료 보기
          </Link>
        ) : readOnly ? (
          <span className="text-slate-400">미연결</span>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onLink(doc)}>
            제출자료 연결
          </Button>
        )}
      </td>
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/* 메인 뷰                                                              */
/* ------------------------------------------------------------------ */

function ChecklistView({
  strategy,
  projectId,
  readOnly,
}: {
  strategy: FundingStrategy
  projectId: string
  readOnly: boolean
}) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [ownerDoc, setOwnerDoc] = useState<FundingDocumentRequirement | null>(null)
  const [linkDoc, setLinkDoc] = useState<FundingDocumentRequirement | null>(null)

  const finalizedPackages = useMemo(
    () => deliverablePackageRepository.getByProjectId(projectId).filter((p) => p.status === 'finalized'),
    [projectId],
  )

  const grouped = useMemo(() => {
    const map = new Map<DocumentCategory, FundingDocumentRequirement[]>()
    for (const doc of strategy.documentRequirements) {
      const list = map.get(doc.category) ?? []
      list.push(doc)
      map.set(doc.category, list)
    }
    return DOCUMENT_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      docs: map.get(c) ?? [],
    }))
  }, [strategy.documentRequirements])

  function handleStatus(docId: string, status: DocumentRequirementStatus) {
    try {
      setDocumentStatus(strategy.id, docId, status)
      showToast('상태를 변경했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '상태 변경에 실패했습니다.')
    }
  }

  async function handleAdd(draft: DocDraft) {
    try {
      addDocumentRequirement(strategy.id, {
        category: draft.category,
        title: draft.title.trim(),
        description: draft.description.trim(),
        required: draft.required,
        officialFormRequired: draft.officialFormRequired,
        sensitive: draft.sensitive,
      })
      showToast('준비자료를 추가했습니다.')
      setAddOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '자료 추가에 실패했습니다.')
    }
  }

  async function handleEditOwner(docId: string, draft: OwnerDraft) {
    try {
      updateDocumentRequirement(strategy.id, docId, {
        ownerId: draft.ownerId.trim(),
        dueDate: draft.dueDate,
      })
      showToast('담당자·기한을 저장했습니다.')
      setOwnerDoc(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  async function handleLink(docId: string, packageId: string) {
    try {
      linkDeliverablePackage(strategy.id, docId, packageId)
      showToast('제출자료를 연결했습니다.')
      setLinkDoc(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '연결에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="후보 기관에 제출할 준비자료를 분류별로 점검하고, 확정된 제출자료 패키지를 연결합니다."
        what="자료명·필요한 이유·담당자·기한·상태를 정리하고 민감정보와 공식 양식 필요 여부를 표시합니다."
        when="접촉을 통해 필요한 서류를 파악한 뒤 제출 준비를 진행할 때 사용합니다."
        next="자료가 준비되면 신청·심사 화면에서 신청을 진행하세요."
      />
      <ReadOnlyNotice strategy={strategy} />

      <div
        role="note"
        className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3"
      >
        <span aria-hidden="true" className="mt-0.5 text-warning-600">
          ⚠
        </span>
        <p className="text-[13px] font-medium break-keep text-warning-800">{INSTITUTION_SUBMISSION_NOTE}</p>
      </div>

      <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px] text-slate-600">
        {finalizedPackages.length > 0 ? (
          <span>
            연결 가능한 Stage 10 확정 제출자료 패키지 {finalizedPackages.length}개:{' '}
            {finalizedPackages.map((p) => p.name).join(', ')}
          </span>
        ) : (
          <span>확정된 Stage 10 제출자료 패키지가 아직 없습니다. 제출자료 화면에서 패키지를 확정하면 연결할 수 있습니다.</span>
        )}
      </div>

      <Panel
        title="준비자료 점검"
        actions={
          !readOnly && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              자료 추가
            </Button>
          )
        }
        flush
      >
        {strategy.documentRequirements.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="아직 준비자료 항목이 없습니다."
            description="필요한 제출 자료를 추가해 분류별로 점검하세요."
          />
        ) : (
          <div className="flex flex-col gap-6 px-5 py-5">
            {grouped.map(({ category, docs }) => (
              <section key={category} className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold text-slate-700">
                  {DOCUMENT_CATEGORY_LABEL[category]}
                  <span className="ml-1.5 text-xs font-normal text-slate-400">{docs.length}건</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th scope="col" className="px-3 py-2 font-medium">
                          자료명 / 필요한 이유
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          대상 기관
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          상태
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          담당자 / 기한
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          연결된 자료
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {docs.map((doc) => (
                        <DocRow
                          key={doc.id}
                          strategy={strategy}
                          doc={doc}
                          projectId={projectId}
                          readOnly={readOnly}
                          onStatus={handleStatus}
                          onEditOwner={setOwnerDoc}
                          onLink={setLinkDoc}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>

      <AddDocModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAdd} />
      {ownerDoc && (
        <EditOwnerModal key={ownerDoc.id} doc={ownerDoc} onClose={() => setOwnerDoc(null)} onSubmit={handleEditOwner} />
      )}
      {linkDoc && (
        <LinkPackageModal
          key={linkDoc.id}
          doc={linkDoc}
          packages={finalizedPackages}
          onClose={() => setLinkDoc(null)}
          onSubmit={handleLink}
        />
      )}
    </div>
  )
}

export function FundingChecklistPage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return <FundingNotFound />
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => {
        const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
        return <ChecklistView strategy={strategy} projectId={projectId} readOnly={readOnly} />
      }}
    />
  )
}
