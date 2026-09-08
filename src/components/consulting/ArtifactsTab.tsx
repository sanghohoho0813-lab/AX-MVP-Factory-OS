/**
 * 산출물 — 종류별 버전 이력. 보기 · 상태 바꾸기(초안/검토 중/확정/대체됨) · 내용 고치기 · 복사 · 지우기 · 직접 적기.
 */

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge, BottomSheet, Disclosure, ListRow, ListSurface, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { useEditor } from './editorContext'
import { ARTIFACT_STATUS_LABEL, artifactDef, isArtifactType } from '../../domain/consulting/artifactDefinitions'
import { deleteArtifact, updateArtifact } from '../../services/consultingStudioService'
import { formatDateTime } from '../../lib/format'
import type { ArtifactStatus, ArtifactType, ConsultingArtifact } from '../../types/consulting'
import { CopyButton, SelectField, TextField, stageTitle } from './studioParts'
import { ImportResultSheet } from './ImportResultSheet'

const STATUS_TONE: Record<ArtifactStatus, 'neutral' | 'warning' | 'success' | 'brand'> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'success',
  superseded: 'neutral',
}

export function ArtifactsTab({ focus }: { focus?: string }) {
  const { artifacts, refresh, toast } = useEditor()
  const [open, setOpen] = useState<ConsultingArtifact | null>(() => artifacts.find((a) => a.id === focus) ?? null)
  const [adding, setAdding] = useState<ArtifactType | null>(isArtifactType(focus) ? focus : null)
  const [pendingDelete, setPendingDelete] = useState<ConsultingArtifact | null>(null)
  const [showSuperseded, setShowSuperseded] = useState(false)

  const groups = useMemo(() => {
    const m = new Map<ArtifactType, ConsultingArtifact[]>()
    for (const a of artifacts) m.set(a.type, [...(m.get(a.type) ?? []), a])
    return [...m.entries()].map(([type, list]) => ({ type, list: list.sort((x, y) => y.version - x.version) }))
  }, [artifacts])

  const patch = async (a: ConsultingArtifact, p: Partial<Pick<ConsultingArtifact, 'title' | 'status' | 'content'>>) => {
    try {
      const next = await updateArtifact(a, p)
      setOpen((cur) => (cur && cur.id === a.id ? next : cur))
      await refresh()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
  }
  const remove = async (a: ConsultingArtifact) => {
    try {
      await deleteArtifact(a)
      setOpen(null)
      await refresh()
      toast('지웠습니다.')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '지우지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="t-section text-slate-900">산출물 · 버전 이력</h2>
            <p className="t-sub mt-1 break-keep text-slate-500">LLM 결과를 들여온 것(llm_paste/llm_file)과 직접 적은 것(manual)이 종류별로 버전으로 쌓입니다. 확정한 것만 사업계획서·실사에 씁니다.</p>
          </div>
          <Button variant="primary" onClick={() => setAdding('NOTE')}>
            <Plus aria-hidden="true" className="size-4" /> 직접 적기
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['draft', 'in_review', 'approved', 'superseded'] as ArtifactStatus[]).map((s) => (
            <Badge key={s} tone={STATUS_TONE[s]}>{ARTIFACT_STATUS_LABEL[s]} {artifacts.filter((a) => a.status === s).length}</Badge>
          ))}
        </div>
      </Surface>

      {groups.length === 0 && <p className="t-body rounded-(--radius-panel) border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-slate-500">아직 산출물이 없습니다. 프롬프트 탭에서 결과를 들여오거나 여기서 직접 적습니다.</p>}

      {groups.map(({ type, list }) => {
        const visible = list.filter((a) => showSuperseded || a.status !== 'superseded')
        if (visible.length === 0) return null
        return (
          <Disclosure key={type} title={artifactDef(type).label} hint={`${list.length}버전 · 최신 v${list[0].version}`} defaultOpen={focus === type || groups.length <= 3}>
            <ListSurface>
              {visible.map((a) => (
                <ListRow
                  key={a.id}
                  title={`${a.title}`}
                  meta={`v${a.version} · ${stageTitle(a.stageKey)} · ${a.source === 'manual' ? '직접 작성' : a.source === 'system' ? '시스템' : 'LLM 결과'}${a.fileName ? ` · ${a.fileName}` : ''}`}
                  badge={<Badge tone={STATUS_TONE[a.status]}>{ARTIFACT_STATUS_LABEL[a.status]}</Badge>}
                  right={formatDateTime(a.updatedAt)}
                  onClick={() => setOpen(a)}
                />
              ))}
            </ListSurface>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => setAdding(type)}>이 종류 새 버전 적기</Button>
            </div>
          </Disclosure>
        )
      })}

      {artifacts.some((a) => a.status === 'superseded') && (
        <button type="button" onClick={() => setShowSuperseded((v) => !v)} className="t-sub self-start text-slate-500 hover:text-slate-800">
          {showSuperseded ? '대체된 버전 감추기' : '대체된 버전도 보기'}
        </button>
      )}

      {open && (
        <BottomSheet
          title={`${open.title} · v${open.version}`}
          onClose={() => setOpen(null)}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setPendingDelete(open)} className="t-sub inline-flex items-center gap-1 text-slate-400 hover:text-danger-600">
                <Trash2 aria-hidden="true" className="size-4" /> 지우기
              </button>
              <div className="flex gap-2">
                <CopyButton text={open.content} label="내용 복사" />
                <Button onClick={() => setOpen(null)}>닫기</Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="제목" value={open.title} onCommit={(v) => void patch(open, { title: v })} />
              <SelectField label="상태" value={open.status} options={(Object.keys(ARTIFACT_STATUS_LABEL) as ArtifactStatus[]).map((s) => ({ value: s, label: ARTIFACT_STATUS_LABEL[s] }))} onChange={(v) => void patch(open, { status: v })} />
            </div>
            <p className="t-meta text-slate-500">{artifactDef(open.type).label} · {stageTitle(open.stageKey)} · {open.source} · 만든 날 {formatDateTime(open.createdAt)}</p>
            <TextField label="내용 (고치면 저장됩니다)" value={open.content} multiline rows={16} onCommit={(v) => void patch(open, { content: v })} />
          </div>
        </BottomSheet>
      )}

      {adding && <ImportResultSheet pkg={null} presetType={adding} onClose={() => setAdding(null)} />}

      <ConfirmModal
        open={pendingDelete !== null}
        title="산출물 삭제"
        message="이 버전을 지웁니다. 되돌릴 수 없습니다. 이력을 남기려면 지우는 대신 '대체됨' 으로 두세요."
        confirmLabel="삭제"
        danger
        onConfirm={() => { const t = pendingDelete; setPendingDelete(null); if (t) void remove(t) }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
