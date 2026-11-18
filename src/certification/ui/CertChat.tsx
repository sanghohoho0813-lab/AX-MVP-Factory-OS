/**
 * D-250 기업인증 대화창(대표 "기업인증도 마찬가지 — 진짜 심플하게").
 * D-628 오른쪽 판에 그려진다 — 가운데는 '인증 한눈에' · 인증별 화면 그대로. 답 단추를 누르면 가운데가 그 인증 화면으로 바뀐다.
 * 판정은 Core 그대로(useCertData) — 대화창은 짧은 답 카드로 보여 주고 그 인증 화면으로 바로 보낸다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BadgeCheck, FileStack, ListOrdered, MessageSquareText } from 'lucide-react'
import { WorkChat } from '../../components/chat/WorkChat'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useAiAssistAccess } from '../../auth/ownerAiAccess'
import { useSenderLine } from '../../components/layout/useCurrentUser'
import { todayLocalDate } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { useCertData } from '../integration/useCertData'
import { CERT_GUIDE, CERT_STARTERS, certAiContext, certChatAnswer, certDetailHref, certTopicOf, type CertChatData } from '../../services/workChat/certChat'

const ICONS = { can: <BadgeCheck className="size-5" />, docs: <FileStack className="size-5" />, next: <ListOrdered className="size-5" />, explain: <MessageSquareText className="size-5" /> } as const


export function CertChat({ d, auto }: { d: ReturnType<typeof useCertData>; auto: boolean }) {
  const { loadClients } = useToolClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const access = useAiAssistAccess()
  const sender = useSenderLine()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const today = todayLocalDate()
  useEffect(() => {
    let alive = true
    void loadClients().then(
      (l) => alive && setClients(l.filter((c) => c.archivedAt === null)),
      () => alive && setClients([]),
    )
    return () => {
      alive = false
    }
  }, [loadClients])

  const clientId = d.clientId ?? ''
  const data: CertChatData | null = useMemo(() => (clientId && d.ctx && d.loaded ? { clientId, clientName: d.clientName || d.ctx.companyName, ctx: d.ctx, list: d.list, roadmap: d.roadmap } : null), [clientId, d.ctx, d.loaded, d.clientName, d.list, d.roadmap])
  const owner = access !== 'no'
  const ready = !!clients && (!clientId || (d.loaded && !!d.ctx) || !!d.loadError)

  return (
    <WorkChat
      module="cert"
      scope="cert"
      auto={auto}
      title="기업인증"
      placeholder="예) 이 회사 벤처 받을 수 있어?"
      starters={CERT_STARTERS.map((s) => ({ ...s, icon: ICONS[s.id as keyof typeof ICONS] }))}
      clients={clients}
      clientId={clientId}
      clientName={d.clientName ?? ''}
      needClient
      // 보고 있던 인증 화면 그대로 — 회사만 바꾼다
      onClient={(id) => navigate(id ? `${pathname}?client=${encodeURIComponent(id)}` : pathname, { replace: true })}
      ready={ready}
      ruleAnswer={({ starter, text }) => {
        if (starter) return certChatAnswer(starter, data, null, owner, sender)
        const m = certTopicOf(text ?? '')
        return certChatAnswer(m.topic ?? 'help', data, m.cert, owner, sender)
      }}
      actionsFor={(text) => {
        if (!data) return []
        const m = certTopicOf(text)
        return m.topic ? certChatAnswer(m.topic, data, m.cert, owner, sender).actions.filter((a) => a.href || a.copy).slice(0, 2) : []
      }}
      aiContext={(turns) =>
        data
          ? certAiContext(data, turns, today)
          : { title: '기업인증 대화창', today, purpose: '회사를 고르지 않았다 — 일반 설명만 하고, 회사를 먼저 고르라고 안내한다.', sections: [] }
      }
      assistId="cert.chat"
      page="cert"
      onAct={() => {}}
      detailHref={clientId ? certDetailHref(clientId) : '/tools/cert-os?detail=1'}
      guide={CERT_GUIDE}
      today={today}
    />
  )
}
