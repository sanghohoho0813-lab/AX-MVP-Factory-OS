/**
 * 내 콘텐츠 (D-231) — 레이더에서 고른 주제를 실제로 찍고 · 올리고 · 나눠 올리기까지 한 곳에서.
 *
 * 대표: "그걸 만들었으면 뭘 만들었고 앞으로 뭘 만들 건지 일정 · 체크리스트 같은 기능이 따로 하나 생겨야 —
 *        콘텐츠를 실제로 만들어 나가는 과정에 필요한 모든 것. 홍보 글 만들기랑도 연동."
 *  - 단계판(아이디어 → 제작 예정 → 대본 준비 → 촬영 완료 → 게시 완료) — 누르면 그 단계만.
 *  - 이번 주 일정(월~일) — 촬영일 · 게시일이 이번 주인 것, 날짜가 지난 일은 빨갛게.
 *  - 줄마다: 단계 · 촬영일 · 게시일 · 체크리스트 7칸 · 메모 · 올린 주소 · 첫 문장 · 제목 후보 · 브리프 복사 · [홍보 글로](주제를 키워드로) · 빼기(한 번 더 묻기).
 *  - 레이더에 없는 주제도 직접 적어 담는다.
 * 예전 '콘텐츠 수첩'(D-194)의 줄 · 단계 · 메모 · 브리프 · 빼기는 그대로 여기로 옮겼다(지운 것 없음). 저장은 같은 수첩 줄.
 * D-241 AI 도우미에서 담은 기획 · 대본이 여기로 온다 — 주소 ?idea=번호 로 오면 그 줄을 펼쳐 보여 주고, 대본은 줄 안에서 읽고 복사.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCopy, Clapperboard, ExternalLink, FileText, NotebookPen, PenLine, Plus, Trash2, TrendingUp, Tv } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Fold, HelpHeading, openFold } from '../../../components/ui/fold'
import { todayLocalDate } from '../../../lib/appClock'
import { IDEA_STATUSES, IDEA_STATUS_LABEL, MAKE_CHECKS, briefText, lateOf, stageCounts, weekRange, weekSchedule, type ContentIdea, type IdeaStatus, type MakeCheckId } from '../../../services/marketing/radarStore'
import { learnFromMine, linkedVideo, perfOf, suggestMatches, youtubeIdOf, youtubeWatchUrl, type PerfTone } from '../../../services/marketing/myPerformance'
import type { RadarVideo } from '../../../services/marketing/ytRadar'
import { AxisBadge, IconChip } from './RadarParts'
import { isMarketingCustomer } from '../../../services/marketing/persona'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const shortDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`)
  return `${d.slice(5, 7).replace(/^0/, '')}/${d.slice(8, 10).replace(/^0/, '')}(${WEEKDAY[t.getUTCDay()]})`
}
const STAGE_TONE: Record<IdeaStatus, string> = {
  idea: 'border-slate-300 text-slate-700',
  selected: 'border-rose-300 text-rose-800',
  script: 'border-amber-300 text-amber-800',
  filmed: 'border-sky-300 text-sky-800',
  published: 'border-emerald-300 text-emerald-800',
}

export interface MakeActions {
  onStatus: (i: ContentIdea, s: IdeaStatus) => void
  onPatch: (i: ContentIdea, fields: Partial<Pick<ContentIdea, 'memo' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'status'>>, what: string) => void
  onRemove: (i: ContentIdea) => void
  onCopy: (text: string, what: string) => void
  onAdd: (topic: string) => Promise<boolean>
}

/** D-232 내 채널 영상 — 레이더 데이터를 받았을 때만(못 받았으면 성과 칸을 그리지 않는다) */
interface MineProps {
  mine?: readonly RadarVideo[]
  feedReady?: boolean
  sample?: boolean
}

const PERF_TONE: Record<PerfTone, string> = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  normal: 'border-slate-200 bg-slate-50 text-slate-700',
  low: 'border-amber-300 bg-amber-50 text-amber-800',
  unknown: 'border-slate-200 bg-white text-slate-600',
}
const dayOf = (ms: number) => {
  const d = new Date(ms + 9 * 3_600_000)
  return d.toISOString().slice(0, 10)
}

