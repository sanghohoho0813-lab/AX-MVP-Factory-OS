/**
 * D-566 마케팅 처음 시작 길 — 대표가 아닌 계정(팀장 · 구독 고객)의 마케팅 첫 화면에 '지금 할 한 가지'.
 * 대표(2026-11-10): "어디서부터 어떻게 시작해야 할지 모르는 사람이 대부분 — 이 OS 안에서 해결하고, 교육적으로도 좋고, 매일 들어와서 하게."
 *
 *  - 다섯 걸음을 다 하기 전: '고객 모으기 n/5 · 다음: …' + 왜 하나요 한 줄 + 큰 단추 하나 + 걸음 점(✓).
 *  - 다 한 뒤: '오늘의 한 가지'(요일마다 하나) + 이번 주 올린 편 수 — 매일 한 번 눌러 하게.
 *  - 실제 기록으로 본다(내 브랜드 · 담은 주제 · 써 둔 글 · 올린 표시) — 따로 저장하는 진행 기록 없음. 읽기만 한다.
 *  - 첫 설정 칸(MkStart)이 보이는 동안에는 그리지 않는다(같은 말을 두 번 하지 않게).
 *  - D-574 한 편이라도 올린 뒤부터: '이번 달 새로 적은 고객 n곳 · 글을 보고 온 곳 m곳' + [잠재고객으로 적어 두기](영업 관리 등록 창).
 * 규칙 화면이다 — AI 를 부르지 않는다.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isBrandEmpty, useBrandProfile } from '../../../services/brandProfile'
import { listThreadPosts } from '../../../services/marketing/threads'
import { listShortPosts } from '../../../services/marketing/shorts'
import { LEAD_FROM_CONTENT_HREF, dailyMission, leadsThisMonth, mkPathNext, mkPathSteps, postedThisWeek, weekdayOf } from '../../../services/marketing/mkPath'
import { listClients } from '../../../services/clientOpsService'
import { localDateOf, todayLocalDate } from '../../../lib/appClock'
import { MARKETING_BASICS, readBasics } from '../../../content/marketingBasics'

interface Post {
  status: string
  postedOn: string
}

export function MkPath({ workspaceId, ideas, interests, prefsReady }: { workspaceId: string | null; ideas: number; interests: number; prefsReady: boolean }) {
  const brand = useBrandProfile()
  const [posts, setPosts] = useState<Post[] | null>(null)
  /** D-574 이번 달에 적은 업체(유입 경로와 함께) — 못 읽으면 숫자 없이 길만 보인다(읽기만) */
  const [leads, setLeads] = useState<Array<{ day: string; source: string }> | null>(null)
  useEffect(() => {
    let alive = true
    setLeads(null)
    void listClients(workspaceId)
      .then((list) => {
        if (alive) setLeads(list.filter((c) => !c.archivedAt).map((c) => ({ day: localDateOf(c.createdAt), source: c.sales?.source ?? '' })))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [workspaceId])
  useEffect(() => {
    let alive = true
    setPosts(null)
    // 한쪽을 못 읽어도 다른 쪽으로 그린다(읽기만 — 쓰지 않는다)
    void Promise.all([listThreadPosts(workspaceId).catch(() => []), listShortPosts(workspaceId).catch(() => [])]).then(([t, s]) => {
      if (alive) setPosts([...t, ...s].map((p) => ({ status: p.status, postedOn: p.postedOn })))
    })
    return () => {
      alive = false
    }
  }, [workspaceId])

  const today = todayLocalDate()
  const ready = prefsReady && brand.loaded && brand.workspaceId === workspaceId && posts !== null
  const steps = useMemo(
    () =>
      mkPathSteps({
        channel: !isBrandEmpty(brand.profile) || interests > 0,
        ideas,
        written: posts?.length ?? 0,
        posted: (posts ?? []).filter((p) => p.status === 'posted').length,
        ending: brand.profile.ending.trim().length > 0,
      }),
    [brand.profile, interests, ideas, posts],
  )
  if (!ready) return null
  // 첫 설정 칸(MkStart)이 그 일을 하는 동안에는 겹치지 않게
  if (!steps[0].done && isBrandEmpty(brand.profile) && interests === 0) return null

  const next = mkPathNext(steps)
  const done = steps.filter((s) => s.done).length
  const box = 'flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 sm:px-5'
  // D-571 왜 이렇게 하는지 더 알고 싶은 사람에게 — 기초 7가지(읽은 수는 이 브라우저에 기억)
  const readCount = readBasics().length
  const basics = (
    <p className="t-sub break-keep text-slate-700" data-testid="mk-path-basics">
      {readCount >= MARKETING_BASICS.length ? '기초 7가지를 다 읽으셨어요 — ' : '처음이라면 — '}
      <Link to="/marketing/basics" className="font-bold text-brand-700 hover:underline">
        고객 모으기 기초 7가지(5분){readCount > 0 && readCount < MARKETING_BASICS.length ? ` · ${readCount}/${MARKETING_BASICS.length} 읽음` : readCount >= MARKETING_BASICS.length ? ' 다시 보기' : ''}
      </Link>
    </p>
  )

  // D-574 글의 끝은 고객 — 한 편이라도 올린 뒤부터: 이번 달 새로 적은 고객 · 글을 보고 온 곳 + [잠재고객으로 적어 두기]
  const postedAny = (posts ?? []).some((p) => p.status === 'posted')
  const lead = leads ? leadsThisMonth(leads, today) : null
  const leadLine = postedAny && (
    <p className="t-sub break-keep text-slate-700" data-testid="mk-path-leads" data-all={lead?.all ?? ''} data-content={lead?.fromContent ?? ''}>
      {lead && (
        <>
          이번 달 새로 적은 고객 <strong className="font-bold text-slate-900">{lead.all}곳</strong>
          {lead.all > 0 && (
            <>
              {' '}
              · 글을 보고 온 곳 <strong className="font-bold text-slate-900">{lead.fromContent}곳</strong>
            </>
          )}
          {' — '}
        </>
      )}
      글을 보고 연락이 왔나요?{' '}
      <Link to={LEAD_FROM_CONTENT_HREF} className="font-bold text-brand-700 hover:underline" data-testid="mk-path-lead-add" data-guide="fn-mk-lead">
        잠재고객으로 적어 두기
      </Link>
    </p>
  )

  if (!next) {
    const m = dailyMission(weekdayOf(today))
    const n = postedThisWeek(posts ?? [], today)
    return (
      <section className={box} aria-label="오늘의 한 가지" data-testid="mk-path" data-mode="daily" data-mission={m.key}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
            <span className="t-sub font-bold text-brand-700">오늘의 한 가지</span>
            <span className="t-section break-keep text-slate-900" data-testid="mk-path-title">
              {m.title}
            </span>
            <span className="t-sub break-keep text-slate-700" data-testid="mk-path-why">
              {m.why}
            </span>
          </span>
          <Link to={m.href} className="tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-testid="mk-path-go">
            {m.action} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <p className="t-sub break-keep text-slate-700" data-testid="mk-path-week">
          이번 주 올린 것 <strong className="font-bold text-slate-900">{n}편</strong>
          {n === 0 ? ' — 오늘 한 편부터 시작해요.' : n >= 3 ? ' — 잘하고 계세요. 꾸준함이 고객을 데려와요.' : ' — 한 주에 세 편이면 충분해요.'}
        </p>
        {leadLine}
        {basics}
      </section>
    )
  }

  return (
    <section className={box} aria-label="고객 모으기 시작 길" data-testid="mk-path" data-mode="steps" data-next={next.key}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
          <span className="t-sub font-bold text-brand-700" data-testid="mk-path-count">
            고객 모으기 시작 {done}/{steps.length}
          </span>
          <span className="t-section break-keep text-slate-900" data-testid="mk-path-title">
            다음: {next.title}
          </span>
          <span className="t-sub break-keep text-slate-700" data-testid="mk-path-why">
            {next.why}
          </span>
        </span>
        <Link to={next.href} className="tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-testid="mk-path-go">
          {next.action} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ol className="flex flex-wrap gap-x-3 gap-y-1" aria-label="시작 걸음">
        {steps.map((s, i) => (
          <li key={s.key} className={`t-sub inline-flex items-center gap-1 ${s.done ? 'text-success-700' : s.key === next.key ? 'font-bold text-slate-900' : 'text-slate-600'}`} data-testid="mk-path-step" data-step={s.key} data-done={s.done ? '1' : '0'}>
            {s.done ? <Check aria-hidden="true" className="size-4" /> : <span aria-hidden="true" className="tabular-nums">{i + 1}</span>}
            {s.title}
          </li>
        ))}
      </ol>
      {leadLine}
      {basics}
    </section>
  )
}
