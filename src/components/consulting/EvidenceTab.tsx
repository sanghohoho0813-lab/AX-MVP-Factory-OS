/**
 * 예전 벤처 증빙 (D-179 · 읽기 전용) — 벤처확인 신청화면 10개 첨부 슬롯 × Claim–Evidence Matrix.
 * LEGACY — 새 벤처 업무는 cert-os/venture 사용. 추가 · 고치기 · 지우기 없음(기록은 그대로).
 */

import { Badge } from '../ui/primitives'
import { useEditor } from './editorContext'
import { EVIDENCE_SLOTS } from '../../domain/consulting/qaRules'
import type { ClaimStatus } from '../../types/consulting'
import { LegacyVentureNotice } from './LegacyVentureNotice'
import { ReadSection, ReadValue } from './legacyRead'

const CLAIM_LABEL: Record<ClaimStatus, string> = { live: 'LIVE', demo: 'DEMO', future: 'FUTURE', market: '시장', target: '목표' }
const CLAIM_TONE: Record<ClaimStatus, 'success' | 'warning' | 'brand' | 'neutral'> = { live: 'success', demo: 'warning', future: 'brand', market: 'neutral', target: 'neutral' }

export function EvidenceTab() {
  const { project: p, evidence } = useEditor()
  const filled = EVIDENCE_SLOTS.filter((s) => evidence.some((e) => e.slot === s.slot))
  const empty = EVIDENCE_SLOTS.filter((s) => !evidence.some((e) => e.slot === s.slot))

  return (
    <div className="flex flex-col gap-4" data-testid="legacy-evidence">
      <LegacyVentureNotice clientId={p.clientId} variant="record" />
      <ReadSection title="증빙 10슬롯" meta={`예전 기록 · 채운 슬롯 ${filled.length}/10`}>
        {filled.length === 0 && <p className="t-body text-slate-400">기록 없음</p>}
        {empty.length > 0 && filled.length > 0 && <p className="t-sub break-keep text-slate-500">기록 없는 슬롯: {empty.map((s) => s.slot).join(' · ')}</p>}
      </ReadSection>
      {filled.map((s) => (
        <ReadSection key={s.slot} title={`${s.slot}. ${s.where}`} testid="legacy-evidence-slot">
          {evidence
            .filter((e) => e.slot === s.slot)
            .map((e) => (
              <div key={e.id} className="flex flex-col gap-1 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                <p className="t-body flex flex-wrap items-center gap-2">
                  <Badge tone={CLAIM_TONE[e.claimStatus]}>{CLAIM_LABEL[e.claimStatus]}</Badge>
                  <ReadValue value={e.claim} />
                </p>
                <p className="t-sub break-keep text-slate-600">
                  첨부 {e.title.trim() || '—'} · 출처 {e.source.trim() || '—'}
                  {e.linksPatent ? ' · 특허와 연결' : ''}
                  {e.linksMvp ? ' · MVP 와 연결' : ''}
                  {e.ready ? ' · 첨부 준비됨' : ''}
                </p>
              </div>
            ))}
        </ReadSection>
      ))}
    </div>
  )
}
