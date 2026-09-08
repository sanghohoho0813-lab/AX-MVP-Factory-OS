/**
 * 결정 로그 — 게이트·단계·범위·사실·산출물·참고자료·정책 확인. 한 줄 + 이유.
 * 업무 일기에도 '결정' 으로 남는다(고객 연결).
 */

import { useState } from 'react'
import { Badge, ListRow, ListSurface, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { STAGE_ORDER } from '../../domain/consulting/workflowDefinition'
import { formatDateTime } from '../../lib/format'
import type { DecisionKind, StageKey } from '../../types/consulting'
import { SelectField, TextField, stageTitle } from './studioParts'

const KIND_LABEL: Record<DecisionKind, string> = {
  gate: '게이트',
  stage: '단계',
  scope: '범위',
  fact: '사실',
  artifact: '산출물',
  reference: '참고자료',
  policy: '공식 기준',
  other: '기타',
}

export function DecisionsTab() {
  const { project: p, decisions, decide } = useEditor()
  const [summary, setSummary] = useState('')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<DecisionKind>('scope')
  const [stage, setStage] = useState<StageKey>(p.currentStage)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (summary.trim() === '') return
    setBusy(true)
    try {
      await decide({ stageKey: stage, kind, summary: summary.trim(), reason: reason.trim() })
      setSummary('')
      setReason('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface>
        <h2 className="t-section text-slate-900">결정 로그</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">"왜 만들었는지 / 왜 안 만들었는지" 를 남깁니다. 단계 완료·게이트·산출물 들여오기·참고자료 선정·공식 기준 확인은 자동으로 적히고, 범위·사실 변경은 여기서 직접 적습니다. 업무 일기에도 같이 남습니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="결정 (한 줄)" value={summary} onCommit={setSummary} placeholder="예: 실제 결제 미구현 — 주문 완료 시뮬레이션으로 검증" />
          </div>
          <TextField label="이유" value={reason} onCommit={setReason} placeholder="예: 결제 자체가 사업가설이 아님. 본개발에서 PG 연동" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="종류" value={kind} options={(Object.keys(KIND_LABEL) as DecisionKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} onChange={setKind} />
            <SelectField label="단계" value={stage} options={STAGE_ORDER.map((k) => ({ value: k, label: k }))} onChange={setStage} />
          </div>
        </div>
        <Button variant="primary" className="mt-3" disabled={busy || summary.trim() === ''} onClick={() => void add()}>기록</Button>
      </Surface>

      <ListSurface>
        {decisions.length === 0 && <ListRow title="아직 결정 기록이 없습니다" meta="단계를 완료하거나 게이트를 정하면 자동으로 쌓입니다." />}
        {decisions.map((d) => (
          <ListRow key={d.id} title={d.summary} meta={d.reason || undefined} badge={<Badge tone="neutral">{KIND_LABEL[d.kind]} · {stageTitle(d.stageKey)}</Badge>} right={formatDateTime(d.createdAt)} />
        ))}
      </ListSurface>
    </div>
  )
}
