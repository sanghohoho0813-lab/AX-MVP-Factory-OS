import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Copy, Sparkles } from 'lucide-react'
import type {
  DeliverablePackage,
  DeliverablePrompt,
  DeliverableTrackType,
} from '../../types/deliverables'
import { editPromptContent, restorePromptOriginal } from '../../services/deliverableService'
import { DELIVERABLE_TRACK_META } from '../../lib/deliverableMeta'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { DeliverableTrackBadge } from '../../components/deliverables/badges'
import { ContentBlocks } from '../../components/deliverables/ContentBlockView'
import { PackageSectionFrame, ReadOnlyNotice, DeliverableNotFound } from './deliverableShared'

const TRACK_ORDER: DeliverableTrackType[] = ['ax', 'website', 'validation', 'roadmap', 'overview', 'evidence', 'prompt']

function trackOrderIndex(track: DeliverableTrackType): number {
  const i = TRACK_ORDER.indexOf(track)
  return i === -1 ? TRACK_ORDER.length : i
}

const INPUT_CLASS = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function PromptCard({
  prompt,
  index,
  total,
  readOnly,
  done,
  onToggleDone,
  onEdit,
  onRestore,
}: {
  prompt: DeliverablePrompt
  index: number
  total: number
  readOnly: boolean
  done: boolean
  onToggleDone: (id: string) => void
  onEdit: (prompt: DeliverablePrompt) => void
  onRestore: (prompt: DeliverablePrompt) => void
}) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('복사에 실패했습니다. 프롬프트 내용을 직접 선택해 복사하세요.')
    }
  }

  return (
    <article id={`prompt-${prompt.id}`} className="rounded-(--radius-card) border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {prompt.sequenceNumber}
            </span>
            <h3 className="text-[15px] font-semibold break-keep text-slate-900">{prompt.title}</h3>
            {prompt.manuallyEdited && (
              <span className="inline-flex items-center rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                수동 수정됨
              </span>
            )}
            {done && (
              <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                <Check aria-hidden="true" className="size-3" />
                완료 표시
              </span>
            )}
          </div>
          {prompt.purpose && (
            <p className="mt-1.5 text-[13px] leading-relaxed break-keep whitespace-pre-wrap text-slate-600">
              {prompt.purpose}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && (
            <Button variant="secondary" size="sm" onClick={() => onEdit(prompt)}>
              편집
            </Button>
          )}
          {!readOnly && prompt.manuallyEdited && (
            <Button variant="ghost" size="sm" onClick={() => onRestore(prompt)}>
              원본 복구
            </Button>
          )}
        </div>
      </div>

      {prompt.prerequisites.length > 0 && (
        <div className="mt-3 rounded-(--radius-control) border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="mb-1 text-[13px] font-semibold text-slate-700">전제조건 (이전 프롬프트가 끝났는지 확인)</p>
          <ul className="flex flex-col gap-1">
            {prompt.prerequisites.map((pre, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] break-keep text-slate-600">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <span className="min-w-0 whitespace-pre-wrap">{pre}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-slate-700">프롬프트 내용</span>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs font-medium text-success-600">
              {copied ? '복사되었습니다' : ''}
            </span>
            <Button variant="secondary" size="sm" onClick={copy}>
              <Copy aria-hidden="true" className="size-3.5" />
              복사
            </Button>
          </div>
        </div>
        <pre
          tabIndex={0}
          className="max-h-96 overflow-auto rounded-(--radius-card) border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-700"
        >
          {prompt.content}
        </pre>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2 text-[13px] text-slate-600">
          <input
            type="checkbox"
            checked={done}
            onChange={() => onToggleDone(prompt.id)}
            className="size-4 rounded border-slate-300"
          />
          완료 표시 (내 화면 표시용, 저장되지 않음)
        </label>
        {index < total - 1 && (
          <a
            href={`#prompt-${prompt.id}-next`}
            className="text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            다음 프롬프트 보기 →
          </a>
        )}
      </div>
      <span id={`prompt-${prompt.id}-next`} aria-hidden="true" />
    </article>
  )
}

interface EditState {
  prompt: DeliverablePrompt
  content: string
  editNotes: string
}

function PromptsView({ pkg, readOnly }: { pkg: DeliverablePackage; readOnly: boolean }) {
  const { showToast } = useToast()
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<EditState | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<DeliverablePrompt | null>(null)
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)

  const promptSection = pkg.sections.find((s) => s.type === 'developer_prompt')

  function toggleDone(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveEdit() {
    if (!edit) return
    setSaving(true)
    try {
      editPromptContent(pkg.id, edit.prompt.id, edit.content, edit.editNotes)
      showToast('프롬프트를 저장했습니다.')
      setEdit(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRestore() {
    if (!restoreTarget || busyRef.current) return
    busyRef.current = true
    setSaving(true)
    try {
      restorePromptOriginal(pkg.id, restoreTarget.id)
      showToast('원본 프롬프트로 복구했습니다.')
      setRestoreTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '복구에 실패했습니다.')
    } finally {
      setSaving(false)
      busyRef.current = false
    }
  }

  const tracks = Array.from(new Set(pkg.prompts.map((p) => p.track))).sort(
    (a, b) => trackOrderIndex(a) - trackOrderIndex(b),
  )

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="이 화면의 개발 프롬프트가 핵심 산출물입니다. 순서대로 복사해 사용하세요."
        what="확정된 AX MVP·홈페이지 설계를 Claude Code용 프롬프트로 변환합니다. 실제 Claude Code와 자동 연동하지 않습니다."
        when="개발 착수 시 순서대로 프롬프트를 복사해 사용할 때 활용합니다."
        next="근거 탭에서 각 프롬프트가 참조한 설계 출처를 확인할 수 있습니다."
      />
      <ReadOnlyNotice pkg={pkg} />

      {pkg.prompts.length > 0 && (
        <Panel title="프롬프트 사용 순서">
          <div className="flex flex-col gap-2 text-[13px] leading-relaxed break-keep text-slate-600">
            <p>
              아래 프롬프트는 <strong className="text-slate-800">실제 Claude Code와 자동 연동하지 않습니다.</strong> 각
              프롬프트의 &ldquo;복사&rdquo; 버튼으로 내용을 복사한 뒤, Claude Code에 순서대로 붙여넣어 사용하세요.
            </p>
            <ol className="ml-4 flex list-decimal flex-col gap-1">
              <li>순번(sequence)이 낮은 프롬프트부터 실행합니다.</li>
              <li>각 프롬프트의 전제조건이 충족되었는지(이전 단계 완료 여부) 확인합니다.</li>
              <li>실행이 끝나면 완료 표시로 진행 상황을 기록합니다(내 화면 표시용).</li>
            </ol>
          </div>
        </Panel>
      )}

      {pkg.prompts.length === 0 ? (
        <Panel title="개발 프롬프트">
          <EmptyState
            icon={Sparkles}
            title="아직 개발 프롬프트가 없습니다."
            description="개발 프롬프트를 만들려면 확정된 AX MVP 설계 또는 홈페이지 설계가 필요합니다."
          />
        </Panel>
      ) : (
        tracks.map((track) => {
          const prompts = pkg.prompts
            .filter((p) => p.track === track)
            .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
          return (
            <section key={track} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <DeliverableTrackBadge track={track} />
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {DELIVERABLE_TRACK_META[track].label} 개발 프롬프트
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {prompts.map((prompt, i) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    index={i}
                    total={prompts.length}
                    readOnly={readOnly}
                    done={doneIds.has(prompt.id)}
                    onToggleDone={toggleDone}
                    onEdit={(p) => setEdit({ prompt: p, content: p.content, editNotes: p.editNotes })}
                    onRestore={setRestoreTarget}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {promptSection && promptSection.structuredContent.length > 0 && (
        <Panel title={promptSection.title || '개발 프롬프트 안내'}>
          <ContentBlocks blocks={promptSection.structuredContent} showInternal={true} />
        </Panel>
      )}

      <Modal
        open={edit !== null}
        title="프롬프트 편집"
        size="lg"
        onClose={() => setEdit(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)} disabled={saving}>
              취소
            </Button>
            <Button variant="primary" onClick={saveEdit} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-700">프롬프트 내용</span>
              <textarea
                className={`${INPUT_CLASS} min-h-64 font-mono text-xs leading-relaxed`}
                value={edit.content}
                onChange={(e) => setEdit((s) => (s ? { ...s, content: e.target.value } : s))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-700">수정 메모</span>
              <input
                className={INPUT_CLASS}
                value={edit.editNotes}
                onChange={(e) => setEdit((s) => (s ? { ...s, editNotes: e.target.value } : s))}
                placeholder="어떤 이유로 수정했는지 기록하세요."
              />
            </label>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={restoreTarget !== null}
        title="원본 프롬프트로 복구"
        message="수동 수정 내용을 버리고 자동 생성된 원본 프롬프트로 되돌립니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="원본 복구"
        danger
        busy={saving}
        onConfirm={confirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  )
}

export function PackagePromptsPage() {
  const { projectId, packageId } = useParams<{ projectId: string; packageId: string }>()
  if (!projectId || !packageId) return <DeliverableNotFound />
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => {
        const readOnly =
          pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'
        return <PromptsView pkg={pkg} readOnly={readOnly} />
      }}
    />
  )
}
