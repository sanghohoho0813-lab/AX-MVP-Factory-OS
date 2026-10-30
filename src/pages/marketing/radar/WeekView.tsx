/**
 * D-346 1주일치 한 번에 — 이번 주 키워드 1~3위로 유튜브 롱폼 1 · 릴스/쇼츠 3 · 스레드 7(+예비 2).
 * 대표: "버튼 하나만 누르면 1주일치 … 한 번에 쫙 — 트렌드 잇는 주제 벤치마킹해서, 기존 마케팅 공식들 잘 적용해서 100점짜리".
 *
 *  - 규칙 초안(AI 아님)을 바로 보여 주고, [AI로 1주일치 다 쓰기](두 번 눌러 확인)를 누르면 여섯 갈래가 동시에 — 답이 온 것부터 바뀐다.
 *  - D-356 프로젝트 머리(기간 · 만든 날 · 짝 셋 · AI 진행) 한 장 + 탭 넷(유튜브 롱폼 · 릴스 · 쇼츠 · 스레드 · 올릴 날) — 한 번에 하나만. 글마다 공식 점검(점검 통과 / 고칠 곳).
 *  - 결과는 이 브라우저(사람별 금고)에 주마다 — 다시 열어도 다시 부르지 않는다. 팀장 화면을 보는 중이면 AI 를 부르지 않는다.
 *  - D-349 AI 가 쓴 글은 클라우드에도 남고 내 콘텐츠 · 릴스 · 틱톡 · 스레드 목록에 저절로 모인다(고친 글 · 올린 글은 그대로) — 어디에 모였는지 한 줄로.
 *  - D-350 쓰는 중 [멈추기] — 누르지 않으면 다른 화면으로 가도 계속 쓴다(어느 화면에서나 아래에 진행 표시). 내 콘텐츠의 '1주일치 프로젝트' 에서 지난 주도 이 화면으로 연다.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowLeft, AtSign, BookmarkPlus, CalendarDays, ClipboardCopy, Download, Film, FolderCheck, FolderOpen, Loader2, MonitorPlay, RotateCcw, Sparkles, Square } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Fold, HintTip } from '../../../components/ui/fold'
import { ModelPicker } from '../../../components/ai/ModelPicker'
import { AiConfirm } from '../../../components/ai/AiConfirm'
import { todayLocalDate } from '../../../lib/appClock'
import type { ChannelBrief } from '../../../services/marketing/radarStore'
import { makePack, withAi, type ContentPack } from '../../../services/marketing/contentPack'
import { templateOf } from '../../../services/marketing/threads'
import { PLATFORMS } from '../../../services/marketing/shorts'
import { LONG_DAY, WEEK_PARTS, buildWeek, dayLabel, weekCalendar, weekLintSummary, weekRequests, weekStart, weekText, type LintSum, type WeekSetup, type WeekShort, type WeekThread } from '../../../services/marketing/weekPlan'
import { markWeekSeen, startWeekAi, stopWeekAi, subscribeWeek, weekRun, weekSaved, weekSync, weekVersion, type WeekPartState } from '../../../services/marketing/weekRun'
import { weekItemId } from '../../../services/marketing/weekCollect'
import { listThreadPosts } from '../../../services/marketing/threads'
import { listShortPosts } from '../../../services/marketing/shorts'

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const NUM = ['①', '②', '③']
type WeekTab = 'long' | 'shorts' | 'threads' | 'plan'
const WEEK_TABS: readonly WeekTab[] = ['long', 'shorts', 'threads', 'plan']
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  // 문서에 붙여 눌러야 모든 브라우저가 내려받기로 받는다 · 파일 이름은 영문(한글 이름을 'download' 로 바꾸는 브라우저가 있다)
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function WeekView({
  setup,
  brief,
  ws,
  start: startProp,
  backLabel = '이번 주 키워드',
  readOnly,
  ownerAi,
  savedLongHref,
  onBack,
  onCopy,
  onSaveLong,
}: {
  /** D-348 짝 셋 — 본업(고정 키워드) × 미끼(이번 주 AI 흐름) */
  setup: WeekSetup
  brief: ChannelBrief
  /** D-349 작업공간 — 주면 AI 결과를 클라우드 · 목록으로 모은다(팀장 화면 보기면 주지 않는다) */
  ws?: string | null
  /** D-350 보여 줄 주(월요일) — 없으면 이번에 만들 주. 내 콘텐츠의 지난 주 묶음은 그 주 */
  start?: string
  /** D-350 뒤로 단추 글 — 내 콘텐츠에서 열었으면 '내 콘텐츠' */
  backLabel?: string
  readOnly: boolean
  ownerAi: boolean
  /** 롱폼 주제가 이미 내 콘텐츠에 있으면 그 줄 주소 */
  savedLongHref: string | null
  onBack: () => void
  onCopy: (text: string, what: string) => void
  onSaveLong: (pack: ContentPack) => Promise<string | null>
}) {
  const today = todayLocalDate()
  const current = weekStart(today)
  const start = startProp || current
  /** 지난 주(또는 다른 주) 묶음 — 보기 · 복사만, 다시 쓰기는 이번에 만들 주만 */
  const past = start !== current
  const version = useSyncExternalStore(subscribeWeek, weekVersion)
  const run = useMemo(() => weekRun(start), [start, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const saved = useMemo(() => weekSaved(start), [start, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const sync = useMemo(() => weekSync(start), [start, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => buildWeek(setup, brief, today, saved), [setup, brief, today, saved])
  const labels = setup.pairs.map((p) => p.label)
  const lint = useMemo(() => weekLintSummary(week), [week])
  const cal = useMemo(() => weekCalendar(week), [week])
  const running = Object.values(run.parts).includes('running')
  const stopped = Object.values(run.parts).includes('stopped')
  const canAi = ownerAi && !readOnly && setup.pairs.length > 0 && !past
  const changed = !past && !!saved && saved.topics.join('|') !== labels.join('|')
  // 이 화면을 보고 있으면 '다 썼어요' 알림은 본 것으로
  useEffect(() => {
    if (run.finishedAt && !run.seen) markWeekSeen(start)
  }, [run.finishedAt, run.seen, start])
  const [savedHref, setSavedHref] = useState<string | null>(savedLongHref)
  // D-359 프로젝트 안에서 '올렸나' 까지 — 모은 글(스레드 · 릴스 기록표)의 상태를 읽는다(쓰기는 그 화면에서)
  const [posts, setPosts] = useState<ReadonlyMap<string, { status: 'draft' | 'posted'; postedOn: string }>>(() => new Map())
  useEffect(() => {
    if (ws === undefined) return
    let alive = true
    void Promise.all([listThreadPosts(ws).catch(() => []), listShortPosts(ws).catch(() => [])]).then(([t, sh]) => {
      if (!alive) return
      setPosts(new Map([...t, ...sh].filter((p) => p.id.startsWith(weekItemId(ws, start, ''))).map((p) => [p.id, { status: p.status, postedOn: p.postedOn }])))
    })
    return () => {
      alive = false
    }
  }, [ws, start, sync.state])
  const [saving, setSaving] = useState(false)

  const runAi = () => {
    if (canAi) startWeekAi(start, labels, weekRequests(setup, brief, today), { ws })
  }
  const saveLong = async () => {
    const first = setup.pairs[0]?.source
    if (!first) return
    setSaving(true)
    try {
      const href = await onSaveLong(withAi(makePack(first, brief), saved?.long ?? {}))
      if (href) setSavedHref(href)
    } finally {
      setSaving(false)
    }
  }
  const text = () => weekText(week)
  const shortsMain = week.shorts.filter((s) => s.slot.n > 0)
  const shortsSpare = week.shorts.filter((s) => s.slot.n === 0)
  const threadsMain = week.threads.filter((x) => x.slot.day > 0)
  const threadsSpare = week.threads.filter((x) => x.slot.day === 0)
  const collect = !readOnly && ws !== undefined
  const got = { long: week.long.ai ? 1 : 0, shorts: shortsMain.filter((s) => s.ai).length, threads: threadsMain.filter((x) => x.ai).length }
  const gotAny = got.long + got.shorts + got.threads > 0
  /** 모은 글이면 그 글 주소 · 상태(스레드 · 릴스 화면에서 고치고 [올렸어요]) */
  const linkOf = (kind: 't' | 's', n: number) => {
    if (!collect) return undefined
    const id = weekItemId(ws ?? null, start, `${kind}${n}`)
    const p = posts.get(id)
    if (!p) return undefined
    return { href: `/marketing/${kind === 't' ? 'threads' : 'shorts'}?open=${encodeURIComponent(id)}`, posted: p.status === 'posted', postedOn: p.postedOn }
  }
  const postedN = [...posts.values()].filter((p) => p.status === 'posted').length
  // D-356 탭은 주소에(?wt=) — 뒤로 가기 · 새로 고침에도 보던 탭 그대로
  const [params, setParams] = useSearchParams()
  const tab: WeekTab = WEEK_TABS.includes(params.get('wt') as WeekTab) ? (params.get('wt') as WeekTab) : 'long'
  const pickTab = (t: WeekTab) => {
    const next = new URLSearchParams(params)
    if (t === 'long') next.delete('wt')
    else next.set('wt', t)
    setParams(next, { replace: true })
  }
  /** 올릴 날 달력에서 누르면 그 탭으로 가서 그 글로 */
  const goTo = (kind: 'long' | 'short' | 'thread', anchor: string) => {
    pickTab(kind === 'long' ? 'long' : kind === 'short' ? 'shorts' : 'threads')
    window.setTimeout(() => scrollTo(anchor), 60)
  }

  if (past && !saved)
    return (
      <div className="flex flex-col gap-3" data-testid="mk-week" data-start={start}>
        <div>
          <button type="button" onClick={onBack} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-2 font-semibold text-slate-700 hover:bg-slate-100" data-testid="mk-week-back">
            <ArrowLeft aria-hidden="true" className="size-4" /> {backLabel}
          </button>
        </div>
        <p className="t-body rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 break-keep text-slate-600" data-testid="mk-week-missing">
          {dayLabel(start, 1)} 주에 만든 1주일치를 찾지 못했어요 — 다른 기기에서 만들었다면 그 기기에서 마케팅 화면을 한 번 열면 여기로 올라와요.
        </p>
      </div>
    )

  /** 탭마다 AI 진행 — 그 탭의 갈래가 쓰는 중이면 돌고, 다 쓰면 ✓ */
  const tabState = (parts: readonly string[]): WeekPartState => {
    const xs = parts.map((p) => run.parts[p as keyof typeof run.parts])
    if (xs.includes('running')) return 'running'
    if (xs.includes('error')) return 'error'
    if (xs.length && xs.every((x) => x === 'done')) return 'done'
    if (xs.includes('stopped')) return 'stopped'
    return 'idle'
  }
  const TABS: { key: WeekTab; label: string; count: string; icon: typeof MonitorPlay; tone: string; state: WeekPartState | null; ai: boolean }[] = [
    { key: 'long', label: '유튜브 롱폼', count: '1', icon: MonitorPlay, tone: 'text-red-600', state: tabState(['long']), ai: week.long.ai },
    { key: 'shorts', label: '릴스 · 쇼츠', count: `${shortsMain.length}`, icon: Film, tone: 'text-fuchsia-700', state: tabState(['shortA', 'shortB']), ai: shortsMain.some((x) => x.ai) },
    { key: 'threads', label: '스레드', count: `${threadsMain.length}${threadsSpare.length ? `+${threadsSpare.length}` : ''}`, icon: AtSign, tone: 'text-slate-800', state: tabState(['th0', 'th1', 'th2']), ai: threadsMain.some((x) => x.ai) },
    { key: 'plan', label: '올릴 날', count: '7일', icon: CalendarDays, tone: 'text-violet-700', state: null, ai: false },
  ]
  const madeLine = `${saved ? `${when(saved.at) ? `${when(saved.at)} 만듦 · ` : ''}AI 로 씀${saved.model ? `(${saved.model})` : ''}` : running ? 'AI 가 쓰는 중' : '규칙 초안 — 아직 AI 로 안 씀'}${posts.size ? ` · 올린 글 ${postedN}/${posts.size}` : ''}`

  return (
    <div className="flex flex-col gap-4" data-testid="mk-week" data-start={start} data-tab={tab}>
      <div>
        <button type="button" onClick={onBack} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-2 font-semibold text-slate-700 hover:bg-slate-100" data-testid="mk-week-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> {backLabel}
        </button>
      </div>

      {/* D-356 대표 "1주일치 쓰면 밑으로 쫙 풀려 눈에 안 들어온다 — 프로젝트 박스 하나, 들어가면 롱폼 · 릴스 · 스레드 딱딱 나눠서".
          프로젝트 머리(기간 · 만든 날 · 짝 셋 · AI 진행) 한 장 + 아래 탭 넷(한 번에 하나만) */}
      <section className="relative z-10 flex flex-col overflow-visible rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="mk-week-project">
        <header className="relative rounded-t-[calc(var(--radius-panel)-2px)] bg-gradient-to-br from-violet-700 via-violet-700 to-fuchsia-700 px-4 py-3 text-white sm:px-5">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[calc(var(--radius-panel)-2px)]">
            <span className="absolute -top-14 -right-10 size-40 rounded-full bg-white/10" />
          </span>
          <div className="relative flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <FolderOpen aria-hidden="true" className="size-5 shrink-0" />
              <h2 className="t-card font-extrabold break-keep text-white">
                1주일치 프로젝트 · {dayLabel(start, 1)} ~ {dayLabel(start, 7)}
              </h2>
              <HintTip tip="본업(고정 키워드 — 이번 주 새 공고가 많은 순, 같으면 주마다 돌아가며) × 미끼(벤치마킹 채널에서 최근 2주 함께 뜨는 AI · 경영 주제)로 짝 셋을 만들어요. AI 이야기로 시작해 중소기업 대표가 바로 써먹을 본업 정보로 끝나요. 롱폼 · 쇼츠 · 스레드 모두 검증된 방법(공식) 그대로예요." label="AI 는 미끼, 끝은 본업" onDark>
                <span className="t-meta rounded-full bg-white/15 px-2 py-0.5 font-semibold text-white ring-1 ring-white/25">AI 는 미끼, 끝은 본업</span>
              </HintTip>
            </div>
            <p className="t-meta font-semibold text-white/90" data-testid="mk-week-made">
              {madeLine}
            </p>
            <ol className="flex flex-col gap-0.5" data-testid="mk-week-topics">
              {week.topics.map((t, i) => (
                <li key={`${t}-${i}`} className="t-sub flex min-w-0 items-baseline gap-2 break-keep text-white">
                  <span className="t-meta shrink-0 rounded-full bg-white px-1.5 font-bold text-violet-800">짝 {i + 1}</span>
                  <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{t}</span>
                </li>
              ))}
            </ol>
            {setup.trend.length > 0 && (
              <p className="t-meta break-keep text-white/80" data-testid="mk-week-trend">
                이번 주 AI 흐름(미끼 후보): {setup.trend.slice(0, 6).join(' · ')}
              </p>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-2 p-3 sm:p-4">
          {/* AI — 여섯 갈래 */}
          {canAi ? (
            <div className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 ${run.errors.length ? 'border-amber-300 bg-amber-50' : 'border-violet-200 bg-violet-50'}`} data-testid="mk-week-ai" data-state={running ? 'running' : run.errors.length ? 'error' : stopped ? 'stopped' : saved ? 'done' : 'idle'}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Sparkles aria-hidden="true" className="size-5 shrink-0 text-violet-700" />
                <p className="t-sub min-w-0 flex-1 basis-56 break-keep font-semibold text-violet-950">
                  {running
                    ? '여섯 갈래를 동시에 쓰는 중이에요(20~60초) — 답이 온 것부터 바뀌어요. 다른 화면으로 가도 계속 써요(멈추려면 [멈추기]).'
                    : stopped
                      ? `멈췄어요 — 다 쓴 갈래는 남겨 두고 목록에도 모았어요. 나머지는 규칙 초안이에요. [AI로 다시 쓰기] 로 처음부터 다시 쓸 수 있어요.`
                      : saved
                        ? `AI 가 쓴 1주일치예요${saved.model ? ` · ${saved.model}` : ''}${when(saved.at) ? ` · ${when(saved.at)}` : ''}`
                        : '모델을 고르고 [AI로 1주일치 다 쓰기] 를 누르면 롱폼 · 쇼츠 · 스레드를 검증된 방법대로 한 번에 써요. 누르기 전에는 부르지 않아요.'}
                </p>
                <div className="flex flex-wrap items-start gap-2">
                  {running ? (
                    <Button size="sm" variant="secondary" onClick={() => stopWeekAi(start)} data-testid="mk-week-stop">
                      <Square aria-hidden="true" className="size-4" /> 멈추기
                    </Button>
                  ) : (
                    <>
                      <ModelPicker />
                      <AiConfirm>
                        <Button size="sm" variant={saved ? 'secondary' : 'primary'} onClick={runAi} data-testid="mk-week-run">
                          {saved ? <RotateCcw aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
                          {saved ? 'AI로 다시 쓰기' : 'AI로 1주일치 다 쓰기'}
                        </Button>
                      </AiConfirm>
                    </>
                  )}
                </div>
              </div>
              {Object.values(run.parts).some((st) => st !== 'idle') && (
                <ul className="flex flex-wrap gap-1.5" data-testid="mk-week-parts">
                  {WEEK_PARTS.map((p) => (
                    <li key={p.part} className={`t-meta inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${partTone(run.parts[p.part])}`} data-testid="mk-week-part" data-part={p.part} data-state={run.parts[p.part]}>
                      {partIcon(run.parts[p.part])} {p.label}
                    </li>
                  ))}
                </ul>
              )}
              {changed && !running && (
                <p className="t-meta break-keep text-violet-900" data-testid="mk-week-changed">
                  지금 짝(본업 × 이번 주 AI 흐름)이 이 1주일치를 만들 때와 달라요 — [AI로 다시 쓰기] 를 누르면 지금 짝으로 다시 써요.
                </p>
              )}
              {run.errors.length > 0 && (
                <p role="alert" className="t-sub break-keep text-amber-900" data-testid="mk-week-error">
                  일부를 AI 로 쓰지 못했어요 — {run.errors.join(' · ')} 그 글은 규칙 초안 그대로예요. [AI로 다시 쓰기] 로 한 번 더.
                </p>
              )}
              {run.storeFull && <p className="t-meta break-keep text-amber-900">이 브라우저 저장 공간이 가득 차 결과를 남기지 못했어요 — [전체 복사] · [텍스트 파일로] 로 가져가세요.</p>}
            </div>
          ) : (
            <p className="t-sub break-keep rounded-xl bg-slate-50 px-3 py-2 text-slate-600" data-testid="mk-week-ai-off">
              {readOnly
                ? '팀장 화면을 보는 중이라 규칙 초안만 보여 드려요(AI 를 부르지 않아요).'
                : past
                  ? `${dayLabel(start, 1)} 주에 만든 1주일치예요${saved?.model ? ` · ${saved.model}` : ''}${saved && when(saved.at) ? ` · ${when(saved.at)}` : ''} — 다시 쓰기는 이번에 만들 주만 돼요.`
                  : 'AI 로 다 쓰기는 대표 계정에서만 돼요 — 아래는 규칙으로 만든 초안이에요.'}
            </p>
          )}

          {/* D-349 어디에 모였나 */}
          {collect && gotAny && (
            <div
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${sync.state === 'error' ? 'border-amber-300 bg-amber-50' : 'border-success-200 bg-success-50'}`}
              data-testid="mk-week-collect"
              data-state={sync.state}
              data-kept={sync.kept}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {sync.state === 'saving' ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-success-700" /> : <FolderCheck aria-hidden="true" className={`size-4 shrink-0 ${sync.state === 'error' ? 'text-amber-700' : 'text-success-700'}`} />}
                <p className={`t-sub min-w-0 break-keep font-semibold ${sync.state === 'error' ? 'text-amber-900' : 'text-success-800'}`}>
                  {sync.state === 'saving'
                    ? '목록으로 모으는 중이에요…'
                    : sync.state === 'error'
                      ? '목록으로 모으지 못했어요(인터넷 · 로그인 확인) — 이 화면을 다시 열면 한 번 더 모아요.'
                      : 'AI 가 쓴 글을 모아 뒀어요 — 내 콘텐츠 › 1주일치 프로젝트에서 언제든 다시 열고, 다른 기기에서도 보여요'}
                </p>
              </div>
              {sync.state !== 'error' && (
                <p className="t-sub flex flex-wrap gap-x-3 gap-y-1">
                  {got.long > 0 && (
                    <Link to={`/marketing?view=make&idea=${encodeURIComponent(weekItemId(ws ?? null, start, 'l'))}`} className="font-semibold text-violet-800 underline underline-offset-2" data-testid="mk-week-collect-long">
                      내 콘텐츠 · 롱폼 1
                    </Link>
                  )}
                  {got.shorts > 0 && (
                    <Link to="/marketing/shorts?tab=records" className="font-semibold text-violet-800 underline underline-offset-2" data-testid="mk-week-collect-shorts">
                      릴스 · 틱톡 {got.shorts}
                    </Link>
                  )}
                  {got.threads > 0 && (
                    <Link to="/marketing/threads?tab=records" className="font-semibold text-violet-800 underline underline-offset-2" data-testid="mk-week-collect-threads">
                      스레드 {got.threads}
                    </Link>
                  )}
                </p>
              )}
              {sync.kept > 0 && <p className="t-meta break-keep text-slate-700">직접 고친 글 {sync.kept}개는 덮지 않고 그대로 뒀어요(올린 글도 그대로).</p>}
            </div>
          )}
        </div>
      </section>

      {/* 형식별 탭 — 한 번에 하나만(예전엔 달력 · 롱폼 · 쇼츠 3 · 스레드 9 가 한 화면에 줄줄이) */}
      <div role="tablist" aria-label="1주일치 — 무엇을 볼까요" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" data-testid="mk-week-tabs">
        {TABS.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pickTab(t.key)}
              className={`tap flex min-h-14 min-w-0 items-center gap-2 rounded-(--radius-control) border px-3 py-2 text-left ${on ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-brand-200'}`}
              data-testid="mk-week-tab"
              data-tab={t.key}
              data-state={t.state ?? ''}
            >
              <t.icon aria-hidden="true" className={`size-5 shrink-0 ${on ? 'text-white' : t.tone}`} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="t-sub truncate font-bold">{t.label}</span>
                <span className={`t-meta truncate ${on ? 'text-white/85' : 'text-slate-500'}`}>
                  {t.count}
                  {t.state === 'running' ? ' · 쓰는 중' : t.state === 'error' ? ' · 일부 초안' : t.ai ? ' · AI' : t.key === 'plan' ? '' : ' · 초안'}
                </span>
              </span>
              {t.state === 'running' && <Loader2 aria-hidden="true" className={`ml-auto size-4 shrink-0 animate-spin ${on ? 'text-white' : 'text-violet-600'}`} />}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="flex min-w-0 flex-col gap-3" data-testid="mk-week-panel" data-tab={tab}>
        {tab === 'long' && (
          <section id="mk-week-long" className="scroll-mt-32" data-testid="mk-week-long" data-ai={week.long.ai ? '1' : '0'}>
            <Card
              icon={<MonitorPlay aria-hidden="true" className="size-5 text-red-600" />}
              title={`유튜브 롱폼 · ${dayLabel(start, LONG_DAY)}`}
              sub={`짝 1 · ${week.long.topic}`}
              ai={week.long.ai}
              lint={week.long.lint}
              onCopy={() => onCopy([`제목: ${week.long.headline}`, ...[...week.long.titles, ...week.long.script].map((b) => `[${b.label}]\n${b.text}`)].join('\n\n'), '롱폼')}
            >
              <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="mk-week-long-title">
                {week.long.headline}
              </p>
              {week.long.titles.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg bg-violet-50/60 px-3 py-2">
                  {week.long.titles.map((b, i) => (
                    <Block key={`t-${i}`} label={b.label} text={b.text} />
                  ))}
                </div>
              )}
              <Fold id="mk-week-long-script" title={`대본 ${week.long.script.length}구간`} summary="그대로 읽는 말 + 화면에 띄울 것 — 누르면 펼쳐져요">
                <div className="flex flex-col gap-3">
                  {week.long.script.map((b, i) => (
                    <Block key={`s-${i}`} label={b.label} text={b.text} />
                  ))}
                </div>
              </Fold>
            </Card>
          </section>
        )}

        {tab === 'shorts' && (
          <section className="flex flex-col gap-2" aria-label="릴스 · 쇼츠 3편">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {shortsMain.map((x) => (
                <ShortCard key={x.slot.n} s={x} start={start} onCopy={onCopy} link={linkOf('s', x.slot.n)} />
              ))}
            </div>
            {shortsSpare.length > 0 && (
              <Fold id="mk-week-short-spare" title="다른 버전 1편" summary="③이 마음에 안 들면 이걸로">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {shortsSpare.map((x) => (
                    <ShortCard key="spare" s={x} start={start} onCopy={onCopy} />
                  ))}
                </div>
              </Fold>
            )}
          </section>
        )}

        {tab === 'threads' && (
          <section className="flex flex-col gap-2" aria-label="스레드 7개">
            <p className="t-sub break-keep text-slate-600">요일마다 목적 · 틀이 달라요 — 하루 하나씩 올려요.</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {threadsMain.map((x) => (
                <ThreadCard key={x.slot.day} x={x} start={start} onCopy={onCopy} link={linkOf('t', x.slot.day)} />
              ))}
            </div>
            {threadsSpare.length > 0 && (
              <Fold id="mk-week-thread-spare" title="예비 글 2개" summary="반응이 약한 날 바꿔 올리기">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {threadsSpare.map((x, i) => (
                    <ThreadCard key={`spare-${i}`} x={x} start={start} onCopy={onCopy} />
                  ))}
                </div>
              </Fold>
            )}
          </section>
        )}

        {tab === 'plan' && (
          <section aria-labelledby="mk-week-cal-title" className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4">
            <h3 id="mk-week-cal-title" className="t-card flex items-center gap-2 font-bold text-slate-900">
              <CalendarDays aria-hidden="true" className="size-5 text-violet-700" /> 언제 무엇을 올리나
              <span className="t-meta font-normal text-slate-500">추천 일정 — 누르면 그 글로</span>
            </h3>
            <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-7" data-testid="mk-week-calendar">
              {cal.map((d) => (
                // 휴대폰은 하루 한 줄(날짜 옆에 올릴 것) — PC 는 일곱 칸
                <li key={d.day} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 lg:flex-col lg:flex-nowrap lg:items-start lg:py-2" data-testid="mk-week-day" data-day={d.day}>
                  <span className="t-sub w-16 shrink-0 font-bold text-slate-900 lg:w-auto">{d.label}</span>
                  <span className="flex flex-wrap gap-1">
                    {d.items.map((it) => (
                      <button key={it.anchor} type="button" onClick={() => goTo(it.kind, it.anchor)} className={`tap t-meta inline-flex min-h-8 items-center rounded-full px-2 font-semibold break-keep ${it.kind === 'long' ? 'bg-red-100 text-red-700' : it.kind === 'short' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-slate-200 text-slate-800'}`}>
                        {it.text}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* 도구 · 점검 요약 — 탭 아래 한 줄 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        <Button size="sm" variant="secondary" onClick={() => onCopy(text(), '1주일치 전체')} data-testid="mk-week-copy-all">
          <ClipboardCopy aria-hidden="true" className="size-4" /> 전체 복사
        </Button>
        <Button size="sm" variant="secondary" onClick={() => download(`week-content-${start}.txt`, text())} data-testid="mk-week-download">
          <Download aria-hidden="true" className="size-4" /> 텍스트 파일로
        </Button>
        {!readOnly &&
          !(collect && week.long.ai) &&
          (savedHref ? (
            <Link to={savedHref} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-2 font-semibold text-violet-800 underline underline-offset-2" data-testid="mk-week-long-saved">
              롱폼 — 내 콘텐츠에서 보기
            </Link>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void saveLong()} disabled={saving} data-testid="mk-week-save-long">
              <BookmarkPlus aria-hidden="true" className="size-4" /> 롱폼을 내 콘텐츠에 담기
            </Button>
          ))}
        <p className={`t-sub min-w-0 flex-1 basis-60 break-keep font-semibold ${lint.bad ? 'text-danger-700' : 'text-success-700'}`} data-testid="mk-week-lint" data-bad={lint.bad}>
          점검: 이번 주 글 {lint.total}개 중 통과 {lint.pass}
          {lint.bad ? ` · 고칠 곳 ${lint.bad}` : ''}
          {lint.warn ? ` · 볼 것 ${lint.warn}` : ''}
        </p>
      </div>

      <p className="t-meta break-keep text-slate-500">
        [대괄호] · [공식 자료 확인] 빈칸은 공고 · 보도자료 · 실제 상담 기록으로 채워요 — 금액 · 날짜는 지어내지 않아요. 올리기 전 스레드 · 릴스 화면에서 한 번 더 점검할 수 있어요.
      </p>
    </div>
  )
}

const partTone = (s: WeekPartState) => (s === 'error' ? 'bg-amber-100 text-amber-900' : s === 'done' ? 'bg-violet-100 text-violet-800' : s === 'stopped' ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-600')
const partIcon = (s: WeekPartState) => (s === 'running' ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : s === 'done' ? '✓' : s === 'error' ? '!' : s === 'stopped' ? '■' : '·')

type PostLink = { href: string; posted: boolean; postedOn: string } | undefined

/** D-359 모은 글이면 카드 아래 — 올렸는지 · 그 화면에서 고치고 [올렸어요] */
function PostRow({ link, what }: { link: PostLink; what: string }) {
  if (!link) return null
  return (
    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2" data-testid="mk-week-post" data-posted={link.posted ? '1' : '0'}>
      <span className={`t-meta rounded-full px-2 py-0.5 font-bold ${link.posted ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-800'}`}>
        {link.posted ? `올림${link.postedOn ? ` ${Number(link.postedOn.slice(5, 7))}/${Number(link.postedOn.slice(8, 10))}` : ''}` : '아직 안 올림'}
      </span>
      <Link to={link.href} className="tap t-sub ml-auto inline-flex items-center font-semibold text-violet-800 hover:underline" data-testid="mk-week-post-open">
        {link.posted ? `${what} 화면에서 숫자 적기 →` : `${what} 화면에서 고치기 · 올렸어요 →`}
      </Link>
    </div>
  )
}

function Card({ icon, title, sub, ai, lint, onCopy, children }: { icon: ReactNode; title: string; sub: string; ai: boolean; lint: LintSum; onCopy: () => void; children: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-2.5 rounded-(--radius-card) border border-slate-200 bg-white p-3 shadow-(--shadow-card) sm:p-4">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
          <span className="t-card font-bold break-keep text-slate-900">{title}</span>
          <span className="t-meta break-keep text-slate-500 [overflow-wrap:anywhere]">{sub}</span>
        </span>
        <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${ai ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'}`}>{ai ? 'AI' : '초안'}</span>
        <button type="button" onClick={onCopy} className="tap t-meta inline-flex min-h-9 shrink-0 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-slate-700 hover:bg-slate-100">
          <ClipboardCopy aria-hidden="true" className="size-3.5" /> 복사
        </button>
      </div>
      <LintBadge lint={lint} />
      {children}
    </div>
  )
}

function LintBadge({ lint }: { lint: LintSum }) {
  if (lint.bad === 0 && lint.warn === 0)
    return (
      <p className="t-meta self-start rounded-full bg-success-50 px-2 py-0.5 font-semibold text-success-700" data-testid="mk-week-lint-item" data-bad="0">
        ✓ 점검 통과
      </p>
    )
  return (
    <details className="t-meta rounded-lg bg-slate-50 px-2.5 py-1.5" data-testid="mk-week-lint-item" data-bad={lint.bad}>
      <summary className={`tap cursor-pointer font-semibold ${lint.bad ? 'text-danger-700' : 'text-amber-800'}`}>
        {lint.bad ? `고칠 곳 ${lint.bad}` : '✓ 점검 통과'}
        {lint.warn ? ` · 볼 것 ${lint.warn}` : ''}
      </summary>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 break-keep text-slate-700">
        {lint.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  )
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="t-meta font-bold break-keep text-slate-600">{label}</span>
      <p className="t-sub whitespace-pre-wrap break-keep text-slate-800 [overflow-wrap:anywhere]">{text}</p>
    </div>
  )
}

function ShortCard({ s, start, onCopy, link }: { s: WeekShort; start: string; onCopy: (t: string, what: string) => void; link?: PostLink }) {
  const kind = s.slot.platform === 'reels' ? '릴스' : '쇼츠'
  const title = s.slot.n ? `${kind} ${NUM[s.slot.n - 1]} · ${dayLabel(start, s.slot.day)}` : `${kind} 다른 버전`
  const plat = PLATFORMS.find((p) => p.key === s.slot.platform)
  const all = [s.draft.script, s.draft.caption ? `캡션: ${s.draft.caption}` : '', s.draft.hashtags].filter(Boolean).join('\n\n')
  return (
    <div id={s.slot.n ? `mk-week-short-${s.slot.n}` : undefined} className="scroll-mt-32" data-testid="mk-week-short" data-n={s.slot.n} data-ai={s.ai ? '1' : '0'} data-bad={s.lint.bad}>
      <Card icon={<Film aria-hidden="true" className="size-5 text-fuchsia-700" />} title={title} sub={`${s.topic} · ${plat?.label ?? ''}${s.draft.seconds ? ` · ${s.draft.seconds}` : ''}`} ai={s.ai} lint={s.lint} onCopy={() => onCopy(all, title)}>
        <p className="t-meta break-keep text-fuchsia-800">{s.slot.role}</p>
        <p className="t-sub whitespace-pre-wrap break-keep text-slate-800 [overflow-wrap:anywhere]">{s.draft.script}</p>
        {s.draft.caption && <Block label="캡션" text={s.draft.caption} />}
        {s.draft.hashtags && <p className="t-meta break-keep text-slate-500 [overflow-wrap:anywhere]">{s.draft.hashtags}</p>}
        <PostRow link={link} what="릴스 · 틱톡" />
      </Card>
    </div>
  )
}

function ThreadCard({ x, start, onCopy, link }: { x: WeekThread; start: string; onCopy: (t: string, what: string) => void; link?: PostLink }) {
  const tp = templateOf(x.draft.template || x.slot.template)
  const title = x.slot.day ? `스레드 · ${dayLabel(start, x.slot.day)}` : '스레드 · 예비'
  return (
    <div id={x.slot.day ? `mk-week-thread-${x.slot.day}` : undefined} className="scroll-mt-32" data-testid="mk-week-thread" data-day={x.slot.day} data-ai={x.ai ? '1' : '0'} data-bad={x.lint.bad}>
      <Card icon={<AtSign aria-hidden="true" className="size-5 text-slate-800" />} title={title} sub={`${x.slot.aim.replace(/^예비 — /, '')} · 틀 ${tp ? `${tp.key} ${tp.name}` : x.slot.template} · ${x.topic}`} ai={x.ai} lint={x.lint} onCopy={() => onCopy(x.draft.body, title)}>
        <p className="t-sub whitespace-pre-wrap break-keep text-slate-800 [overflow-wrap:anywhere]">{x.draft.body}</p>
        {x.draft.selfComment && <Block label="본인 댓글(조회 1,000 넘으면)" text={x.draft.selfComment} />}
        {x.draft.checks.length > 0 && (
          <ul className="t-meta flex list-disc flex-col gap-0.5 pl-4 break-keep text-slate-600">
            {x.draft.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <PostRow link={link} what="스레드" />
      </Card>
    </div>
  )
}
