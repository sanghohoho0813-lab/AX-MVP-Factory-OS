/**
 * D-273 마케팅 · 브랜딩 › 릴스 · 틱톡 — 대표 "릴스 틱톡 파트도 따로 만들어 줘 · 60대도 쓸 수 있을 정도로 쉽고 간편하게".
 * 대표가 준 숏폼 실측 공식(틱톡 · 릴스 승 · 패 비교)을 그대로, 한 번에 하나씩 고르게:
 *  ① 어디에(틱톡 · 쇼츠 / 릴스) ② 무엇을(많이 보이게 / 문의 · 댓글) ③ 형식(맞는 것만 2~4개) ④ 소재 → [예시 대본] 또는 [AI로 대본 2개]
 *  ⑤ 고치며 규칙 검사(규칙 계산 — 첫마디 · 길이 · 권유 · 캡션 · 해시태그) → 복사 · 저장 · 올렸어요
 *  기록표: 조회 · 좋아요 · 댓글 · 저장 · 공유 · 문의 → 점수(좋아요 + 댓글×3) · 저장 · 공유율 · 형식별 평균.
 * 대표 전용(마케팅 · 브랜딩 모듈). 저장은 기존 모듈 기록(marketing / shorts).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { DraftSyncLine, useDraftSync } from './useDraftSync'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarCheck, ClipboardCopy, Clapperboard, Download, Eye, FilePlus2, Lightbulb, MessageCircle, NotebookPen, RefreshCw, Save, Send, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile, Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useViewingPilot } from '../../auth/osAccess'
import { useMarketingAiOn } from '../../auth/ownerAiAccess'
import { MarketingTabs } from '../../tools/marketing/MarketingTabs'
import { todayLocalDate } from '../../lib/appClock'
import { AssistError, callAssist, type AssistAnswer } from '../../services/aiAssist/client'
import { AiAssist } from '../../components/ai/AiAssist'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { useShortPosts } from '../../services/marketing/useSnsPosts'
import {
  AIMS,
  EMPTY_SHORT_STATS,
  FORMAT_EASY,
  PLATFORMS,
  SHORT_BASICS_EASY,
  SHORT_FORMATS,
  SHORT_STAT_KEYS,
  aimLabel,
  aimsOf,
  exampleOf,
  exampleTagsOf,
  firstWordsOf,
  formatOf,
  formatRecords,
  formatsFor,
  keepRate,
  lintShort,
  parseShortDrafts,
  shortScore,
  shortsContext,
  shortsCsv,
  weekMix,
  type ShortAim,
  type ShortDraft,
  type ShortFormat,
  type ShortFormatKey,
  type ShortPlatform,
  type ShortPost,
} from '../../services/marketing/shorts'
import { BigChoices, DeleteTwice, FactsBox, HoverTip, InnerTabs, LintList, RewriteTable, ShareKit, StatInputs, StepTitle, TipBody, ToneSection } from './snsParts'
import { TONES, scrollAndFlash, toneChip, type Tone } from './snsTone'
import { QuickStart } from './QuickStart'
import { FirstLineMaker } from './FirstLineMaker'
import { PostingHowTo } from './PostingHowTo'
import { Fold, HelpHeading, HintTip, openFold, useFold } from '../../components/ui/fold'
import { readWeekTopics, recommendShort, topicChips } from '../../services/marketing/quickStart'
import { mkText } from '../../services/marketing/persona'
import { exampleText } from '../../services/marketing/shorts'
import { weekBadge } from '../../services/marketing/weekCollect'
import { useRadarPrefs } from '../../services/marketing/useRadarStore'
import { briefOf, type ChannelBrief } from '../../services/marketing/radarStore'
import { withWriteExtras } from '../../services/aiAssist/marketingBuilders'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { bestFirst, EXTRA_SCORE_KEYS, fixLines, needsPolish, polishedWins, scorePost, type PostScore } from '../../services/marketing/postScore'
import { PostScoreBar } from './PostScoreBar'

type Tab = 'write' | 'records' | 'guide'
// D-298 대표 "릴스 · 틱톡도 글자가 구구절절 — 처음 보는 사람은 이게 뭐지 싶다 · 색도 더" — 칸마다 색 · 마우스를 올리면(휴대폰은 아래 한 줄) 무엇을 하는 곳인지
const TABS: ReadonlyArray<{ key: Tab; label: string; short: string; icon: typeof Clapperboard; tone: Tone; tip: string }> = [
  { key: 'write', label: '오늘 만들 영상', short: '만들기', icon: Clapperboard, tone: 'rose', tip: '주제만 고르면 릴스 · 틱톡 대본(영상에서 할 말)을 써 주는 곳이에요.' },
  { key: 'records', label: '기록표', short: '기록표', icon: CalendarCheck, tone: 'emerald', tip: '올린 영상의 조회 · 좋아요 숫자를 적는 곳이에요. 어떤 형식이 잘 되는지 숫자로 알려 줘요.' },
  { key: 'guide', label: '형식 · 공식', short: '설명서', icon: BookOpen, tone: 'violet', tip: '영상 형식 5가지와 잘 되는 규칙을 모은 설명서예요.' },
]

/** D-298 어디에 · 무엇을 · 형식마다 색(같은 뜻은 어느 화면에서나 같은 색) */
const PLATFORM_TONE: Readonly<Record<ShortPlatform, Tone>> = { tiktok: 'teal', reels: 'fuchsia' }
const AIM_TONE: Readonly<Record<ShortAim, Tone>> = { reach: 'sky', convert: 'emerald' }
const AIM_ICON = { reach: Eye, convert: MessageCircle } as const
const FORMAT_TONE: Readonly<Record<ShortFormatKey, Tone>> = { list: 'sky', talk: 'violet', demo: 'emerald', comment: 'rose', ban: 'orange' }
const PLATFORM_CHOICES = PLATFORMS.map((p) => ({ ...p, tone: PLATFORM_TONE[p.key], tip: p.key === 'tiktok' ? '말로 설명하는 40~60초 영상이에요. 틱톡과 유튜브 쇼츠에 같이 올려요.' : '20초 안팎 짧은 영상이에요. 글자 화면만 넘겨도 돼요.' }))
const aimChoices = (p: ShortPlatform) => AIMS[p].map((a) => ({ ...a, tone: AIM_TONE[a.key], icon: AIM_ICON[a.key], tip: a.key === 'reach' ? '더 많은 사람에게 보이게 하고 싶을 때 골라요. 끝에 "연락 주세요" 같은 말을 넣지 않아요.' : p === 'reels' ? '댓글을 받고 싶을 때 골라요. 나눠 줄 자료가 실제로 있을 때만 써요.' : '문의로 이어지게 하고 싶을 때 골라요. 끝에 한 줄만 넣어요.' }))

/** 형식 설명(마우스를 올리면 · ? 를 누르면) — 쉽게 말하면 · 예시 */
function formatTip(f: ShortFormat): string {
  const e = FORMAT_EASY[f.key]
  return `${f.name} (${f.seconds})\n${e.plain}\n\n예시\n${e.sample}`
}
const tabOf = (raw: string | null): Tab => (TABS.some((t) => t.key === raw) ? (raw as Tab) : 'write')

// short — 주제 칩에 보이는 짧은 이름(MUX-2 큰 글자에서도 한 줄 안팎). AI 에는 topic 전체가 간다
const QUICK_TOPICS = [
  { topic: '창업 3년 안 벤처확인 세금', short: '창업 3년 안 벤처확인 세금' },
  { topic: '매일 반복되는 일 하나 화면으로 바꾸기', short: '반복 업무를 화면으로' },
  { topic: '정책자금 전에 볼 기본 컨디션(신용 · 재무 · 체납)', short: '자금 전 기본 컨디션' },
]

