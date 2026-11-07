/**
 * D-552 모듈 첫 화면 = 대화창(9곳). 대표 "완전한 LLM 느낌 + 아래에 어떻게 묻는지 예시 + 직접 클릭하면서 하고 싶은 사람도".
 *
 *   맨 위: 모듈 이름 · [사용 방법] · [바로 화면] · 회사 고르기
 *   처음: '무엇을 도와드릴까요?' · 이 화면이 하는 일 한 줄 · 질문창 · 큰 단추 4개 · 이렇게 물어보세요(예시)
 *   아래: 직접 눌러서 하기 — 예전 화면들(목차)로 바로 + '이 모듈을 열면: 대화창부터 / 바로 화면'
 * 답은 modChat(규칙 · 판정 그대로). 쓴 말은 대표 · 팀장이면 AI(기존 '직접 물어본 것에 답' 단추와 같은 길).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  BookOpen,
  Building2,
  Calculator,
  CalendarClock,
  ClipboardList,
  FileStack,
  FileText,
  Globe,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MessageSquareText,
  PenLine,
  Search,
  Sparkles,
  Target,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { WorkChat } from './WorkChat'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useEntitlements } from '../../lib/entitlementsStore'
import { useAiAssistAccess, useMarketingAiOn } from '../../auth/ownerAiAccess'
import { todayLocalDate } from '../../lib/appClock'
import { buildInsights } from '../../services/clientInsights'
import { runScenariosCached } from '../../services/scenarios'
import { TAX_CALCULATORS } from '../../services/taxCalc'
import { toolOf } from '../../config/toolRegistry'
import { useGrantNotices } from '../grants/useGrants'
import type { GrantNotice } from '../../services/grants/grantMatch'
import type { ClientOpsRecord } from '../../types/clientOps'
import { MOD_CHAT, modAiContext, modChatActions, modChatAnswer, modGuide, calcHref, type ModChatData } from '../../services/workChat/modChat'
import { CHAT_FIRST_PATHS, CHAT_FIRST_EVENT, modeOf, readChatFirst, writeChatFirst, type ChatFirstKey, type ChatFirstMode } from '../../services/workChat/chatFirst'

const STARTER_ICON: Record<string, LucideIcon> = {
  judge: Target,
  who: Users,
  docs: FileStack,
  scenario: Wand2,
  calc: Calculator,
  basis: BookOpen,
  soon: CalendarClock,
  add: ClipboardList,
  analyze: LineChart,
  results: ListChecks,
  how: MessageSquareText,
  make: PenLine,
  first: ListChecks,
  kakao: MessageSquareText,
  month: CalendarClock,
  score: BadgeCheck,
  sample: LayoutDashboard,
  publish: Globe,
}

interface DirectItem {
  id: string
  label: string
  hint: string
  href: string
  icon: LucideIcon
}

const enc = encodeURIComponent
const withClient = (href: string, clientId: string) => (clientId ? `${href}${href.includes('?') ? '&' : '?'}client=${enc(clientId)}` : href)

/** 직접 눌러서 하기 — 목차가 있는 모듈은 목차 그대로 · 없는 곳은 그 화면의 갈래 */
function directItems(k: ChatFirstKey, clientId: string): DirectItem[] {
  const base = CHAT_FIRST_PATHS[k]
  if (k === 'tax')
    return [
      { id: 'plan', label: '원하는 결과로 찾기', hint: '“대표가 1억 가져오기” 처럼 결과부터 — 가장 싼 길', href: withClient('/tools/tax?m=plan', clientId), icon: Search },
      ...TAX_CALCULATORS.map((c) => ({ id: c.key, label: `${c.no} ${c.title}`, hint: c.desc, href: calcHref(c.key, clientId || null), icon: Calculator })),
      { id: 'basis', label: '계산 기준표', hint: '세율 · 공제 · 4대보험 요율 한 표', href: '/tools/tax?m=basis', icon: BookOpen },
    ]
  if (k === 'grants')
    return [
      { id: 'notices', label: '공고별로 보기', hint: '받아 둔 공고 · 맞는 업체 수 · 마감', href: '/grants?view=notices', icon: FileText },
      { id: 'clients', label: '업체별로 보기', hint: '업체마다 도전할 만한 공고', href: withClient('/grants?view=clients', clientId), icon: Building2 },
      { id: 'applying', label: '신청 진행', hint: '도전 체크한 공고 · 서류 대조 · 마감', href: '/grants?view=applying', icon: ListChecks },
    ]
  const tool = toolOf(k)
  const sections = tool?.sections ?? []
  if (sections.length === 0) return [{ id: 'open', label: `${MOD_CHAT[k].title} 화면`, hint: '예전 화면 그대로', href: withClient(`${base}?direct=1`, clientId), icon: LayoutDashboard }]
  return sections.map((s) => ({ id: s.key, label: s.label, hint: s.hint ?? '', href: withClient(`${base}/${s.key}`, clientId), icon: (s.icon as LucideIcon) ?? LayoutDashboard }))
}

