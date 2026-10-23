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
import { AtSign, BookOpen, CalendarCheck, CheckCircle2, ClipboardCopy, Download, ExternalLink, FilePlus2, NotebookPen, RefreshCw, Save, Send, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile, Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useViewingPilot } from '../../auth/osAccess'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { MarketingTabs } from '../../tools/marketing/MarketingTabs'
import { BigChoices, DeleteTwice, FactsBox, InnerTabs, LintList, RewriteTable, ShareKit, StatInputs, StepTitle, chip } from './snsParts'
import { QuickStart } from './QuickStart'
import { Fold, openFold } from '../../components/ui/fold'
import { readWeekTopics, recommendThread, topicChips, topicTag } from '../../services/marketing/quickStart'
import { todayLocalDate } from '../../lib/appClock'
import { AssistError, callAssist } from '../../services/aiAssist/client'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { useThreadPosts, useWeekRef } from '../../services/marketing/useSnsPosts'
import {
  BEFORE_POST,
  ENDINGS,
  EXPERT_REPLY,
  FIRST_LINES,
  GOALS,
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
const TABS: ReadonlyArray<{ key: Tab; label: string; short: string; icon: typeof AtSign }> = [
  { key: 'write', label: '오늘 쓸 글', short: '쓰기', icon: NotebookPen },
  { key: 'records', label: '기록표', short: '기록표', icon: CalendarCheck },
  { key: 'library', label: '틀 23가지', short: '틀', icon: BookOpen },
  { key: 'routine', label: '하루 10분', short: '10분', icon: CheckCircle2 },
]
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
  const aiOk = useOwnerAiAccess() !== 'no' && !readOnly
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
    window.setTimeout(() => document.querySelector('[data-testid="thr-choose"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
        if (fill) set({ body: first.body, source: 'ai', selfComment: first.selfComment, checks: first.checks, ...(first.template ? { template: first.template } : {}) })
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
    set({ selfComment: d.selfComment, checks: d.checks, ...(d.template ? { template: d.template } : {}) })
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

      {/* D-275 이번 주 잘 터진 형식 — 참고만(기본은 우리 공식) · 없으면 월요일에 적으라고 한 줄. MUX-2 주제 고르기 아래로(첫 행동이 먼저 보이게) */}
      <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-amber-200 bg-amber-50/70 px-3 py-2.5" data-testid="thr-week-hint">
        <p className="t-sub min-w-[12rem] flex-1 break-keep text-slate-700">
          {hotKeys.size ? (
            <>
              <b className="text-slate-900">이번 주 잘 터진 형식(참고)</b> · {[...hotKeys].map((k) => `${k} ${templateOf(k)?.name ?? ''}`).join(' / ')} — 기본은 우리 공식, AI 는 글 하나에만 참고해요
            </>
          ) : (
            '이번 주 잘 터진 형식을 아직 안 적었어요 — 월요일에 한 번, 인기 글 3~5개의 형식만 적으면 돼요(매일 모을 필요 없어요)'
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={onRoutine} data-testid="thr-week-go">
          {hotKeys.size ? '고치기' : '적으러 가기'}
        </Button>
      </div>
      <Fold id="thr.formats" title="형식 직접 고르기" summary={`원하는 반응 · 틀 23가지 · 주제 태그${draft.tag ? ` (#${draft.tag})` : ''} · 남의 글 뼈대`} panel testId="thr-choose">
        {plan && (
          <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="thr-plan">
            <p className="t-sub min-w-[12rem] flex-1 break-keep text-slate-700">
              <b className="text-slate-900">오늘({plan.day}) 계획 — {plan.label}</b> · {plan.picks.map((k) => `${k} ${templateOf(k)?.name ?? ''}`).join(' / ')}
            </p>
            <Button size="sm" variant="secondary" onClick={() => set({ goal: plan.goal, template: plan.picks[0], formatBy: 'hand' })} data-testid="thr-plan-use">
              이 계획으로
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <h3 className="t-card font-bold text-slate-900">원하는 반응</h3>
          <BigChoices items={GOALS} value={draft.goal} onPick={pickGoal} label="원하는 반응" testPrefix="thr-goal" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="t-card min-w-[12rem] flex-1 font-bold text-slate-900">틀 고르기</h3>
            <Button size="sm" variant="ghost" onClick={onLibrary} data-testid="thr-all-templates">
              <BookOpen aria-hidden="true" className="size-4" /> 틀 23가지 전부
            </Button>
          </div>
          <p className="t-sub break-keep text-slate-600">{goal ? `'${goal.label}' 에 잘 된 틀 — 앞쪽일수록 실측 숫자가 좋았어요.` : '반응을 고르면 그 반응에 맞는 틀만 남아요. 지금은 오늘 계획 · 자주 쓰는 틀.'}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="thr-picks">
            {picks.map((t) => (
              <li key={t.key} className="min-w-0">
                <TemplateButton t={t} on={draft.template === t.key} hot={hotKeys.has(t.key)} onClick={() => set({ template: t.key, goal: draft.goal || t.goals[0], formatBy: 'hand' })} />
              </li>
            ))}
          </ul>
          {tpl && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/60 px-3 py-3" data-testid="thr-tpl-detail">
              <p className="t-body font-bold break-keep text-slate-900">
                {tpl.key} {tpl.name} <span className="t-meta font-normal text-slate-600">· {tpl.reaction}</span>
              </p>
              <ol className="t-sub flex flex-wrap items-center gap-x-1.5 gap-y-1 break-keep text-slate-700" aria-label="뼈대">
                {tpl.skeleton.map((s, i) => (
                  <li key={s} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true" className="text-slate-400">→</span>}
                    <span className="rounded-md bg-white px-1.5 py-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="t-sub break-keep text-slate-700">
                <b>왜 되나</b> {tpl.why}
              </p>
              <p className="t-sub break-keep text-slate-700">
                <b>우리가 쓰면</b> {tpl.ours}
              </p>
              {tpl.caution && (
                <p className="t-sub flex items-start gap-1.5 break-keep text-warning-800">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {tpl.caution}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {tpl.example && (
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
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="t-card font-bold text-slate-900">주제 태그 1개</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="주제 태그">
            {TOPIC_TAGS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={draft.tag === t} onClick={() => set({ tag: draft.tag === t ? '' : t })} className={chip(draft.tag === t)} data-testid={`thr-tag-${t}`}>
                #{t}
              </button>
            ))}
          </div>
        </div>
        <details className="rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid="thr-ref-box">
          <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">잘 된 남의 글 붙여넣기 (선택 — 뼈대만 빌림 · 저장 안 함)</summary>
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
                <span className="t-sub font-semibold text-slate-700">글{tpl ? ` — ${tpl.key} ${tpl.name}` : ''}</span>
                <span className={`t-sub font-bold tabular-nums ${lint.chars > THREAD_MAX ? 'text-danger-700' : 'text-slate-600'}`} data-testid="thr-count">
                  {lint.chars} / {THREAD_MAX}자
                </span>
              </span>
              <textarea value={draft.body} onChange={(e) => set({ body: e.target.value })} rows={13} placeholder={'첫 줄 15~25자\n둘째 줄 = 왜 너 얘기인지\n\n한 줄에 한 생각\n\n끝 = 대답하기 쉬운 것 하나'} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 leading-relaxed" data-testid="thr-body" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">본인 댓글 (조회 1,000 넘으면 · 진단 · 자료 안내는 여기만)</span>
              <input value={draft.selfComment} onChange={(e) => set({ selfComment: e.target.value })} placeholder="예: 3분 진단은 프로필 링크에서" className="t-body min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="thr-comment" />
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
              <span className="t-sub font-semibold text-slate-700">규칙 검사</span>
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

function TemplateButton({ t, on, hot = false, onClick }: { t: ThreadTemplate; on: boolean; hot?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`tap flex h-full min-h-16 w-full min-w-0 flex-col items-start gap-1 rounded-(--radius-control) border px-3 py-2.5 text-left ${on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'}`} data-testid={`thr-tpl-${t.key}`}>
      <span className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[0.85rem] font-bold text-white">{t.key}</span>
        <span className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">{t.name}</span>
        {hot && (
          <Badge tone="warning" className="shrink-0">
            이번 주 잘 됨
          </Badge>
        )}
      </span>
      <span className="t-sub break-keep text-slate-600">{t.reaction}</span>
    </button>
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
          <h2 className="t-section min-w-[12rem] flex-1 break-keep text-slate-900">우리 계정에서 되는 틀</h2>
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
                  {r.key} {r.name}
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
        {GOALS.map((g) => (
          <button key={g.key} type="button" role="radio" aria-checked={goal === g.key} onClick={() => setGoal(g.key)} className={chip(goal === g.key)} data-testid={`thr-lib-filter-${g.key}`}>
            {g.label}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="thr-lib-list">
        {list.map((t) => (
          <li key={t.key} className="min-w-0">
            <Surface className="flex h-full flex-col gap-2" as="article">
              <div className="flex flex-wrap items-center gap-1.5" data-testid="thr-lib-card" data-key={t.key}>
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-900 font-bold text-white">{t.key}</span>
                <h3 className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">{t.name}</h3>
                {t.few && <Badge>표본 적음</Badge>}
              </div>
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
              <p className="t-sub break-keep text-slate-700">
                <b>우리가 쓰면</b> {t.ours}
              </p>
              {t.caution && <p className="t-sub break-keep text-warning-800">⚠ {t.caution}</p>}
              {t.example && (
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
                <span className="t-sub break-keep text-slate-700">{f.example}</span>
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
            return (
              <li key={r.key}>
                <label className="tap flex min-h-12 cursor-pointer items-start gap-2.5 rounded-(--radius-control) border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" checked={on} onChange={() => toggle(r.key)} className="mt-1 size-5 shrink-0 accent-slate-900" data-testid={`thr-routine-${r.key}`} />
                  <span className="min-w-0 flex-1">
                    <span className="t-sub font-bold text-slate-900">
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
                <span className="t-sub break-keep text-slate-600">{w.picks.map((k) => `${k} ${templateOf(k)?.name ?? ''}`).join(' / ')}</span>
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