export function MakeView({ ideas, readOnly, failed, today = todayLocalDate(), mine = [], feedReady = false, sample = false, focusId = '', projects, ...act }: { ideas: readonly ContentIdea[]; readOnly: boolean; failed: boolean; today?: string; focusId?: string; /** D-350 1주일치 묶음(맨 위) */ projects?: ReactNode } & MineProps & MakeActions) {
  const [stage, setStage] = useState<IdeaStatus | 'all'>('all')
  const [topic, setTopic] = useState('')
  // '아니에요' 를 누른 제안 — 이 화면에서만 숨긴다(다음에 열면 다시 물어도 된다)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const mineById = useMemo(() => new Map(mine.map((v) => [v.id, v])), [mine])
  const suggestions = useMemo(() => (feedReady ? suggestMatches(ideas, mine) : new Map<string, RadarVideo>()), [feedReady, ideas, mine])
  const learning = useMemo(() => learnFromMine(ideas, mine), [ideas, mine])
  const counts = useMemo(() => stageCounts(ideas), [ideas])
  const week = useMemo(() => weekSchedule(ideas, today), [ideas, today])
  const range = weekRange(today)
  const late = useMemo(() => ideas.filter((i) => lateOf(i, today)), [ideas, today])
  const shown = useMemo(() => {
    const list = stage === 'all' ? ideas : ideas.filter((i) => i.status === stage)
    // 게시 완료는 뒤로 · 날짜가 있는 것 먼저(가까운 날 순) — 그다음 최근 담은 순
    const key = (i: ContentIdea) => [i.shootDate, i.publishDate].filter(Boolean).sort()[0] ?? '9999'
    return [...list].sort((a, b) => Number(a.status === 'published') - Number(b.status === 'published') || key(a).localeCompare(key(b)) || b.savedAt.localeCompare(a.savedAt))
  }, [ideas, stage])
  // D-357 줄로 데려오면(?idea= — 만든 것 한눈에 · 1주일치 · AI 도우미) 접힌 진행판을 펼친다(이 화면에 이미 있어도)
  useEffect(() => {
    if (focusId) openFold('mk.make.long')
  }, [focusId])
  const add = async () => {
    const t = topic.trim()
    if (!t) return
    if (await act.onAdd(t)) setTopic('')
  }
  return (
    <div className="flex flex-col gap-4" data-testid="make-view">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HelpHeading label="내 콘텐츠 만들기" className="flex items-center gap-2 text-[1.375rem] leading-tight font-extrabold text-slate-900 sm:text-2xl">
          <IconChip icon={NotebookPen} tone="rose" size="lg" />
          내 콘텐츠 만들기
        </HelpHeading>
        <p className="t-sub break-keep text-slate-600">고른 주제를 찍고 · 올리고 · 블로그 · 쇼츠로 나눠 올리기까지</p>
      </div>
      {readOnly && <p className="t-meta text-warning-700">팀장 화면을 보는 중에는 바꾸지 않습니다(읽기만).</p>}
      {failed && <p className="t-sub rounded-(--radius-control) bg-warning-50 px-3 py-2 text-warning-700">내 콘텐츠를 읽지 못했습니다 — 새로고침한 뒤 다시 열어 주세요.</p>}
      {projects}

      {/* D-357 화면 원칙 — 내 콘텐츠 첫 화면은 1주일치 프로젝트 · 만든 것 한눈에만. 롱폼 단계 · 일정 · 체크리스트 줄은 접힌 채 한 줄(펼친 것은 기억 · 줄로 오면 펼침) */}
      <Fold
        panel
        id="mk.make.long"
        title="유튜브 롱폼 진행판"
        forceOpen={!!focusId}
        count={ideas.length}
        summary={ideas.length ? [...IDEA_STATUSES.filter((x) => counts[x] > 0).map((x) => `${IDEA_STATUS_LABEL[x]} ${counts[x]}`), late.length ? `늦은 일 ${late.length}` : ''].filter(Boolean).join(' · ') : '아직 담은 롱폼이 없어요 — 누르면 주제를 직접 담는 칸'}
        testId="mk-make-long"
      >
        {/* 단계판 */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="tablist" aria-label="단계" data-testid="make-stages">
          {(['all', ...IDEA_STATUSES] as const).map((s) => {
            const n = s === 'all' ? ideas.length : counts[s]
            const on = stage === s
            return (
              <button key={s} type="button" role="tab" aria-selected={on} onClick={() => setStage(on ? 'all' : s)} className={`tap flex min-h-14 flex-col items-center justify-center rounded-(--radius-control) border-2 px-1 py-1.5 ${on ? 'border-transparent bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-sm' : `bg-white ${s === 'all' ? 'border-slate-300 text-slate-800' : STAGE_TONE[s]}`}`} data-testid="make-stage" data-status={s}>
                <span className="text-xl leading-none font-extrabold tabular-nums">{n}</span>
                <span className="t-meta mt-0.5 font-semibold break-keep">{s === 'all' ? '전체' : IDEA_STATUS_LABEL[s]}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* 이번 주 일정 */}
          <section className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-rose-200 bg-white p-3 sm:p-4" data-testid="make-week">
            <p className="t-sub flex flex-wrap items-center gap-x-2 font-bold text-slate-900">
              <CalendarDays aria-hidden="true" className="size-4 text-rose-600" /> 이번 주 일정
              <span className="t-meta font-normal text-slate-500">
                {shortDay(range.from)} ~ {shortDay(range.to)}
              </span>
            </p>
            {week.length === 0 ? (
              <p className="t-sub break-keep text-slate-500" data-testid="make-week-empty">
                아래 줄에서 촬영일 · 게시일을 적으면 여기 이번 주 일정으로 모여요.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {week.map((w) => (
                  <li key={`${w.idea.id}-${w.what}`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5" data-testid="make-week-item" data-what={w.what}>
                    <span className={`t-sub w-[4.75rem] shrink-0 font-bold tabular-nums ${w.date === today ? 'text-rose-700' : 'text-slate-700'}`}>{w.date === today ? '오늘' : shortDay(w.date)}</span>
                    <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-bold ${w.what === 'shoot' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>{w.what === 'shoot' ? '촬영' : '게시'}</span>
                    <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{w.idea.topic}</span>
                  </li>
                ))}
              </ul>
            )}
            {late.length > 0 && (
              <p className="t-sub flex items-start gap-1.5 rounded-(--radius-control) bg-danger-50 px-3 py-2 break-keep text-danger-700" data-testid="make-late">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  날짜가 지난 일 {late.length}개 — {late.slice(0, 2).map((i) => i.topic).join(' · ')}
                  {late.length > 2 ? ' …' : ''}. 단계를 바꾸거나 날짜를 다시 잡아 주세요.
                </span>
              </p>
            )}
          </section>

          {/* 직접 담기 */}
          <section className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 sm:p-4">
            <p className="t-sub font-bold text-slate-900">레이더에 없는 주제 직접 담기</p>
            <div className="flex min-w-0 gap-2">
              <input
                value={topic}
                maxLength={120}
                disabled={readOnly}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void add()}
                placeholder="예: 정책자금 상담 전 꼭 준비할 서류 5가지"
                className="tap t-sub min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2"
                aria-label="담을 주제"
                data-testid="make-add-input"
              />
              <Button variant="primary" onClick={() => void add()} disabled={readOnly || !topic.trim()} data-testid="make-add">
                <Plus aria-hidden="true" className="size-4" /> 담기
              </Button>
            </div>
            <p className="t-meta break-keep text-slate-500">담으면 '제작 예정' 으로 들어가요. 레이더 카드의 [이번 주로 확정] 도 여기로 모여요.</p>
          </section>
        </div>

        {/* D-232 우리 채널 성과 — 올린 영상이 평소보다 어땠나 · 어떤 축 · 제목 틀이 잘 됐나 */}
        {feedReady && ideas.length > 0 && (
          <section className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-3 sm:p-4" data-testid="make-learn" data-linked={learning.linked} data-measured={learning.measured}>
            <p className="t-sub flex flex-wrap items-center gap-x-2 font-bold text-slate-900">
              <TrendingUp aria-hidden="true" className="size-4 text-emerald-600" /> 우리 채널 성과
              <span className="t-meta font-normal text-slate-500">내 채널 최근 영상 {mine.length}편 기준{sample ? ' · 예시 데이터' : ''} · 평소 대비(레이더와 같은 식)</span>
            </p>
            {learning.lines.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {learning.lines.map((l) => (
                  <li key={l} className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="make-learn-line">
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-sub break-keep text-slate-600" data-testid="make-learn-empty">
                올린 유튜브 주소를 적거나 아래 '이 영상인가요?' 에서 [맞아요] 를 누르면, 평소보다 잘 됐는지가 여기 모여요.
              </p>
            )}
            {[...suggestions.keys()].filter((id) => !dismissed.has(id)).length > 0 && (
              <p className="t-meta font-semibold text-rose-700" data-testid="make-learn-suggest">
                이 영상인가요? 확인할 것 {[...suggestions.keys()].filter((id) => !dismissed.has(id)).length}건 — 아래 줄에서 [맞아요] 한 번이면 이어져요
              </p>
            )}
            {/* D-236: 내 채널을 고르는 단추는 없다 — 미리 정해 둔 한 채널(예전 글은 '채널 탭에서 정하라' 고 했다) */}
            {mine.length === 0 && <p className="t-meta break-keep text-slate-500">아직 받아 온 내 채널 영상이 없어요. 내 채널은 따로 고르지 않아도 미리 정해져 있어요(채널 탭의 '내 채널' 표시) — 그 영상이 들어오면 올린 영상의 숫자를 저절로 찾아요.</p>}
            <p className="t-meta break-keep text-slate-500">노출 · 클릭률 · 시청 지속시간은 공개 숫자에 없어 어림하지 않아요(YouTube Analytics 연결 뒤).</p>
          </section>
        )}

        {/* 콘텐츠 줄 */}
        <section className="flex flex-col" data-testid="radar-notebook">
          {ideas.length === 0 ? (
            <p className="t-sub rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 break-keep text-slate-500" data-testid="make-empty">
              아직 담은 콘텐츠가 없어요. [이번 주 찍을 것] 에서 카드의 [이번 주로 확정] 을 누르거나, 위에 주제를 직접 적어 담아 주세요.
            </p>
          ) : shown.length === 0 ? (
            <p className="t-sub break-keep text-slate-500">이 단계의 콘텐츠가 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {shown.map((i) => (
                <MakeRow
                  key={i.id}
                  i={i}
                  readOnly={readOnly}
                  today={today}
                  video={linkedVideo(i, mineById)}
                  missingVideo={feedReady && mine.length > 0 && !!youtubeIdOf(i.link) && !linkedVideo(i, mineById)}
                  suggestion={dismissed.has(i.id) ? null : (suggestions.get(i.id) ?? null)}
                  onDismiss={() => setDismissed((s) => new Set([...s, i.id]))}
                  focus={i.id === focusId}
                  {...act}
                />
              ))}
            </ul>
          )}
        </section>
      </Fold>
    </div>
  )
}

function MakeRow({
  i,
  readOnly,
  today,
  video,
  missingVideo,
  suggestion,
  onDismiss,
  focus = false,
  onStatus,
  onPatch,
  onRemove,
  onCopy,
}: { i: ContentIdea; readOnly: boolean; today: string; video: RadarVideo | null; missingVideo: boolean; suggestion: RadarVideo | null; onDismiss: () => void; focus?: boolean } & MakeActions) {
  const [memo, setMemo] = useState(i.memo)
  // D-241 AI 기획을 담으면 메모가 밖에서 바뀐다 — 고치는 중이 아니면 새 메모로(옛 메모로 덮어쓰지 않게)
  const [memoEdited, setMemoEdited] = useState(false)
  // D-244 저장을 보낸 메모(to)와 그 전 메모(from) — 저장이 실패해 from 으로 되돌아오면 적은 글을 지우지 않고 '고치는 중' 으로 둔다
  // (예전: 칸을 벗어나면 고치는 중을 풀어, 실패해 되돌아온 옛 메모가 적은 글을 덮었다 — 알림은 '그대로 있습니다')
  const sentMemo = useRef<{ from: string; to: string } | null>(null)
  useEffect(() => {
    const s = sentMemo.current
    if (s && i.memo === s.from) setMemoEdited(true)
    else if (!memoEdited && !(s && i.memo === s.to)) {
      sentMemo.current = null
      setMemo(i.memo)
    }
  }, [i.memo, memoEdited])
  const [link, setLink] = useState(i.link)
  const rowRef = useRef<HTMLLIElement | null>(null)
  // ?idea= 로 온 줄 — 펼쳐서 그 자리로(AI 도우미 [내 콘텐츠에서 보기])
  useEffect(() => {
    if (!focus) return
    const t = window.setTimeout(() => rowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120)
    return () => window.clearTimeout(t)
  }, [focus])
  const perf = video ? perfOf(video) : null
  // [맞아요] — 주소 · 게시 완료 · 게시일(비어 있으면 그 영상 올린 날)을 한 번에(따로 저장하면 서로 덮을 수 있다)
  const accept = (v: RadarVideo) => {
    const url = youtubeWatchUrl(v.id)
    setLink(url)
    onPatch(i, { link: url, status: 'published', ...(i.publishDate ? {} : { publishDate: dayOf(v.publishedAt) }) }, '올린 영상')
  }
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState(focus)
  const late = lateOf(i, today)
  const done = i.checks.length
  const toggle = (id: MakeCheckId) => onPatch(i, { checks: i.checks.includes(id) ? i.checks.filter((c) => c !== id) : [...i.checks, id] }, '체크')
  return (
    <li ref={rowRef} className={`flex min-w-0 scroll-mt-20 flex-col gap-2.5 rounded-(--radius-card) border bg-white p-3 sm:p-4 ${late ? 'border-danger-300' : focus ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200'}`} data-testid="radar-idea" data-status={i.status} data-focus={focus ? '1' : undefined}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {i.source === 'custom' ? <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">직접 담음</span> : <AxisBadge axis={i.type} />}
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap t-body min-w-0 flex-[1_1_12rem] text-left font-bold break-keep text-slate-900 [overflow-wrap:anywhere] hover:text-rose-700" data-testid="make-row-toggle">
          {i.topic}
        </button>
        {/* D-350 1주일치에서 모은 롱폼 — 그 주 묶음(쇼츠 · 스레드까지)으로 바로 */}
        {i.key.startsWith('week:') && (
          <Link to={`/marketing?week=1&start=${encodeURIComponent(i.key.slice(5))}&from=make`} className="tap t-meta inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-900 hover:bg-violet-200" data-testid="make-week-badge">
            <CalendarDays aria-hidden="true" className="size-3.5" /> 1주일치 프로젝트 보기
          </Link>
        )}
        {i.script && (
          <button type="button" onClick={() => setOpen(true)} className="tap t-meta inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900" data-testid="make-script-badge">
            <FileText aria-hidden="true" className="size-3.5" /> 대본 있음
          </button>
        )}
        <label className="flex items-center gap-1.5">
          <span className="sr-only">단계</span>
          <select value={i.status} disabled={readOnly} onChange={(e) => onStatus(i, e.target.value as IdeaStatus)} className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5 text-slate-800" data-testid="radar-idea-status">
            {IDEA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {IDEA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="t-sub w-12 shrink-0 font-semibold text-sky-800">촬영일</span>
          <input type="date" value={i.shootDate} disabled={readOnly} onChange={(e) => onPatch(i, { shootDate: e.target.value }, '촬영일')} className="tap t-sub w-40 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5" data-testid="make-shoot-date" />
        </label>
        <label className="flex items-center gap-2">
          <span className="t-sub w-12 shrink-0 font-semibold text-emerald-800">게시일</span>
          <input type="date" value={i.publishDate} disabled={readOnly} onChange={(e) => onPatch(i, { publishDate: e.target.value }, '게시일')} className="tap t-sub w-40 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5" data-testid="make-publish-date" />
        </label>
        {late && (
          <span className="t-meta inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 font-bold text-danger-700" data-testid="make-row-late">
            <AlertTriangle aria-hidden="true" className="size-3.5" /> {late === 'shoot' ? '촬영일이 지났어요' : '게시일이 지났어요'}
          </span>
        )}
      </div>

      {/* D-232 올린 영상 성과 · '이 영상인가요?' */}
      {perf && (
        <p className={`t-sub flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-(--radius-control) border px-3 py-2 ${PERF_TONE[perf.tone]}`} data-testid="make-perf" data-tone={perf.tone}>
          <Tv aria-hidden="true" className="size-4 shrink-0" />
          <b className="font-extrabold">{perf.label}</b>
          <span className="t-meta">{perf.meta}</span>
          {perf.tone === 'good' && <span className="t-meta font-bold">· 이 틀 · 주제를 한 번 더</span>}
        </p>
      )}
      {missingVideo && (
        <p className="t-meta break-keep text-slate-500" data-testid="make-perf-missing">
          올린 주소의 영상을 내 채널 최근 영상에서 찾지 못했어요(오래된 영상이거나 다른 채널).
        </p>
      )}
      {suggestion && !i.link && (
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-rose-200 bg-rose-50/70 px-3 py-2.5" data-testid="make-suggest">
          <p className="t-sub min-w-0 break-keep text-slate-800 [overflow-wrap:anywhere]">
            <span className="font-bold text-rose-700">이 영상인가요? </span>'{suggestion.title}' <span className="t-meta text-slate-500">· {shortDay(dayOf(suggestion.publishedAt))} 올림</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => accept(suggestion)} disabled={readOnly} data-testid="make-suggest-yes">
              맞아요 — 이 줄과 잇기
            </Button>
            <Button variant="ghost" onClick={onDismiss} data-testid="make-suggest-no">
              아니에요
            </Button>
          </div>
        </div>
      )}

      {/* 체크리스트 */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="t-meta flex items-center gap-1.5 font-semibold text-slate-600">
          <CheckCircle2 aria-hidden="true" className={`size-4 ${done === MAKE_CHECKS.length ? 'text-success-600' : 'text-slate-400'}`} /> 할 일 {done}/{MAKE_CHECKS.length}
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600" style={{ width: `${Math.round((done / MAKE_CHECKS.length) * 100)}%` }} />
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5" data-testid="make-checks">
          {MAKE_CHECKS.map((c) => {
            const on = i.checks.includes(c.id)
            return (
              <label key={c.id} className={`tap t-sub inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 ${on ? 'border-success-300 bg-success-50 font-semibold text-success-800' : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'}`} data-testid="make-check" data-id={c.id} data-on={on ? '1' : '0'}>
                <input type="checkbox" className="size-4 accent-rose-600" checked={on} disabled={readOnly} onChange={() => toggle(c.id)} />
                {c.label}
              </label>
            )
          })}
        </div>
      </div>

      {open && (
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2.5" data-testid="make-row-body">
          {i.angle && (
            <p className="t-sub break-keep text-slate-800">
              <span className="t-meta font-bold text-indigo-800">이렇게 말해요 </span>
              {i.angle}
            </p>
          )}
          {i.hook && (
            <p className="t-sub break-keep text-slate-800">
              <span className="t-meta font-bold text-rose-700">첫 문장 </span>"{i.hook}"
            </p>
          )}
          {i.titleCandidates.length > 0 && (
            <ol className="t-sub flex list-decimal flex-col gap-0.5 pl-5 break-keep text-slate-800">
              {i.titleCandidates.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          )}
          {i.benchmarkTitles.length > 0 && <p className="t-meta break-keep text-slate-500">참고 영상 {i.benchmarkTitles.length}편 — {i.benchmarkTitles[0]}</p>}
          {i.script && (
            <div className="flex min-w-0 flex-col gap-1.5 rounded-(--radius-control) border border-amber-200 bg-white p-2.5" data-testid="make-script">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-sub inline-flex items-center gap-1 font-bold text-amber-900">
                  <FileText aria-hidden="true" className="size-4" /> 대본
                </span>
                <span className="t-meta text-slate-500">{i.script.length.toLocaleString('ko-KR')}자 · AI 도우미에서 저장</span>
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onCopy(i.script, '대본')} data-testid="make-script-copy">
                  <ClipboardCopy aria-hidden="true" className="size-4" /> 대본 복사
                </Button>
              </div>
              <p className="t-sub max-h-96 overflow-y-auto break-keep whitespace-pre-line text-slate-800 [overflow-wrap:anywhere]">{i.script}</p>
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="t-meta font-semibold text-slate-600">메모</span>
            <textarea
              value={memo}
              rows={memo.includes('\n') ? 5 : 2}
              maxLength={1000}
              disabled={readOnly}
              onChange={(e) => {
                setMemoEdited(true)
                setMemo(e.target.value)
              }}
              onBlur={() => {
                if (memoEdited && memo !== i.memo) {
                  sentMemo.current = { from: i.memo, to: memo }
                  onPatch(i, { memo }, '메모')
                } else sentMemo.current = null
                setMemoEdited(false)
              }}
              placeholder="예: 화요일 오전 촬영 · 사례는 A사(이름 빼고)"
              className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2"
              data-testid="radar-idea-memo"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-meta font-semibold text-slate-600">올린 주소(유튜브 · 블로그)</span>
            <input
              value={link}
              disabled={readOnly}
              inputMode="url"
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => link.trim() !== i.link && onPatch(i, { link: link.trim() }, '올린 주소')}
              placeholder="https://"
              className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2"
              data-testid="make-link"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
          <Clapperboard aria-hidden="true" className="size-4" /> {open ? '접기' : '관점 · 제목 · 메모'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCopy(briefText(i), '브리프')} data-testid="radar-idea-brief">
          <ClipboardCopy aria-hidden="true" className="size-4" /> 브리프 복사
        </Button>
        {/* SAAS-2 홍보 글 만들기는 고객 계정에 아직 닫혀 있어 그 입구도 보이지 않는다 */}
        {!isMarketingCustomer() && (
          <Link to={`/tools/content?kw=${encodeURIComponent(i.topic.split(/\s*×\s*/)[0].slice(0, 40))}`} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-3 font-semibold text-violet-700 hover:bg-violet-50" data-testid="make-to-content" title="누구 글인지 고르면 이 주제를 키워드로 넣은 채 블로그 · 쇼츠 · 카드뉴스를 만들어요">
            <PenLine aria-hidden="true" className="size-4" /> 홍보 글로
          </Link>
        )}
        {i.link && (
          <a href={i.link} target="_blank" rel="noreferrer noopener" className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-3 font-semibold text-emerald-700 hover:bg-emerald-50" data-testid="make-open-link">
            <ExternalLink aria-hidden="true" className="size-4" /> 올린 글 보기
          </a>
        )}
        {confirm ? (
          <span className="flex flex-wrap items-center gap-2" data-testid="radar-idea-confirm">
            <span className="t-sub font-semibold text-danger-700">내 콘텐츠에서 뺄까요?</span>
            <Button size="sm" variant="danger" onClick={() => onRemove(i)} disabled={readOnly}>
              빼기
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              그대로 두기
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={readOnly} aria-label={`내 콘텐츠에서 빼기 — ${i.topic}`} data-testid="radar-idea-remove">
            <Trash2 aria-hidden="true" className="size-4" /> 빼기
          </Button>
        )}
      </div>
    </li>
  )
}