const FIRST_DIRECT = 6

function DirectArea({ k, clientId }: { k: ChatFirstKey; clientId: string }) {
  const items = useMemo(() => directItems(k, clientId), [k, clientId])
  const [all, setAll] = useState(false)
  const [mode, setMode] = useState<ChatFirstMode>(() => modeOf(readChatFirst(), k))
  const shown = all ? items : items.slice(0, FIRST_DIRECT)
  const pick = (m: ChatFirstMode) => {
    setMode(m)
    writeChatFirst({ mods: { [k]: m } })
  }
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" aria-label="직접 눌러서 하기" data-testid="modchat-direct">
      <div className="flex flex-col gap-1">
        <h2 className="t-section font-bold text-slate-900">직접 눌러서 하기</h2>
        <p className="t-sub break-keep text-slate-600">대화 없이 화면에서 바로 하고 싶으면 아래에서 고르세요. 누르면 예전 화면 그대로 열려요.</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="modchat-direct-list">
        {shown.map((it) => (
          <li key={it.id}>
            <Link to={it.href} className="tap flex h-full items-start gap-3 rounded-(--radius-control) border border-slate-200 bg-white p-3 hover:border-brand-400 hover:bg-slate-50" data-testid="modchat-direct-item" data-id={it.id}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
                <it.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="t-body block font-semibold break-keep text-slate-900">{it.label}</span>
                {it.hint && <span className="t-sub line-clamp-2 block break-keep text-slate-600">{it.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > FIRST_DIRECT && (
        <button type="button" onClick={() => setAll((v) => !v)} className="tap t-sub self-start rounded-(--radius-control) px-2 py-1.5 font-semibold text-brand-700 hover:bg-slate-100" data-testid="modchat-direct-more">
          {all ? '접기' : `${items.length - FIRST_DIRECT}개 더 보기`}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" data-testid="modchat-mode">
        <span className="t-sub font-semibold text-slate-700">이 화면을 열면</span>
        <div role="radiogroup" aria-label="이 화면을 열면" className="inline-flex rounded-(--radius-control) border border-slate-300 p-0.5">
          {(
            [
              ['chat', '대화창부터'],
              ['direct', '바로 화면'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => pick(m)}
              className={`tap t-sub min-h-10 rounded-[calc(var(--radius-control)-2px)] px-3 font-semibold ${mode === m ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              data-testid={`modchat-mode-${m}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="t-sub break-keep text-slate-500">{mode === 'direct' ? '다음부터 대화창 없이 예전 화면으로 열려요(위 [대화로 묻기] 로 언제든 돌아와요).' : '모든 모듈은 설정 › 내 설정에서 한 번에 바꿀 수 있어요.'}</span>
      </div>
    </section>
  )
}

const CLIENT_KEY = (k: ChatFirstKey) => `axmvp.modchat.client.${k}`

function ModuleChatInner({ k, notices }: { k: ChatFirstKey; notices: readonly GrantNotice[] }) {
  const cfg = MOD_CHAT[k]
  const { loadClients } = useToolClient()
  const { ent } = useEntitlements()
  const access = useAiAssistAccess()
  const marketingAi = useMarketingAiOn()
  // 홈페이지 AI 는 대표만 · 홍보 글 AI 는 마케팅이 열린 계정만(서버와 같은 기준) — 아니면 쓴 질문도 정해진 답
  const aiOn = k === 'homepage' ? access === 'owner' : k === 'content' ? marketingAi : true
  const today = todayLocalDate()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [clientId, setClientId] = useState(() => {
    try {
      return sessionStorage.getItem(CLIENT_KEY(k)) ?? ''
    } catch {
      return ''
    }
  })

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

  const onClient = (id: string) => {
    setClientId(id)
    try {
      if (id) sessionStorage.setItem(CLIENT_KEY(k), id)
      else sessionStorage.removeItem(CLIENT_KEY(k))
    } catch {
      /* 이번 화면만 */
    }
  }

  const client = useMemo(() => (clients ?? []).find((c) => c.id === clientId) ?? null, [clients, clientId])
  const usable = useCallback((key: string) => key === 'grants' || ent.feature(key).usable, [ent])
  const insightOf = useCallback(
    (r: ClientOpsRecord, light = false) => (cfg.insightKey ? (buildInsights(r, today, notices, (key) => key === cfg.insightKey && usable(key), light)[0] ?? null) : null),
    [cfg.insightKey, today, notices, usable],
  )
  const scenariosOf = useCallback((r: ClientOpsRecord) => (cfg.scenarioModule ? runScenariosCached(r, today, (m) => m === cfg.scenarioModule && usable(m), true).filter((s) => s.module === cfg.scenarioModule) : []), [cfg.scenarioModule, today, usable])
  const noticeLite = useMemo(() => notices.map((n) => ({ id: n.id, title: n.title, deadline: n.applyEnd ?? '' })), [notices])
  const data: ModChatData = useMemo(() => ({ today, clients: clients ?? [], client, insightOf, scenariosOf, notices: noticeLite }), [today, clients, client, insightOf, scenariosOf, noticeLite])

  const name = client?.companyName ?? '○○'
  const icons = (id: string): ReactNode => {
    const I = STARTER_ICON[id] ?? Sparkles
    return <I className="size-5" />
  }

  return (
    <WorkChat
      module={k}
      title={cfg.title}
      heroSub={cfg.sub}
      placeholder={client ? cfg.placeholder.replace(/한솔테크|○○/, client.companyName) : cfg.placeholder}
      starters={cfg.starters.map((s) => ({ ...s, icon: icons(s.id) }))}
      examples={cfg.examples(name)}
      clients={clients}
      clientId={clientId}
      clientName={client?.companyName ?? ''}
      needClient={false}
      onClient={onClient}
      ready={!!clients}
      ruleAnswer={(input) => modChatAnswer(cfg, input, data)}
      actionsFor={(text) => modChatActions(cfg, text, data)}
      aiContext={(turns) => modAiContext(cfg, data, turns)}
      assistId={cfg.assist.id}
      page={cfg.assist.page}
      onAct={() => {}}
      detailHref={withClient(`${CHAT_FIRST_PATHS[k]}?direct=1`, clientId)}
      detailLabel="바로 화면"
      guide={modGuide(cfg)}
      today={today}
      aiOn={aiOn}
      below={<DirectArea k={k} clientId={clientId} />}
    />
  )
}

function GrantsChat() {
  const { workspaceId } = useToolClient()
  const notices = useGrantNotices(workspaceId)
  return <ModuleChatInner k="grants" notices={notices} />
}

const NO_NOTICES: readonly GrantNotice[] = []

export function ModuleChat({ k }: { k: ChatFirstKey }) {
  // 설정에서 바꾸면 바로 따르게(다른 탭 포함)
  const [, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener(CHAT_FIRST_EVENT, on)
    return () => window.removeEventListener(CHAT_FIRST_EVENT, on)
  }, [])
  return (
    <div data-testid="modchat" data-module={k}>
      {k === 'grants' ? <GrantsChat /> : <ModuleChatInner k={k} notices={NO_NOTICES} />}
    </div>
  )
}
