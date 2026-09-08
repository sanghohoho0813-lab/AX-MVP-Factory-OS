/**
 * 증빙 — 실제 신청화면 10개 첨부 슬롯 × Claim–Evidence Matrix.
 * 슬롯마다 주장 · 상태(LIVE/DEMO/FUTURE/시장/목표) · 첨부 제목 · 출처 · 특허/MVP 연결 · 준비 여부.
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { EVIDENCE_SLOTS } from '../../domain/consulting/qaRules'
import { evidenceIssues } from '../../domain/consulting/gateEngine'
import { deleteEvidence, upsertEvidence } from '../../services/consultingStudioService'
import type { ClaimStatus, ConsultingEvidence, EvidenceSlot } from '../../types/consulting'
import { CheckRow, SelectField, TextField } from './studioParts'

const CLAIM_LABEL: Record<ClaimStatus, string> = { live: 'LIVE', demo: 'DEMO', future: 'FUTURE', market: '시장', target: '목표' }
const CLAIM_TONE: Record<ClaimStatus, 'success' | 'warning' | 'brand' | 'neutral'> = { live: 'success', demo: 'warning', future: 'brand', market: 'neutral', target: 'neutral' }

export function EvidenceTab() {
  const { project: p, evidence, workspaceId, refresh, toast, goTo } = useEditor()
  const [busy, setBusy] = useState(false)
  const issues = evidenceIssues(evidence)

  const save = async (item: Partial<ConsultingEvidence> & { projectId: string }) => {
    setBusy(true)
    try {
      await upsertEvidence(workspaceId, item)
      await refresh()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (item: ConsultingEvidence) => {
    try {
      await deleteEvidence(item)
      await refresh()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '지우지 못했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface edge={issues.emptySlots.length === 0 && issues.noSource === 0 ? 'success' : 'warning'} showEdge>
        <h2 className="t-section text-slate-900">증빙 · 인포그래픽 — 10개 첨부 슬롯</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">1,000자 서술 = 논리와 주장, 첨부 = 눈으로 이해시키는 증거. 기본 1장, 중요한 곳만 2장, 총 10~14장 (§33). 각 장에는 메시지 하나.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={issues.emptySlots.length === 0 ? 'success' : 'warning'}>빈 슬롯 {issues.emptySlots.length}</Badge>
          <Badge tone={issues.noSource === 0 ? 'success' : 'danger'}>출처 없는 주장 {issues.noSource}</Badge>
          <Badge tone="neutral">준비 안 됨 {issues.notReady}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('prompts', 'EVIDENCE_REVIEW')}>Claim–Evidence 검토 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'INFOGRAPHIC_BRIEF')}>인포그래픽 기획 프롬프트</Button>
        </div>
      </Surface>

      {EVIDENCE_SLOTS.map((s) => {
        const items = evidence.filter((e) => e.slot === s.slot)
        return (
          <section key={s.slot} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className="t-meta flex size-7 items-center justify-center rounded-full bg-slate-900 font-bold text-white">{s.slot}</span>
              <h3 className="t-card text-slate-900">{s.where}</h3>
              <span className="t-meta text-slate-500">{s.direction} · {s.pages}</span>
              {items.length === 0 && <Badge tone="warning">비어 있음</Badge>}
            </div>
            {items.map((e) => (
              <div key={e.id} className="rounded-(--radius-card) border border-slate-200 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <TextField label="핵심 주장 (한 문장)" value={e.claim} onCommit={(v) => void save({ ...e, claim: v })} placeholder="예: 작업지연 위험분석이 실제 동작한다" />
                  <TextField label="첨부 제목 (인포그래픽 이름)" value={e.title} onCommit={(v) => void save({ ...e, title: v })} />
                  <SelectField label="상태" value={e.claimStatus} options={(Object.keys(CLAIM_LABEL) as ClaimStatus[]).map((k) => ({ value: k, label: CLAIM_LABEL[k] }))} onChange={(v) => void save({ ...e, claimStatus: v })} />
                  <TextField label="객관 증빙 · 출처" value={e.source} onCommit={(v) => void save({ ...e, source: v })} placeholder="화면·테스트·통계+산식·계약서 …" hint={e.claim && !e.source ? '출처가 없으면: 확보 / 표현 약화 / 향후계획 이동 / 삭제 중 하나' : undefined} />
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  <CheckRow label="특허와 연결" checked={e.linksPatent} onChange={(v) => void save({ ...e, linksPatent: v })} />
                  <CheckRow label="MVP 와 연결" checked={e.linksMvp} onChange={(v) => void save({ ...e, linksMvp: v })} />
                  <CheckRow label="첨부 준비됨" checked={e.ready} onChange={(v) => void save({ ...e, ready: v })} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={CLAIM_TONE[e.claimStatus]}>{CLAIM_LABEL[e.claimStatus]}</Badge>
                  <button type="button" onClick={() => void remove(e)} className="t-meta inline-flex items-center gap-1 text-slate-400 hover:text-danger-600">
                    <Trash2 aria-hidden="true" className="size-3.5" /> 지우기
                  </button>
                </div>
              </div>
            ))}
            <Button size="sm" className="self-start" disabled={busy} onClick={() => void save({ projectId: p.id, slot: s.slot as EvidenceSlot, claim: '', title: '', source: '', claimStatus: 'live' })}>
              <Plus aria-hidden="true" className="size-4" /> 이 슬롯에 주장·첨부 추가
            </Button>
          </section>
        )
      })}
    </div>
  )
}
