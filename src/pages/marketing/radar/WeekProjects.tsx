/**
 * D-350 내 콘텐츠 맨 위 '1주일치 묶음'(D-356 이름 '1주일치 프로젝트' — 대표 "프로젝트 박스 하나, 들어가면 롱폼 · 릴스 · 스레드 나눠서") — 대표: "일주일치 콘텐츠 쓰면 내 콘텐츠에 프로젝트식으로, 누르면 써 준 내용이 싹 다 보이게.
 *        롱폼은 어디 저장돼 있는지 모르겠고, 스레드는 기록표에 … 여기저기 분산돼 있어서 더 헷갈려".
 * 주마다 카드 하나(만든 주 · 짝 셋 · 롱폼 · 쇼츠 · 스레드 몇 개 · 쓰는 중이면 진행) — [열기] 를 누르면 그 주 1주일치 화면에 전부.
 * 이 브라우저 · 클라우드(다른 기기에서 만든 주)를 합쳐 최근 주부터.
 */
import { useMemo, useSyncExternalStore } from 'react'
import { AtSign, CalendarRange, ChevronRight, Film, Loader2, MonitorPlay } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { dayLabel, weekStart } from '../../../services/marketing/weekPlan'
import { weekCounts } from '../../../services/marketing/weekCollect'
import { activeWeekRun, allWeeks, subscribeWeek, weekRun, weekVersion } from '../../../services/marketing/weekRun'
import { todayLocalDate } from '../../../lib/appClock'

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function WeekProjects({ onOpen, onMake }: { onOpen: (start: string) => void; onMake: () => void }) {
  const version = useSyncExternalStore(subscribeWeek, weekVersion)
  const current = weekStart(todayLocalDate())
  const weeks = useMemo(() => {
    const list = allWeeks()
    // 쓰기 시작했는데 아직 답이 하나도 안 온 주도 카드로(누르면 진행이 보인다)
    const run = activeWeekRun()
    if (run && !list.some((w) => w.start === run.start)) return [{ start: run.start, saved: null }, ...list.map((w) => ({ start: w.start, saved: w }))]
    return list.map((w) => ({ start: w.start, saved: w }))
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" aria-labelledby="mk-projects-h" data-testid="mk-projects">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="mk-projects-h" className="t-card flex items-center gap-2 font-extrabold text-violet-950">
          <CalendarRange aria-hidden="true" className="size-5 text-violet-700" /> 1주일치 프로젝트
        </h3>
        <p className="t-meta break-keep text-violet-900">누르면 그 주 프로젝트 안에서 롱폼 · 릴스 · 스레드를 탭으로 나눠 봐요 · 다른 기기에서 만든 것도</p>
      </div>
      {weeks.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-dashed border-violet-300 bg-white px-3 py-3" data-testid="mk-projects-empty">
          <p className="t-sub min-w-0 flex-1 basis-60 break-keep text-slate-700">아직 만든 1주일치가 없어요 — 이번 주 키워드에서 [1주일치 콘텐츠 한 번에 만들기] 를 누르면 여기에 주마다 쌓여요.</p>
          <Button size="sm" variant="secondary" onClick={onMake} data-testid="mk-projects-make">
            1주일치 만들러 가기
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {weeks.map(({ start, saved }) => {
            const run = weekRun(start)
            const running = Object.values(run.parts).includes('running')
            const done = Object.values(run.parts).filter((s) => s === 'done').length
            const c = saved ? weekCounts(saved) : { long: 0, shorts: 0, threads: 0 }
            return (
              <li key={start} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(start)}
                  className="tap flex h-full w-full min-w-0 flex-col gap-2 rounded-(--radius-card) border border-violet-200 bg-white p-3 text-left shadow-(--shadow-card) hover:border-violet-400"
                  data-testid="mk-project"
                  data-start={start}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="t-sub font-extrabold text-slate-900">
                      {dayLabel(start, 1)} ~ {dayLabel(start, 7)}
                    </span>
                    {start === current && <span className="t-meta rounded-full bg-violet-600 px-2 py-0.5 font-bold text-white">이번에 올릴 주</span>}
                    {running ? (
                      <span className="t-meta inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900" data-testid="mk-project-running">
                        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> 쓰는 중 {done}/6
                      </span>
                    ) : (
                      saved && <span className="t-meta text-slate-500">{[saved.model, when(saved.at)].filter(Boolean).join(' · ')}</span>
                    )}
                    <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-violet-600" />
                  </span>
                  {saved && saved.topics.length > 0 && (
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {saved.topics.map((t, i) => (
                        <span key={`${t}-${i}`} className="t-meta min-w-0 break-keep text-slate-700 [overflow-wrap:anywhere]">
                          <b className="text-violet-800">짝 {i + 1}</b> {t}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="flex flex-wrap gap-1.5" data-testid="mk-project-counts">
                    <Count icon={MonitorPlay} label="롱폼" n={c.long} of={1} />
                    <Count icon={Film} label="쇼츠 · 릴스" n={c.shorts} of={3} />
                    <Count icon={AtSign} label="스레드" n={c.threads} of={7} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Count({ icon: Icon, label, n, of }: { icon: typeof Film; label: string; n: number; of: number }) {
  return (
    <span className={`t-meta inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${n ? 'bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-500'}`}>
      <Icon aria-hidden="true" className="size-3.5" /> {label} {n}/{of}
    </span>
  )
}
