/**
 * D-355 내 콘텐츠 '만든 것 한눈에' — 대표: "롱폼은 어디 있는지도 모르겠어 · 스레드는 기록표에 · 여기저기 분산돼 있어서 더 헷갈려 ·
 *        내 콘텐츠 안에서도 한 번에 다 볼 수 있게".
 * 1주일치 묶음(D-350)은 1주일치로 만든 것만 모았다 — 스레드 · 릴스 화면에서 하나씩 쓴 글은 여전히 각 기록표에만 있었다.
 *  - 롱폼(내 콘텐츠 줄) · 릴스 · 틱톡 대본 · 스레드 글을 한 목록에, 최근에 만든 것부터. 형식 칩으로 거르기.
 *  - 누르면 그 글이 있는 곳에서 바로 열린다(롱폼 = 이 화면의 그 줄 · 스레드 · 릴스 = 그 화면 글 칸 — ?open=).
 *  - 읽기만 한다(저장 · 지우기는 원래 화면에서). 못 읽은 형식은 한 줄로 알리고 나머지는 보인다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, ChevronRight, Film, Layers, MonitorPlay, type LucideIcon } from 'lucide-react'
import type { ContentIdea } from '../../../services/marketing/radarStore'
import { listThreadPosts, type ThreadPost } from '../../../services/marketing/threads'
import { listShortPosts, type ShortPost } from '../../../services/marketing/shorts'
import { madeItems, type MadeKind } from '../../../services/marketing/allMade'

const KIND: Record<MadeKind, { label: string; icon: LucideIcon; tone: string; list: string; listLabel: string }> = {
  long: { label: '유튜브 롱폼', icon: MonitorPlay, tone: 'bg-red-50 text-red-700 ring-red-200', list: '/marketing?view=make', listLabel: '롱폼 줄' },
  short: { label: '릴스 · 틱톡', icon: Film, tone: 'bg-pink-50 text-pink-700 ring-pink-200', list: '/marketing/shorts?tab=records', listLabel: '릴스 · 틱톡 기록표' },
  thread: { label: '스레드', icon: AtSign, tone: 'bg-slate-100 text-slate-800 ring-slate-300', list: '/marketing/threads?tab=records', listLabel: '스레드 기록표' },
}

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`
}

export function AllMade({ ideas, workspaceId }: { ideas: readonly ContentIdea[]; workspaceId: string | null }) {
  const [shorts, setShorts] = useState<ShortPost[] | null>(null)
  const [threads, setThreads] = useState<ThreadPost[] | null>(null)
  const [failed, setFailed] = useState<string[]>([])
  const [kind, setKind] = useState<MadeKind | 'all'>('all')
  const [more, setMore] = useState(false)
  useEffect(() => {
    let alive = true
    const miss = (what: string) => alive && setFailed((xs) => (xs.includes(what) ? xs : [...xs, what]))
    void listShortPosts(workspaceId).then((l) => alive && setShorts(l), () => (miss('릴스 · 틱톡'), alive && setShorts([])))
    void listThreadPosts(workspaceId).then((l) => alive && setThreads(l), () => (miss('스레드'), alive && setThreads([])))
    return () => {
      alive = false
    }
  }, [workspaceId])
  const all = useMemo(() => madeItems(ideas, shorts ?? [], threads ?? []), [ideas, shorts, threads])
  const count = (k: MadeKind) => all.filter((x) => x.kind === k).length
  const shown = kind === 'all' ? all : all.filter((x) => x.kind === kind)
  const limit = more ? 30 : 6
  const loading = shorts === null || threads === null

  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" aria-labelledby="mk-allmade-h" data-testid="mk-allmade">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="mk-allmade-h" className="t-card flex items-center gap-2 font-extrabold text-slate-900">
          <Layers aria-hidden="true" className="size-5 text-rose-600" /> 만든 것 한눈에
        </h3>
        <p className="t-meta break-keep text-slate-500">롱폼 · 릴스 · 틱톡 · 스레드 — 어디서 만들었든 최근 것부터 · 누르면 그 글이 바로 열려요</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="형식" data-testid="mk-allmade-kinds">
        {(['all', 'long', 'short', 'thread'] as const).map((k) => {
          const on = kind === k
          const n = k === 'all' ? all.length : count(k)
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setKind(k)
                setMore(false)
              }}
              className={`tap t-sub inline-flex min-h-10 items-center gap-1 rounded-full border px-3 font-semibold ${on ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'}`}
              data-testid="mk-allmade-kind"
              data-kind={k}
            >
              {k === 'all' ? '전체' : KIND[k].label} <span className={on ? 'text-white/85' : 'text-slate-400'}>{loading && k !== 'long' && k !== 'all' ? '…' : n}</span>
            </button>
          )
        })}
      </div>
      {failed.length > 0 && <p className="t-meta text-warning-700">{failed.join(' · ')} 기록을 읽지 못했어요 — 나머지만 보여요.</p>}
      {shown.length === 0 ? (
        <p className="t-sub rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-3 break-keep text-slate-500" data-testid="mk-allmade-empty">
          {loading ? '읽는 중…' : kind === 'all' ? '아직 만든 글이 없어요 — 이번 주 키워드에서 하나 고르거나 1주일치를 한 번에 만들어 보세요.' : `아직 ${KIND[kind].label} 글이 없어요.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="mk-allmade-list">
          {shown.slice(0, limit).map((x) => {
            const K = KIND[x.kind]
            return (
              <li key={`${x.kind}-${x.id}`}>
                <Link to={x.href} className="tap flex min-w-0 items-center gap-2.5 py-2 hover:bg-slate-50" data-testid="mk-allmade-item" data-kind={x.kind}>
                  <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ${K.tone}`}>
                    <K.icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="t-body truncate font-semibold text-slate-900">{x.title}</span>
                    <span className="t-meta truncate text-slate-500">
                      {K.label} · {x.state}
                      {when(x.at) && ` · ${when(x.at)} 만듦`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {shown.length > limit && (
          <button type="button" onClick={() => setMore(true)} className="tap t-sub font-semibold text-rose-700 hover:underline" data-testid="mk-allmade-more">
            {shown.length - limit}개 더 보기
          </button>
        )}
        {kind !== 'all' && kind !== 'long' && (
          <Link to={KIND[kind].list} className="tap t-sub inline-flex items-center font-semibold text-slate-600 hover:text-rose-700 hover:underline" data-testid="mk-allmade-list-link">
            {KIND[kind].listLabel}에서 숫자까지 보기 →
          </Link>
        )}
      </div>
    </section>
  )
}
