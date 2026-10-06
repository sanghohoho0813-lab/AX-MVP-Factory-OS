/**
 * 업체 상세 개요 — '맞는 지원사업' (D-141). 계약 고객이든 잠재고객이든 같은 카드.
 * 맞는 공고 3건 · 확인할 것 · [카톡 문구 복사] · [찾기 링크 복사] · (고객 화면 계정이 있으면) [고객 화면에 올리기].
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing } from 'lucide-react'
import { Section } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { matchesFor } from '../../services/grants/grantMatch'
import { sentAt } from '../../services/grants/grantStore'
import { grantClients } from '../../services/grants/grantView'
import { applicationFor, withGrantChallenge, withoutGrantChallenge } from '../../services/grants/grantApply'
import type { ClientOpsRecord } from '../../types/clientOps'
import { ClientGrantPanel } from './GrantSheets'
import { useGrantActions, useGrantData } from './useGrants'

export function ClientGrantsCard({
  workspaceId,
  record,
  today,
  onFill,
  onCommit,
}: {
  workspaceId: string | null
  record: ClientOpsRecord
  today: string
  onFill: () => void
  /** D-156: '도전해 볼 만함' 체크를 업체 기록에 저장 */
  onCommit?: (next: ClientOpsRecord, message: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { notices, sent, setSent, linkOf, loaded } = useGrantData(workspaceId)
  const actions = useGrantActions({ workspaceId, setSent, linkOf, toast: showToast })
  const client = useMemo(() => grantClients([record], today)[0] ?? null, [record, today])
  const matches = useMemo(() => (client ? matchesFor(notices, client.profile, today) : []), [client, notices, today])
  // 알릴 것은 이 업체를 겨냥한 공고(맞음 · 확인 필요)만 — 전국 공통은 패널에서 접어 보여 준다
  const targeted = useMemo(() => matches.filter((m) => m.verdict !== 'general'), [matches])
  const byId = useMemo(() => new Map(notices.map((n) => [n.id, n])), [notices])
  const challenge = onCommit
    ? {
        busy,
        of: (nid: string) => {
          const n = byId.get(nid)
          return n ? applicationFor(record, n) : null
        },
        toggle: async ({ notice }: { notice: (typeof notices)[number] }) => {
          if (busy) return
          setBusy(true)
          try {
            const on = applicationFor(record, notice)
            const next = on ? withoutGrantChallenge(record, notice) : withGrantChallenge(record, notice).record
            // 신청 준비 · 손으로 적은 건이면 바뀌지 않는다 — '풀었습니다' 라고 거짓으로 말하지 않는다
            if (next === record) showToast('이미 신청 건이 있어요 — 자금 · 지원사업 탭에서 고쳐 주세요')
            else await onCommit(next, on ? `도전 체크를 풀었습니다 — ${notice.title.slice(0, 30)}` : `도전 체크 — ${notice.title.slice(0, 30)} · 마감을 일정 · 오늘에 띄웁니다`)
          } finally {
            setBusy(false)
          }
        },
      }
    : undefined
  if (!loaded || !client) return null
  const more = (
    <button type="button" onClick={() => navigate(`/grants?view=clients&client=${record.id}`)} className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
      지원사업 알림 <ArrowRight aria-hidden="true" className="size-4" />
    </button>
  )
  return (
    <Section title="맞는 지원사업" count={matches.filter((m) => m.verdict === 'fit').length} action={more}>
      <div data-testid="detail-grants">
        {notices.length === 0 ? (
          <p className="t-sub flex items-start gap-2 break-keep text-slate-500">
            <BellRing aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            기업마당 공고를 받아 오면(매일 아침 9시) 이 업체 지역 · 업력 · 업종에 맞는 공고를 여기서 바로 보여 드려요.
          </p>
        ) : (
          <ClientGrantPanel
            client={client}
            matches={matches}
            compact={3}
            sentOf={(nid) => sentAt(sent, record.id, nid)}
            linked={linkOf(record.id) !== null}
            onCopyAll={() => void actions.copyAll(client, targeted)}
            onCopyLink={() => void actions.copyLink(client)}
            onPortal={() => void actions.toPortal(client, targeted)}
            onPick={() => navigate(`/grants?view=clients&client=${record.id}`)}
            onFill={onFill}
            challenge={challenge}
          />
        )}
      </div>
    </Section>
  )
}