interface Draft {
  id?: string
  platform: ShortPlatform
  aim: ShortAim | ''
  format: ShortFormatKey | ''
  topic: string
  facts: string
  script: string
  caption: string
  hashtags: string
  checks: string[]
  source: ShortPost['source']
  /** MUX-2 형식을 누가 정했나 — 'rec' 추천 · 'hand' 직접 고름(추천이 덮지 않음) */
  formatBy?: 'rec' | 'hand'
}
const EMPTY: Draft = { platform: 'tiktok', aim: '', format: '', topic: '', facts: '', script: '', caption: '', hashtags: '', checks: [], source: 'hand' }
const DRAFT_KEY = 'mirae.shorts.draft.v1'
/** 저장된 대본 모양 다듬기 — 이 기기 · 클라우드(D-513) 같은 규칙 */
function cleanDraft(raw: unknown): Draft {
  const v = raw && typeof raw === 'object' ? (raw as Partial<Draft>) : null
  if (!v) return EMPTY
  return { ...EMPTY, ...v, platform: v.platform === 'reels' ? 'reels' : 'tiktok', checks: Array.isArray(v.checks) ? v.checks.filter((x) => typeof x === 'string') : [] }
}
function readDraft(): Draft {
  try {
    return cleanDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'))
  } catch {
    // 못 읽으면 빈 대본
  }
  return EMPTY
}
const draftEmpty = (d: Draft) => !d.script.trim() && !d.topic.trim() && !d.caption.trim() && !d.facts.trim()
function writeDraft(d: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // 저장 공간이 없으면 이번 접속 동안만
  }
}

