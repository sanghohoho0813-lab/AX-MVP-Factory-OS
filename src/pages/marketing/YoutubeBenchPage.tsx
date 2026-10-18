/**
 * 콘텐츠 레이더 (D-194) — 예전 이름 '유튜브 벤치마킹'(D-193). 주소는 그대로 /marketing/youtube.
 *
 * 대표 지시(D-194): "벤치마킹 대시보드 → 실제 콘텐츠 의사결정 엔진. 첫 화면을 열면 '이번 주에 무엇을 찍을까' 가 먼저."
 *  - 탭 넷: 이번 주 찍을 것(첫 화면) · 인기 · 급상승(D-193 순위 판 그대로) · 채널(네 묶음 · 끄기 · 채널 추가) · 분석(D-193 분석 + 내 채널 · 제목 구조).
 *  - D-193 기능은 하나도 빼지 않았다 — 기간 4칸 · 키워드 · 순위 · 급상승 · 채널 현황 · 요일/시간/길이 · 롱폼/쇼츠 · 업로드 주기 ·
 *    내 채널 비교 · 주목 주제 · 제목 아이디어 · CSV · 새로 가져오기 · 키 없음 · 예시 데이터. 자리만 옮기고 접어 두었다(필요할 때 펼침).
 *  - 계산은 모두 규칙(ytBench · ytRadar) — 'AI' 라고 부르지 않는다. 대본 만들기 · 외부 AI 호출은 없다(브리프 복사만).
 *  - 저장(콘텐츠 수첩 · 채널 설정)은 기존 모듈 기록(moduleData) — 작업공간마다 따로. 팀장 화면을 보는 중이면 읽기만.
 *  - D-195: 마케팅 · 브랜딩은 대표(full) 전용 — 팀장(Pilot) · 대표가 팀장 화면으로 볼 때는 메뉴 · 찾기 · 주소 모두 닫힌다
 *    (moduleRegistry ownerOnly · AppShell 의 PilotRouteGuard 한 곳에서). 이 화면 안에서 따로 숨기지 않는다.
 *  - D-195 UX 3.0: 첫 화면은 1순위 하나만 크게 · 받은 때 · 채널 수는 작은 글로 · 비중 가이드는 [추천 기준] 안으로.
 *  - D-231: 마케팅 · 브랜딩(/marketing)을 누르면 바로 이 화면. 목차 한 줄에 '내 콘텐츠'(일정 · 체크리스트 · 예전 콘텐츠 수첩) ·
 *    홍보 글 만들기 · 홈페이지 만들기까지(MarketingTabs). 후보 카드마다 미래AI랩 관점 상자 + 이번 주 찍기 키트.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ClipboardCopy, Download, ExternalLink, Eye, Flame, Hash, MessageCircle, PlayCircle, RefreshCw, Rocket, SlidersHorizontal, ThumbsUp, TriangleAlert, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile } from '../../components/ui/primitives'
import { Fold, HintTip } from '../../components/ui/fold'
import { hintFor } from '../../content/sectionHints'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useViewingPilot } from '../../auth/osAccess'
import { useYtFeed } from '../../services/marketing/ytFeed'
import { mergeFeeds, useYtExtra } from '../../services/marketing/ytExtra'
import { useIdeas, useRadarPrefs } from '../../services/marketing/useRadarStore'
import { particle, quoted as q } from '../../lib/josa'
import { IDEA_STATUS_LABEL, confirmInput, customIdea, ideaFromOpportunity, type ContentIdea, type IdeaStatus, type RadarPrefs } from '../../services/marketing/radarStore'
import {
  PERIOD_HINT,
  PERIOD_LABEL,
  boardOf,
  byHour,
  byLength,
  byWeekday,
  bestOf,
  compareMine,
  dateKo,
  extractKeywords,
  extractTopics,
  fmt,
  formatByChannel,
  isRising,
  periodVideos,
  prepareFeed,
  shortNum,
  uploadCadence,
  videosCsv,
  type GroupStat,
  type Prepared,
  type Topic,
  type YtFeed,
  type YtPeriod,
  type YtType,
  type YtVideo,
} from '../../services/marketing/ytBench'
import {
  SIDE_MAX,
  aiKeywordBoard,
  aiWorkflowSignals,
  breakoutVideos,
  domainSignals,
  groupOf,
  hotPatterns,
  isCoreKeyword,
  isNoiseKeyword,
  myChannelStats,
  newAiKeywords,
  radarPlan,
  radarVideos,
  risingTopics,
  sideBreakouts,
  type Opportunity,
  type RadarVideo,
} from '../../services/marketing/ytRadar'
import { PlanView, type FocusData } from './radar/PlanView'
import { IconChip, RatioChip, VideoDetail } from './radar/RadarParts'
import { Peek, PeekProvider } from './radar/EvidencePeek'
import { ChannelManager } from './radar/ChannelManager'
import { MakeView } from './radar/MakeView'
import { MarketingTabs, RADAR_VIEWS, type RadarView } from '../../tools/marketing/MarketingTabs'
import { HotPatternsCard, MyChannelCard } from './radar/AnalysisExtras'

/** D-231 탭(목차)은 MarketingTabs — 이번 주 찍을 것 · 인기 · 급상승 · 채널 · 분석 · 내 콘텐츠 + 홍보 글 · 홈페이지 */
type View = RadarView
// 롱폼 · 쇼츠 고르기 칸(인기 탭) — 고른 칸은 레이더 색(빨강)
const seg = (on: boolean) => `tap t-sub inline-flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 py-2 font-semibold whitespace-nowrap sm:px-3 ${on ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-(--shadow-card)' : 'text-slate-600 hover:bg-white/70'}`
const PERIODS: YtPeriod[] = ['week', 'month', 'year', 'shorts']
const TOP_NS = [20, 30, 40, 60]


