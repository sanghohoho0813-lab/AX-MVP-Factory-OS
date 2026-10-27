/**
 * D-273 마케팅 · 브랜딩 › 스레드 — 대표 "쓰레드는 원래 없던 부분이라 기능을 잘 만들어 달라".
 * 대표가 준 스레드 실측 공식(틀 23가지 · 첫 줄 · 끝 · 쓰는 순서 · 4주 운영안 · 하루 10분)을 그대로 화면으로.
 *  ① 오늘 쓸 글   원하는 반응 → 틀 → 소재 · 태그 → [AI로 글 3개 쓰기] 또는 [예시 · 빈 틀로 시작] → 고치며 규칙 검사(규칙 계산) → 복사 · 저장 · 올렸어요
 *  ② 기록표       올린 뒤 조회 · 좋아요 · 답글 · 리포스트 · 공유 · 문의 → 점수(좋아요 + 답글×3 + 리포스트×2 + 공유×3) · 틀별 평균 = 우리 계정에서 되는 틀
 *  ③ 틀 23가지    뼈대 · 왜 되나 · 우리가 쓰면 · 예시 · 첫 줄 10가지 · 끝 11가지
 *  ④ 하루 10분    오늘 할 일 체크 · 태그 검색 열기 · 전문가 답글 틀 · 요일 계획
 * 대표 전용(마케팅 · 브랜딩 모듈 · 팀장에게 안 보임). 저장은 기존 모듈 기록(marketing / threads).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AtSign, BookOpen, CalendarCheck, CheckCircle2, ClipboardCopy, Download, ExternalLink, FilePlus2, Heart, Lightbulb, MessageCircle, NotebookPen, RefreshCw, Save, Send, Share2, SlidersHorizontal, TriangleAlert, UserPlus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile, Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useViewingPilot } from '../../auth/osAccess'
import { useMarketingAiOn } from '../../auth/ownerAiAccess'
import { MarketingTabs } from '../../tools/marketing/MarketingTabs'
import { BigChoices, DeleteTwice, FactsBox, HoverTip, InnerTabs, LintList, RewriteTable, ShareKit, StatInputs, StepTitle, TipBody, ToneSection, chip } from './snsParts'
import { TONES, scrollAndFlash, toneChip, type Tone } from './snsTone'
import { QuickStart } from './QuickStart'
import { Fold, HelpHeading, HintTip, openFold } from '../../components/ui/fold'
import { readWeekTopics, recommendThread, topicChips, topicTag } from '../../services/marketing/quickStart'
import { todayLocalDate } from '../../lib/appClock'
import { AssistError, callAssist, type AssistAnswer } from '../../services/aiAssist/client'
import { AiAssist } from '../../components/ai/AiAssist'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { useThreadPosts, useWeekRef } from '../../services/marketing/useSnsPosts'
import { isMarketingCustomer, mkText } from '../../services/marketing/persona'
import {
  BEFORE_POST,
  ENDINGS,
  EXPERT_REPLY,
  FIRST_LINES,
  GOALS,
  GOAL_EASY,
  TEMPLATE_EASY,
  NOT_THIS,
  PRIORITY_TOPICS,
  ROUTINE,
  STAT_KEYS,
  THREAD_MAX,
  THREAD_TEMPLATES,
  TOPIC_TAGS,
  WEEK_PLAN,
  EMPTY_STATS,
  firstLineOf,
  lintThreadPost,
  parseThreadDrafts,
  postsThisWeek,
  recordsCsv,
  skeletonDraft,
  templateOf,
  templateRecords,
  threadScore,
  threadsContext,
  todayPlan,
  mondayOf,
  WEEK_REF_MAX,
  type WeekRef,
  type WeekRefItem,
  type EndingKind,
  type ThreadDraft,
  type ThreadGoal,
  type ThreadPost,
  type ThreadTemplate,
  type ThreadTemplateKey,
} from '../../services/marketing/threads'

type Tab = 'write' | 'records' | 'library' | 'routine'
// D-298 대표 "기록표 · 틀 23가지 · 하루 10분 — 뭘 위한 칸인지 모르겠다" — 칸마다 색 · 마우스를 올리면(휴대폰은 아래 한 줄) 무엇을 하는 곳인지
const TABS: ReadonlyArray<{ key: Tab; label: string; short: string; icon: typeof AtSign; tone: Tone; tip: string }> = [
  { key: 'write', label: '오늘 쓸 글', short: '쓰기', icon: NotebookPen, tone: 'rose', tip: '주제만 고르면 스레드 글을 써 주는 곳이에요. 고치고 복사해서 올려요.' },
  { key: 'records', label: '기록표', short: '기록표', icon: CalendarCheck, tone: 'emerald', tip: '올린 글의 조회 · 좋아요 숫자를 적는 곳이에요. 어떤 틀이 잘 되는지 숫자로 알려 줘요.' },
  { key: 'library', label: '틀 23가지', short: '틀', icon: BookOpen, tone: 'violet', tip: '잘 된 글의 모양 23가지를 모은 설명서예요. 틀 = 글을 쓰는 순서예요.' },
  { key: 'routine', label: '하루 10분', short: '10분', icon: CheckCircle2, tone: 'amber', tip: '매일 10분 할 일 체크표예요 — 글 쓰기 · 답글 달기 · 월요일 · 금요일 할 일.' },
]

/** D-298 원하는 반응마다 색 · 그림 — 틀 번호 딱지도 그 틀의 첫 반응 색 */
const GOAL_TONE: Readonly<Record<ThreadGoal, Tone>> = { reply: 'sky', share: 'emerald', follow: 'violet', like: 'rose' }
const GOAL_ICON = { reply: MessageCircle, share: Share2, follow: UserPlus, like: Heart } as const
const GOAL_CHOICES = GOALS.map((g) => ({ ...g, tone: GOAL_TONE[g.key], tip: GOAL_EASY[g.key], icon: GOAL_ICON[g.key] }))
/**
 * 틀 색 = 그 틀이 잘 되는 반응 색. D-299 대표 "반응을 고르면 틀이 색별로 나뉘는데 가끔 하나씩 다른 색이 섞여 있다" —
 * 두 반응에 다 좋은 틀(I 판 깔기 = 답글 · 팔로워)은 예전엔 첫 반응 색만 보였다. 지금 고른 반응이 그 틀에 맞으면 그 반응 색으로 칠한다.
 */
const toneOfTemplate = (t: ThreadTemplate, ctx: ThreadGoal | '' = ''): Tone => (ctx && t.goals.includes(ctx) ? GOAL_TONE[ctx] : (GOAL_TONE[t.goals[0]] ?? 'slate'))
const GOAL_SHORT: Readonly<Record<ThreadGoal, string>> = { reply: '답글', share: '공유', follow: '팔로워', like: '공감' }

