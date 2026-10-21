/**
 * D-250 특허 · 벤처 첫 화면 = 대화창(대표 "LLM 채팅창처럼 · 아주 간단하게"). 예전 첫 화면(진행판 · 도구 카드)은 /patent-venture/more([자세히]).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePen, FileSearch, ListChecks, PenLine } from 'lucide-react'
import { useToast } from '../../components/ui/toastContext'
import { WorkChat } from '../../components/chat/WorkChat'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useModuleBucket } from '../../tools/shared/useModuleBucket'
import { useAiAssistAccess, useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { todayLocalDate } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'
import { emptyDraft, type SpecDraft } from '../../services/patent/specDraft'
import { sampleDraft } from '../../services/patent/specCoach'
import { PV_HOME, specAutoHref, specHref } from '../../services/patent/pvBoard'
import { parseSpecFile } from '../../services/patent/specParse'
import { checkSpec } from '../../services/patent/specCheck'
import { topicOf } from '../../services/workChat/chatTypes'
import { PV_GUIDE, PV_STARTERS, PV_TOPICS, pvAiContext, pvAnswer, pvFileAnswer, pvHelpAnswer, type PvChatData } from '../../services/workChat/pvChat'

type DraftRow = { draft: SpecDraft } & Record<string, unknown>
type CertWorkRow = { cert?: string; notes?: Record<string, string> } & Record<string, unknown>

const ICONS = { status: <ListChecks className="size-5" />, write: <FilePen className="size-5" />, check: <FileSearch className="size-5" />, plan: <PenLine className="size-5" /> } as const


export function PatentVentureChatPage() {
  const drafts = useModuleBucket<DraftRow>('patent-draft', 'draft')
  const works = useModuleBucket<CertWorkRow>('cert-os', 'work')
  const { clientId: urlClient, loadClients } = useToolClient()
  const clientId = urlClient ?? ''
  const access = useAiAssistAccess()
  const { showToast } = useToast()
  const navigate = useNavigate()
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

  const clientName = clients?.find((c) => c.id === clientId)?.companyName ?? ''
  const data: PvChatData = useMemo(
    () => ({
      clientId,
      clientName,
      drafts: (drafts.rows ?? []).map((r) => ({ id: r.id, clientId: r.clientId, updatedAt: r.updatedAt, draft: r.data.draft })),
      plans: (works.rows ?? []).filter((r) => r.data.cert === 'venture').map((r) => ({ clientId: r.clientId, updatedAt: r.updatedAt, notes: r.data.notes ?? {} })),
      clients: (clients ?? []).map((c) => ({ id: c.id, companyName: c.companyName })),
    }),
    [clientId, clientName, drafts.rows, works.rows, clients],
  )
  const ready = (!!drafts.rows || !!drafts.error) && (!!works.rows || !!works.error) && !!clients
  const owner = access !== 'no'

  const specAi = useOwnerAiAccess()
  const createDraft = async (draft: SpecDraft, msg: string, auto = false) => {
    try {
      const r = await drafts.save({ clientId, data: { draft } })
      if (msg) showToast(msg)
      // D-261 대표(AI)의 새 명세서는 열자마자 AI 가 처음부터 끝까지 — 타자 치는 단계 화면으로 보내지 않는다
      navigate(auto && specAi === 'yes' ? specAutoHref(r.id, clientId) : specHref(r.id, clientId, 'idea'))
    } catch (e) {
      showToast(`만들지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="pv-chat-page">
      {(drafts.error || works.error) && (
        <p role="alert" className="t-sub break-keep rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-900">
          기록 일부를 읽지 못했어요 — 저장한 것은 그대로 있어요. 잠시 뒤 새로 고쳐 주세요.
        </p>
      )}
      <WorkChat
        module="pv"
        title="특허 · 벤처"
        placeholder="예) 이 회사 명세서 어디까지 썼어?"
        starters={PV_STARTERS.map((s) => ({ ...s, icon: ICONS[s.id as keyof typeof ICONS] }))}
        clients={clients}
        clientId={clientId}
        clientName={clientName}
        needClient={false}
        onClient={(id) => navigate(id ? `${PV_HOME}?client=${encodeURIComponent(id)}` : PV_HOME, { replace: true })}
        ready={ready}
        ruleAnswer={({ starter, text }) => {
          const topic = starter ?? topicOf(text ?? '', PV_TOPICS)
          return topic ? pvAnswer(topic, data, owner) : pvHelpAnswer(owner)
        }}
        actionsFor={(text) => {
          const topic = topicOf(text, PV_TOPICS)
          return topic ? pvAnswer(topic, data, owner).actions.slice(0, 2) : []
        }}
        aiContext={(turns) => pvAiContext(data, turns, today)}
        assistId="pv.chat"
        page="patent"
        onAct={(k) => {
          if (k === 'new-spec') void createDraft(emptyDraft(), '', true)
          else if (k === 'sample') void createDraft(sampleDraft(), '견본을 열었습니다 — 1~4단계는 채워져 있어요. 단계를 넘기며 보고 5 본문을 직접 써 보세요')
        }}
        onFile={async (f) => pvFileAnswer(f.name, checkSpec(await parseSpecFile(f.name, new Uint8Array(await f.arrayBuffer()))))}
        fileAccept=".hwpx,.md,.txt,.markdown"
        detailHref={`${PV_HOME}/more${clientId ? `?client=${encodeURIComponent(clientId)}` : ''}`}
        guide={PV_GUIDE}
        today={today}
      />
    </div>
  )
}
