/**
 * 유튜브 벤치마킹 (D-193) — 마케팅 · 브랜딩 안. 대표가 예전에 만든 '김팀장 벤치마킹 대시보드'(Streamlit)를 OS 화면으로 옮겼다.
 *
 * 대표 지시: "이걸 마케팅 브랜딩 목차에 넣고 싶다 — 유튜브 조회수 잘 나오는 곳 벤치마킹." (A안: 'AI 대본 생성' 만 빼고)
 *  - 데이터: 서버 함수(/api/yt-bench)가 채널 20곳 · 최근 영상 50편씩을 매일 아침 9시에 받아 온다(키는 서버에만).
 *  - 화면은 세 갈래 — 인기 영상(이번 주 · 이번 달 · 올해 · 쇼츠) · 콘텐츠 추천(주목 주제 + 제목 아이디어) · 채널 · 분석.
 *    예전 앱의 탭 7개를 셋으로 줄였다(D-192 — 글씨는 적게, 분석은 접어 두고 목차 설명으로).
 *  - 계산은 모두 규칙(services/marketing/ytBench) — 'AI' 라고 부르지 않는다. 대본 만들기는 없다(LLM 호출 0).
 *  - 키를 넣기 전에는 [예시로 보기](지어낸 채널 · 숫자, 크게 '예시 데이터').
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCopy, Download, Eye, Flame, MessageCircle, PlayCircle, RefreshCw, Rocket, ThumbsUp, TriangleAlert, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile } from '../../components/ui/primitives'
import { Fold, HintTip } from '../../components/ui/fold'
import { hintFor } from '../../content/sectionHints'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { useYtFeed } from '../../services/marketing/ytFeed'
import {
  PERIOD_HINT,
  PERIOD_LABEL,
  boardOf,
  byHour,
  byLength,
  byWeekday,
  bestOf,
  channelTable,
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
  type YtPeriod,
  type YtType,
  type YtVideo,
} from '../../services/marketing/ytBench'

type View = 'top' | 'ideas' | 'channels'
const VIEWS: Array<[View, string]> = [
  ['top', '인기 영상'],
  ['ideas', '콘텐츠 추천'],
  ['channels', '채널 · 분석'],
]
const PERIODS: YtPeriod[] = ['week', 'month', 'year', 'shorts']
const TOP_NS = [20, 30, 40, 60]

const seg = (on: boolean) => `tap t-sub flex-1 rounded-[8px] px-3 py-2 font-semibold whitespace-nowrap ${on ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`

export default function YoutubeBenchPage() {
  const yt = useYtFeed()
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.some(([k]) => k === params.get('view')) ? params.get('view') : 'top') as View
  const period = (PERIODS.includes(params.get('p') as YtPeriod) ? params.get('p') : 'week') as YtPeriod
  const kw = params.get('kw') ?? ''
  const [type, setType] = useState<YtType>('all')
  const [channel, setChannel] = useState('')
  const [topN, setTopN] = useState(30)

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const prepared = useMemo(() => (yt.feed ? prepareFeed(yt.feed) : null), [yt.feed])
  const loading = yt.status === 'loading'

  const refresh = () => void yt.refresh()
  const filter = useMemo(() => ({ type, channels: channel ? [channel] : [] }), [type, channel])

  const csv = () => {
    if (!prepared) return
    const d = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '')
    // 파일 이름은 영문(브라우저마다 한글 이름이 'download' 로 바뀌는 일이 있다) — 매출 · 비용 CSV 와 같은 꼴
    downloadText(`youtube-benchmark-${d}${yt.sample ? '-sample' : ''}.csv`, videosCsv(prepared.videos), 'text/csv')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5" data-testid="yt-page">
      <PageHeader
        title="유튜브 벤치마킹"
        descriptionAsHint
        description="정해 둔 채널 20곳(내 채널 + 벤치마킹 19곳)의 최근 영상으로 잘 되는 주제 · 키워드 · 올리기 좋은 요일과 시간을 찾습니다. 규칙 계산이고, 매일 아침 9시에 새로 받습니다."
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

      {!prepared ? (
        <SetupCard status={yt.status} message={yt.message} onSample={yt.showSample} />
      ) : (
        <>
          <FeedLine prepared={prepared} fetchedAt={yt.feed?.fetchedAt ?? ''} failed={yt.feed?.failed ?? []} sample={yt.sample} message={yt.status === 'ready' || yt.status === 'sample' ? '' : yt.message} />

          <HotBanner prepared={prepared} onPick={(k) => setParam({ view: '', p: '', kw: k })} />

          <div role="tablist" className="flex max-w-xl rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5" data-testid="yt-views">
            {VIEWS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} data-testid={`yt-view-${k}`} onClick={() => setParam({ view: k === 'top' ? '' : k })} className={seg(view === k)}>
                {l}
              </button>
            ))}
          </div>

          {view !== 'channels' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="yt-filters">
              {!(view === 'top' && period === 'shorts') && (
                <div role="group" aria-label="영상 종류" className="flex rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
                  {(
                    [
                      ['all', '전체'],
                      ['long', '롱폼'],
                      ['short', '쇼츠'],
                    ] as Array<[YtType, string]>
                  ).map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} className={seg(type === k)} data-testid={`yt-type-${k}`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              <label className="flex min-w-0 items-center gap-2">
                <span className="t-sub shrink-0 text-slate-600">채널</span>
                <select value={channel} onChange={(e) => setChannel(e.target.value)} data-testid="yt-channel" className="tap t-sub max-w-[14rem] min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-slate-800">
                  <option value="">전체 채널</option>
                  {prepared.channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.mine ? ' (내 채널)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {view === 'top' && (
                <label className="flex items-center gap-2">
                  <span className="t-sub shrink-0 text-slate-600">보기</span>
                  <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} data-testid="yt-topn" className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-slate-800">
                    {TOP_NS.map((n) => (
                      <option key={n} value={n}>
                        TOP {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {view === 'top' && (
            <TopView
              prepared={prepared}
              period={period}
              kw={kw}
              topN={topN}
              filter={filter}
              sample={yt.sample}
              onPeriod={(p) => setParam({ p: p === 'week' ? '' : p, kw: '' })}
              onKeyword={(k) => setParam({ kw: k })}
            />
          )}
          {view === 'ideas' && <IdeasView prepared={prepared} filter={filter} onCopy={(t) => void copyText(t).then((ok) => showToast(ok ? '제목을 복사했습니다.' : '복사하지 못했습니다 — 길게 눌러 직접 복사해 주세요.'))} />}
          {view === 'channels' && <ChannelsView prepared={prepared} />}
        </>
      )}
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
          <li>다시 배포(Redeploy)하면 이 화면이 실제 채널 20곳으로 바뀝니다.</li>
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

function FeedLine({ prepared, fetchedAt, failed, sample, message }: { prepared: Prepared; fetchedAt: string; failed: string[]; sample: boolean; message: string }) {
  const t = Date.parse(fetchedAt)
  const when = Number.isFinite(t) ? new Date(t + 9 * 3_600_000).toISOString().slice(5, 16).replace('-', '월 ').replace('T', '일 ') : ''
  return (
    <div className="flex flex-col gap-2">
      {sample && (
        <p className="t-body rounded-(--radius-control) border border-amber-300 bg-amber-50 px-4 py-3 font-semibold break-keep text-amber-900" data-testid="yt-sample-banner">
          예시 데이터입니다 — 지어낸 채널 · 숫자입니다. 유튜브 키를 넣으면 실제 채널 20곳으로 바뀝니다.
        </p>
      )}
      {message && (
        <p className="t-sub rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-800" data-testid="yt-message">
          {message}
        </p>
      )}
      <p className="t-sub flex flex-wrap gap-x-3 gap-y-1 text-slate-500" data-testid="yt-feedline">
        {when && <span>받은 때 {when}</span>}
        <span>채널 {prepared.channels.length}곳</span>
        <span>영상 {fmt(prepared.videos.length)}편</span>
        {failed.length > 0 && <span className="text-warning-700" data-testid="yt-failed">못 받은 채널 {failed.join(' · ')}</span>}
      </p>
    </div>
  )
}

/** 이번 주 주목 주제 TOP 3 — 거르기 없이 7일 안 전체에서. 누르면 그 키워드로 인기 영상 */
function HotBanner({ prepared, onPick }: { prepared: Prepared; onPick: (keyword: string) => void }) {
  const topics = useMemo(() => extractTopics(periodVideos(prepared.videos, 'week'), prepared.channelWords, 3), [prepared])
  if (topics.length === 0) return null
  return (
    <section className="flex flex-col gap-2" data-testid="yt-hot">
      <HintTip tip={hintFor('이번 주 주목 주제 TOP 3')} label="이번 주 주목 주제 TOP 3">
        <h2 className="t-card flex items-center gap-1.5 font-bold text-slate-900">
          <Flame aria-hidden="true" className="size-5 text-red-500" /> 이번 주 주목 주제 TOP 3
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
/* 인기 영상                                                              */
/* ------------------------------------------------------------------ */

function TopView({
  prepared,
  period,
  kw,
  topN,
  filter,
  sample,
  onPeriod,
  onKeyword,
}: {
  prepared: Prepared
  period: YtPeriod
  kw: string
  topN: number
  filter: { type: YtType; channels: string[] }
  sample: boolean
  onPeriod: (p: YtPeriod) => void
  onKeyword: (k: string) => void
}) {
  const counts = useMemo(() => Object.fromEntries(PERIODS.map((p) => [p, periodVideos(prepared.videos, p, filter).length])) as Record<YtPeriod, number>, [prepared, filter])
  const pool = useMemo(() => periodVideos(prepared.videos, period, filter), [prepared, period, filter])
  const keywords = useMemo(() => extractKeywords(pool, prepared.channelWords), [pool, prepared])
  const board = useMemo(() => boardOf(pool, topN, kw), [pool, topN, kw])
  const top = board.rows[0]
  const second = board.rows[1]
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

      {keywords.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="yt-keywords">
          <HintTip tip={hintFor('인기 핵심 키워드')} label="인기 핵심 키워드">
            <h2 className="t-card font-bold text-slate-900">인기 핵심 키워드</h2>
          </HintTip>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!kw} onClick={() => onKeyword('')} className={`tap t-sub rounded-full border px-3 py-1 font-medium ${!kw ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              전체
            </button>
            {keywords.map((k, i) => (
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
          </div>
        </section>
      )}

      {board.rows.length === 0 ? (
        <p className="t-body rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 text-slate-500" data-testid="yt-empty">
          {kw ? `'${kw}' 이 든 영상이 없습니다.` : '이 기간에 올린 영상이 없습니다.'}
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
          <ol className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" data-testid="yt-grid">
            {board.rows.map((v, i) => (
              <VideoCard key={v.id} v={v} rank={i + 1} rising={isRising(v, board.periodAvg)} noThumb={sample} />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function VideoCard({ v, rank, rising, noThumb }: { v: YtVideo; rank: number; rising: boolean; noThumb: boolean }) {
  const [broken, setBroken] = useState(false)
  const medal = rank === 1 ? 'bg-amber-400 text-amber-950' : rank === 2 ? 'bg-slate-300 text-slate-900' : rank === 3 ? 'bg-orange-300 text-orange-950' : 'bg-slate-900/80 text-white'
  return (
    <li className={`flex min-w-0 flex-col overflow-hidden rounded-(--radius-card) border bg-white ${v.mine ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'}`} data-testid="yt-card" data-mine={v.mine ? '1' : '0'} data-rising={rising ? '1' : '0'}>
      <a href={v.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-slate-100" aria-label={`${v.title} — 유튜브에서 보기`}>
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
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <p className="t-meta truncate text-slate-500">{v.channelName}</p>
        <a href={v.url} target="_blank" rel="noopener noreferrer" className="t-sub line-clamp-2 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere] hover:text-brand-700 hover:underline">
          {v.title}
        </a>
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
        <p className="t-meta text-slate-400">{dateKo(v.publishedAt)}</p>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 콘텐츠 추천                                                            */
/* ------------------------------------------------------------------ */

function IdeasView({ prepared, filter, onCopy }: { prepared: Prepared; filter: { type: YtType; channels: string[] }; onCopy: (t: string) => void }) {
  const week = useMemo(() => extractTopics(periodVideos(prepared.videos, 'week', filter), prepared.channelWords), [prepared, filter])
  const month = useMemo(() => extractTopics(periodVideos(prepared.videos, 'month', filter), prepared.channelWords), [prepared, filter])
  return (
    <div className="flex flex-col gap-4" data-testid="yt-ideas">
      <Fold id="yt.ideas.week" title="이번 주 주목 주제" defaultOpen count={week.length} countTone="brand">
        <TopicGrid topics={week} onCopy={onCopy} />
      </Fold>
      <Fold id="yt.ideas.month" title="이번 달 주목 주제" defaultOpen count={month.length} countTone="brand">
        <TopicGrid topics={month} onCopy={onCopy} />
      </Fold>
    </div>
  )
}

function TopicGrid({ topics, onCopy }: { topics: Topic[]; onCopy: (t: string) => void }) {
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
            {t.channels}개 채널 · 최고 {fmt(t.topViews)}회 · 평균 {fmt(t.avgViews)}회
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

/* ------------------------------------------------------------------ */
/* 채널 · 분석                                                            */
/* ------------------------------------------------------------------ */

function ChannelsView({ prepared }: { prepared: Prepared }) {
  const table = useMemo(() => channelTable(prepared.channels), [prepared])
  const cmp = useMemo(() => compareMine(prepared), [prepared])
  const wd = useMemo(() => byWeekday(prepared.videos), [prepared])
  const hr = useMemo(() => byHour(prepared.videos), [prepared])
  const ln = useMemo(() => byLength(prepared.videos), [prepared])
  const fm = useMemo(() => formatByChannel(prepared.videos), [prepared])
  const cad = useMemo(() => uploadCadence(prepared.videos), [prepared])
  const best = (g: GroupStat | null) => (g ? `1위 ${g.label} · 평균 ${shortNum(g.avg)}회` : undefined)
  return (
    <div className="flex flex-col gap-3" data-testid="yt-channels">
      <Fold panel id="yt.channels" title="채널 현황" defaultOpen count={table.length} testId="yt-channel-table">
        <ul className="flex flex-col divide-y divide-slate-100">
          {table.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2" data-testid="yt-channel-row">
              <span className="t-meta w-6 shrink-0 text-right text-slate-400">{i + 1}</span>
              <span className="t-body min-w-0 flex-[1_1_10rem] font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">
                {c.title} {c.mine && <Badge tone="warning">내 채널</Badge>}
              </span>
              <span className="t-sub flex flex-wrap gap-x-3 pl-9 text-slate-600 sm:pl-0">
                <span>구독자 {shortNum(c.subs)}</span>
                <span>영상 {fmt(c.videoCount)}</span>
                <span>총 조회 {shortNum(c.views)}</span>
                <span className="font-semibold text-slate-800">구독자당 {c.viewsPerSub.toFixed(1)}회</span>
              </span>
            </li>
          ))}
        </ul>
      </Fold>

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
    </div>
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