/** 이 틀이 잘 되는 반응 — 색 딱지(두 반응에 다 좋으면 두 개) */
function GoalTags({ t, dots = false }: { t: ThreadTemplate; dots?: boolean }) {
  if (dots)
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`잘 되는 반응: ${t.goals.map((g) => GOAL_SHORT[g]).join(' · ')}`} data-testid="thr-goaldots">
        {t.goals.map((g) => (
          <span key={g} aria-hidden="true" className={`inline-block size-2 rounded-full ${TONES[GOAL_TONE[g]].bar}`} />
        ))}
      </span>
    )
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid="thr-goaltags">
      {t.goals.map((g) => (
        <span key={g} className={`t-meta inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-semibold ${TONES[GOAL_TONE[g]].line} ${TONES[GOAL_TONE[g]].soft} ${TONES[GOAL_TONE[g]].ink}`}>
          <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${TONES[GOAL_TONE[g]].bar}`} />
          {GOAL_SHORT[g]}
        </span>
      ))}
    </span>
  )
}

/** AI 가 다른 틀로 썼을 때 원하는 반응도 그 틀에 맞춘다 — [형식 바꾸기] 를 열면 그 틀이 골라져 보이게(반응 목록에 없는 틀이면 아무것도 안 골라져 보였다) */
function goalFor(k: ThreadTemplateKey, g: ThreadGoal | ''): ThreadGoal | '' {
  const t = templateOf(k)
  if (!t) return g
  return g && t.goals.includes(g) ? g : t.goals[0]
}

/** 틀 설명(마우스를 올리면 · ? 를 누르면) — 쉽게 말하면 · 예시 */
function templateTip(t: ThreadTemplate): string {
  const e = TEMPLATE_EASY[t.key]
  return `${t.key} ${t.name}\n${e.plain}\n\n예시\n${e.sample}`
}

/** 글 속 틀 이름 — 색 밑줄 · 마우스를 올리면 뜻 · 예시 */
function TplName({ k }: { k: ThreadTemplateKey }) {
  const t = templateOf(k)
  if (!t) return <>{k}</>
  const tone = TONES[toneOfTemplate(t)]
  return (
    <HoverTip tip={<TipBody title={`${t.key} ${t.name}`} body={TEMPLATE_EASY[t.key].plain} example={TEMPLATE_EASY[t.key].sample} />} testId="thr-tpltip">
      <span className={`cursor-help rounded-md px-1.5 py-0.5 font-semibold underline decoration-dotted underline-offset-2 ${tone.soft} ${tone.ink}`} data-testid="thr-tplname" data-key={t.key}>
        {t.key} {t.name}
      </span>
    </HoverTip>
  )
}

/** 틀 이름 여러 개 — ' / ' 로 잇기 */
function TplNames({ keys }: { keys: readonly ThreadTemplateKey[] }) {
  return (
    <>
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && <span className="text-slate-400"> / </span>}
          <TplName k={k} />
        </span>
      ))}
    </>
  )
}
const tabOf = (raw: string | null): Tab => (TABS.some((t) => t.key === raw) ? (raw as Tab) : 'write')

interface Draft {
  id?: string
  goal: ThreadGoal | ''
  template: ThreadTemplateKey | ''
  topic: string
  tag: string
  facts: string
  reference: string
  body: string
  selfComment: string
  checks: string[]
  source: ThreadPost['source']
  /** MUX-2 형식을 누가 정했나 — 'rec' 추천 · 'hand' 직접 고름(추천이 덮지 않음) */
  formatBy?: 'rec' | 'hand'
}
const EMPTY_DRAFT: Draft = { goal: '', template: '', topic: '', tag: '', facts: '', reference: '', body: '', selfComment: '', checks: [], source: 'hand' }

/** 아직 저장 안 한 글 — 이 브라우저에만(새로고침 · 저장 실패에도 적은 것이 남게) */
const DRAFT_KEY = 'mirae.threads.draft.v1'
function readDraft(): Draft {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null
    if (v && typeof v === 'object') return { ...EMPTY_DRAFT, ...v, reference: '', checks: Array.isArray(v.checks) ? v.checks.filter((x) => typeof x === 'string') : [] }
  } catch {
    // 못 읽으면 빈 글
  }
  return EMPTY_DRAFT
}
function writeDraft(d: Draft): void {
  try {
    // 참고 글(남의 글)은 남기지 않는다
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, reference: '' }))
  } catch {
    // 저장 공간이 없으면 이번 접속 동안만
  }
}

export default function ThreadsPage() {
  return <WorkspaceScope>{(ctx) => <Threads workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}

function Threads({ workspaceId }: { workspaceId: string | null }) {
  const readOnly = useViewingPilot() !== null
  // SAAS-2 고객도 서버가 마케팅을 열었으면(사용량 장부로 셈) AI 를 쓴다 — 대표 판정은 그대로
  const aiOk = useMarketingAiOn() && !readOnly
  const store = useThreadPosts(workspaceId, readOnly)
  const week = useWeekRef(workspaceId, readOnly)
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  const go = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'write') next.delete('tab')
    else next.set('tab', t)
    setParams(next)
  }
  // D-274 다른 채널에서 '같은 소재로' 를 누르고 왔으면 소재를 채운다(주소의 topic 은 한 번 쓰고 지운다)
  const [draft, setDraftState] = useState<Draft>(() => {
    const d = readDraft()
    const t = params.get('topic')?.slice(0, 200)
    if (!t) return d
    // MUX-2 주제를 들고 왔으면 형식도 그 주제에 맞춰 추천(이번 주 잘 된 틀은 읽은 뒤 화면이 다시 맞춘다)
    const r = recommendThread({ topic: t })
    return { ...d, topic: t, goal: r.goal, template: r.template, tag: r.tag || d.tag, formatBy: 'rec' }
  })
  useEffect(() => {
    if (!params.get('topic')) return
    const next = new URLSearchParams(params)
    next.delete('topic')
    setParams(next, { replace: true })
  }, [params, setParams])
  const setDraft = (fn: (d: Draft) => Draft) =>
    setDraftState((d) => {
      const n = fn(d)
      writeDraft(n)
      return n
    })
  const openPost = (p: ThreadPost) => {
    setDraft(() => ({ ...EMPTY_DRAFT, id: p.id, goal: p.goal, template: p.template, topic: p.topic, tag: p.tag, body: p.body, selfComment: p.selfComment, checks: p.checks, source: p.source }))
    go('write')
  }
  const pickTemplate = (t: ThreadTemplate) => {
    setDraft((d) => ({ ...d, template: t.key, goal: d.goal && t.goals.includes(d.goal) ? d.goal : t.goals[0] }))
    go('write')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5" data-testid="thr-page">
      <PageHeader
        title="마케팅 · 브랜딩"
        showOnPhone
        descriptionAsHint
        description="스레드 글을 실측 공식대로 씁니다 — 원하는 반응을 고르면 맞는 틀이 나오고, 쓰는 동안 500자 · 첫 줄 · 끝 · 본문 판매 · 보장 문구를 규칙으로 바로 확인합니다(규칙 계산). 올린 뒤 숫자를 적으면 우리 계정에서 되는 틀이 숫자로 나옵니다."
      />
      <MarketingTabs active="threads" />
      <InnerTabs tabs={TABS} value={tab} onPick={go} label="스레드" testPrefix="thr" />
      {store.failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="thr-failed">
          <p className="t-sub min-w-[12rem] flex-1 break-keep text-warning-700">스레드 기록을 읽지 못했습니다. 적어 둔 글은 이 화면에 그대로 있고, 다시 읽기 전에는 저장하지 않습니다.</p>
          <Button size="sm" variant="secondary" onClick={() => void store.reload()} data-testid="thr-retry">
            <RefreshCw aria-hidden="true" className="size-4" /> 다시 읽기
          </Button>
        </div>
      )}
      {readOnly && <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 text-slate-600">팀장 화면을 보는 중에는 저장하지 않습니다.</p>}
      {tab === 'write' && <WritePanel draft={draft} setDraft={setDraft} store={store} weekRef={week.ref} aiOk={aiOk} readOnly={readOnly} onRecords={() => go('records')} onLibrary={() => go('library')} onRoutine={() => go('routine')} />}
      {tab === 'records' && <RecordsPanel store={store} readOnly={readOnly} onOpen={openPost} />}
      {tab === 'library' && <LibraryPanel onUse={pickTemplate} />}
      {tab === 'routine' && <RoutinePanel week={week} readOnly={readOnly} onWrite={() => go('write')} onRecords={() => go('records')} />}
    </div>
  )
}

type Store = ReturnType<typeof useThreadPosts>

/* ------------------------------------------------------------------ */
/* ① 오늘 쓸 글                                                         */
/* ------------------------------------------------------------------ */

function WritePanel({ draft, setDraft, store, weekRef, aiOk, readOnly, onRecords, onLibrary, onRoutine }: { draft: Draft; setDraft: (fn: (d: Draft) => Draft) => void; store: Store; weekRef: WeekRef | null; aiOk: boolean; readOnly: boolean; onRecords: () => void; onLibrary: () => void; onRoutine: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayLocalDate()
  const plan = todayPlan(today)
  const goal = GOALS.find((g) => g.key === draft.goal)
  const picks = (goal?.picks ?? (plan ? plan.picks : ['P', 'B', 'T', 'U', 'Q', 'E'])).map((k) => templateOf(k)).filter((t): t is ThreadTemplate => !!t)
  const tpl = draft.template ? templateOf(draft.template) : undefined
  const hotKeys = new Set((weekRef?.items ?? []).map((x) => x.template))
  const [ai, setAi] = useState<{ busy: boolean; error: string; drafts: ThreadDraft[] }>({ busy: false, error: '', drafts: [] })
  const [saving, setSaving] = useState(false)
  const factsText = `${draft.facts}\n${draft.topic}`
  const lint = useMemo(() => lintThreadPost({ body: draft.body, template: draft.template, tag: draft.tag, selfComment: draft.selfComment, recent: store.posts, id: draft.id, today, facts: factsText }), [draft.body, draft.template, draft.tag, draft.selfComment, draft.id, store.posts, today, factsText])
  const set = (part: Partial<Draft>) => setDraft((d) => ({ ...d, ...part }))
  const bodyNow = useRef(draft.body)
  bodyNow.current = draft.body

  // MUX-2 추천 형식(규칙) — 사람이 직접 고른 틀이 있으면 그것, 없으면 주제 · 오늘 계획 · 이번 주 잘 된 틀로
  const rec = useMemo(() => recommendThread({ topic: draft.topic, today, weekRef }), [draft.topic, today, weekRef])
  const eff = draft.template ? { goal: (draft.goal || templateOf(draft.template)?.goals[0] || rec.goal) as ThreadGoal, template: draft.template } : { goal: rec.goal, template: rec.template }
  const chips = useMemo(() => topicChips(readWeekTopics(today), PRIORITY_TOPICS), [today])
  const pickTopic = (t: string) => {
    // 칩으로 새 주제를 고르면 형식도 그 주제에 맞춰 다시 추천 — 사람이 직접 고른 틀은 덮지 않는다
    if (draft.formatBy === 'hand' && draft.template) return set({ topic: t, tag: draft.tag || topicTag(t) })
    const r = recommendThread({ topic: t, today, weekRef })
    set({ topic: t, goal: r.goal, template: r.template, tag: r.tag || draft.tag, formatBy: 'rec' })
  }
  const openFormats = () => {
    openFold('thr.formats')
    scrollAndFlash('thr-choose')
  }
  const pickGoal = (g: ThreadGoal) => set({ goal: g, template: draft.template && templateOf(draft.template)?.goals.includes(g) ? draft.template : '', formatBy: 'hand' })
  const startBody = (body: string, source: Draft['source'], tag?: string) => {
    if (draft.body.trim() && draft.body.trim() !== body.trim() && !window.confirm('지금 쓰던 글을 이 글로 바꿀까요? (쓰던 글은 사라집니다)')) return
    set({ body, source, ...(tag && !draft.tag ? { tag } : {}), checks: [] })
    document.getElementById('thr-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const startSkeleton = () => {
    const t = templateOf(eff.template)
    if (!t) return
    if (!draft.template) set({ goal: eff.goal, template: eff.template, tag: draft.tag || rec.tag, formatBy: 'rec' })
    startBody(skeletonDraft(t, draft.topic), 'hand')
  }

  /** auto — 글 칸이 비어 있으면 1안을 바로 넣는다(쓰던 글은 덮지 않는다) */
  const runAi = async (pick?: { goal: ThreadGoal | ''; template: ThreadTemplateKey | ''; tag: string }, auto = false) => {
    if (ai.busy) return
    setAi({ busy: true, error: '', drafts: [] })
    const use = pick ?? { goal: draft.goal, template: draft.template, tag: draft.tag }
    try {
      const context = threadsContext({ goal: use.goal, template: use.template, topic: draft.topic, tag: use.tag, facts: draft.facts, reference: draft.reference, recent: store.posts, today, weekRef })
      const run = await callAssist({ requestId: newRequestId(), assistId: 'threads.write', page: 'threads', choice: readChoice(), context })
      const { drafts, tag } = parseThreadDrafts(run.structured)
      if (!drafts.length) throw new AssistError('provider_error', 'AI 답에서 글을 찾지 못했어요 — 다시 눌러 주세요.')
      setAi({ busy: false, error: '', drafts })
      if (tag) setDraft((d) => (d.tag ? d : { ...d, tag }))
      if (auto) {
        // 기다리는 사이 글 칸에 쓴 것이 있으면 덮지 않는다(가장 최근 화면 값으로 본다)
        const first = drafts[0]
        const fill = !bodyNow.current.trim()
        if (fill) set({ body: first.body, source: 'ai', selfComment: first.selfComment, checks: first.checks, ...(first.template ? { template: first.template, goal: goalFor(first.template, use.goal) } : {}) })
        showToast(fill ? '1안을 글 칸에 넣었어요 — 다른 안은 "AI로 바로 쓰기" 아래에 있어요.' : '쓰던 글은 그대로 두었어요 — AI 글은 "AI로 바로 쓰기" 아래에서 골라 넣어요.')
        if (fill) window.setTimeout(() => document.getElementById('thr-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      }
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error && e.message ? e.message : '다시 눌러 주세요.', drafts: [] })
    }
  }
  const runQuick = () => {
    if (!draft.topic.trim()) return
    // 형식을 아직 안 정했으면 추천대로 정해 두고 쓴다 — '형식 직접 고르기' 에도 그대로 보인다
    const pick = draft.template ? { goal: eff.goal, template: draft.template, tag: draft.tag || rec.tag } : { goal: rec.goal, template: rec.template, tag: draft.tag || rec.tag }
    if (!draft.template || !draft.tag) set({ goal: pick.goal, template: pick.template, tag: pick.tag, ...(draft.template ? {} : { formatBy: 'rec' as const }) })
    return runAi(pick, true)
  }
  const takeDraft = (d: ThreadDraft) => {
    startBody(d.body, 'ai')
    set({ selfComment: d.selfComment, checks: d.checks, ...(d.template ? { template: d.template, goal: goalFor(d.template, draft.goal) } : {}) })
  }

  const save = async (posted: boolean) => {
    if (!draft.body.trim()) return showToast('글이 비어 있어요.')
    if (readOnly) return showToast('팀장 화면을 보는 중에는 저장하지 않습니다.')
    if (saving) return
    setSaving(true)
    try {
      const prev = draft.id ? store.posts.find((p) => p.id === draft.id) : undefined
      const saved = await store.save({
        id: draft.id,
        template: draft.template,
        goal: draft.goal,
        topic: draft.topic,
        tag: draft.tag,
        body: draft.body.trim(),
        selfComment: draft.selfComment.trim(),
        checks: draft.checks,
        status: posted ? 'posted' : (prev?.status ?? 'draft'),
        postedOn: posted ? (prev?.postedOn || today) : (prev?.postedOn ?? ''),
        stats: prev?.stats ?? EMPTY_STATS,
        source: draft.source,
      })
      if (posted) {
        setDraft(() => ({ ...EMPTY_DRAFT }))
        setAi({ busy: false, error: '', drafts: [] })
        showToast('기록표에 올렸어요 — 하루 이틀 뒤 숫자를 적어 주세요.')
        onRecords()
      } else {
        set({ id: saved.id })
        showToast('저장했어요 — 기록표의 "쓰다 둔 글" 에 있어요.')
      }
    } catch (e) {
      showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message} (적은 글은 이 화면에 그대로 있어요)` : '저장하지 못했어요 — 적은 글은 이 화면에 그대로 있어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="thr-write">
      {/* MUX-2 주제 하나 → 바로 쓰기 — 형식은 오늘 계획 · 이번 주 잘 된 틀로 추천(규칙). 직접 고르기는 아래에 접어 둠(지운 것 없음) */}
      <QuickStart
        testPrefix="thr"
        topic={draft.topic}
        onTopic={(t) => set({ topic: t })}
        onPick={pickTopic}
        chips={chips}
        recLabel={`${GOALS.find((g) => g.key === eff.goal)?.label ?? ''} · ${eff.template} ${templateOf(eff.template)?.name ?? ''}`}
        recWhy={rec.why}
        recTip={templateOf(eff.template) ? templateTip(templateOf(eff.template) as ThreadTemplate) : undefined}
        picked={!!draft.template && draft.formatBy !== 'rec'}
        onChangeFormat={openFormats}
        facts={<FactsBox value={draft.facts} onChange={(v) => set({ facts: v })} testPrefix="thr" what="글" />}
        ai={{ ok: aiOk, busy: ai.busy, error: ai.error, label: 'AI로 바로 쓰기', onRun: () => void runQuick() }}
        fallback={{ label: aiOk ? '뼈대만 받기' : '뼈대로 시작', onClick: startSkeleton }}
      >
        {ai.drafts.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-3" data-testid="thr-ai-drafts">
            {ai.drafts.map((d, i) => (
              <AiDraftCard key={i} n={i + 1} d={d} tag={draft.tag} recent={store.posts} facts={factsText} onUse={() => takeDraft(d)} />
            ))}
          </ul>
        )}
      </QuickStart>

      {/* D-299 대표 "마케팅 · 브랜딩 어디서든 LLM 모델을 골라 요청" — 이 화면에도 AI 도우미 판: 모델 고르기 · 직접 묻기(스레드 공식으로 답) ·
          [스레드 글 3개 쓰기] 를 고른 모델로 → 답의 [글 칸에 넣기]. 띠에는 단추를 늘어놓지 않는다(위 [AI로 바로 쓰기] 와 겹치지 않게) */}
      {aiOk && (
        <AiAssist
          page="threads"
          title="스레드"
          presets={['threads.write']}
          quick={0}
          build={() => ({ context: threadsContext({ goal: draft.goal, template: draft.template, topic: draft.topic, tag: draft.tag, facts: draft.facts, reference: draft.reference, recent: store.posts, today, weekRef }), links: {} })}
          itemActions={(id) =>
            id === 'threads.write'
              ? [
                  {
                    id: 'thr-use',
                    label: '글 칸에 넣기',
                    primary: true,
                    run: (item) => {
                      const d = parseThreadDrafts({ headline: '', items: [item] } as AssistAnswer).drafts[0]
                      if (!d) return false
                      takeDraft(d)
                      return true
                    },
                  },
                ]
              : null
          }
        />
      )}

      {/* D-275 이번 주 잘 터진 형식 — 참고만(기본은 우리 공식) · 없으면 월요일에 적으라고 한 줄. MUX-2 주제 고르기 아래로(첫 행동이 먼저 보이게) */}
      <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-amber-200 bg-amber-50/70 px-3 py-2.5" data-testid="thr-week-hint">
        <p className="t-sub min-w-[12rem] flex-1 break-keep text-slate-700">
          {hotKeys.size ? (
            <>
              <b className="text-slate-900">이번 주 잘 터진 형식(참고)</b> · <TplNames keys={[...hotKeys]} /> — 기본은 우리 공식, AI 는 글 하나에만 참고해요
            </>
          ) : (
            '이번 주 잘 터진 형식을 아직 안 적었어요 — 월요일에 한 번, 인기 글 3~5개의 형식만 적으면 돼요(매일 모을 필요 없어요)'
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={onRoutine} data-testid="thr-week-go">
          {hotKeys.size ? '고치기' : '적으러 가기'}
        </Button>
      </div>
      {/* D-298 대표 "[형식 바꾸기] 누르면 아래에 쭉 뜨는 건 좋은데 막상 내려 보면 눈에 안 들어온다 · 색이 없다" —
          보라 테두리 칸 · 펼치며 잠깐 빛남 · 안은 색 구역 넷(① 반응 하늘 · ② 틀 보라 · ③ 태그 초록 · ④ 남의 글 회색) */}
      <Fold
        id="thr.formats"
        title="형식 직접 고르기"
        hint="추천 형식 말고 내가 글 모양(틀)을 직접 고르는 곳이에요. 원하는 반응 → 틀 → 주제 태그 순서로 골라요."
        icon={<SlidersHorizontal aria-hidden="true" className="size-5 text-violet-600" />}
        summary={`원하는 반응 · 틀 23가지 · 주제 태그${draft.tag ? ` (#${draft.tag})` : ''} · 남의 글 뼈대`}
        className="scroll-mt-24 rounded-(--radius-panel) border-2 border-violet-200 bg-violet-50/40 px-3 py-1 data-[open=1]:pb-4 sm:px-4"
        testId="thr-choose"
      >
        {plan && (
          <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-amber-200 bg-amber-50 px-3 py-2.5" data-testid="thr-plan">
            <p className="t-sub min-w-[12rem] flex-1 break-keep leading-relaxed text-slate-700">
              <CalendarCheck aria-hidden="true" className="mr-1 inline size-4 align-[-0.15em] text-amber-600" />
              <b className="text-slate-900">오늘({plan.day}) 계획 — {plan.label}</b> · <TplNames keys={plan.picks} />
            </p>
            <Button size="sm" variant="secondary" onClick={() => set({ goal: plan.goal, template: plan.picks[0], formatBy: 'hand' })} data-testid="thr-plan-use">
              이 계획으로
            </Button>
          </div>
        )}
        <ToneSection n="1" tone="sky" title="원하는 반응" help="이 글을 읽은 사람이 무엇을 해 주면 좋겠는지 골라요. 고르면 그 반응에 잘 맞는 틀만 남아요." testId="thr-sec-goal">
          <BigChoices items={GOAL_CHOICES} value={draft.goal} onPick={pickGoal} label="원하는 반응" testPrefix="thr-goal" />
        </ToneSection>
        <ToneSection n="2" tone="violet" title="틀 고르기" help="틀 = 글을 쓰는 순서예요. 잘 된 글 수백 개를 보고 모양이 같은 것끼리 묶었어요. 틀 이름에 마우스를 올리면 뜻 · 예시가 나와요." testId="thr-sec-tpl">
          {/* D-299 대표 "틀 3개가 고정이라 별로 — 먼저 추천해 주고, 23개가 조그맣게라도 다 나열돼서 마우스를 올리면 정의 · 예시" —
              ① 추천 틀(반응 · 오늘 계획) 큰 단추 ② 그 아래 틀 전부 작은 색 단추(반응 색 · ★ 추천 · 이번 주 잘 됨) — 어느 것이든 바로 고른다 */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-sub min-w-[12rem] flex-1 break-keep text-slate-700" data-testid="thr-picks-why">
              <b className="text-violet-800">★ 추천</b> ·{' '}
              {goal ? `'${goal.label}' 에 잘 된 틀 — 앞쪽일수록 실측 숫자가 좋았어요.` : plan ? `오늘(${plan.day}) 계획 '${plan.label}' 에 맞는 틀이에요.` : '자주 쓰는 틀이에요.'} 딱지 = 그 틀이 잘 되는 반응. 아래에서 다른 틀도 바로 골라요.
            </p>
            <Button size="sm" variant="ghost" onClick={onLibrary} data-testid="thr-all-templates">
              <BookOpen aria-hidden="true" className="size-4" /> 틀 설명서
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="thr-picks">
            {picks.map((t) => (
              <li key={t.key} className="min-w-0">
                <TemplateButton t={t} on={draft.template === t.key} hot={hotKeys.has(t.key)} ctx={draft.goal || plan?.goal || ''} onClick={() => set({ template: t.key, goal: draft.goal || t.goals[0], formatBy: 'hand' })} />
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-white/80 p-2.5 sm:p-3" data-testid="thr-all-tpls">
            <p className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-slate-700">
              <b className="text-slate-900">틀 전부 — 눌러서 바로 골라요</b>
              <span className="text-slate-500">마우스를 올리면 뜻 · 예시{' · '}휴대폰은 누르면 아래 상자에</span>
            </p>
            {/* D-299 색 읽는 법 — 색 = 그 틀이 잘 되는 반응 · 점 두 개 = 두 반응에 다 좋음 · 고른 반응에 맞는 틀은 진하게 */}
            <p className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-slate-600" data-testid="thr-color-legend">
              <span>
                <b className="text-slate-800">색 = 잘 되는 반응</b> · 점이 두 개면 두 반응에 다 좋아요
                {goal ? (
                  <>
                    {' · '}
                    <b className={TONES[GOAL_TONE[goal.key]].ink}>'{goal.label}'</b> 에 맞는 틀은 진하게
                  </>
                ) : null}
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1" aria-label="색 뜻">
                {GOAL_CHOICES.map((g) => (
                  <span key={g.key} className="t-meta inline-flex items-center gap-1 text-slate-600">
                    <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${TONES[g.tone].bar}`} />
                    {g.label}
                  </span>
                ))}
              </span>
            </p>
            {/* 휴대폰도 두 줄(8.5rem) — 큰 글자면 저절로 한 줄 */}
            <ul className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr))' }}>
              {THREAD_TEMPLATES.map((t) => (
                <li key={t.key} className="min-w-0">
                  <MiniTemplate t={t} on={draft.template === t.key} rec={picks.some((x) => x.key === t.key)} hot={hotKeys.has(t.key)} ctx={draft.goal} onClick={() => set({ template: t.key, goal: goalFor(t.key, draft.goal), formatBy: 'hand' })} />
                </li>
              ))}
            </ul>
          </div>
          {tpl && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border-2 border-violet-200 bg-white px-3 py-3" data-testid="thr-tpl-detail">
              <p className="t-body font-bold break-keep text-slate-900">
                {tpl.key} {tpl.name} <span className="t-meta font-normal text-slate-600">· {tpl.reaction}</span>
              </p>
              {/* D-298 쉽게 말하면 · 예시 — 휴대폰(마우스 없음)도 고르면 여기서 본다 */}
              <p className="t-sub flex items-start gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 break-keep text-violet-950" data-testid="thr-tpl-plain">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <span className="min-w-0">
                  <b>쉽게 말하면</b> {TEMPLATE_EASY[tpl.key].plain}
                </span>
              </p>
              <p className="t-sub rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-2.5 py-2 break-keep whitespace-pre-line text-slate-800" data-testid="thr-tpl-sample">
                <b className="text-amber-800">예시</b>
                {'\n'}
                {TEMPLATE_EASY[tpl.key].sample}
              </p>
              <ol className="t-sub flex flex-wrap items-center gap-x-1.5 gap-y-1 break-keep text-slate-700" aria-label="뼈대">
                {tpl.skeleton.map((s, i) => (
                  <li key={s} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true" className="text-violet-400">→</span>}
                    <span className="rounded-md bg-violet-100/70 px-1.5 py-0.5 text-violet-950">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="t-sub break-keep text-slate-700">
                <b>왜 되나</b> {tpl.why}
              </p>
              {!isMarketingCustomer() && (
                <p className="t-sub break-keep text-slate-700">
                  <b>우리가 쓰면</b> {tpl.ours}
                </p>
              )}
              {tpl.caution && (
                <p className="t-sub flex items-start gap-1.5 break-keep text-warning-800">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {tpl.caution}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {tpl.example && !isMarketingCustomer() && (
                  <Button size="sm" variant="secondary" onClick={() => startBody(tpl.example ?? '', 'example', tpl.exampleTag)} data-testid="thr-use-example">
                    <FilePlus2 aria-hidden="true" className="size-4" /> 예시 글로 시작
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startBody(skeletonDraft(tpl, draft.topic), 'hand')} data-testid="thr-use-skeleton">
                  빈 틀로 시작
                </Button>
              </div>
            </div>
          )}
        </ToneSection>
        <ToneSection n="3" tone="emerald" title="주제 태그 1개" help="스레드에서 글 주제를 묶어 주는 낱말이에요. 하나만 붙이면 그 주제를 찾는 사람에게 더 잘 보여요." testId="thr-sec-tag">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="주제 태그">
            {TOPIC_TAGS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={draft.tag === t} onClick={() => set({ tag: draft.tag === t ? '' : t })} className={toneChip('emerald', draft.tag === t)} data-testid={`thr-tag-${t}`}>
                #{t}
              </button>
            ))}
          </div>
        </ToneSection>
        <details className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-testid="thr-ref-box">
          <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">
            <span aria-hidden="true" className="mr-1.5 inline-flex size-6 items-center justify-center rounded-full bg-slate-700 text-[0.75rem] font-bold text-white">4</span>
            잘 된 남의 글 붙여넣기 (선택 — 뼈대만 빌림 · 저장 안 함)
          </summary>
          <textarea value={draft.reference} onChange={(e) => set({ reference: e.target.value })} rows={4} className="t-body mt-2 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2" placeholder="첫 줄 기법 · 줄 수 · 끝 방식만 빌리고 문장은 새로 씁니다" data-testid="thr-ref" />
        </details>
      </Fold>

      <Surface className="flex flex-col gap-3">
        <div id="thr-editor" className="scroll-mt-24">
          <StepTitle n="2">고치기 · 규칙 검사</StepTitle>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" data-testid="thr-editor">
          <div className="flex min-w-0 flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="t-sub font-semibold text-slate-700">
                  글{tpl && ' — '}
                  {tpl && <TplName k={tpl.key} />}
                </span>
                <span className={`t-sub font-bold tabular-nums ${lint.chars > THREAD_MAX ? 'text-danger-700' : 'text-slate-600'}`} data-testid="thr-count">
                  {lint.chars} / {THREAD_MAX}자
                </span>
              </span>
              <textarea value={draft.body} onChange={(e) => set({ body: e.target.value })} rows={13} placeholder={'첫 줄 15~25자\n둘째 줄 = 왜 너 얘기인지\n\n한 줄에 한 생각\n\n끝 = 대답하기 쉬운 것 하나'} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 leading-relaxed" data-testid="thr-body" />
            </label>
            <label className="flex flex-col gap-1">
              <HintTip tip="내 글에 내가 다는 첫 댓글이에요. 본문에서는 팔지 않고, 자료 · 링크 안내는 여기에만 적어요. 조회가 1,000을 넘으면 달아요." label="본인 댓글" tight>
                <span className="t-sub font-semibold text-slate-700">본인 댓글 (조회 1,000 넘으면 · 진단 · 자료 안내는 여기만)</span>
              </HintTip>
              <input value={draft.selfComment} onChange={(e) => set({ selfComment: e.target.value })} placeholder={isMarketingCustomer() ? '예: 자세한 정리는 프로필 링크에서' : '예: 3분 진단은 프로필 링크에서'} className="t-body min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="thr-comment" />
            </label>
            {draft.checks.length > 0 && (
              <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="thr-checks">
                <p className="t-sub font-semibold text-warning-900">올리기 전 확인할 것(AI 가 적음)</p>
                <ul className="t-sub list-disc pl-5 break-keep text-warning-900">
                  {draft.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copyText(draft.body.trim()).then((ok) => showToast(ok ? '글을 복사했어요 — 스레드에 붙여 넣으세요.' : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.'))} disabled={!draft.body.trim()} data-testid="thr-copy">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
              </Button>
              {!readOnly && (
                <>
                  <Button variant="secondary" onClick={() => void save(false)} disabled={!draft.body.trim() || saving} data-testid="thr-save">
                    <Save aria-hidden="true" className="size-4" /> 저장
                  </Button>
                  <Button variant="primary" onClick={() => void save(true)} disabled={!draft.body.trim() || saving} data-testid="thr-posted">
                    <Send aria-hidden="true" className="size-4" /> 올렸어요 · 기록표로
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => (draft.body.trim() && !window.confirm('지금 글을 비우고 새로 쓸까요?') ? undefined : (setDraft(() => ({ ...EMPTY_DRAFT })), setAi({ busy: false, error: '', drafts: [] })))} data-testid="thr-new">
                새 글
              </Button>
            </div>
            {/* D-274 보충본 1-3 "한 주제를 여러 채널로" — 같은 소재 · 태그를 들고 릴스 · 틱톡으로 */}
            {draft.topic.trim() && (
              <Button variant="ghost" className="self-start" onClick={() => navigate(`/marketing/shorts?topic=${encodeURIComponent(draft.topic.trim())}`)} data-testid="thr-to-shorts">
                같은 소재로 릴스 · 틱톡 만들기 →
              </Button>
            )}
            {(draft.template === 'P' || lint.ending === 'material') && <ShareKit testId="thr-share" />}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <HintTip tip="글이 규칙대로 잘 써졌는지 바로 확인해 줘요(규칙 계산). 빨강 = 꼭 고칠 것 · 노랑 = 한 번 볼 것 · 초록 = 괜찮아요." label="규칙 검사" tight>
                <span className="t-sub font-semibold text-slate-700">규칙 검사</span>
              </HintTip>
              {lint.bad > 0 ? <Badge tone="danger">고칠 것 {lint.bad}</Badge> : <Badge tone="success">고칠 것 0</Badge>}
              {lint.warn > 0 && <Badge tone="warning">볼 것 {lint.warn}</Badge>}
            </div>
            <LintList lines={draft.body.trim() ? lint.lines : []} testId="thr-lint" />
            {!draft.body.trim() && <p className="t-sub break-keep text-slate-500">글을 쓰면 여기서 바로 확인해요.</p>}
            <details className="rounded-(--radius-control) border border-slate-200 px-3 py-2">
              <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">올리기 전 사람이 볼 것 {BEFORE_POST.length}가지</summary>
              <ul className="t-sub mt-1 list-disc pl-5 break-keep text-slate-700">
                {BEFORE_POST.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </Surface>
    </div>
  )
}

function TemplateButton({ t, on, hot = false, ctx = '', onClick }: { t: ThreadTemplate; on: boolean; hot?: boolean; ctx?: ThreadGoal | ''; onClick: () => void }) {
  // D-298 번호 딱지는 그 틀의 반응 색 · 마우스를 올리면 쉽게 말하면 · 예시. D-299 추천 칸에서는 고른 반응 색으로 맞추고 잘 되는 반응 딱지를 붙인다
  const tone = TONES[toneOfTemplate(t, ctx)]
  return (
    <HoverTip block className="h-full" tip={<TipBody title={`${t.key} ${t.name}`} body={TEMPLATE_EASY[t.key].plain} example={TEMPLATE_EASY[t.key].sample} />} testId="thr-tpltip">
      <button type="button" aria-pressed={on} onClick={onClick} className={`tap flex h-full min-h-16 w-full min-w-0 flex-col items-start gap-1 rounded-(--radius-control) border-2 px-3 py-2.5 text-left ${on ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : `${tone.line} bg-white ${tone.hover}`}`} data-testid={`thr-tpl-${t.key}`}>
        <span className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
          <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md border text-[0.85rem] font-bold ${tone.solid}`}>{t.key}</span>
          <span className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">{t.name}</span>
          {hot && (
            <Badge tone="warning" className="shrink-0">
              이번 주 잘 됨
            </Badge>
          )}
        </span>
        <span className="t-sub break-keep text-slate-600">{t.reaction}</span>
        <GoalTags t={t} />
      </button>
    </HoverTip>
  )
}

/** D-299 틀 전부 — 작은 색 단추(번호 딱지는 반응 색 · ★ 추천 · 🔥 이번 주 잘 됨) · 마우스를 올리면 쉽게 말하면 · 예시 */
function MiniTemplate({ t, on, rec, hot, ctx, onClick }: { t: ThreadTemplate; on: boolean; rec: boolean; hot: boolean; ctx: ThreadGoal | ''; onClick: () => void }) {
  const tone = TONES[toneOfTemplate(t, ctx)]
  // 고른 반응에 안 맞는 틀은 흐리게(그래도 누르면 고를 수 있다)
  const fits = !ctx || t.goals.includes(ctx)
  return (
    <HoverTip block className="h-full" tip={<TipBody title={`${t.key} ${t.name}`} body={TEMPLATE_EASY[t.key].plain} example={TEMPLATE_EASY[t.key].sample} />} testId="thr-tpltip">
      <button
        type="button"
        aria-pressed={on}
        onClick={onClick}
        className={`tap t-sub flex h-full min-h-11 w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left font-semibold break-keep ${on ? 'border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-violet-300' : `${tone.line} bg-white text-slate-800 ${tone.hover}`} ${fits || on ? '' : 'opacity-50 hover:opacity-100'}`}
        data-testid={`thr-mini-${t.key}`}
        data-rec={rec ? '1' : '0'}
        data-fits={fits ? '1' : '0'}
      >
        <span aria-hidden="true" className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-[0.78rem] font-bold ${tone.solid}`}>
          {t.key}
        </span>
        {/* 반응 점은 이름 아래 줄 — 휴대폰 두 줄 칸에서 이름이 낱말 가운데서 끊기지 않게 */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="leading-tight">{t.name}</span>
          <GoalTags t={t} dots />
        </span>
        {rec && (
          <span className="shrink-0 text-amber-500" title="추천">
            ★
          </span>
        )}
        {hot && (
          <span className="shrink-0" title="이번 주 잘 됨">
            🔥
          </span>
        )}
      </button>
    </HoverTip>
  )
}

function AiDraftCard({ n, d, tag, recent, facts, onUse }: { n: number; d: ThreadDraft; tag: string; recent: readonly ThreadPost[]; facts: string; onUse: () => void }) {
  const lint = lintThreadPost({ body: d.body, template: d.template, tag, recent, facts })
  const t = d.template ? templateOf(d.template) : undefined
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3" data-testid="thr-ai-draft">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="t-sub font-bold text-slate-900">{n}안</span>
        {t && <Badge tone="brand">{t.key} {t.name}</Badge>}
        <Badge tone={lint.bad ? 'danger' : 'success'}>{lint.chars}자 · 고칠 것 {lint.bad}</Badge>
      </div>
      <p className="t-sub max-h-48 overflow-y-auto break-keep whitespace-pre-line text-slate-800">{d.body}</p>
      {d.selfComment && <p className="t-meta break-keep text-slate-500">본인 댓글: {d.selfComment}</p>}
      <Button size="sm" variant="secondary" onClick={onUse} data-testid="thr-ai-use">
        이 글로 고치기
      </Button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* ② 기록표                                                            */
/* ------------------------------------------------------------------ */

function RecordsPanel({ store, readOnly, onOpen }: { store: Store; readOnly: boolean; onOpen: (p: ThreadPost) => void }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const posted = store.posts.filter((p) => p.status === 'posted')
  const drafts = store.posts.filter((p) => p.status === 'draft')
  const week = postsThisWeek(store.posts, today)
  const recs = templateRecords(store.posts)
  const scores = posted.map((p) => threadScore(p.stats)).filter((x): x is number => x != null)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const inquiries = posted.reduce((a, p) => a + (p.stats.inquiries ?? 0), 0)
  const best = recs.find((r) => r.scored >= 3)

  if (!store.loaded) return <p className="t-sub text-slate-500">기록을 읽는 중…</p>
  return (
    <div className="flex flex-col gap-4" data-testid="thr-records">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div data-testid="thr-rec-count" className="contents">
          <MetricTile label="올린 글" value={`${posted.length}개`} />
        </div>
        <div data-testid="thr-rec-week" className="contents">
          <MetricTile label="이번 주" value={`${week.length} / 5`} />
        </div>
        <MetricTile label="평균 점수" value={avg == null ? '—' : avg.toLocaleString('ko-KR')} />
        <MetricTile label="문의" value={`${inquiries}건`} />
      </div>
      <Surface className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <HelpHeading help="올린 글의 숫자를 모아 틀마다 평균을 낸 표예요. 점수가 높은 틀을 더 자주 쓰면 돼요." wrapClassName="min-w-[12rem] flex-1" className="t-section break-keep text-slate-900">
            우리 계정에서 되는 틀
          </HelpHeading>
          <Button size="sm" variant="ghost" onClick={() => downloadText(`스레드-기록표-${today}.csv`, `﻿${recordsCsv(store.posts)}`, 'text/csv')} disabled={!posted.length} data-testid="thr-rec-csv">
            <Download aria-hidden="true" className="size-4" /> CSV
          </Button>
        </div>
        <p className="t-sub break-keep text-slate-600">점수 = 좋아요 + 답글×3 + 리포스트×2 + 공유×3 (남의 계정 실측과 같은 계산). 틀마다 글이 3개 넘게 쌓이면 그 숫자를 공식보다 먼저 믿어요.{best ? ` 지금은 ${best.key} ${best.name} 이(가) 가장 좋아요.` : ''}</p>
        {recs.length ? (
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="thr-rec-templates">
            {recs.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="thr-rec-template" data-key={r.key}>
                <span className="t-body min-w-[9rem] flex-1 font-semibold break-keep text-slate-900">
                  <TplName k={r.key} />
                </span>
                <span className="t-sub tabular-nums text-slate-600">{r.posts}개</span>
                <span className="t-sub font-bold tabular-nums text-slate-900">평균 {r.avgScore == null ? '—' : r.avgScore.toLocaleString('ko-KR')}</span>
                <span className="t-sub tabular-nums text-slate-600">조회 {r.avgViews == null ? '—' : r.avgViews.toLocaleString('ko-KR')}</span>
                {r.inquiries > 0 && <Badge tone="brand">문의 {r.inquiries}</Badge>}
                {r.scored < 3 && <Badge>표본 적음</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">아직 올린 글이 없어요 — [오늘 쓸 글] 에서 쓰고 [올렸어요] 를 누르면 여기에 쌓입니다.</p>
        )}
      </Surface>
      {posted.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="올린 글">
          <h2 className="t-section break-keep text-slate-900">올린 글 — 숫자 적기</h2>
          <ul className="flex flex-col gap-2" data-testid="thr-rec-list">
            {posted.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
      {drafts.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="쓰다 둔 글">
          <h2 className="t-section break-keep text-slate-900">쓰다 둔 글 {drafts.length}</h2>
          <ul className="flex flex-col gap-2" data-testid="thr-rec-drafts">
            {drafts.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function RecordItem({ p, store, readOnly, onOpen, showToast }: { p: ThreadPost; store: Store; readOnly: boolean; onOpen: () => void; showToast: (m: string) => void }) {
  const t = p.template ? templateOf(p.template) : undefined
  const score = threadScore(p.stats)
  const put = (part: Partial<ThreadPost>) => store.patch(p.id, part).catch((e: unknown) => showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message}` : '저장하지 못했어요.'))
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid="thr-rec-item" data-id={p.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        {p.status === 'posted' ? <Badge tone="success">{p.postedOn.slice(5).replace('-', '/')} 올림</Badge> : <Badge>쓰다 둠</Badge>}
        {t && <Badge tone="brand">{t.key} {t.name}</Badge>}
        {p.tag && <Badge>#{p.tag}</Badge>}
        {score != null && (
          <span className="t-sub ml-auto font-bold tabular-nums text-slate-900" data-testid="thr-rec-score">
            점수 {score.toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      <p className="t-body line-clamp-2 font-semibold break-keep text-slate-900">{firstLineOf(p.body)}</p>
      {p.status === 'posted' && <StatInputs keys={STAT_KEYS} values={p.stats} disabled={readOnly} onSet={(k, v) => void put({ stats: { ...p.stats, [k]: v } })} testPrefix="thr" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onOpen} data-testid="thr-rec-open">
          열어서 고치기
        </Button>
        {!readOnly && p.status === 'draft' && (
          <Button size="sm" variant="secondary" onClick={() => void put({ status: 'posted', postedOn: todayLocalDate() })} data-testid="thr-rec-post">
            <Send aria-hidden="true" className="size-4" /> 올렸어요
          </Button>
        )}
        {!readOnly && <DeleteTwice onDelete={() => void store.remove(p.id).catch(() => showToast('지우지 못했어요 — 다시 눌러 주세요.'))} testPrefix="thr-rec" />}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* ③ 틀 23가지                                                          */
/* ------------------------------------------------------------------ */

function LibraryPanel({ onUse }: { onUse: (t: ThreadTemplate) => void }) {
  const [goal, setGoal] = useState<ThreadGoal | ''>('')
  const list = goal ? THREAD_TEMPLATES.filter((t) => t.goals.includes(goal)) : THREAD_TEMPLATES
  return (
    <div className="flex flex-col gap-4" data-testid="thr-library">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="반응으로 거르기">
        <button type="button" role="radio" aria-checked={goal === ''} onClick={() => setGoal('')} className={chip(goal === '')} data-testid="thr-lib-filter-all">
          전체 {THREAD_TEMPLATES.length}
        </button>
        {GOAL_CHOICES.map((g) => {
          const Icon = g.icon
          return (
            <HoverTip key={g.key} tip={<TipBody title={g.label} body={g.tip} />}>
              <button type="button" role="radio" aria-checked={goal === g.key} onClick={() => setGoal(g.key)} className={toneChip(g.tone, goal === g.key)} data-testid={`thr-lib-filter-${g.key}`}>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {g.label}
              </button>
            </HoverTip>
          )
        })}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="thr-lib-list">
        {list.map((t) => (
          <li key={t.key} className="min-w-0">
            <Surface className="flex h-full flex-col gap-2" as="article">
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${TONES[toneOfTemplate(t, goal)].bar}`} />
              <div className="flex flex-wrap items-center gap-1.5" data-testid="thr-lib-card" data-key={t.key}>
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border font-bold ${TONES[toneOfTemplate(t, goal)].solid}`}>{t.key}</span>
                <h3 className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">{t.name}</h3>
                {t.few && <Badge>표본 적음</Badge>}
                <GoalTags t={t} />
              </div>
              {/* D-298 쉽게 말하면 — 카드 맨 위 한 줄(초등학생도) · 예시는 펼쳐서 */}
              <p className={`t-sub flex items-start gap-1.5 rounded-lg px-2.5 py-2 break-keep text-slate-800 ${TONES[toneOfTemplate(t, goal)].soft}`} data-testid="thr-lib-plain">
                <Lightbulb aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${TONES[toneOfTemplate(t, goal)].icon}`} />
                <span className="min-w-0">{TEMPLATE_EASY[t.key].plain}</span>
              </p>
              <p className="t-meta break-keep text-slate-600">
                {t.reaction}
                {t.median != null ? ` · 점수 중앙값 ${t.median.toLocaleString('ko-KR')}` : ''}
              </p>
              <ol className="t-sub list-decimal pl-5 break-keep text-slate-800">
                {t.skeleton.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="t-sub break-keep text-slate-700">
                <b>왜</b> {t.why}
              </p>
              {!isMarketingCustomer() && (
                <p className="t-sub break-keep text-slate-700">
                  <b>우리가 쓰면</b> {t.ours}
                </p>
              )}
              {t.caution && <p className="t-sub break-keep text-warning-800">⚠ {t.caution}</p>}
              <details className="rounded-(--radius-control) border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2" data-testid="thr-lib-sample">
                <summary className="tap t-sub cursor-pointer font-semibold text-amber-900">짧은 예시 보기</summary>
                <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-800">{TEMPLATE_EASY[t.key].sample}</p>
              </details>
              {t.example && !isMarketingCustomer() && (
                <details className="rounded-(--radius-control) bg-slate-50 px-3 py-2">
                  <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">우리 버전 예시</summary>
                  <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-800">{t.example}</p>
                </details>
              )}
              <div className="mt-auto">
                <Button size="sm" variant="secondary" onClick={() => onUse(t)} data-testid="thr-lib-use">
                  이 틀로 쓰기
                </Button>
              </div>
            </Surface>
          </li>
        ))}
        {!goal && (
          <li className="min-w-0">
            <Surface className="flex h-full flex-col gap-2 border-dashed" as="article">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-300 font-bold text-slate-700">{NOT_THIS.key}</span>
                <h3 className="t-body min-w-0 flex-1 font-bold break-keep text-slate-700">{NOT_THIS.name} — 쓰지 않음</h3>
              </div>
              <p className="t-sub break-keep text-slate-600">{NOT_THIS.why}</p>
            </Surface>
          </li>
        )}
      </ul>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">이렇게 말고 → 이렇게</h2>
        <p className="t-sub break-keep text-slate-600">대표님이 정한 원칙 · 넣지 말 것 — 규칙 검사가 이 표대로 알려 드려요.</p>
        <RewriteTable testId="thr-rewrites" />
      </Surface>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Surface className="flex flex-col gap-2">
          <h2 className="t-section break-keep text-slate-900">첫 줄 10가지</h2>
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="thr-first-lines">
            {FIRST_LINES.map((f) => (
              <li key={f.label} className="flex flex-col gap-0.5 py-2">
                <span className="t-sub font-bold break-keep text-slate-900">
                  {f.label} <span className="t-meta font-normal text-slate-500">· {f.note}</span>
                </span>
                <span className="t-sub break-keep text-slate-700">{mkText(f.example)}</span>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="flex flex-col gap-2">
          <h2 className="t-section break-keep text-slate-900">끝 방식</h2>
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="thr-endings">
            {ENDINGS.map((e) => (
              <li key={e.key} className="flex items-start gap-2 py-2">
                {e.good ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-700" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-700" />}
                <span className="min-w-0">
                  <span className="t-sub font-bold break-keep text-slate-900">{e.label}</span>
                  <span className="t-sub block break-keep text-slate-600">{e.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ④ 하루 10분                                                          */
/* ------------------------------------------------------------------ */

const ROUTINE_KEY = 'mirae.threads.routine.v1'
const ROUTINE_TONE: Readonly<Record<string, Tone>> = { write: 'sky', answer: 'emerald', expert: 'orange', weekref: 'violet', record: 'rose' }
function readRoutine(today: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ROUTINE_KEY) ?? 'null') as { day?: string; done?: unknown } | null
    if (v && v.day === today && Array.isArray(v.done)) return v.done.filter((x): x is string => typeof x === 'string')
  } catch {
    // 못 읽으면 오늘 처음
  }
  return []
}

function RoutinePanel({ week, readOnly, onWrite, onRecords }: { week: ReturnType<typeof useWeekRef>; readOnly: boolean; onWrite: () => void; onRecords: () => void }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [done, setDone] = useState<string[]>(() => readRoutine(today))
  useEffect(() => {
    try {
      localStorage.setItem(ROUTINE_KEY, JSON.stringify({ day: today, done }))
    } catch {
      // 이번 접속 동안만
    }
  }, [done, today])
  const toggle = (k: string) => setDone((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))
  const plan = todayPlan(today)
  return (
    <div className="flex flex-col gap-4" data-testid="thr-routine">
      <Surface className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="t-section min-w-[12rem] flex-1 break-keep text-slate-900">할 일 — 매일 셋 · 월요일 · 금요일</h2>
          <Badge tone={done.length === ROUTINE.length ? 'success' : 'neutral'}>
            {done.length} / {ROUTINE.length}
          </Badge>
        </div>
        <ul className="flex flex-col gap-1.5" data-testid="thr-routine-list">
          {ROUTINE.map((r) => {
            const on = done.includes(r.key)
            // D-298 때마다 색 — 매일 하늘 · 올린 뒤 초록 · 점심 · 저녁 주황 · 월요일 보라 · 금요일 분홍
            const tone = TONES[ROUTINE_TONE[r.key] ?? 'slate']
            return (
              <li key={r.key}>
                <label className={`tap flex min-h-12 cursor-pointer items-start gap-2.5 rounded-(--radius-control) border border-l-4 px-3 py-2 ${tone.line} ${on ? 'bg-slate-50' : tone.wash}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(r.key)} className="mt-1 size-5 shrink-0 accent-slate-900" data-testid={`thr-routine-${r.key}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`t-sub font-bold ${tone.ink}`}>
                      {r.when} · {r.min}
                    </span>
                    <span className={`t-sub block break-keep ${on ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{r.what}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onWrite}>
            <NotebookPen aria-hidden="true" className="size-4" /> 오늘 글 쓰기
          </Button>
          <Button size="sm" variant="secondary" onClick={onRecords}>
            <CalendarCheck aria-hidden="true" className="size-4" /> 기록표
          </Button>
        </div>
      </Surface>
      <WeekRefEditor week={week} readOnly={readOnly} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Surface className="flex flex-col gap-2">
          <h2 className="t-section break-keep text-slate-900">주제 태그 인기 글 보기</h2>
          <p className="t-sub break-keep text-slate-600">월요일에 한 번 — 스레드 검색을 새 창으로 열고 잘 터진 글 3~5개의 형식만 위 "이번 주 잘 터진 형식" 에 적어요. 매일 모을 필요는 없어요.</p>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_TAGS.map((t) => (
              <a key={t} href={`https://www.threads.com/search?q=${encodeURIComponent(t)}&serp_type=default`} target="_blank" rel="noreferrer noopener" className={`${chip(false)} gap-1`} data-testid="thr-search-link">
                #{t} <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ))}
          </div>
        </Surface>
        <Surface className="flex flex-col gap-2">
          <h2 className="t-section break-keep text-slate-900">남의 글에 다는 전문가 답글</h2>
          <p className="t-sub break-keep text-slate-600">칭찬 한 줄 말고, 정보를 하나 더합니다(하루 3개).</p>
          <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep whitespace-pre-line text-slate-800" data-testid="thr-expert">
            {EXPERT_REPLY}
          </p>
          <div>
            <Button size="sm" variant="secondary" onClick={() => void copyText(EXPERT_REPLY).then((ok) => showToast(ok ? '답글 틀을 복사했어요.' : '복사하지 못했어요.'))}>
              <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
            </Button>
          </div>
        </Surface>
      </div>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">요일 계획 (주 5개)</h2>
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="thr-week">
          {[1, 2, 3, 4, 5].map((d) => {
            const w = WEEK_PLAN[d]
            const on = plan?.day === ['일', '월', '화', '수', '목', '금', '토'][d]
            return (
              <li key={d} className="flex flex-col gap-0.5 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="t-body font-bold text-slate-900">{['일', '월', '화', '수', '목', '금', '토'][d]}요일</span>
                  <span className="t-sub text-slate-700">{w.label}</span>
                  {on && <Badge tone="brand">오늘</Badge>}
                </span>
                <span className="t-sub break-keep leading-relaxed text-slate-600">
                  <TplNames keys={w.picks} />
                </span>
              </li>
            )
          })}
        </ul>
        <p className="t-meta break-keep text-slate-500">대놓고 영업(V)은 한 달에 한 번. 4주 뒤 기록표의 틀별 평균을 보고 잘 된 틀 비중을 늘립니다.</p>
      </Surface>
    </div>
  )
}

/** D-275 이번 주 잘 터진 형식 — 원문 없이 틀 · 첫 줄 · 끝 방식만(5줄까지) */
function WeekRefEditor({ week, readOnly }: { week: ReturnType<typeof useWeekRef>; readOnly: boolean }) {
  const { showToast } = useToast()
  const [items, setItems] = useState<WeekRefItem[]>(() => week.ref?.items ?? [])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!dirty) setItems(week.ref?.items ?? [])
  }, [week.ref, dirty])
  const upd = (i: number, part: Partial<WeekRefItem>) => {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...part } : x)))
    setDirty(true)
  }
  const add = () => {
    setItems((xs) => (xs.length >= WEEK_REF_MAX ? xs : [...xs, { template: 'B', firstLine: '', ending: '', note: '' }]))
    setDirty(true)
  }
  const drop = (i: number) => {
    setItems((xs) => xs.filter((_, j) => j !== i))
    setDirty(true)
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await week.save(items)
      setDirty(false)
      showToast('이번 주 잘 터진 형식을 저장했어요 — AI 는 글 하나에만 참고하고, 기본은 우리 공식이에요.')
    } catch (e) {
      showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message}` : '저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }
  const sel = 't-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-2'
  return (
    <Surface className="flex flex-col gap-3" as="section">
      <div className="flex flex-wrap items-center gap-2" data-testid="thr-weekref">
        <h2 className="t-section min-w-[12rem] flex-1 break-keep text-slate-900">이번 주 잘 터진 형식</h2>
        <Badge>{mondayOf().slice(5).replace('-', '/')} 주</Badge>
      </div>
      <p className="t-sub break-keep text-slate-600">월요일에 한 번 — 잘 터진 글 3~5개의 형식만 적어요(원문 문장은 적지 않아요). 기본은 우리가 정리해 둔 공식이고, AI 는 이 형식을 글 하나에만 참고해요.</p>
      {items.length === 0 && <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">아직 적은 형식이 없어요.</p>}
      <ul className="flex flex-col gap-2" data-testid="thr-weekref-list">
        {items.map((x, i) => (
          <li key={i} className="grid gap-2 rounded-(--radius-control) border border-slate-200 p-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 11rem), 1fr))' }} data-testid="thr-weekref-item">
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="t-sub text-slate-600">틀</span>
              <select value={x.template} onChange={(e) => upd(i, { template: e.target.value as ThreadTemplateKey })} disabled={readOnly} className={sel} data-testid="thr-weekref-template">
                {THREAD_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key} {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="t-sub text-slate-600">첫 줄</span>
              <select value={x.firstLine} onChange={(e) => upd(i, { firstLine: e.target.value })} disabled={readOnly} className={sel} data-testid="thr-weekref-first">
                <option value="">(잘 모름)</option>
                {FIRST_LINES.map((f) => (
                  <option key={f.label} value={f.label}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="t-sub text-slate-600">끝</span>
              <select value={x.ending} onChange={(e) => upd(i, { ending: e.target.value as EndingKind | '' })} disabled={readOnly} className={sel} data-testid="thr-weekref-ending">
                <option value="">(잘 모름)</option>
                {ENDINGS.map((e2) => (
                  <option key={e2.key} value={e2.key}>
                    {e2.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="t-sub text-slate-600">메모(선택)</span>
              <input value={x.note} maxLength={80} onChange={(e) => upd(i, { note: e.target.value })} disabled={readOnly} placeholder="예: 자금 태그 · 답글이 많음" className={sel} data-testid="thr-weekref-note" />
            </label>
            {!readOnly && (
              <div className="flex items-end">
                <Button size="sm" variant="ghost" onClick={() => drop(i)} data-testid="thr-weekref-drop">
                  빼기
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={add} disabled={items.length >= WEEK_REF_MAX} data-testid="thr-weekref-add">
            + 한 줄 더
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving || week.failed} data-testid="thr-weekref-save">
            <Save aria-hidden="true" className="size-4" /> 저장
          </Button>
        </div>
      )}
    </Surface>
  )
}