export default function YoutubeBenchPage() {
  return <WorkspaceScope>{(ctx) => <RadarPage workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}

function viewOf(raw: string | null): View {
  if (raw === 'ideas') return 'analysis' // D-193 '콘텐츠 추천' 주소 → 분석 탭(단어로 본 주목 주제)
  if (raw === 'notebook') return 'make' // D-231 예전 콘텐츠 수첩 → 내 콘텐츠
  return (RADAR_VIEWS.some((v) => v.key === raw) ? raw : 'plan') as View
}

/** 꺼 둔 채널은 계산에서 뺀다(내 채널은 끌 수 없다) */
function withoutDisabled(feed: YtFeed, overrides: Readonly<Record<string, { enabled?: boolean }>>): YtFeed {
  const off = new Set(Object.entries(overrides).filter(([, o]) => o.enabled === false).map(([id]) => id))
  if (off.size === 0) return feed
  const keep = feed.channels.filter((c) => c.mine || !off.has(c.id))
  const ids = new Set(keep.map((c) => c.id))
  return { ...feed, channels: keep, videos: feed.videos.filter((v) => ids.has(v.ch)) }
}

function RadarPage({ workspaceId }: { workspaceId: string | null }) {
  const yt = useYtFeed()
  const { showToast } = useToast()
  const readOnly = useViewingPilot() !== null
  const { prefs, ready: prefsReady, failed: prefsFailed, reload: reloadPrefs, update: updatePrefs } = useRadarPrefs(workspaceId, readOnly)
  /** D-222 설정을 아직 못 읽었으면 바꾸지 않는다(빈 설정으로 덮지 않게) */
  const prefsBlocked = () => (prefsReady ? false : (showToast(prefsFailed ? '채널 · 추천 설정을 읽지 못했습니다 — 위의 [다시 읽기] 를 누른 뒤 바꿔 주세요.' : '설정을 읽는 중입니다 — 잠시 뒤 다시 눌러 주세요.'), true))
  const notebook = useIdeas(workspaceId, readOnly)
  const [extraKey, setExtraKey] = useState(0)
  const addedIds = useMemo(() => (yt.sample ? [] : prefs.added.map((a) => a.id)), [yt.sample, prefs.added])
  const extra = useYtExtra(addedIds, extraKey, yt.feed?.fetchedAt ?? '')
  const [params, setParams] = useSearchParams()
  const view = viewOf(params.get('view'))
  const period = (PERIODS.includes(params.get('p') as YtPeriod) ? params.get('p') : 'week') as YtPeriod
  const kw = params.get('kw') ?? ''
  const [type, setType] = useState<YtType>('all')
  const [channel, setChannel] = useState('')
  const [topN, setTopN] = useState(30)
  const [detail, setDetail] = useState<RadarVideo | null>(null)

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const groupsOfAdded = useMemo(() => Object.fromEntries(prefs.added.map((a) => [a.id, a.group])), [prefs.added])
  const fullFeed = useMemo(() => (yt.feed ? mergeFeeds(yt.feed, extra.feed, groupsOfAdded) : null), [yt.feed, extra.feed, groupsOfAdded])
  const feed = useMemo(() => (fullFeed ? withoutDisabled(fullFeed, prefs.overrides) : null), [fullFeed, prefs.overrides])
  const prepared = useMemo(() => (feed ? prepareFeed(feed) : null), [feed])
  const opts = useMemo(() => ({ overrides: prefs.overrides, mix: prefs.mix, muted: prefs.muted }), [prefs.overrides, prefs.mix, prefs.muted])
  const rvideos = useMemo(() => (prepared ? radarVideos(prepared, opts) : []), [prepared, opts])
  const rvById = useMemo(() => new Map(rvideos.map((v) => [v.id, v])), [rvideos])
  // D-232 내 콘텐츠 성과 — 레이더가 이미 받은 내 채널 영상만(유튜브를 더 부르지 않음)
  const mineVideos = useMemo(() => rvideos.filter((v) => v.mine), [rvideos])
  const plan = useMemo(() => (prepared ? radarPlan(prepared, opts, rvideos) : null), [prepared, opts, rvideos])
  const rising = useMemo(() => (prepared && plan ? risingTopics(prepared, rvideos, plan.clusters) : []), [prepared, rvideos, plan])
  const breakouts = useMemo(() => breakoutVideos(rvideos), [rvideos])
  // D-197 — 경제 · 경영 · AI 신호판 · AI 핵심 키워드 · 새 AI 키워드 후보 · 사이드 급상승(새 AI 키워드 영상은 사이드에서 뺀다)
  const focus = useMemo<FocusData | null>(() => {
    if (!prepared || !plan) return null
    const fresh = newAiKeywords(prepared, rvideos)
    return {
      domains: domainSignals(plan.clusters),
      aiKeywords: aiKeywordBoard(rvideos),
      workflow: aiWorkflowSignals(plan.clusters),
      fresh,
      side: sideBreakouts(rvideos, 14, SIDE_MAX, fresh.map((k) => k.word)),
    }
  }, [prepared, plan, rvideos])
  const loading = yt.status === 'loading'

  const refresh = () => {
    void yt.refresh()
    if (prefs.added.length) setExtraKey((k) => k + 1)
  }
  // D-222 거르던 채널을 [채널] 탭에서 꺼 두면 그 채널은 목록에서 빠진다 — 그대로 거르면 '영상이 없습니다' 만 보여 '전체 채널' 로 본다
  const liveChannel = channel && prepared?.channels.some((c) => c.id === channel) ? channel : ''
  const filter = useMemo(() => ({ type, channels: liveChannel ? [liveChannel] : [] }), [type, liveChannel])

  const csv = () => {
    if (!prepared) return
    const d = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '')
    // 파일 이름은 영문(브라우저마다 한글 이름이 'download' 로 바뀌는 일이 있다) — 매출 · 비용 CSV 와 같은 꼴
    downloadText(`youtube-benchmark-${d}${yt.sample ? '-sample' : ''}.csv`, videosCsv(prepared.videos), 'text/csv')
  }
  const copy = useCallback((text: string, what = '제목') => void copyText(text).then((ok) => showToast(ok ? `${what}${particle(what, '을/를')} 복사했습니다.` : '복사하지 못했습니다 — 길게 눌러 직접 복사해 주세요.')), [showToast])
  const openVideo = useCallback((v: YtVideo | RadarVideo) => setDetail(rvById.get(v.id) ?? null), [rvById])
  // 숫자 뒤 영상 목록(D-198)에서 영상을 누르면 같은 영상 상세 창
  const peekEnv = useMemo(() => ({ onOpenVideo: openVideo, noThumb: yt.sample }), [openVideo, yt.sample])

  const saveOpp = async (o: Opportunity) => {
    if (readOnly) return showToast('팀장 화면을 보는 중에는 저장하지 않습니다.')
    if (notebook.failed) return showToast('콘텐츠 수첩을 읽지 못했습니다 — 새로고침한 뒤 다시 눌러 주세요(같은 주제가 두 번 담기지 않게).')
    if (notebook.ideas.some((i) => i.key === o.key)) return showToast(`${q(o.topic, '은/는')} 이미 수첩에 있습니다.`)
    try {
      if (!(await notebook.save(ideaFromOpportunity(o)))) return showToast('담는 중입니다 — 잠시만 기다려 주세요.')
      showToast(`${q(o.topic, '을/를')} 아이디어로 담았습니다 — [내 콘텐츠] 에 있습니다.`)
    } catch {
      showToast('수첩에 담지 못했습니다 — 잠시 뒤 다시 눌러 주세요.')
    }
  }
  /** [이번 주로 확정] — 수첩에 '제작 예정' 으로(이미 있으면 그 줄의 단계만 · D-195) */
  const confirmOpp = async (o: Opportunity) => {
    if (readOnly) return showToast('팀장 화면을 보는 중에는 저장하지 않습니다.')
    if (notebook.failed) return showToast('콘텐츠 수첩을 읽지 못했습니다 — 새로고침한 뒤 다시 눌러 주세요(같은 주제가 두 번 담기지 않게).')
    const c = confirmInput(o, notebook.ideas)
    if (!c.changed) return showToast(`${q(o.topic, '은/는')} 이미 '${IDEA_STATUS_LABEL[c.input.status ?? 'idea']}' 단계입니다.`)
    try {
      if (!(await notebook.save(c.input))) return showToast('담는 중입니다 — 잠시만 기다려 주세요.')
      showToast(`${q(o.topic, '을/를')} 이번 주 제작 예정으로 담았습니다 — [내 콘텐츠] 에서 촬영일 · 체크리스트를 적을 수 있습니다.`)
    } catch {
      showToast('담지 못했습니다 — 잠시 뒤 다시 눌러 주세요.')
    }
  }
  /** [관심 없음] — 정확히 이 후보만 다음 추천에서 뺀다(추천 기준 › 숨긴 주제에서 되살림) */
  const muteOpp = async (o: Opportunity) => {
    if (readOnly) return showToast('팀장 화면을 보는 중에는 바꾸지 않습니다.')
    if (prefsBlocked()) return
    const ok = await updatePrefs({ ...prefs, muted: [...prefs.muted.filter((k) => k !== o.key), o.key] })
    showToast(ok ? `${q(o.topic, '을/를')} 후보에서 뺐습니다 — 추천 기준 › 숨긴 주제에서 되살릴 수 있습니다.` : '숨기지 못했습니다.')
  }
  const unmute = async (key: string) => {
    if (readOnly) return showToast('팀장 화면을 보는 중에는 바꾸지 않습니다.')
    if (prefsBlocked()) return
    const ok = await updatePrefs({ ...prefs, muted: prefs.muted.filter((k) => k !== key) })
    if (!ok) showToast('되살리지 못했습니다.')
  }
  const goNotebook = () => {
    setParam({ view: 'make' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const setStatus = async (i: ContentIdea, status: IdeaStatus) => {
    try {
      await notebook.patch(i.id, { status })
    } catch {
      showToast('단계를 바꾸지 못했습니다.')
    }
  }
  /** D-231 내 콘텐츠 — 메모 · 촬영일 · 게시일 · 체크 · 올린 주소 */
  const patchIdea = async (i: ContentIdea, fields: Partial<Pick<ContentIdea, 'memo' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'status'>>, what: string) => {
    if (fields.link !== undefined && fields.link && !/^https:\/\/\S{4,}$/.test(fields.link)) return showToast('올린 주소는 https:// 로 시작하는 주소만 적을 수 있습니다.')
    try {
      await notebook.patch(i.id, fields)
      if (what === '메모' || what === '올린 주소') showToast(`${what}${particle(what, '을/를')} 저장했습니다.`)
      // D-232 '이 영상인가요?' [맞아요] — 주소 · 게시 완료 · 게시일을 한 번에 잇는다
      if (what === '올린 영상') showToast(`${q(i.topic, '을/를')} 올린 영상과 이었습니다 — 평소 대비 숫자가 이 줄과 '우리 채널 성과' 에 보여요.`)
    } catch {
      showToast(`${what}${particle(what, '을/를')} 저장하지 못했습니다 — 적은 것은 화면에 그대로 있습니다.`)
    }
  }
  const addCustom = async (topic: string): Promise<boolean> => {
    if (readOnly) return (showToast('팀장 화면을 보는 중에는 저장하지 않습니다.'), false)
    if (notebook.failed) return (showToast('콘텐츠 수첩을 읽지 못했습니다 — 새로고침한 뒤 다시 눌러 주세요.'), false)
    if (notebook.ideas.some((i) => i.topic === topic.trim())) return (showToast(`${q(topic.trim(), '은/는')} 이미 담겨 있습니다.`), false)
    try {
      const saved = await notebook.save(customIdea(topic))
      if (!saved) return false
      showToast(`${q(saved.topic, '을/를')} 제작 예정으로 담았습니다.`)
      return true
    } catch {
      showToast('담지 못했습니다 — 잠시 뒤 다시 눌러 주세요.')
      return false
    }
  }
  const removeIdea = async (i: ContentIdea) => {
    try {
      await notebook.remove(i.id)
      showToast(`${q(i.topic, '을/를')} 수첩에서 뺐습니다.`)
    } catch {
      showToast('빼지 못했습니다.')
    }
  }
  const savePrefs = async (next: RadarPrefs): Promise<boolean> => {
    if (readOnly) return (showToast('팀장 화면을 보는 중에는 바꾸지 않습니다.'), false)
    if (prefsBlocked()) return false
    const ok = await updatePrefs(next)
    if (!ok) showToast('설정을 저장하지 못했습니다.')
    return ok
  }

  const benchChannels = prepared ? prepared.channels.filter((c) => !c.mine).length : 0
  const aiAx = prepared ? prepared.channels.filter((c) => !c.mine && ['ai', 'ax'].includes(groupOf(c, prefs.overrides))).length : 0
  const recent30 = rvideos.filter((v) => !v.mine && v.ageDays <= 30).length

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5" data-testid="yt-page">
      <div className="flex flex-col gap-1">
        {/* D-233 대표 "왼쪽 위 콘텐츠 레이더라는 이름 말고 마케팅 · 브랜딩으로" — 이름은 하나, 어디인지는 아래 목차 탭이 말한다 */}
        <PageHeader
          title="마케팅 · 브랜딩"
          showOnPhone
          descriptionAsHint
          description="잘되는 콘텐츠를 보고 이번 주에 찍을 주제를 고르고(콘텐츠 레이더), 찍고 올린 것의 성과까지 봅니다. 업체 홍보 글 · 홈페이지도 같은 목차에서. 벤치마킹 채널의 최근 영상을 6시간마다 저절로 새로 받아, 여러 채널에서 함께 오르고 채널 평소보다 잘된 주제를 근거와 함께 보여 줍니다(규칙 계산)."
          actions={
            <>
              <Button variant="secondary" onClick={refresh} disabled={loading} data-testid="yt-refresh">
                <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} /> 지금 새로 가져오기
              </Button>
              <Button variant="secondary" onClick={csv} disabled={!prepared} data-testid="yt-csv">
                <Download aria-hidden="true" className="size-4" /> CSV
              </Button>
            </>
          }
        />
        {/* 보조 이름 · 받은 때 · 채널 수는 작은 글 한 줄(D-195 — '이번 주 찍을 것' 보다 먼저 눈을 끌지 않게) */}
        <p className="t-meta flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500">
          <span className="font-semibold text-slate-600" data-testid="radar-subtitle">
            콘텐츠 레이더 · YouTube 벤치마킹
          </span>
          {prepared && <FeedMeta prepared={prepared} fetchedAt={yt.feed?.fetchedAt ?? ''} failed={yt.feed?.failed ?? []} />}
        </p>
      </div>
      {prefsFailed && !readOnly && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="radar-prefs-failed">
          <p className="t-sub min-w-0 flex-1 break-keep text-warning-700">채널 · 추천 설정을 읽지 못했습니다. 저장해 둔 설정은 그대로 있고, 다시 읽기 전에는 바꾸지 않습니다.</p>
          <Button size="sm" variant="secondary" onClick={reloadPrefs} data-testid="radar-prefs-retry">
            <RefreshCw aria-hidden="true" className="size-4" /> 다시 읽기
          </Button>
        </div>
      )}

      {/* D-231 목차는 데이터를 받기 전에도 — 내 콘텐츠 · 홍보 글 · 홈페이지는 유튜브 데이터 없이도 쓴다 */}
      <div role="tablist" data-testid="yt-views">
        <MarketingTabs active={view} onRadar={(k) => setParam({ view: k === 'plan' ? '' : k })} />
      </div>

      {view === 'make' ? (
        <MakeView
          ideas={notebook.ideas}
          readOnly={readOnly}
          failed={notebook.failed}
          mine={mineVideos}
          feedReady={!!prepared}
          sample={yt.sample}
          onStatus={(i, s) => void setStatus(i, s)}
          onPatch={(i, f, what) => void patchIdea(i, f, what)}
          onRemove={(i) => void removeIdea(i)}
          onCopy={(t, what) => copy(t, what)}
          onAdd={addCustom}
        />
      ) : !prepared ? (
        <SetupCard status={yt.status} message={yt.message} onSample={yt.showSample} />
      ) : (
        <PeekProvider value={peekEnv}>
          <FeedNotices sample={yt.sample} message={yt.status === 'ready' || yt.status === 'sample' ? '' : yt.message} extraMessage={extra.status === 'error' ? extra.message : ''} />

          {view === 'plan' && plan && focus && (
            <>
              <PlanView
                plan={plan}
                // 시장 신호는 경제 · 경영 · AI 주제만(D-197) — 분류표 밖 낱말은 '인기' 탭의 기타 급상승에서 본다
                rising={rising.filter((r) => r.fit)}
                breakouts={breakouts}
                focus={focus}
                basis={`최근 30일 영상 ${fmt(recent30)}편 · 벤치마킹 채널 ${benchChannels}곳(AI · AX ${aiAx}곳) — 점수가 아니라 근거로 고릅니다`}
                ideas={notebook.ideas}
                readOnly={readOnly}
                noThumb={yt.sample}
                onConfirm={(o) => void confirmOpp(o)}
                onSave={(o) => void saveOpp(o)}
                onMute={(o) => void muteOpp(o)}
                onUnmute={(k) => void unmute(k)}
                onCopy={(t, what) => copy(t, what)}
                onOpenVideo={openVideo}
                onMix={(mix) => void savePrefs({ ...prefs, mix })}
                onGoChannels={() => setParam({ view: 'channels' })}
                onGoNotebook={goNotebook}
              />
            </>
          )}

          {view === 'top' && (
            <>
              <HotBanner prepared={prepared} onPick={(k) => setParam({ p: '', kw: k })} />
              <Filters prepared={prepared} period={period} type={type} channel={liveChannel} topN={topN} onType={setType} onChannel={setChannel} onTopN={setTopN} />
              <TopView
                prepared={prepared}
                rv={rvById}
                period={period}
                kw={kw}
                topN={topN}
                filter={filter}
                sample={yt.sample}
                onPeriod={(p) => setParam({ p: p === 'week' ? '' : p, kw: '' })}
                onKeyword={(k) => setParam({ kw: k })}
                onOpen={openVideo}
              />
            </>
          )}
          {view === 'channels' && <ChannelManager channels={fullFeed?.channels ?? []} prefs={prefs} readOnly={readOnly} failed={yt.feed?.failed ?? []} onPrefs={savePrefs} notify={showToast} />}
          {view === 'analysis' && <AnalysisView prepared={prepared} rvideos={rvideos} rv={rvById} onCopy={(t) => copy(t)} />}
        </PeekProvider>
      )}

      <VideoDetail v={detail} clusters={plan?.clusters ?? []} onClose={() => setDetail(null)} noThumb={yt.sample} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 받기 전 · 받은 때                                                       */
/* ------------------------------------------------------------------ */

function SetupCard({ status, message, onSample }: { status: string; message: string; onSample: () => void }) {
  if (status === 'loading' || status === 'idle')
    return (
      <p className="t-body flex items-center gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-6 text-slate-600" data-testid="yt-loading">
        <RefreshCw aria-hidden="true" className="size-5 animate-spin text-brand-600" /> 유튜브에서 받아 오는 중… (처음에는 20초쯤 걸립니다)
      </p>
    )
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid="yt-setup" data-status={status}>
      <p className="t-body flex items-start gap-2 break-keep text-slate-800">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-600" />
        <span>{message || '유튜브 데이터를 아직 받지 못했습니다.'}</span>
      </p>
      {status === 'no_key' && (
        <ol className="t-sub flex list-decimal flex-col gap-1 pl-6 break-keep text-slate-600" data-testid="yt-key-steps">
          <li>Google Cloud 콘솔에서 'YouTube Data API v3' 를 켜고 API 키를 만듭니다(예전 대시보드에 쓰던 키도 됩니다).</li>
          <li>Vercel › 이 프로젝트 › Settings › Environment Variables 에 이름 YOUTUBE_API_KEY 로 넣습니다.</li>
          <li>다시 배포(Redeploy)하면 이 화면이 실제 벤치마킹 채널로 바뀝니다.</li>
        </ol>
      )}
      <div>
        <Button variant="primary" onClick={onSample} data-testid="yt-sample">
          <PlayCircle aria-hidden="true" className="size-4" /> 예시로 보기
        </Button>
      </div>
    </section>
  )
}

/** 받은 때 · 채널 · 영상 · 못 받은 채널 — 머리 아래 작은 글 */
function FeedMeta({ prepared, fetchedAt, failed }: { prepared: Prepared; fetchedAt: string; failed: string[] }) {
  const t = Date.parse(fetchedAt)
  const when = Number.isFinite(t) ? new Date(t + 9 * 3_600_000).toISOString().slice(5, 16).replace('-', '월 ').replace('T', '일 ') : ''
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5" data-testid="yt-feedline">
      {when && <span>받은 때 {when}</span>}
      <span>채널 {prepared.channels.length}곳</span>
      <span>영상 {fmt(prepared.videos.length)}편</span>
      {failed.length > 0 && <span className="text-warning-700" data-testid="yt-failed">못 받은 채널 {failed.join(' · ')}</span>}
    </span>
  )
}

