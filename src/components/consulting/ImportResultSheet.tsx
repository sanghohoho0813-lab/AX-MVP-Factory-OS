/**
 * 결과 들여오기 — 수동 LLM 왕복의 들어오는 쪽.
 * 붙여넣기 또는 .md/.txt 파일 → 머리줄 인식(종류·단계·제목) → 사람이 확인 → 산출물 저장(버전 +1).
 */

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Badge, BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { ARTIFACT_DEFS, artifactDef, artifactTypeForPrompt } from '../../domain/consulting/artifactDefinitions'
import { defaultArtifactTitle, parsePastedResult } from '../../domain/consulting/resultImport'
import { STAGE_ORDER } from '../../domain/consulting/workflowDefinition'
import { createArtifact, nextVersion } from '../../services/consultingStudioService'
import type { ArtifactType, ConsultingPromptPackage, StageKey } from '../../types/consulting'
import { CheckRow, SelectField, stageTitle } from './studioParts'

export function ImportResultSheet({
  pkg,
  presetType,
  onClose,
}: {
  /** 어느 꾸러미의 결과인지 (없으면 직접 작성) */
  pkg: ConsultingPromptPackage | null
  presetType?: ArtifactType
  onClose: () => void
}) {
  const { project: p, artifacts, workspaceId, refresh, toast, decide } = useEditor()
  const initialType = presetType ?? (pkg ? artifactTypeForPrompt(pkg.type) : 'NOTE')
  const [text, setText] = useState('')
  const [type, setType] = useState<ArtifactType>(initialType)
  const [stage, setStage] = useState<StageKey>(pkg?.stageKey ?? artifactDef(initialType).stage)
  const [title, setTitle] = useState('')
  const [fileName, setFileName] = useState('')
  const [supersede, setSupersede] = useState(true)
  const [busy, setBusy] = useState(false)
  const [detected, setDetected] = useState<string | null>(null)

  const applyText = (raw: string, fromFile = '') => {
    setText(raw)
    setFileName(fromFile)
    const parsed = parsePastedResult(raw)
    if (parsed.hadHeader) {
      if (parsed.type) setType(parsed.type)
      if (parsed.stage) setStage(parsed.stage)
      setDetected(`머리줄 인식 — ${parsed.type ?? '종류 미확인'} · ${parsed.stage ?? '단계 미확인'}`)
    } else {
      setDetected('머리줄이 없어 아래 값을 사람이 고릅니다.')
    }
    if (parsed.title && title === '') setTitle(parsed.title)
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    const raw = await file.text()
    applyText(raw, file.name)
  }

  const version = nextVersion(artifacts, p.id, type)

  const save = async () => {
    const parsed = parsePastedResult(text)
    const body = parsed.hadHeader ? parsed.body : text.trim()
    if (body === '') {
      toast('결과 본문을 붙여 넣어 주세요.')
      return
    }
    setBusy(true)
    try {
      const art = await createArtifact(workspaceId, {
        projectId: p.id,
        type,
        title: defaultArtifactTitle(type, version, title),
        stageKey: stage,
        content: body,
        source: fileName ? 'llm_file' : pkg ? 'llm_paste' : 'manual',
        promptPackageId: pkg?.id ?? null,
        fileName,
        supersedePrevious: supersede,
      })
      await decide({ stageKey: stage, kind: 'artifact', summary: `${artifactDef(type).label} v${art.version} 들여옴`, reason: pkg ? `${pkg.title} 결과` : '직접 작성' })
      await refresh()
      toast(`${art.title} 저장했습니다.`)
      onClose()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      title={pkg ? `결과 들여오기 — ${pkg.title}` : '산출물 직접 적기'}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="t-meta text-slate-500">{artifactDef(type).label} v{version}</span>
          <div className="flex gap-2">
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" disabled={busy || text.trim() === ''} onClick={() => void save()}>{busy ? '저장 중…' : '산출물로 저장'}</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="t-sub block font-medium text-slate-600">결과 붙여넣기</span>
          <textarea
            aria-label="결과 본문"
            value={text}
            onChange={(e) => applyText(e.target.value)}
            rows={10}
            placeholder="LLM 이 돌려준 결과 전체를 붙여 넣습니다. 첫 줄 [ARTIFACT] type=… 이 있으면 종류·단계를 자동으로 읽습니다."
            className="t-sub mt-1 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2 font-mono"
          />
        </label>
        <label className="tap inline-flex w-fit cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">
          <Upload aria-hidden="true" className="size-4" />
          <span className="t-sub font-medium">.md / .txt 파일로 올리기</span>
          <input type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </label>
        {fileName && <p className="t-meta text-slate-500">파일: {fileName}</p>}
        {detected && <Badge tone="neutral">{detected}</Badge>}

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="종류" value={type} options={ARTIFACT_DEFS.map((d) => ({ value: d.type, label: d.label }))} onChange={(v) => { setType(v); setStage(artifactDef(v).stage) }} />
          <SelectField label="단계" value={stage} options={STAGE_ORDER.map((k) => ({ value: k, label: stageTitle(k) }))} onChange={setStage} />
        </div>
        <label className="block">
          <span className="t-sub block font-medium text-slate-600">제목</span>
          <input aria-label="산출물 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${artifactDef(type).label} v${version}`} className="t-body mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" />
        </label>
        <CheckRow label="같은 종류의 이전 버전을 '대체됨' 으로 표시" hint="이력은 남고, 완료 조건 계산에서만 빠집니다." checked={supersede} onChange={setSupersede} />
      </div>
    </BottomSheet>
  )
}
