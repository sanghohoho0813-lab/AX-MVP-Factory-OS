/**
 * 미팅 준비 — '이야기할 지원사업' (D-143).
 * 이 회사 지역 · 업력 · 업종에 맞는 접수 중 공고를 미팅에서 꺼낼 거리로. 계약 전 잠재고객에게 연락할 이유가 된다.
 * 공고는 같은 저장소(기업마당 하루 한 번 + 직접 넣은 공고)를 쓴다.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Disclosure } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { matchesFor } from '../../services/grants/grantMatch'
import { sentAt } from '../../services/grants/grantStore'
import { grantClients } from '../../services/grants/grantView'
import type { ClientOpsRecord } from '../../types/clientOps'
import { ClientGrantPanel } from './GrantSheets'
import { useGrantActions, useGrantData } from './useGrants'

export function MeetingGrantTalk({ workspaceId, record, today }: { workspaceId: string | null; record: ClientOpsRecord; today: string }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { notices, sent, setSent, linkOf } = useGrantData(workspaceId)
  const actions = useGrantActions({ workspaceId, setSent, linkOf, toast: showToast })
  const client = useMemo(() => grantClients([record], today)[0] ?? null, [record, today])
  const targeted = useMemo(() => (client ? matchesFor(notices, client.profile, today).filter((m) => m.verdict !== 'general') : []), [client, notices, today])
  if (!client || targeted.length === 0) return null
  const fit = targeted.filter((m) => m.verdict === 'fit').length
  return (
    <div data-testid="meeting-grants">
      <Disclosure title="이야기할 지원사업" hint={`이 회사 조건에 맞음 ${fit}건${targeted.length > fit ? ` · 확인 필요 ${targeted.length - fit}건` : ''} — 미팅에서 꺼낼 거리`}>
        <ClientGrantPanel
          client={client}
          matches={targeted}
          compact={5}
          sentOf={(nid) => sentAt(sent, record.id, nid)}
          linked={linkOf(record.id) !== null}
          onCopyAll={() => void actions.copyAll(client, targeted)}
          onCopyLink={() => void actions.copyLink(client)}
          onPortal={() => void actions.toPortal(client, targeted)}
          onPick={() => navigate(`/grants?view=clients&client=${record.id}`)}
        />
      </Disclosure>
    </div>
  )
}