export default function ShortsPage() {
  return <WorkspaceScope>{(ctx) => <Shorts workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}

function Shorts({ workspaceId }: { workspaceId: string | null }) {
  const readOnly = useViewingPilot() !== null
  // SAAS-2 고객도 서버가 마케팅을 열었으면(사용량 장부로 셈) AI 를 쓴다 — 대표 판정은 그대로
  const aiOk = useMarketingAiOn() && !readOnly
  const store = useShortPosts(workspaceId, readOnly)
  // D-558 내 채널 설계 기준(본업 · 확인된 사실 · 말 원칙) — AI 완성 대본 자료에
  const { prefs } = useRadarPrefs(workspaceId, readOnly)
  const brief = useMemo(() => briefOf(prefs), [prefs])
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  const go = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'write') next.delete('tab')
    else next.set('tab', t)
    setParams(next)
  }
  // D-274 스레드에서 '같은 소재로' 를 누르고 왔으면 소재를 채운다(주소의 topic 은 한 번 쓰고 지운다)
  const [draft, setDraftState] = useState<Draft>(() => {
    const d = readDraft()
    const t = params.get('topic')?.slice(0, 200)
    if (!t) return d
    // MUX-2 주제를 들고 왔으면 목적 · 형식도 그 주제에 맞춰 추천
    const r = recommendShort({ topic: t, platform: d.platform, posts: [] })
    return { ...d, topic: t, aim: r.aim, format: r.format, formatBy: 'rec' }
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
  // D-513 다른 기기에서 이어 쓰기 — 주소로 주제 · 글을 들고 왔으면 클라우드 글로 바꾸지 않는다
  const [openedWith] = useState(() => !!(params.get('topic') || params.get('open')))
  const sync = useDraftSync<Draft>({ kind: 'shorts', workspaceId, readOnly, draft, replace: (d) => setDraft(() => d), blocked: openedWith, empty: draftEmpty, clean: cleanDraft })
  const draftOf = (p: ShortPost): Draft => ({ ...EMPTY, id: p.id, platform: p.platform, aim: p.aim, format: p.format, topic: p.topic, script: p.script, caption: p.caption, hashtags: p.hashtags, checks: p.checks, source: p.source })
  const openPost = (p: ShortPost) => {
    setDraft(() => draftOf(p))
    go('write')
  }
  // D-355 내 콘텐츠 '만든 것 한눈에' 에서 누르고 왔으면(?open=) 그 대본을 대본 칸에 — 쓰던 다른 대본이 있으면 묻고 · 못 찾으면 기록표로 · open 은 한 번 쓰고 지운다
  const openId = params.get('open')
  useEffect(() => {
    if (!openId || !store.loaded) return
    const p = store.posts.find((x) => x.id === openId)
    const next = new URLSearchParams(params)
    next.delete('open')
    if (p) {
      next.delete('tab')
      if (draft.id === p.id || !draft.script.trim() || window.confirm('지금 쓰던 대본을 이 대본으로 바꿀까요? (쓰던 대본은 사라집니다)')) setDraft(() => draftOf(p))
    } else next.set('tab', 'records')
    setParams(next, { replace: true })
  }, [openId, store.loaded]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickFormat = (f: ShortFormat) => {
    setDraft((d) => {
      const platform = f.platforms.includes(d.platform) ? d.platform : f.platforms[0]
      const aims = aimsOf(f, platform)
      return { ...d, platform, aim: d.aim && aims.includes(d.aim) ? d.aim : aims[0], format: f.key }
    })
    go('write')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5" data-testid="sht-page">
      <PageHeader
        title="마케팅 · 브랜딩"
        showOnPhone
        descriptionAsHint
        description="릴스 · 틱톡 · 유튜브 쇼츠 대본을 검증된 방법대로 만듭니다 — 어디에 · 무엇을 · 어떤 형식을 하나씩 고르면 예시 대본이나 AI 대본이 나오고, 첫마디 · 길이 · 권유 · 설명 글 · #태그를 규칙으로 바로 확인합니다(규칙 계산)."
      />
      <MarketingTabs active="shorts" />
      <InnerTabs tabs={TABS} value={tab} onPick={go} label="릴스 · 틱톡" testPrefix="sht" />
      {store.failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="sht-failed">
          <p className="t-sub min-w-[12rem] flex-1 break-keep text-warning-700">기록을 읽지 못했습니다. 적어 둔 대본은 이 화면에 그대로 있고, 다시 읽기 전에는 저장하지 않습니다.</p>
          <Button size="sm" variant="secondary" onClick={() => void store.reload()}>
            <RefreshCw aria-hidden="true" className="size-4" /> 다시 읽기
          </Button>
        </div>
      )}
      {readOnly && <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 text-slate-600">팀장 화면을 보는 중에는 저장하지 않습니다.</p>}
      {tab === 'write' && <DraftSyncLine sync={sync} testPrefix="sht" />}
      {tab === 'write' && <WritePanel draft={draft} setDraft={setDraft} store={store} brief={brief} aiOk={aiOk} readOnly={readOnly} onRecords={() => go('records')} />}
      {tab === 'records' && <RecordsPanel store={store} readOnly={readOnly} onOpen={openPost} />}
      {tab === 'guide' && <GuidePanel onUse={pickFormat} />}
    </div>
  )
}

type Store = ReturnType<typeof useShortPosts>

/* ------------------------------------------------------------------ */
/* 오늘 만들 영상                                                        */
/* ------------------------------------------------------------------ */

function WritePanel({ draft, setDraft, store, brief, aiOk, readOnly, onRecords }: { draft: Draft; setDraft: (fn: (d: Draft) => Draft) => void; store: Store; brief: ChannelBrief; aiOk: boolean; readOnly: boolean; onRecords: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayLocalDate()
  const set = (part: Partial<Draft>) => setDraft((d) => ({ ...d, ...part }))
  const formats = formatsFor(draft.platform, draft.aim)
  const fmt = draft.format ? formatOf(draft.format) : undefined
  const [ai, setAi] = useState<{ busy: boolean; error: string; drafts: ShortDraft[] }>({ busy: false, error: '', drafts: [] })
  // D-559 [AI로 고칠 곳만 고쳐 쓰기] — 고친 대본(fixed)이 칸에 그대로 있는 동안만 [고치기 전으로]
  // D-561 auto = [완성 대본 쓰기] 뒤 90점이 안 돼 자동으로 한 번 더 다듬는 중
  const [fix, setFix] = useState<{ busy: boolean; error: string; before: { script: string; caption: string; hashtags: string } | null; fixed: string; why?: 'fix' | 'new'; auto?: boolean }>({ busy: false, error: '', before: null, fixed: '' })
  // D-558 더 바라는 점 한 줄(이 화면에만 · AI 에 [자료 · 요청] 으로)
  const [request, setRequest] = useState('')
  const writeContext = (use: { aim: ShortAim | ''; format: ShortFormatKey | '' }, revise?: { body: string; fixes: readonly string[] }) =>
    withWriteExtras(shortsContext({ platform: draft.platform, aim: use.aim, format: use.format, topic: draft.topic, facts: draft.facts, recent: store.posts, today }), { brief, request, revise })
  const [saving, setSaving] = useState(false)
  /** D-364 📐 한 단계씩 — 대본이 아직 없으면 2단계는 한 줄 + [직접 쓰기](스레드 화면과 같다) */
  const [editorAll] = useFold('sht.editor', false)
  const [handOpen, setHandOpen] = useState(false)
  const hasScript = !!draft.script.trim()
  useEffect(() => {
    if (hasScript) setHandOpen(true)
  }, [hasScript])
  const editorOpen = editorAll || handOpen || hasScript
  const factsText = `${draft.facts}\n${draft.topic}`
  const lint = useMemo(() => lintShort({ platform: draft.platform, aim: draft.aim, script: draft.script, caption: draft.caption, hashtags: draft.hashtags, facts: factsText }), [draft.platform, draft.aim, draft.script, draft.caption, draft.hashtags, factsText])
  // D-559 올리기 전 점수(규칙) — 대본 + 설명 글
  const score = useMemo(() => scorePost({ kind: 'short', text: draft.script.trim() ? `${draft.script}\n${draft.caption}` : '', lines: lint.lines }), [draft.script, draft.caption, lint])
  const lintShown = useMemo(() => [...lint.lines, ...(score?.items ?? []).filter((x) => EXTRA_SCORE_KEYS.has(x.key)).map((x) => ({ key: x.key, level: x.level, text: x.text }))], [lint, score])
  const mix = weekMix(store.posts, today)

  const bodyNow = useRef(draft.script)
  bodyNow.current = draft.script
  // MUX-2 추천 형식(규칙) — 사람이 직접 고른 형식이 있으면 그것, 없으면 이번 주 올린 비율 · 주제 낱말로
  const rec = useMemo(() => recommendShort({ topic: draft.topic, platform: draft.platform, posts: store.posts, today }), [draft.topic, draft.platform, store.posts, today])
  const effFmt = draft.format ? formatOf(draft.format) : undefined
  const eff = effFmt ? { aim: (draft.aim || aimsOf(effFmt, draft.platform)[0]) as ShortAim, format: effFmt.key } : { aim: rec.aim, format: rec.format }
  const chips = useMemo(() => topicChips(readWeekTopics(today), QUICK_TOPICS), [today])
  const pickTopic = (t: string) => {
    // 칩으로 새 주제를 고르면 목적 · 형식도 그 주제에 맞춰 다시 추천 — 사람이 직접 고른 형식은 덮지 않는다
    if (draft.formatBy === 'hand' && draft.format) return set({ topic: t })
    const r = recommendShort({ topic: t, platform: draft.platform, posts: store.posts, today })
    set({ topic: t, aim: r.aim, format: r.format, formatBy: 'rec' })
  }
  const openFormats = () => {
    openFold('sht.formats')
    scrollAndFlash('sht-choose')
  }

  const pickPlatform = (p: ShortPlatform) => {
    // 추천으로 정해진 형식이면 새 플랫폼에 맞춰 다시 추천
    if (draft.formatBy === 'rec' && draft.topic.trim()) {
      const r = recommendShort({ topic: draft.topic, platform: p, posts: store.posts, today })
      return set({ platform: p, aim: r.aim, format: r.format })
    }
    const f = draft.format ? formatOf(draft.format) : undefined
    set({ platform: p, format: f && f.platforms.includes(p) && (!draft.aim || aimsOf(f, p).includes(draft.aim)) ? draft.format : '' })
  }
  const pickAim = (a: ShortAim) => {
    const f = draft.format ? formatOf(draft.format) : undefined
    set({ aim: a, format: f && aimsOf(f, draft.platform).includes(a) ? draft.format : '', formatBy: 'hand' })
  }
  const start = (part: Pick<Draft, 'script' | 'caption' | 'hashtags' | 'source'> & Partial<Draft>) => {
    if (draft.script.trim() && draft.script.trim() !== part.script.trim() && !window.confirm('지금 쓰던 대본을 이 대본으로 바꿀까요? (쓰던 대본은 사라집니다)')) return
    set({ checks: [], ...part })
    document.getElementById('sht-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const startExample = () => {
    const f = formatOf(eff.format)
    if (!f) return
    if (!draft.format) set({ aim: eff.aim, format: eff.format, formatBy: 'rec' })
    start({ ...exampleOf(f, draft.platform), hashtags: exampleTagsOf(f), source: 'example' })
  }
  /**
   * D-546 첫마디 10개 → [이걸로 쓰기] — 대본이 비어 있으면 첫마디로 시작하는 뼈대(0초 첫마디 · 본론 · 마무리),
   * 쓰던 대본이 있으면 첫 줄만 바꾼다(시각 '[0:00]' 은 그대로 · 한 번 묻고).
   */
  const applyFirstLine = (line: string) => {
    const cur = draft.script
    if (!cur.trim()) {
      if (!draft.format) set({ aim: eff.aim, format: eff.format, formatBy: 'rec' })
      start({ script: `[0:00] ${line}  (화면: 큰 글자)\n[0:03] [본론 — 2~3가지 + 숫자]\n[끝] [답 · 마무리 한 줄]`, caption: draft.caption, hashtags: draft.hashtags, source: 'hand' })
      showToast('첫마디로 대본을 시작했어요 — [ ] 칸을 채워 주세요.')
      return
    }
    const rows = cur.split('\n')
    const i = rows.findIndex((r) => r.trim())
    const time = /^\s*(\[\d+:\d{2}\])\s*/.exec(rows[i] ?? '')?.[1]
    const next = time ? `${time} ${line}` : line
    if (rows[i]?.trim() === next.trim()) return
    if (!window.confirm('지금 대본의 첫 줄을 이 첫마디로 바꿀까요? (나머지는 그대로예요)')) return
    rows[i] = next
    set({ script: rows.join('\n') })
    showToast('첫 줄을 바꿨어요.')
    document.getElementById('sht-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  /**
   * auto — 누른 단추가 [완성 대본 쓰기] 면 1안을 대본 칸에 바로 넣는다.
   * D-560 예전에는 대본 칸에 글이 있으면 넣지 않아 아무 일도 안 일어난 것처럼 보였다 — 이제 새 1안 + [이전 대본으로 되돌리기].
   * 기다리는 사이 직접 고친 대본만 덮지 않는다.
   */
  const runAi = async (pick?: { aim: ShortAim | ''; format: ShortFormatKey | '' }, auto = false) => {
    if (ai.busy || fix.busy) return
    const atClick = { script: bodyNow.current, caption: draft.caption, hashtags: draft.hashtags }
    setAi({ busy: true, error: '', drafts: [] })
    const use = pick ?? { aim: draft.aim, format: draft.format }
    try {
      const context = writeContext(use)
      const run = await callAssist({ requestId: newRequestId(), assistId: 'shorts.write', page: 'shorts', choice: readChoice(), context })
      const { drafts: raw, checks } = parseShortDrafts(run.structured)
      if (!raw.length) throw new AssistError('provider_error', 'AI 답에서 대본을 찾지 못했어요 — 다시 눌러 주세요.')
      // D-561 한 번 누르면 90점까지 — 점수 높은 안이 1안(대본 칸에 들어갈 안)
      const aimNow = (use.aim || draft.aim) as ShortAim
      const drafts = bestFirst(raw, (d) => scoreShortDraft(d, aimNow)?.score ?? 0)
      setAi({ busy: false, error: '', drafts })
      set({ checks })
      if (auto) {
        // 기다리는 사이 대본 칸을 직접 고쳤으면 덮지 않는다
        const first = drafts[0]
        const fill = bodyNow.current === atClick.script
        if (fill) {
          const filled = { script: first.script, caption: first.caption, hashtags: first.hashtags }
          set({ ...filled, source: 'ai', checks, ...(first.format ? { format: first.format } : {}) })
          const had = atClick.script.trim() && atClick.script.trim() !== first.script.trim()
          const sc = scoreShortDraft(first, aimNow)
          const polishNow = needsPolish(sc) && aiOk && !readOnly
          setFix(had ? { busy: false, error: '', before: atClick, fixed: first.script, why: 'new' } : { busy: false, error: '', before: null, fixed: '' })
          showToast(
            polishNow && sc
              ? `AI가 쓴 안 가운데 가장 높은 안(${sc.score}점)을 넣었어요 — 90점이 안 돼 AI가 고칠 곳만 한 번 더 다듬는 중이에요.`
              : `${had ? '새 대본(1안)으로 바꿨어요 — 예전 대본은 [이전 대본으로 되돌리기] 로 돌릴 수 있어요.' : '완성 대본(1안)을 대본 칸에 넣었어요.'}${drafts.length > 1 ? ' 다른 안은 대본 칸 바로 위 단추로 바꿔 봐요.' : ''}`,
          )
          // D-560 대본 칸으로 내려가 잠깐 빛나게 — 생긴 것이 바로 눈에 띄게
          scrollAndFlash('sht-editor')
          // D-561 90점이 안 되면 자동으로 한 번 더(점수가 내려가면 AI가 처음 쓴 대본 그대로)
          if (polishNow && sc) await polish(filled, sc, { aim: aimNow, format: (first.format || use.format) as ShortFormatKey | '' }, had ? { to: atClick, why: 'new' } : { to: filled, why: 'fix' }, true)
        } else showToast('기다리는 사이 고치신 대본은 그대로 두었어요 — AI 대본은 위 "AI로 완성 대본 쓰기" 아래에서 골라 넣어요.')
      }
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error && e.message ? e.message : '다시 눌러 주세요.', drafts: [] })
    }
  }
  type Body = { script: string; caption: string; hashtags: string }
  /** 대본 하나의 올리기 전 점수(규칙) — 다른 안 · 자동 다듬기 비교에 */
  const scoreShortDraft = (d: Body, aim: ShortAim): PostScore | null =>
    scorePost({ kind: 'short', text: d.script.trim() ? `${d.script}\n${d.caption}` : '', lines: lintShort({ platform: draft.platform, aim, script: d.script, caption: d.caption, hashtags: d.hashtags, facts: factsText }).lines })
  /**
   * D-559 고칠 곳만 AI 로 — before 대본(+ 설명 글)을 점수에서 뺀 곳과 함께 보내 고친 대본을 받아 칸에.
   * D-561 auto = [완성 대본 쓰기] 뒤 90점이 안 돼 자동으로 한 번 — 점수가 내려가면 처음 대본 그대로 · 2안은 남긴다.
   */
  const polish = async (before: Body, sc: PostScore, use: { aim: ShortAim; format: ShortFormatKey | '' }, undo: { to: Body; why: 'fix' | 'new' }, auto: boolean) => {
    const idle = { busy: false, error: '', before: null, fixed: '' }
    const keepUndo = undo.to.script.trim() && undo.to.script !== before.script ? { busy: false, error: '', before: undo.to, fixed: before.script, why: undo.why } : idle
    setFix({ ...idle, busy: true, auto })
    try {
      const body = before.caption.trim() ? `${before.script}\n\n설명 글: ${before.caption.trim()}` : before.script
      const run = await callAssist({ requestId: newRequestId(), assistId: 'shorts.write', page: 'shorts', choice: readChoice(), context: writeContext(use, { body, fixes: fixLines(sc) }) })
      const { drafts, checks } = parseShortDrafts(run.structured)
      const first = drafts[0]
      if (!first?.script.trim()) throw new AssistError('provider_error', 'AI 답에서 고친 대본을 찾지 못했어요 — 다시 눌러 주세요.')
      // 기다리는 사이 대본 칸을 고쳤으면 덮지 않는다
      if (bodyNow.current !== before.script) {
        if (!auto) setAi({ busy: false, error: '', drafts })
        setFix(idle)
        showToast(auto ? '기다리는 사이 대본을 고치셔서 그대로 두었어요.' : '기다리는 사이 대본을 고치셔서 그대로 두었어요 — AI가 고친 대본은 "AI로 완성 대본 쓰기" 아래 1안에 있어요.')
        return
      }
      const next: Body = { script: first.script, caption: first.caption || before.caption, hashtags: first.hashtags || before.hashtags }
      const after = scoreShortDraft(next, use.aim)
      if (auto && !polishedWins(sc.score, after?.score)) {
        setFix(keepUndo)
        showToast(`한 번 더 다듬어 봤지만 점수가 오르지 않아 AI가 처음 쓴 대본(${sc.score}점)을 그대로 두었어요 — 빨간 · 노란 줄만 직접 고쳐 주세요.`)
        return
      }
      if (auto) setAi((a) => ({ ...a, drafts: a.drafts.map((d, k) => (k === 0 ? { ...d, ...next } : d)) }))
      else setAi({ busy: false, error: '', drafts })
      set({ ...next, source: 'ai', checks })
      setFix({ busy: false, error: '', before: undo.to, fixed: next.script, why: undo.why })
      showToast(auto ? `한 번 더 다듬었어요 — ${sc.score}점 → ${after?.score ?? sc.score}점` : `고쳐 썼어요 — ${sc.score}점 → ${after?.score ?? sc.score}점`)
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : '다시 눌러 주세요.'
      setFix(auto ? { ...keepUndo, error: `한 번 더 다듬기는 못 했어요(${msg}) — 대본은 AI가 처음 쓴 그대로예요.` } : { ...idle, error: msg })
    }
  }
  const runFix = async () => {
    if (fix.busy || ai.busy || !score || score.pass || readOnly) return
    const before = { script: draft.script, caption: draft.caption, hashtags: draft.hashtags }
    await polish(before, score, { aim: draft.aim as ShortAim, format: draft.format }, { to: before, why: 'fix' }, false)
  }
  const undoFix = () => {
    if (!fix.before) return
    set({ ...fix.before })
    setFix({ busy: false, error: '', before: null, fixed: '' })
    showToast(fix.why === 'new' ? '이전 대본으로 돌렸어요.' : '고치기 전 대본으로 돌렸어요.')
  }
  /** D-560 대본 칸 위 '다른 안' — 바로 바꾸고 예전 대본은 [이전 대본으로 되돌리기] */
  const swapDraft = (d: ShortDraft) => {
    const prev = { script: draft.script, caption: draft.caption, hashtags: draft.hashtags }
    if (prev.script.trim() === d.script.trim()) return
    set({ script: d.script, caption: d.caption || prev.caption, hashtags: d.hashtags || prev.hashtags, source: 'ai', ...(d.format ? { format: d.format } : {}) })
    setFix(prev.script.trim() ? { busy: false, error: '', before: prev, fixed: d.script, why: 'new' } : { busy: false, error: '', before: null, fixed: '' })
  }
  const runQuick = () => {
    if (!draft.topic.trim()) return
    // 형식을 아직 안 정했으면 추천대로 정해 두고 쓴다 — '형식 직접 고르기' 에도 그대로 보인다
    if (!draft.format) set({ aim: eff.aim, format: eff.format, formatBy: 'rec' })
    return runAi({ aim: eff.aim, format: eff.format }, true)
  }
  const save = async (posted: boolean) => {
    if (!draft.script.trim()) return showToast('대본이 비어 있어요.')
    if (readOnly || saving) return
    setSaving(true)
    try {
      const prev = draft.id ? store.posts.find((p) => p.id === draft.id) : undefined
      const saved = await store.save({
        id: draft.id,
        platform: draft.platform,
        aim: draft.aim,
        format: draft.format,
        topic: draft.topic,
        script: draft.script.trim(),
        caption: draft.caption.trim(),
        hashtags: draft.hashtags.trim(),
        checks: draft.checks,
        status: posted ? 'posted' : (prev?.status ?? 'draft'),
        postedOn: posted ? (prev?.postedOn || today) : (prev?.postedOn ?? ''),
        stats: prev?.stats ?? EMPTY_SHORT_STATS,
        source: draft.source,
      })
      if (posted) {
        setDraft((d) => ({ ...EMPTY, platform: d.platform, aim: d.aim }))
        setAi({ busy: false, error: '', drafts: [] })
        setHandOpen(false)
        showToast('기록표에 올렸어요 — 하루 이틀 뒤 숫자를 적어 주세요.')
        onRecords()
      } else {
        set({ id: saved.id })
        showToast('저장했어요 — 기록표의 "만들다 둔 영상" 에 있어요.')
      }
    } catch (e) {
      showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message} (적은 대본은 이 화면에 그대로 있어요)` : '저장하지 못했어요 — 적은 대본은 이 화면에 그대로 있어요.')
    } finally {
      setSaving(false)
    }
  }
  const copy = (text: string, what: string) => void copyText(text).then((ok) => showToast(ok ? `${what} 복사했어요.` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.'))

  // D-507 계속 쓰기 — 대본 칸이 비어 있고 써 둔 대본이 있으면 맨 위 한 줄 [이어서 쓰기](가장 최근에 저장한 것)
  const lastDraft = !draft.script.trim() && !draft.id ? [...store.posts].filter((p) => p.status === 'draft' && p.script.trim()).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] : undefined
  return (
    <div className="flex flex-col gap-4" data-testid="sht-write">
      {lastDraft && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="sht-resume">
          <span className="min-w-0 flex-1 basis-48">
            <span className="t-meta block font-semibold text-slate-600">써 둔 대본</span>
            <span className="t-sub block font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="sht-resume-line">
              {(lastDraft.topic.trim() || lastDraft.script.trim().split('\n')[0]).slice(0, 40)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setDraft(() => ({ ...EMPTY, id: lastDraft.id, platform: lastDraft.platform, aim: lastDraft.aim, format: lastDraft.format, topic: lastDraft.topic, script: lastDraft.script, caption: lastDraft.caption, hashtags: lastDraft.hashtags, checks: lastDraft.checks, source: lastDraft.source }))}
            className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700"
            data-testid="sht-resume-go"
          >
            이어서 쓰기
          </button>
        </div>
      )}
      {/* MUX-2 주제 하나 → 바로 쓰기 — 목적 · 형식은 이번 주 올린 비율 · 주제 낱말로 추천(규칙). 직접 고르기는 아래에 접어 둠(지운 것 없음) */}
      <QuickStart
        testPrefix="sht"
        topic={draft.topic}
        onTopic={(t) => set({ topic: t })}
        onPick={pickTopic}
        chips={chips}
        recLabel={`${aimLabel(draft.platform, eff.aim)} · ${formatOf(eff.format)?.name ?? ''} (${formatOf(eff.format)?.seconds ?? ''})`}
        recWhy={rec.why}
        recTip={formatOf(eff.format) ? formatTip(formatOf(eff.format) as ShortFormat) : undefined}
        picked={!!draft.format && draft.formatBy !== 'rec'}
        onChangeFormat={openFormats}
        top={
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="어디에 올려요" data-testid="sht-qs-platform">
            {PLATFORM_CHOICES.map((p) => (
              <HoverTip key={p.key} tip={<TipBody title={p.label} body={p.tip} />}>
                <button type="button" role="radio" aria-checked={draft.platform === p.key} onClick={() => pickPlatform(p.key)} className={toneChip(p.tone, draft.platform === p.key)} data-testid={`sht-qs-platform-${p.key}`}>
                  {p.label}
                </button>
              </HoverTip>
            ))}
          </div>
        }
        facts={<FactsBox value={draft.facts} onChange={(v) => set({ facts: v })} testPrefix="sht" what="영상" />}
        ai={{ ok: aiOk, busy: ai.busy, error: ai.error, label: 'AI로 완성 대본 쓰기', onRun: () => void runQuick() }}
        fallback={{ label: '형식 예시로 시작', onClick: startExample }}
        request={aiOk ? { value: request, onChange: setRequest, placeholder: '예: 50대 사장님께 말하듯 · 30초 안으로 · 댓글로 키워드 받기' } : undefined}
        hooks={<FirstLineMaker testPrefix="sht" channel="shorts" topic={draft.topic} facts={draft.facts} aiOk={aiOk} onUse={applyFirstLine} />}
      >
        {ai.drafts.length > 0 && (
          <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))' }} data-testid="sht-ai-drafts">
            {ai.drafts.map((d, i) => (
              <AiDraftCard key={i} n={i + 1} d={d} draft={draft} facts={factsText} onUse={() => start({ script: d.script, caption: d.caption, hashtags: d.hashtags, source: 'ai', checks: draft.checks, ...(d.format ? { format: d.format } : {}) })} />
            ))}
          </ul>
        )}
      </QuickStart>

      {/* D-299 AI 도우미 판 — 모델 고르기 · 직접 묻기(숏폼 공식으로 답) · [대본 2개 쓰기] 를 고른 모델로 → 답의 [대본 칸에 넣기] */}
      {aiOk && (
        <AiAssist
          page="shorts"
          title="릴스 · 틱톡"
          presets={['shorts.write']}
          quick={0}
          build={() => ({ context: writeContext({ aim: draft.aim, format: draft.format }), links: {} })}
          itemActions={(id) =>
            id === 'shorts.write'
              ? [
                  {
                    id: 'sht-use',
                    label: '대본 칸에 넣기',
                    primary: true,
                    run: (item) => {
                      const d = parseShortDrafts({ headline: '', items: [item] } as AssistAnswer).drafts[0]
                      if (!d) return false
                      start({ script: d.script, caption: d.caption, hashtags: d.hashtags, source: 'ai', ...(d.format ? { format: d.format } : {}) })
                      return true
                    },
                  },
                ]
              : null
          }
        />
      )}

      {/* D-298 '이것만 지키면 돼요' — 글자 덩어리 대신 색 번호 · 굵은 한마디 · 짧은 설명, 예시는 마우스를 올리거나 ? 를 누르면 */}
      {/* D-357 화면 원칙 — 접힌 채로도 네 가지 한마디는 한 줄에(누르면 설명 · 예시) */}
      <Fold
        id="sht.basics"
        title="이것만 지키면 돼요"
        icon={<Lightbulb aria-hidden="true" className="size-5 shrink-0 text-amber-600" />}
        summary={SHORT_BASICS_EASY.map((b, i) => `${i + 1} ${b.title}`).join(' · ')}
        className="rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-1 data-[open=1]:pb-3 sm:px-4"
        testId="sht-basics"
      >
        <ol className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 15rem), 1fr))' }}>
          {SHORT_BASICS_EASY.map((b, i) => (
            <li key={b.title} className="min-w-0 rounded-lg border border-amber-200 bg-white px-2.5 py-2" data-testid="sht-basic">
              <HintTip tip={`예시\n${b.example}`} label={b.title} tight>
                <span className="t-body flex min-w-0 items-center gap-2 font-bold break-keep text-slate-900">
                  <span aria-hidden="true" className="t-meta inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{b.title}</span>
                </span>
              </HintTip>
              <span className="t-sub block pl-8 break-keep text-slate-600">{b.detail}</span>
            </li>
          ))}
        </ol>
      </Fold>

      {/* D-298 [형식 바꾸기] 로 펼치는 칸 — 보라 테두리 · 펼치며 잠깐 빛남 · 색 구역 셋(① 어디에 · ② 무엇을 · ③ 형식) */}
      <Fold
        id="sht.formats"
        title="내 맞춤 — 어디에 · 목적 · 형식 직접 고르기"
        hint="자세히 하고 싶을 때만 여세요. 추천 형식 대신 어디에 올릴지 → 무엇을 원하는지 → 영상 형식을 직접 골라요. 고른 형식에서 [이 형식으로 완성 대본 쓰기] 를 누르면 그 형식으로 바로 써요."
        icon={<SlidersHorizontal aria-hidden="true" className="size-5 text-violet-600" />}
        summary="어디에 · 무엇을 원해요 · 형식 5가지 · 예시 대본"
        className="scroll-mt-24 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-1 data-[open=1]:pb-4 sm:px-4"
        testId="sht-choose"
      >
        <ToneSection n="1" tone="teal" title="어디에 올려요?" help="영상을 올릴 곳이에요. 틱톡 · 쇼츠는 말로 설명하는 조금 긴 영상, 릴스는 20초 안팎 짧은 영상이 잘 돼요." testId="sht-sec-platform">
          <BigChoices items={PLATFORM_CHOICES} value={draft.platform} onPick={pickPlatform} label="어디에 올려요" testPrefix="sht-platform" min="13rem" />
        </ToneSection>
        <ToneSection n="2" tone="sky" title="무엇을 원해요?" help="이 영상으로 얻고 싶은 것이에요. 많이 보이게 하는 영상과 문의 · 댓글을 받는 영상은 끝맺음이 달라요." testId="sht-sec-aim">
          <BigChoices items={aimChoices(draft.platform)} value={draft.aim} onPick={pickAim} label="무엇을 원해요" testPrefix="sht-aim" min="13rem" />
          <p className="t-sub break-keep text-slate-600" data-testid="sht-mix">
            {draft.platform === 'tiktok' ? `권장: 많이 보이게 3번에 문의로 1번 · 이번 주 ${mix.tiktok.reach} : ${mix.tiktok.convert}` : `권장: 많이 보이게 2번 · 댓글 받기 2번(자금 · 세금 소재는 댓글 위주) · 이번 주 ${mix.reels.reach} : ${mix.reels.convert}`}
          </p>
        </ToneSection>
        <ToneSection n="3" tone="violet" title="어떤 형식으로?" help="영상의 모양이에요. 형식 이름에 마우스를 올리면 어떤 영상인지 · 예시가 나와요." testId="sht-sec-format">
          <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 15rem), 1fr))' }} data-testid="sht-formats">
            {formats.map((f) => {
              const on = draft.format === f.key
              const tone = TONES[FORMAT_TONE[f.key]]
              return (
                <li key={f.key} className="min-w-0">
                  <HoverTip block className="h-full" tip={<TipBody title={`${f.name} (${f.seconds})`} body={FORMAT_EASY[f.key].plain} example={FORMAT_EASY[f.key].sample} />} testId="sht-formattip">
                    <button type="button" aria-pressed={on} onClick={() => set({ format: f.key, formatBy: 'hand' })} className={`tap flex h-full min-h-16 w-full min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border px-3.5 py-2.5 text-left ${on ? 'border-brand-500 bg-white ring-2 ring-brand-200' : `${tone.line} bg-white ${tone.hover}`}`} data-testid={`sht-format-${f.key}`}>
                      <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-full ${tone.bar}`} />
                        <span className="t-body font-bold break-keep text-slate-900">{f.name}</span>
                        <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${tone.soft} ${tone.ink}`}>{f.seconds}</span>
                      </span>
                      <span className="t-sub break-keep text-slate-600">{mkText(f.how)}</span>
                    </button>
                  </HoverTip>
                </li>
              )
            })}
          </ul>
          {fmt && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3" data-testid="sht-format-detail">
              {/* D-298 쉽게 말하면 · 예시 — 휴대폰(마우스 없음)도 고르면 여기서 본다 */}
              <p className="t-sub flex items-start gap-1.5 break-keep text-slate-800" data-testid="sht-format-plain">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
                <span className="min-w-0">
                  <b>쉽게 말하면</b> {FORMAT_EASY[fmt.key].plain}
                </span>
              </p>
              <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-slate-800">
                <b className="text-slate-900">예시</b> {FORMAT_EASY[fmt.key].sample}
              </p>
              <p className="t-sub break-keep text-slate-700">
                <b>왜 되나</b> {fmt.why}
              </p>
              {fmt.caution && (
                <p className="t-sub flex items-start gap-1.5 break-keep text-warning-800">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {fmt.caution}
                </p>
              )}
              <div>
                <Button variant="secondary" onClick={() => start({ ...exampleOf(fmt, draft.platform), hashtags: exampleTagsOf(fmt), source: 'example' })} data-testid="sht-use-example">
                  <FilePlus2 aria-hidden="true" className="size-4" /> 예시 대본으로 시작
                </Button>
              </div>
              {/* D-558 대표 "형식 · 예시를 보고 고른 다음 요청 한 줄 달고 한 번 누르면 완성" — 이 형식으로 AI 한 번(위 '더 바라는 점' 도 같이) */}
              {aiOk && (
                <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5" data-testid="sht-fmt-ai-box">
                  <input value={request} onChange={(e) => setRequest(e.target.value)} maxLength={200} placeholder="더 바라는 점(선택) — 예: 30초 안으로" aria-label="이 형식으로 쓸 때 더 바라는 점" className="t-sub min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="sht-fmt-request" />
                  <div className="flex flex-wrap items-center gap-2">
                    <AiConfirm>
                      <Button size="sm" variant="primary" className="bg-violet-600 hover:bg-violet-700" onClick={() => void runAi({ aim: draft.aim || eff.aim, format: fmt.key }, true)} disabled={ai.busy || !draft.topic.trim()} data-testid="sht-fmt-ai">
                        {ai.busy ? 'AI가 쓰는 중…' : `${fmt.name}으로 완성 대본 쓰기`}
                      </Button>
                    </AiConfirm>
                    {!draft.topic.trim() && <span className="t-meta text-slate-600">위 1번에서 주제를 먼저 고르세요.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </ToneSection>
      </Fold>

      {!editorOpen ? (
        <Surface className="flex flex-col gap-2">
          <div id="sht-editor" className="scroll-mt-24" data-testid="sht-editor-closed">
            <StepTitle n="2">고치고 확인하기</StepTitle>
          </div>
          <p className="t-sub break-keep text-slate-600">1단계에서 [AI로 완성 대본 쓰기] · 예시 · 빈 틀로 시작하면 여기에 대본이 나와요 — 첫마디 · 길이 · 자막 · #태그를 바로 검사해요.</p>
          <Button variant="secondary" className="self-start" onClick={() => (setHandOpen(true), window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-testid="sht-script"]')?.focus(), 0))} data-testid="sht-hand">
            <NotebookPen aria-hidden="true" className="size-4" /> 직접 쓰기
          </Button>
        </Surface>
      ) : (
      <Surface className="flex flex-col gap-3">
        <div id="sht-editor" className="scroll-mt-24">
          <StepTitle n="2">고치고 확인하기</StepTitle>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" data-testid="sht-editor">
          <div className="flex min-w-0 flex-col gap-3">
            {ai.drafts.length > 1 && <AltDrafts drafts={ai.drafts} current={draft.script} draft={draft} facts={factsText} onPick={swapDraft} />}
            <label className="flex flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <HintTip tip="영상에서 말할 말과 화면에 띄울 큰 글자를 시간 순서대로 적은 것이에요. [0:00] 은 몇 초에 나오는지예요." label="대본" tight>
                  <span className="t-sub font-semibold text-slate-700">대본{fmt ? ` — ${fmt.name}` : ''}</span>
                </HintTip>
                <span className="t-sub font-bold tabular-nums text-slate-700" data-testid="sht-seconds">
                  {draft.script.trim() ? `약 ${lint.seconds}초 · 첫마디 ${lint.firstWords.replace(/\s/g, '').length}자` : ''}
                </span>
              </span>
              <textarea value={draft.script} onChange={(e) => set({ script: e.target.value })} rows={11} placeholder={'[0:00] 첫마디 10자 안팎  (화면 큰 글자: …)\n[0:03] 딱 세 가지만 보세요.\n[0:06] 첫째, …'} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 leading-relaxed" data-testid="sht-script" />
            </label>
            <label className="flex flex-col gap-1">
              <HintTip tip="영상 아래에 붙는 설명 글이에요. 영상을 다 안 본 사람도 무슨 내용인지 알게 짧게 적어요." label="설명 글(캡션)" tight>
                <span className="t-sub font-semibold text-slate-700">설명 글(캡션) {draft.platform === 'tiktok' ? '(한 줄)' : draft.aim === 'convert' ? '(200자 안팎 · 요약 3줄 + 키워드)' : '(100자 안팎)'}</span>
              </HintTip>
              <textarea value={draft.caption} onChange={(e) => set({ caption: e.target.value })} rows={3} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2" data-testid="sht-caption" />
            </label>
            <label className="flex flex-col gap-1">
              <HintTip tip="#으로 시작하는 검색 낱말이에요. 이 낱말을 찾는 사람에게 영상이 보여요. 예: #창업 #세금" label="#태그(해시태그)" tight>
                <span className="t-sub font-semibold text-slate-700">#태그(해시태그) {draft.platform === 'tiktok' ? '(3~5개)' : '(0~3개)'}</span>
              </HintTip>
              <input value={draft.hashtags} onChange={(e) => set({ hashtags: e.target.value })} placeholder="#벤처기업확인 #창업" className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="sht-tags" />
            </label>
            {draft.checks.length > 0 && (
              <div className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="sht-checks">
                <p className="t-sub font-semibold text-warning-900">찍기 전 확인할 것(AI 가 적음)</p>
                <ul className="t-sub list-disc pl-5 break-keep text-warning-900">
                  {draft.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copy(draft.script.trim(), '대본을')} disabled={!draft.script.trim()} data-testid="sht-copy-script">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 대본 복사
              </Button>
              <Button variant="secondary" onClick={() => copy(`${draft.caption.trim()}\n\n${draft.hashtags.trim()}`.trim(), '설명 글을')} disabled={!draft.caption.trim() && !draft.hashtags.trim()} data-testid="sht-copy-caption">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 설명 글 복사
              </Button>
              {!readOnly && (
                <>
                  <Button variant="secondary" onClick={() => void save(false)} disabled={!draft.script.trim() || saving} data-testid="sht-save">
                    <Save aria-hidden="true" className="size-4" /> 저장
                  </Button>
                  <Button variant="primary" onClick={() => void save(true)} disabled={!draft.script.trim() || saving} data-testid="sht-posted" data-guide="fn-mk-posted">
                    <Send aria-hidden="true" className="size-4" /> 올렸어요 · 기록표로
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => (draft.script.trim() && !window.confirm('지금 대본을 비우고 새로 만들까요?') ? undefined : (setDraft((d) => ({ ...EMPTY, platform: d.platform, aim: d.aim })), setAi({ busy: false, error: '', drafts: [] }), setHandOpen(false)))} data-testid="sht-new">
                새로
              </Button>
            </div>
            {/* D-583 찍은 영상을 어디에 어떻게 올리나 — 접힌 한 줄(안에서 릴스 · 틱톡 · 쇼츠 탭) */}
            <PostingHowTo channels={['reels', 'tiktok', 'shorts']} testId="sht-howto" />
            {draft.topic.trim() && (
              <Button variant="ghost" className="self-start" onClick={() => navigate(`/marketing/threads?topic=${encodeURIComponent(draft.topic.trim())}`)} data-testid="sht-to-threads">
                같은 소재로 스레드 글 쓰기 →
              </Button>
            )}
            {draft.format === 'comment' && <ShareKit testId="sht-share" />}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <PostScoreBar score={draft.script.trim() ? score : null} testPrefix="sht" aiOk={aiOk} busy={fix.busy} busyLabel={fix.auto ? 'AI가 90점까지 한 번 더 다듬는 중…' : undefined} error={fix.error} onFix={() => void runFix()} onUndo={fix.before && fix.fixed === draft.script ? undoFix : null} undoLabel={fix.why === 'new' ? '이전 대본으로 되돌리기' : '고치기 전으로'} readOnly={readOnly} />
            <div className="flex flex-wrap items-center gap-2">
              <HintTip tip="대본이 규칙대로 잘 써졌는지 바로 확인해 줘요(규칙 계산) — 첫마디 · 길이 · 끝맺음 · 설명 글 · #태그. 빨강 = 꼭 고칠 것 · 노랑 = 한 번 볼 것 · 초록 = 괜찮아요." label="규칙 검사" tight>
                <span className="t-sub font-semibold text-slate-700">규칙 검사</span>
              </HintTip>
              {lint.bad > 0 ? <Badge tone="danger">고칠 것 {lint.bad}</Badge> : <Badge tone="success">고칠 것 0</Badge>}
              {lint.warn > 0 && <Badge tone="warning">볼 것 {lint.warn}</Badge>}
            </div>
            <LintList lines={draft.script.trim() ? lintShown : []} testId="sht-lint" />
            {!draft.script.trim() && <p className="t-sub break-keep text-slate-500">대본을 쓰면 여기서 바로 확인해요.</p>}
          </div>
        </div>
      </Surface>
      )}
    </div>
  )
}

/** D-560 대본 칸 바로 위 — AI 가 함께 쓴 안(1 · 2안)을 점수와 함께 · 누르면 그 안으로(예전 대본은 되돌리기) */
function AltDrafts({ drafts, current, draft, facts, onPick }: { drafts: readonly ShortDraft[]; current: string; draft: Draft; facts: string; onPick: (d: ShortDraft) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid="sht-alt">
      <span className="t-sub font-semibold text-slate-700">AI가 쓴 안</span>
      {drafts.map((d, i) => {
        const sc = scorePost({ kind: 'short', text: `${d.script}\n${d.caption}`, lines: lintShort({ platform: draft.platform, aim: draft.aim, script: d.script, caption: d.caption, hashtags: d.hashtags, facts }).lines })
        const on = d.script.trim() === current.trim()
        const f = d.format ? formatOf(d.format) : undefined
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={on}
            className={`tap t-sub inline-flex min-h-10 items-center gap-1 rounded-full border px-3 font-semibold ${on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50'}`}
            data-testid="sht-alt-btn"
            data-on={on ? '1' : '0'}
          >
            {i + 1}안{f ? ` · ${f.name}` : ''}
            {sc && <span className={`t-meta font-bold ${sc.pass ? 'text-success-700' : 'text-warning-800'}`}>{sc.score}점</span>}
            {on && <span className="t-meta font-normal">(지금)</span>}
          </button>
        )
      })}
    </span>
  )
}

