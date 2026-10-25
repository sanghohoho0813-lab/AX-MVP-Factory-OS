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
import { liveRows } from '../../services/patent/specTrash'
import { pvBoard } from '../../services/patent/pvBoard'
import { pvBrief } from '../../services/patent/pvBrief'
import { companyFactLines, importableDocs } from '../../services/patent/specMaterials'
import { PvBriefCautions, PvBriefNext, PvBriefSummary, PvResumeCard } from './PvBriefCard'
import { pvSteps } from '../../services/patent/pvSteps'
import { StepProgress } from '../../components/ui/visual'
import { NextActionBar } from '../../components/ui/pageFrame'
import type { FeatureTone } from '../../config/featureVisual'

type DraftRow = { draft: SpecDraft } & Record<string, unknown>
type CertWorkRow = { cert?: string; notes?: Record<string, string> } & Record<string, unknown>

const ICONS = { status: <ListChecks className="size-5" />, write: <FilePen className="size-5" />, check: <FileSearch className="size-5" />, plan: <PenLine className="size-5" /> } as const
/** D-282 큰 단추 아이콘 칸 색 — 특허 · 벤처 도구는 호박색, 진행 확인은 남색 */
const TONES: Record<keyof typeof ICONS, FeatureTone> = { status: 'indigo', write: 'amber', check: 'amber', plan: 'amber' }


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
      drafts: liveRows(drafts.rows).map((r) => ({ id: r.id, clientId: r.clientId, updatedAt: r.updatedAt, draft: r.data.draft })),
      plans: (works.rows ?? []).filter((r) => r.data.cert === 'venture').map((r) => ({ clientId: r.clientId, updatedAt: r.updatedAt, notes: r.data.notes ?? {} })),
      clients: (clients ?? []).map((c) => ({ id: c.id, companyName: c.companyName })),
    }),
    [clientId, clientName, drafts.rows, works.rows, clients],
  )
  const ready = (!!drafts.rows || !!drafts.error) && (!!works.rows || !!works.error) && !!clients
  const owner = access !== 'no'

  const specAi = useOwnerAiAccess()
  // PV-1 회사를 고르면 대화를 시작하지 않아도 준비 현황 · 이미 있는 자료 · 다음 할 일 하나가 먼저(규칙 계산)
  const record = clients?.find((c) => c.id === clientId) ?? null
  const brief = useMemo(
    () => (clientId && ready ? pvBrief({ clientId, drafts: data.drafts, plans: data.plans, clients: data.clients, factLines: companyFactLines(record).length, docs: importableDocs(record).map((d) => d.label), specAi: specAi === 'yes' }) : null),
    [clientId, ready, data, record, specAi],
  )
  const resumeRows = useMemo(() => (!clientId && ready ? pvBoard({ drafts: data.drafts, plans: data.plans, clients: data.clients }) : []), [clientId, ready, data])
  // D-282 단계 표시 — 회사를 고르기 전에는 순서만(회사 고르기가 지금 단계). 고르면 준비 현황 카드 안에 같은 다섯 단계
  const steps = useMemo(() => (ready && !clientId ? pvSteps('', null) : null), [clientId, ready])
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

  // UXS-1 화면 문법 — ① 머리(회사 고르기) ② 단계 ③ 다음 할 일 ④ 대화 판 ⑤ 보조(주의 · 이어서 할 회사)
  const doneSteps = brief ? pvSteps(clientId, brief.row, clientName).filter((st) => st.state === 'done').length : 0
  const resumeFirst = resumeRows.find((r) => r.stage !== 'done')
  const pickResume = (r: (typeof resumeRows)[number]) => (r.clientId ? navigate(`${PV_HOME}?client=${encodeURIComponent(r.clientId)}`, { replace: true }) : navigate(r.next.href))
  const summary = brief ? (
    <PvBriefSummary company={clientName || '이 회사'} clientId={clientId} brief={brief} />
  ) : steps ? (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white px-2 py-3 sm:px-4" aria-label="특허 · 벤처 단계" data-testid="pv-steps">
      <StepProgress
        label={clientName ? `${clientName} 특허 · 벤처 단계` : '특허 · 벤처 단계'}
        steps={steps.map((st) => ({ key: st.key, label: st.label, state: st.state, note: st.note, onClick: st.href ? () => navigate(st.href as string) : undefined }))}
      />
    </section>
  ) : undefined
  // 회사를 안 골랐으면 '지금 할 일' 은 이어서 할 회사가 있을 때만(없으면 머리의 회사 칸이 그 말을 한다 — 첫 화면 글을 늘리지 않게)
  const next = brief ? (
    <PvBriefNext brief={brief} onNewSpec={() => void createDraft(emptyDraft(), '', true)} />
  ) : ready && resumeFirst ? (
    <NextActionBar
      label="이어서 하기"
      tone="amber"
      title={resumeFirst.companyName}
      detail={resumeFirst.next.text}
      action={
        <button type="button" onClick={() => pickResume(resumeFirst)} className="tap t-body inline-flex h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50" data-testid="pv-next-resume">
          {resumeFirst.clientId ? '이 회사 보기' : resumeFirst.next.label}
        </button>
      }
      testId="pv-next"
    />
  ) : undefined
  const aside = brief ? <PvBriefCautions brief={brief} /> : resumeRows.length ? <PvResumeCard rows={resumeRows} onPick={pickResume} /> : undefined

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
        starters={PV_STARTERS.map((s) => ({ ...s, icon: ICONS[s.id as keyof typeof ICONS], tone: TONES[s.id as keyof typeof ICONS] }))}
        frame={{
          art: 'patent-venture',
          // 회사를 안 골랐으면 한 줄 상태는 없음 — 단계 1 '위에서 회사 고르기' 가 같은 말(첫 화면 글 220자 이하 · qa:chat A4)
          sub: clientId && clientName ? `${clientName} — 다섯 단계 중 ${doneSteps}단계 끝 · 명세서 · 점검 · 벤처 사업계획서를 한곳에서` : undefined,
          summary,
          next,
          aside,
        }}
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
        heroTitle={brief || resumeRows.length ? '다른 것을 묻거나 고르세요' : undefined}
      />
    </div>
  )
}
