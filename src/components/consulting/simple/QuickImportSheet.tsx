/**
 * 결과 가져오기 — 붙여넣기 또는 파일. 종류·단계·버전은 묻지 않는다.
 *
 * 시스템이 방금 어떤 프롬프트를 만들었는지 알고 있으므로 그대로 저장한다.
 * OS 반환 블록이 있으면 요약을 보여 주고, 없으면 원문을 그대로 저장한다(절대 잃지 않는다).
 */

import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { ArtifactType } from '../../../types/consulting'
import { artifactDef } from '../../../domain/consulting/artifactDefinitions'
import { parseReturnBlock } from '../../../domain/consulting/returnBlock'
import { BottomSheet } from '../../ui/primitives'
import { Button } from '../../ui/Button'

export function QuickImportSheet({
  artifactType,
  busy,
  onSave,
  onClose,
}: {
  artifactType: ArtifactType
  busy: boolean
  onSave: (text: string, fileName: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const parsed = text.trim() === '' ? null : parseReturnBlock(text)

  const onFile = async (file: File | null) => {
    if (!file) return
    setText(await file.text())
    setFileName(file.name)
  }

  return (
    <BottomSheet
      title={`${artifactDef(artifactType).label} 가져오기`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={busy || text.trim() === ''} onClick={() => onSave(text, fileName)}>
            {busy ? '저장 중…' : '저장하고 계속'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="t-sub font-medium text-slate-600">GPT·Claude 결과를 그대로 붙여 넣으세요</span>
          <textarea
            autoFocus
            aria-label="결과 붙여넣기"
            value={text}
            rows={10}
            onChange={(e) => { setText(e.target.value); setFileName('') }}
            placeholder="답변 전체를 복사해서 붙여 넣습니다. 일부만 넣어도 저장은 됩니다."
            className="t-sub mt-1 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2 font-mono"
          />
        </label>

        <label className="tap inline-flex w-fit cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50">
          <Upload aria-hidden="true" className="size-4" />
          <span className="t-sub font-medium">파일로 올리기 (.md · .txt)</span>
          <input type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </label>
        {fileName && <p className="t-meta text-slate-500">파일: {fileName}</p>}

        {parsed?.found && (
          <div className="rounded-(--radius-card) border border-success-200 bg-success-50/50 px-4 py-3">
            <p className="t-sub font-semibold text-success-700">내용을 알아봤습니다</p>
            {parsed.summary && <p className="t-body mt-1 break-keep text-slate-700">{parsed.summary.slice(0, 300)}</p>}
            {parsed.decisionOptions.length > 0 && (
              <p className="t-sub mt-2 text-slate-600">고를 후보 {parsed.decisionOptions.length}개 — 저장하면 바로 고르는 화면이 나옵니다.</p>
            )}
            {parsed.missingFacts.length > 0 && (
              <p className="t-sub mt-1 break-keep text-warning-700">확인이 필요하다고 짚은 것: {parsed.missingFacts.join(' · ')}</p>
            )}
          </div>
        )}
        {parsed && !parsed.found && text.trim() !== '' && (
          <p className="t-meta break-keep text-slate-500">
            정해진 형식이 없어도 괜찮습니다. 원문 그대로 {artifactDef(artifactType).label} 로 저장됩니다.
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