function AiDraftCard({ n, d, draft, facts, onUse }: { n: number; d: ShortDraft; draft: Draft; facts: string; onUse: () => void }) {
  const lint = lintShort({ platform: draft.platform, aim: draft.aim, script: d.script, caption: d.caption, hashtags: d.hashtags, facts })
  const sc = scorePost({ kind: 'short', text: `${d.script}\n${d.caption}`, lines: lint.lines })
  const f = d.format ? formatOf(d.format) : undefined
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3" data-testid="sht-ai-draft">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="t-sub font-bold text-slate-900">{n}안</span>
        {f && <Badge tone="brand">{f.name}</Badge>}
        <Badge tone={lint.bad ? 'danger' : 'success'}>
          약 {lint.seconds}초 · 고칠 것 {lint.bad}
        </Badge>
        {sc && (
          <span className="contents" data-testid="sht-ai-draft-score" data-score={sc.score}>
            <Badge tone={sc.pass ? 'success' : sc.bad ? 'danger' : 'warning'}>{sc.score}점</Badge>
          </span>
        )}
      </div>
      <p className="t-sub max-h-56 overflow-y-auto break-keep whitespace-pre-line text-slate-800">{d.script}</p>
      {d.caption && <p className="t-sub break-keep text-slate-500">설명 글: {d.caption}</p>}
      <Button variant="secondary" onClick={onUse} data-testid="sht-ai-use">
        이 대본으로 고치기
      </Button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 기록표                                                              */
/* ------------------------------------------------------------------ */

function RecordsPanel({ store, readOnly, onOpen }: { store: Store; readOnly: boolean; onOpen: (p: ShortPost) => void }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const posted = store.posts.filter((p) => p.status === 'posted')
  const drafts = store.posts.filter((p) => p.status === 'draft')
  const recs = formatRecords(store.posts)
  const mix = weekMix(store.posts, today)
  const inquiries = posted.reduce((a, p) => a + (p.stats.inquiries ?? 0), 0)
  if (!store.loaded) return <p className="t-sub text-slate-500">기록을 읽는 중…</p>
  return (
    <div className="flex flex-col gap-4" data-testid="sht-records">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr))' }}>
        <div data-testid="sht-rec-count" className="contents">
          <MetricTile label="올린 영상" value={`${posted.length}개`} />
        </div>
        <MetricTile label="이번 주 틱톡" value={`${mix.tiktok.reach + mix.tiktok.convert}개`} hint={`많이 보이게 ${mix.tiktok.reach} · 문의 ${mix.tiktok.convert}`} hintOnMobile />
        <MetricTile label="이번 주 릴스" value={`${mix.reels.reach + mix.reels.convert}개`} hint={`많이 보이게 ${mix.reels.reach} · 댓글 ${mix.reels.convert}`} hintOnMobile />
        <MetricTile label="문의" value={`${inquiries}건`} />
      </div>
      <Surface className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <HelpHeading help="올린 영상의 숫자를 모아 형식마다 평균을 낸 표예요. 점수가 높은 형식을 더 자주 만들면 돼요." wrapClassName="min-w-[12rem] flex-1" className="t-section break-keep text-slate-900">
            우리 계정에서 되는 형식
          </HelpHeading>
          <Button size="sm" variant="ghost" onClick={() => downloadText(`릴스-틱톡-기록표-${today}.csv`, `﻿${shortsCsv(store.posts)}`, 'text/csv')} disabled={!posted.length} title="CSV 파일 — 엑셀에서 열려요" data-testid="sht-rec-csv">
            <Download aria-hidden="true" className="size-4" /> 엑셀로 받기
          </Button>
        </div>
        <p className="t-sub break-keep text-slate-600">점수는 좋아요 1점 · 댓글 3점으로 더해요(실제로 잘된 영상과 안 된 영상을 가른 방법). 같은 형식으로 3개 넘게 쌓이면 우리 숫자를 먼저 믿어요.</p>
        {recs.length ? (
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="sht-rec-formats">
            {recs.map((r) => (
              <li key={r.key} className="flex flex-col gap-0.5 py-2" data-testid="sht-rec-format" data-key={r.key}>
                <span className="t-body font-semibold break-keep text-slate-900">{r.label}</span>
                <span className="t-sub flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums text-slate-600">
                  <span>{r.posts}개</span>
                  <b className="text-slate-900">평균 {r.avgScore == null ? '—' : r.avgScore.toLocaleString('ko-KR')}</b>
                  <span>조회 {r.avgViews == null ? '—' : r.avgViews.toLocaleString('ko-KR')}</span>
                  {r.inquiries > 0 && <span>문의 {r.inquiries}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">아직 올린 영상이 없어요 — [오늘 만들 영상] 에서 만들고 [올렸어요] 를 누르면 여기에 쌓입니다.</p>
        )}
      </Surface>
      {posted.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="올린 영상">
          <h2 className="t-section break-keep text-slate-900">올린 영상 — 숫자 적기</h2>
          <ul className="flex flex-col gap-2" data-testid="sht-rec-list">
            {posted.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
      {drafts.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="만들다 둔 영상">
          <h2 className="t-section break-keep text-slate-900">만들다 둔 영상 {drafts.length}</h2>
          <ul className="flex flex-col gap-2" data-testid="sht-rec-drafts">
            {drafts.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function RecordItem({ p, store, readOnly, onOpen, showToast }: { p: ShortPost; store: Store; readOnly: boolean; onOpen: () => void; showToast: (m: string) => void }) {
  const f = p.format ? formatOf(p.format) : undefined
  const score = shortScore(p.stats)
  const rate = keepRate(p.stats)
  const put = (part: Partial<ShortPost>) => store.patch(p.id, part).catch((e: unknown) => showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message}` : '저장하지 못했어요.'))
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid="sht-rec-item" data-id={p.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        {p.status === 'posted' ? <Badge tone="success">{p.postedOn.slice(5).replace('-', '/')} 올림</Badge> : <Badge>만들다 둠</Badge>}
        {weekBadge(p) && <Badge tone="brand">{weekBadge(p)}</Badge>}
        <Badge tone="brand">{p.platform === 'reels' ? '릴스' : '틱톡 · 쇼츠'}</Badge>
        {f && <Badge>{f.name}</Badge>}
        {p.aim && <Badge>{aimLabel(p.platform, p.aim)}</Badge>}
      </div>
      <p className="t-body line-clamp-2 font-semibold break-keep text-slate-900">{firstWordsOf(p.script)}</p>
      {(score != null || rate != null) && (
        <p className="t-sub flex flex-wrap gap-x-3 font-bold tabular-nums text-slate-900" data-testid="sht-rec-score">
          {score != null && <span>점수 {score.toLocaleString('ko-KR')}</span>}
          {rate != null && <span>저장 · 공유율 {rate}%</span>}
        </p>
      )}
      {p.status === 'posted' && <StatInputs keys={SHORT_STAT_KEYS} values={p.stats} disabled={readOnly} onSet={(k, v) => void put({ stats: { ...p.stats, [k]: v } })} testPrefix="sht" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onOpen} data-testid="sht-rec-open">
          열어서 고치기
        </Button>
        {!readOnly && p.status === 'draft' && (
          <Button size="sm" variant="secondary" onClick={() => void put({ status: 'posted', postedOn: todayLocalDate() })} data-testid="sht-rec-post">
            <Send aria-hidden="true" className="size-4" /> 올렸어요
          </Button>
        )}
        {!readOnly && <DeleteTwice onDelete={() => void store.remove(p.id).catch(() => showToast('지우지 못했어요 — 다시 눌러 주세요.'))} testPrefix="sht-rec" what="이 영상을" />}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 형식 · 공식                                                          */
/* ------------------------------------------------------------------ */

const COMMENT_WORKS: ReadonlyArray<[string, string]> = [
  ['받는 것이 크고 구체적(목록 · 공식 · 서류 목록)', '"정리해 드림" · 목차만 · 무료 상담'],
  ['대상이 넓음("사장님 누구나")', '대상이 좁음("연구소 보유 법인")'],
  ['20초 안팎 · 숫자가 첫 화면에', '40초 넘는 글자 영상 · 숫자 없음'],
  ['댓글로 남길 말이 쉬움(숫자 하나 · "아무 댓글")', '신청서 · 개인 메시지(DM) · 링크까지 여러 단계'],
]

function GuidePanel({ onUse }: { onUse: (f: ShortFormat) => void }) {
  return (
    <div className="flex flex-col gap-4" data-testid="sht-guide">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))' }}>
        <Surface className="flex flex-col gap-1.5">
          <h2 className="t-section flex items-center gap-2 break-keep text-teal-900">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${TONES.teal.bar}`} />틱톡 · 유튜브 쇼츠
          </h2>
          <ul className="t-body flex list-disc flex-col gap-1 pl-5 break-keep text-slate-800">
            <li>정보형 40~70초 (답을 끝으로) · 이미지형 25~30초</li>
            <li>말로 설명 — 1초에 6~7자</li>
            <li>리스트 · 화면 시연 · 대화형</li>
            <li>많이 보이게: 끝에 권유 없이 / 문의로: 끝 한 줄</li>
            <li>설명 글 한 줄 + #태그 3~5개</li>
          </ul>
        </Surface>
        <Surface className="flex flex-col gap-1.5">
          <h2 className="t-section flex items-center gap-2 break-keep text-slate-900">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${TONES.fuchsia.bar}`} />인스타 릴스
          </h2>
          <ul className="t-body flex list-disc flex-col gap-1 pl-5 break-keep text-slate-800">
            <li>20~25초 · 한 화면 목록은 6~15초</li>
            <li>말 없이 글자만도 됨 (말을 넣으면 첫 문장에 숫자)</li>
            <li>한 화면 목록 · 화면 시연 · 짧은 글자 정보</li>
            <li>많이 보이게: 권유 없이 / 댓글 받기: "키워드 댓글" 하나</li>
            <li>설명 글 100자(댓글형 200자) · #태그 0~3개</li>
          </ul>
        </Surface>
      </div>
      <h2 className="t-section break-keep text-slate-900">형식 5가지</h2>
      <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))' }} data-testid="sht-guide-formats">
        {SHORT_FORMATS.map((f) => (
          <li key={f.key} className="min-w-0">
            <Surface className="flex h-full flex-col gap-2" as="article">
              <div className="flex flex-wrap items-baseline gap-x-2" data-testid="sht-guide-card" data-key={f.key}>
                <span aria-hidden="true" className={`size-2.5 shrink-0 self-center rounded-full ${TONES[FORMAT_TONE[f.key]].bar}`} />
                <h3 className="t-body font-bold break-keep text-slate-900">{f.name}</h3>
                <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${TONES[FORMAT_TONE[f.key]].soft} ${TONES[FORMAT_TONE[f.key]].ink}`}>{f.seconds}</span>
              </div>
              {/* D-298 쉽게 말하면 — 카드 맨 위 한 줄 */}
              <p className={`t-sub flex items-start gap-1.5 rounded-lg px-2.5 py-2 break-keep text-slate-800 ${TONES[FORMAT_TONE[f.key]].soft}`} data-testid="sht-guide-plain">
                <Lightbulb aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${TONES[FORMAT_TONE[f.key]].icon}`} />
                <span className="min-w-0">{FORMAT_EASY[f.key].plain}</span>
              </p>
              <p className="flex flex-wrap gap-1">
                {f.platforms.map((p) => (
                  <span key={p} className={`t-meta rounded-full border px-2 py-0.5 font-semibold ${TONES[PLATFORM_TONE[p]].line} ${TONES[PLATFORM_TONE[p]].soft} ${TONES[PLATFORM_TONE[p]].ink}`}>
                    {p === 'reels' ? '릴스' : '틱톡 · 쇼츠'}
                  </span>
                ))}
              </p>
              <p className="t-sub break-keep text-slate-800">{mkText(f.how)}</p>
              <p className="t-sub break-keep text-slate-700">
                <b>왜</b> {f.why}
              </p>
              <details className="rounded-(--radius-control) bg-slate-50 px-3 py-2">
                <summary className="sum-chev tap t-sub cursor-pointer font-semibold text-slate-700">예시 대본 보기</summary>
                <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-800">{exampleText(f.example)}</p>
                <p className="t-sub mt-2 break-keep whitespace-pre-line text-slate-500">설명 글: {f.exampleCaption}</p>
              </details>
              <div className="mt-auto">
                <Button variant="secondary" onClick={() => onUse(f)} data-testid="sht-guide-use">
                  이 형식으로 만들기
                </Button>
              </div>
            </Surface>
          </li>
        ))}
      </ul>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">릴스 "댓글 받기" 가 통하는 조건</h2>
        <ShareKit testId="sht-guide-share" />
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="sht-comment-works">
          {COMMENT_WORKS.map(([yes, no]) => (
            <li key={yes} className="flex flex-col gap-0.5 py-2">
              <span className="t-sub break-keep text-success-800">○ {yes}</span>
              <span className="t-sub break-keep text-slate-500">✕ {no}</span>
            </li>
          ))}
        </ul>
        <p className="t-sub break-keep text-slate-600">자료는 실제로 만든 뒤에만 겁니다.</p>
      </Surface>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">이렇게 말고 → 이렇게</h2>
        <p className="t-sub break-keep text-slate-600">대표님이 정한 원칙 · 넣지 말 것 — 규칙 검사가 이 표대로 알려 드려요.</p>
        <RewriteTable testId="sht-rewrites" />
      </Surface>
    </div>
  )
}
