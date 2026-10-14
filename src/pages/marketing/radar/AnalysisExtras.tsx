/**
 * 분석 탭에 더한 것 (D-194) — 내 채널(최근 20편) · 이번 달 잘된 제목 구조.
 * Data API 로 알 수 없는 노출 클릭률(CTR) · 시청 지속시간 · 평균 시청 비율은 어림하지 않는다 — 'Analytics 연결 뒤' 라고 적는다.
 */
import { Fold } from '../../../components/ui/fold'
import { fmt, shortNum } from '../../../services/marketing/ytBench'
import type { MyChannelStats, PatternStat } from '../../../services/marketing/ytRadar'

function Row({ a, b, c }: { a: string; b: string; c?: string }) {
  return (
    <>
      <span className="t-sub min-w-0 break-keep text-slate-700">{a}</span>
      <span className="t-sub text-right font-semibold break-keep text-slate-900 tabular-nums">{b}</span>
      <span className="t-meta text-right break-keep text-slate-500">{c ?? ''}</span>
    </>
  )
}

export function MyChannelCard({ s }: { s: MyChannelStats | null }) {
  return (
    <Fold panel id="radar.mine" title="내 채널(최근 20편)" defaultOpen summary={s ? `롱폼 평소 ${s.longMedian === null ? '—' : `${shortNum(s.longMedian)}회`} · 쇼츠 평소 ${s.shortMedian === null ? '—' : `${shortNum(s.shortMedian)}회`}` : '내 채널 영상이 없습니다'} testId="radar-mine">
      {!s ? (
        <p className="t-sub text-slate-500">받아 온 데이터에 내 채널 영상이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
            <Row a="평소 조회수 · 롱폼" b={s.longMedian === null ? '—' : `${fmt(s.longMedian)}회`} c={`${s.longCount}편 중앙값`} />
            <Row a="평소 조회수 · 쇼츠" b={s.shortMedian === null ? '—' : `${fmt(s.shortMedian)}회`} c={`${s.shortCount}편 중앙값`} />
            <Row a="평소 조회 속도" b={`하루 ${fmt(Math.round(s.perDayMedian))}회`} c="올린 뒤 하루 평균의 중앙값" />
            <Row a="가장 잘된 주제" b={s.bestTopic ? s.bestTopic.label : '아직 모름'} c={s.bestTopic ? `${s.bestTopic.count}편 · 중앙값 ${shortNum(s.bestTopic.median)}회` : '같은 주제 2편 넘게 필요'} />
            <Row a="가장 잘된 제목 구조" b={s.bestPattern ? s.bestPattern.label : '아직 모름'} c={s.bestPattern ? `${s.bestPattern.count}편 · 중앙값 ${shortNum(s.bestPattern.median)}회` : ''} />
            <Row a="잘된 길이" b={s.bestLength ? s.bestLength.label : '아직 모름'} c={s.bestLength ? `${s.bestLength.count}편 · 중앙값 ${shortNum(s.bestLength.median)}회` : ''} />
            <Row a="업로드 주기" b={s.cadenceDays === null ? '데이터 부족' : `${s.cadenceDays.toFixed(1)}일에 한 편`} c={`최근 ${s.count}편 기준`} />
          </div>
          <p className="t-meta rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600" data-testid="radar-analytics-note">
            시청 지속시간 · 노출 클릭률 분석은 추후 YouTube Analytics 연결 예정입니다(지금 받는 공개 데이터로는 알 수 없어 어림하지 않습니다).
          </p>
        </div>
      )}
    </Fold>
  )
}

export function HotPatternsCard({ stats }: { stats: PatternStat[] }) {
  const top = stats[0]
  return (
    <Fold panel id="radar.patterns" title="이번 달 잘된 제목 구조" defaultOpen={false} summary={top ? `1위 ${top.label} · 잘된 영상 ${top.hotOf}편 중 ${top.hot}편` : '평소보다 잘된 영상이 아직 없습니다'} testId="radar-patterns">
      {stats.length === 0 ? (
        <p className="t-sub text-slate-500">최근 30일에 평소보다 2배 넘게 잘된 영상이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5">
          <span className="t-meta text-slate-400">제목 구조</span>
          <span className="t-meta text-right font-semibold text-slate-500">잘된 영상 중</span>
          <span className="t-meta text-right font-semibold text-slate-500">전체 영상 중</span>
          {stats.map((p) => (
            <Row key={p.id} a={p.label} b={`${p.hot}편 · ${p.hotShare}%`} c={`${p.baseShare}%`} />
          ))}
        </div>
      )}
    </Fold>
  )
}