/** 예시 데이터 띠 · 받기 문제 안내(있을 때만) */
function FeedNotices({ sample, message, extraMessage }: { sample: boolean; message: string; extraMessage: string }) {
  if (!sample && !message && !extraMessage) return null
  return (
    <div className="flex flex-col gap-2">
      {sample && (
        <p className="t-body rounded-(--radius-control) border border-amber-300 bg-amber-50 px-4 py-3 font-semibold break-keep text-amber-900" data-testid="yt-sample-banner">
          예시 데이터입니다 — 지어낸 채널 · 숫자입니다. 유튜브 키를 넣으면 실제 벤치마킹 채널로 바뀝니다.
        </p>
      )}
      {message && (
        <p className="t-sub rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-800" data-testid="yt-message">
          {message}
        </p>
      )}
      {extraMessage && <p className="t-meta break-keep text-warning-700">{extraMessage}</p>}
    </div>
  )
}

/** 이번 주 주목 주제 TOP 3 — 거르기 없이 7일 안 전체에서. 누르면 그 키워드로 인기 영상 */
function HotBanner({ prepared, onPick }: { prepared: Prepared; onPick: (keyword: string) => void }) {
  // D-197 — '반드시 · 완전히' 같은 흔한 말은 주제가 아니다(같은 계산 · 걸러내기만)
  const topics = useMemo(() => extractTopics(periodVideos(prepared.videos, 'week'), prepared.channelWords, 8).filter((t) => !isNoiseKeyword(t.keyword)).slice(0, 3), [prepared])
  if (topics.length === 0) return null
  return (
    <section className="flex flex-col gap-2" data-testid="yt-hot">
      <HintTip tip={hintFor('이번 주 주목 주제 TOP 3')} label="이번 주 주목 주제 TOP 3">
        <h2 className="t-card flex items-center gap-2 font-bold text-slate-900">
          <IconChip icon={Flame} tone="red" /> 이번 주 주목 주제 TOP 3
        </h2>
      </HintTip>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {topics.map((t, i) => (
          <li key={t.keyword} className="min-w-0">
            <button type="button" onClick={() => onPick(t.keyword)} data-testid="yt-hot-item" className="tap flex w-full min-w-0 items-center gap-2.5 rounded-(--radius-card) border border-red-200 bg-red-50/60 px-3 py-2.5 text-left hover:border-red-400">
              <span className="t-meta flex size-7 shrink-0 items-center justify-center rounded-full bg-red-500 font-bold text-white">{i + 1}</span>
              <span className="flex min-w-0 flex-col">
                <span className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{t.keyword}</span>
                <span className="t-meta text-slate-600">
                  {t.channels}채널 · 최고 {shortNum(t.topViews)}회
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 인기 · 급상승                                                          */
/* ------------------------------------------------------------------ */

/** 거르기 — 필요할 때만 펼친다(D-194: 첫 화면에 필터 · 칩 · 숫자 · 카드가 한꺼번에 다투지 않게) */
function Filters({
  prepared,
  period,
  type,
  channel,
  topN,
  onType,
  onChannel,
  onTopN,
}: {
  prepared: Prepared
  period: YtPeriod
  type: YtType
  channel: string
  topN: number
  onType: (t: YtType) => void
  onChannel: (c: string) => void
  onTopN: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const chName = prepared.channels.find((c) => c.id === channel)?.title
  const summary = [type === 'long' ? '롱폼' : type === 'short' ? '쇼츠' : '전체', chName ?? '전체 채널', `TOP ${topN}`].join(' · ')
  const active = (type !== 'all' ? 1 : 0) + (channel ? 1 : 0)
  return (
    <div className="flex flex-col gap-2">
      <div>
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap t-sub inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-brand-400" data-testid="yt-filter-toggle">
          <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 truncate">거르기 · {summary}</span>
          {active > 0 && <Badge tone="brand">{active}</Badge>}
          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="yt-filters">
          {period !== 'shorts' && (
            <div role="group" aria-label="영상 종류" className="flex rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  ['all', '전체'],
                  ['long', '롱폼'],
                  ['short', '쇼츠'],
                ] as Array<[YtType, string]>
              ).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={type === k} onClick={() => onType(k)} className={seg(type === k)} data-testid={`yt-type-${k}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <label className="flex min-w-0 items-center gap-2">
            <span className="t-sub shrink-0 text-slate-600">채널</span>
            <select value={channel} onChange={(e) => onChannel(e.target.value)} data-testid="yt-channel" className="tap t-sub max-w-[14rem] min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-slate-800">
              <option value="">전체 채널</option>
              {prepared.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.mine ? ' (내 채널)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="t-sub shrink-0 text-slate-600">보기</span>
            <select value={topN} onChange={(e) => onTopN(Number(e.target.value))} data-testid="yt-topn" className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-slate-800">
              {TOP_NS.map((n) => (
                <option key={n} value={n}>
                  TOP {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

function TopView({
  prepared,
  rv,
  period,
  kw,
  topN,
  filter,
  sample,
  onPeriod,
  onKeyword,
  onOpen,
}: {
  prepared: Prepared
  rv: ReadonlyMap<string, RadarVideo>
  period: YtPeriod
  kw: string
  topN: number
  filter: { type: YtType; channels: string[] }
  sample: boolean
  onPeriod: (p: YtPeriod) => void
  onKeyword: (k: string) => void
  onOpen: (v: YtVideo) => void
}) {
  const [allKw, setAllKw] = useState(false)
  const counts = useMemo(() => Object.fromEntries(PERIODS.map((p) => [p, periodVideos(prepared.videos, p, filter).length])) as Record<YtPeriod, number>, [prepared, filter])
  const pool = useMemo(() => periodVideos(prepared.videos, period, filter), [prepared, period, filter])
  // D-197 — 경제 · 경영 · AI 핵심 키워드와 기타 급상승을 나눈다(같은 낱말 계산 · 나누기만)
  const allKeywords = useMemo(() => extractKeywords(pool, prepared.channelWords).filter((k) => !isNoiseKeyword(k.word)), [pool, prepared])
  const keywords = useMemo(() => allKeywords.filter((k) => isCoreKeyword(k.word)), [allKeywords])
  const otherKeywords = useMemo(() => allKeywords.filter((k) => !isCoreKeyword(k.word)).slice(0, 8), [allKeywords])
  const board = useMemo(() => boardOf(pool, topN, kw), [pool, topN, kw])
  const top = board.rows[0]
  const second = board.rows[1]
  const shownKw = allKw ? keywords : keywords.slice(0, 8)
  return (
    <div className="flex flex-col gap-4" data-testid="yt-top">
      <div className="flex flex-wrap gap-2" role="group" aria-label="기간" data-testid="yt-periods">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => onPeriod(p)}
            title={PERIOD_HINT[p]}
            data-testid={`yt-period-${p}`}
            className={`tap t-sub inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-semibold ${period === p ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
          >
            {PERIOD_LABEL[p]} TOP <span className={period === p ? 'text-white/80' : 'text-slate-400'}>{counts[p]}</span>
          </button>
        ))}
      </div>

      {allKeywords.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="yt-keywords">
          <HintTip tip={hintFor('인기 핵심 키워드')} label="인기 핵심 키워드">
            <h2 className="t-card flex items-center gap-2 font-bold text-slate-900">
              <IconChip icon={Hash} tone="sky" /> 인기 핵심 키워드
            </h2>
          </HintTip>
          <p className="t-meta text-slate-500">경제 · 경영 · AI 주제</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!kw} onClick={() => onKeyword('')} className={`tap t-sub rounded-full border px-3 py-1 font-medium ${!kw ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              전체
            </button>
            {shownKw.map((k, i) => (
              <button
                key={k.word}
                type="button"
                aria-pressed={kw === k.word}
                onClick={() => onKeyword(kw === k.word ? '' : k.word)}
                data-testid="yt-keyword"
                className={`tap t-sub rounded-full border px-3 py-1 font-medium break-keep ${kw === k.word ? 'border-brand-600 bg-brand-600 text-white' : i < 3 ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                #{k.word} <span className="opacity-60">{k.videos}</span>
              </button>
            ))}
            {keywords.length > 8 && !allKw && (
              <button type="button" onClick={() => setAllKw(true)} className="tap t-sub rounded-full border border-dashed border-slate-300 px-3 py-1 font-medium text-slate-500" data-testid="yt-keyword-more">
                +{keywords.length - 8} 더 보기
              </button>
            )}
          </div>
          {otherKeywords.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2" data-testid="yt-keywords-other">
              <p className="t-meta text-slate-500">기타 급상승 — 경제 · 경영 · AI 밖(참고)</p>
              <div className="flex flex-wrap gap-1.5">
                {otherKeywords.map((k) => (
                  <button
                    key={k.word}
                    type="button"
                    aria-pressed={kw === k.word}
                    onClick={() => onKeyword(kw === k.word ? '' : k.word)}
                    data-testid="yt-keyword-other"
                    className={`tap t-sub rounded-full border px-3 py-1 font-medium break-keep ${kw === k.word ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                  >
                    #{k.word} <span className="opacity-60">{k.videos}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {board.rows.length === 0 ? (
        <p className="t-body rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 text-slate-500" data-testid="yt-empty">
          {kw ? `${q(kw, '이/가')} 든 영상이 없습니다.` : '이 기간에 올린 영상이 없습니다.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid="yt-summary">
            <MetricTile label="조회수 1위" value={`${shortNum(top.views)}회`} hint={top.channelName} hintOnMobile />
            <MetricTile label="평균 조회수" value={`${shortNum(board.shownAvg)}회`} hint={`영상 ${board.rows.length}편`} hintOnMobile />
            {board.myBestRank > 0 ? (
              <MetricTile label="내 채널 최고 순위" value={`${board.myBestRank}위`} tone="warning" hint={`${shortNum(board.rows[board.myBestRank - 1].views)}회`} hintOnMobile />
            ) : (
              <MetricTile label="조회수 2위" value={second ? `${shortNum(second.views)}회` : '—'} hint={second?.channelName} hintOnMobile />
            )}
          </div>
          <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" data-testid="yt-grid">
            {board.rows.map((v, i) => (
              <VideoCard key={v.id} v={v} r={rv.get(v.id)} rank={i + 1} rising={isRising(v, board.periodAvg)} noThumb={sample} onOpen={onOpen} />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function VideoCard({ v, r, rank, rising, noThumb, onOpen }: { v: YtVideo; r: RadarVideo | undefined; rank: number; rising: boolean; noThumb: boolean; onOpen: (v: YtVideo) => void }) {
  const [broken, setBroken] = useState(false)
  const medal = rank === 1 ? 'bg-amber-400 text-amber-950' : rank === 2 ? 'bg-slate-300 text-slate-900' : rank === 3 ? 'bg-orange-300 text-orange-950' : 'bg-slate-900/80 text-white'
  return (
    <li className={`flex min-w-0 flex-row overflow-hidden rounded-(--radius-card) border bg-white sm:flex-col ${v.mine ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'}`} data-testid="yt-card" data-mine={v.mine ? '1' : '0'} data-rising={rising ? '1' : '0'} data-tier={r?.tier ?? 'unknown'}>
      {/* 휴대폰은 한 줄 목록(썸네일 왼쪽) — PC 카드 여러 칸을 작게 줄이지 않는다(D-194) */}
      <button type="button" onClick={() => onOpen(v)} className="relative block aspect-video w-36 shrink-0 self-start bg-slate-100 sm:w-full" aria-label={`${v.title} — 자세히 보기`} data-testid="yt-card-thumb">
        {noThumb || broken ? (
          <span className="flex size-full items-center justify-center text-slate-300">
            <PlayCircle aria-hidden="true" className="size-10" />
          </span>
        ) : (
          <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-cover" />
        )}
        <span className={`t-meta absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 font-bold ${medal}`}>{rank}위</span>
        <span className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
          {v.mine && (
            <span className="t-meta inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 font-bold text-amber-950">
              <UserRound aria-hidden="true" className="size-3" /> 내 채널
            </span>
          )}
          {rising && (
            <span className="t-meta inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 font-bold text-white" data-testid="yt-rising">
              <Rocket aria-hidden="true" className="size-3" /> 급상승
            </span>
          )}
        </span>
        <span className="t-meta absolute right-1.5 bottom-1.5 rounded bg-slate-900/80 px-1.5 font-semibold text-white">{v.isShort ? '쇼츠' : '롱폼'}</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <p className="t-meta truncate text-slate-500">{v.channelName}</p>
        <button type="button" onClick={() => onOpen(v)} className="t-sub line-clamp-2 text-left font-semibold break-keep text-slate-900 [overflow-wrap:anywhere] hover:text-brand-700 hover:underline">
          {v.title}
        </button>
        {r && r.ratio !== null && <RatioChip v={r} />}
        <p className="t-meta mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-slate-600">
          <span className="inline-flex items-center gap-0.5 font-semibold text-slate-800">
            <Eye aria-hidden="true" className="size-3.5" /> {shortNum(v.views)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <ThumbsUp aria-hidden="true" className="size-3.5" /> {v.likeRate.toFixed(1)}%
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageCircle aria-hidden="true" className="size-3.5" /> {shortNum(v.comments)}
          </span>
        </p>
        <p className="t-meta flex items-center justify-between gap-2 text-slate-400">
          <span>{dateKo(v.publishedAt)}</span>
          <a href={v.url} target="_blank" rel="noopener noreferrer" className="tap -my-3 inline-flex items-center justify-end gap-0.5 font-semibold text-slate-500 hover:text-brand-700" aria-label={`${v.title} — 유튜브에서 보기`}>
            유튜브 <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </p>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 분석                                                                  */
/* ------------------------------------------------------------------ */

function AnalysisView({ prepared, rvideos, rv, onCopy }: { prepared: Prepared; rvideos: RadarVideo[]; rv: ReadonlyMap<string, RadarVideo>; onCopy: (t: string) => void }) {
  const cmp = useMemo(() => compareMine(prepared), [prepared])
  const wd = useMemo(() => byWeekday(prepared.videos), [prepared])
  const hr = useMemo(() => byHour(prepared.videos), [prepared])
  const ln = useMemo(() => byLength(prepared.videos), [prepared])
  const fm = useMemo(() => formatByChannel(prepared.videos), [prepared])
  const cad = useMemo(() => uploadCadence(prepared.videos), [prepared])
  const mine = useMemo(() => myChannelStats(rvideos), [rvideos])
  const pats = useMemo(() => hotPatterns(rvideos), [rvideos])
  const week = useMemo(() => extractTopics(periodVideos(prepared.videos, 'week'), prepared.channelWords), [prepared])
  const month = useMemo(() => extractTopics(periodVideos(prepared.videos, 'month'), prepared.channelWords), [prepared])
  const best = (g: GroupStat | null) => (g ? `1위 ${g.label} · 평균 ${shortNum(g.avg)}회` : undefined)
  return (
    <div className="flex flex-col gap-3" data-testid="yt-analysis">
      <MyChannelCard s={mine} />
      {cmp.length > 0 && (
        <Fold panel id="yt.compare" title="내 채널 vs 벤치마킹 평균" defaultOpen testId="yt-compare">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
            <span className="t-meta text-slate-400" />
            <span className="t-meta text-right font-semibold text-amber-700">내 채널</span>
            <span className="t-meta text-right font-semibold text-slate-500">벤치마킹 평균</span>
            {cmp.map((r) => (
              <Row3 key={r.label} a={r.label} b={r.mine} c={r.bench} />
            ))}
          </div>
        </Fold>
      )}
      <HotPatternsCard stats={pats} />
      <Fold panel id="yt.weekday" title="잘 되는 요일" summary={best(bestOf(wd))} testId="yt-weekday">
        <StatList stats={wd} />
      </Fold>
      <Fold panel id="yt.hour" title="잘 되는 시간대" summary={best(bestOf(hr))} testId="yt-hour">
        {hr.length ? <StatList stats={hr} /> : <p className="t-sub text-slate-500">같은 시간대에 올린 영상이 2편 넘는 곳이 아직 없습니다.</p>}
      </Fold>
      <Fold panel id="yt.length" title="영상 길이별" summary={best(bestOf(ln))} testId="yt-length">
        <StatList stats={ln} />
      </Fold>
      <Fold panel id="yt.format" title="롱폼 vs 쇼츠" testId="yt-format">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
          <span className="t-meta text-slate-400">채널</span>
          <span className="t-meta text-right font-semibold text-slate-500">롱폼 평균(편)</span>
          <span className="t-meta text-right font-semibold text-slate-500">쇼츠 평균(편)</span>
          {fm.map((r) => (
            <Row3 key={r.channel} a={r.channel} b={`${shortNum(r.longAvg)} (${r.longCount})`} c={`${shortNum(r.shortAvg)} (${r.shortCount})`} />
          ))}
        </div>
      </Fold>
      <Fold panel id="yt.cadence" title="채널별 업로드 주기" testId="yt-cadence">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
          <span className="t-meta text-slate-400">채널</span>
          <span className="t-meta text-right font-semibold text-slate-500">평균 간격</span>
          <span className="t-meta text-right font-semibold text-slate-500">7일 · 30일</span>
          {cad.map((r) => (
            <Row3 key={r.channel} a={r.channel} b={r.avgDays === null ? '데이터 부족' : `${r.avgDays.toFixed(1)}일`} c={`${r.recent7} · ${r.recent30}편`} />
          ))}
        </div>
      </Fold>
      <Fold panel id="yt.ideas" title="단어로 본 주목 주제" summary={week[0] ? `이번 주 1위 ${week[0].keyword}` : undefined} count={week.length + month.length} testId="yt-ideas">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="t-sub font-bold text-slate-900">이번 주</p>
            <TopicGrid topics={week} rv={rv} basis="이번 주" onCopy={onCopy} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="t-sub font-bold text-slate-900">이번 달</p>
            <TopicGrid topics={month} rv={rv} basis="이번 달" onCopy={onCopy} />
          </div>
        </div>
      </Fold>
    </div>
  )
}

function TopicGrid({ topics, rv, basis, onCopy }: { topics: Topic[]; rv: ReadonlyMap<string, RadarVideo>; basis: string; onCopy: (t: string) => void }) {
  if (topics.length === 0) return <p className="t-sub rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-4 text-slate-500">이 기간에 2개 이상 채널이 같이 다룬 주제가 없습니다.</p>
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {topics.map((t, i) => (
        <li key={t.keyword} className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3.5 sm:p-4" data-testid="yt-topic">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{i + 1}위 주목 주제</Badge>
            <span className="t-card font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{t.keyword}</span>
          </div>
          <p className="t-sub text-slate-600">
            <Peek videos={t.hits.map((v) => rv.get(v.id)).filter((v): v is RadarVideo => v !== undefined)} title={t.keyword} basis={`${basis} 제목에 나온 영상`} kind="topic">
              {t.channels}개 채널 · 최고 {fmt(t.topViews)}회 · 평균 {fmt(t.avgViews)}회
            </Peek>
          </p>
          <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">
            대표 영상{' '}
            <a href={t.top.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
              {t.top.title}
            </a>{' '}
            <span className="text-slate-400">({t.top.channelName})</span>
          </p>
          <ul className="flex flex-col gap-1.5 border-t border-slate-100 pt-2" aria-label="제목 아이디어">
            {t.ideas.map((idea) => (
              <li key={idea} className="flex min-w-0 items-center gap-2" data-testid="yt-idea">
                <span className="t-sub min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">{idea}</span>
                <Button size="sm" variant="ghost" onClick={() => onCopy(idea)} aria-label={`제목 복사 — ${idea}`} data-testid="yt-idea-copy">
                  <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
                </Button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function Row3({ a, b, c }: { a: ReactNode; b: ReactNode; c: ReactNode }) {
  return (
    <>
      <span className="t-sub min-w-0 break-keep text-slate-800 [overflow-wrap:anywhere]">{a}</span>
      <span className="t-sub text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{b}</span>
      <span className="t-sub text-right whitespace-nowrap text-slate-600 tabular-nums">{c}</span>
    </>
  )
}

function StatList({ stats }: { stats: GroupStat[] }) {
  const top = bestOf(stats)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
      <span className="t-meta text-slate-400" />
      <span className="t-meta text-right font-semibold text-slate-500">평균 조회수</span>
      <span className="t-meta text-right font-semibold text-slate-500">영상 · 최고</span>
      {stats.map((g) => (
        <Row3 key={g.label} a={<>{top && g.label === top.label && stats.length > 1 ? <span className="mr-1 font-bold text-red-600">1위</span> : null}{g.label}</>} b={`${fmt(g.avg)}회`} c={`${g.count}편 · ${shortNum(g.max)}`} />
      ))}
    </div>
  )
}
