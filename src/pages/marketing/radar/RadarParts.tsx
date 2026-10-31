/**
 * 콘텐츠 레이더 화면 조각 (D-194) — 축 배지 · 신호 세기 · 썸네일 · 영상 한 줄 · 영상 상세 창.
 * 숫자 점수는 없다 — 신호는 '강함 · 보통 · 초기' 세 칸 막대와 글로만.
 */
import { useState } from 'react'
import { ExternalLink, Flame, PlayCircle, UserRound, type LucideIcon } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { VideoStudy, type StudyProps } from './VideoStudy'
import { Badge } from '../../../components/ui/primitives'
import { dateKo, fmt, shortNum } from '../../../services/marketing/ytBench'
import { TOPIC_BY_ID } from '../../../services/marketing/radarPlaybook'
import {
  AXIS_LABEL,
  DOMAIN_LABEL,
  FORMAT_LABEL,
  GROUP_LABEL,
  PATTERN_LABEL,
  STRENGTH_LABEL,
  expectedShare,
  lessonsOf,
  ratioLine,
  tierLabel,
  type Cluster,
  type ContentAxis,
  type ContentDomain,
  type RadarVideo,
  type Strength,
} from '../../../services/marketing/ytRadar'

export function AxisBadge({ axis }: { axis: ContentAxis }) {
  const cls =
    axis === 'bridge'
      ? 'border-slate-300 bg-white text-slate-800'
      : axis === 'axai'
        ? 'border-brand-200 bg-brand-50 text-brand-800'
        : 'border-slate-300 bg-slate-50 text-slate-700'
  return (
    <span className={`t-meta inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-bold ${cls}`} data-testid="radar-axis">
      {AXIS_LABEL[axis]}
    </span>
  )
}

const CHIP_TONE = {
  rose: 'bg-rose-100 text-rose-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-600',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-600',
  amber: 'bg-amber-100 text-amber-700',
} as const
export type ChipTone = keyof typeof CHIP_TONE

/** 구역 제목 앞 색 아이콘(D-197 대표 요청 — 제목이 눈에 띄게) */
export function IconChip({ icon: Icon, tone, size = 'md' }: { icon: LucideIcon; tone: ChipTone; size?: 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-lg ${CHIP_TONE[tone]} ${size === 'lg' ? 'size-9' : 'size-7'}`}>
      <Icon className={size === 'lg' ? 'size-5' : 'size-4'} />
    </span>
  )
}

/** 내용 영역(경제 · 경영) — 시장수요 · BRIDGE 카드에만(AX · AI 카드는 축 배지가 이미 말한다 · D-197) */
export function DomainBadge({ axis, domain }: { axis: ContentAxis; domain: ContentDomain }) {
  if (axis === 'axai' || domain === 'ai' || domain === 'other') return null
  return (
    <span className="t-meta inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600" data-testid="radar-domain-badge" data-domain={domain}>
      {DOMAIN_LABEL[domain]}
    </span>
  )
}

/** 신호 세기 — 세 칸 막대 + 글 */
export function StrengthMeter({ strength }: { strength: Strength }) {
  const n = strength === 'strong' ? 3 : strength === 'medium' ? 2 : 1
  const on = strength === 'strong' ? 'bg-red-500' : strength === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <span className="t-meta inline-flex shrink-0 items-center gap-1.5 font-semibold text-slate-700" data-testid="radar-strength" data-strength={strength}>
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-1 rounded-sm ${i < n ? on : 'bg-slate-200'}`} style={{ height: 6 + i * 3 }} />
        ))}
      </span>
      {STRENGTH_LABEL[strength]}
    </span>
  )
}

export function Thumb({ v, noThumb, className = '' }: { v: Pick<RadarVideo, 'thumb' | 'title'>; noThumb?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={`relative block aspect-video overflow-hidden rounded-[6px] bg-slate-100 ${className}`}>
      {noThumb || broken ? (
        <span className="flex size-full items-center justify-center text-slate-300">
          <PlayCircle aria-hidden="true" className="size-8" />
        </span>
      ) : (
        <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full object-cover" />
      )}
    </span>
  )
}

/** '평소보다 6.2배' 칩 — 터진 영상만 붉게 */
export function RatioChip({ v }: { v: RadarVideo }) {
  if (v.ratio === null) return <span className="t-meta text-slate-400">평소 기준 부족</span>
  const hot = v.tier === 'breakout'
  return (
    <span className={`t-meta inline-flex items-center gap-0.5 font-bold ${hot ? 'text-red-700' : v.tier === 'above' ? 'text-amber-800' : 'text-slate-600'}`} data-testid={hot ? 'radar-breakout-chip' : undefined}>
      {hot && <Flame aria-hidden="true" className="size-3.5" />}
      {ratioLine(v)}
    </span>
  )
}

/** 영상 한 줄(썸네일 작게 + 제목 + 채널 + 배수) — 누르면 상세 */
export function VideoRow({ v, onOpen, noThumb }: { v: RadarVideo; onOpen: (v: RadarVideo) => void; noThumb?: boolean }) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={() => onOpen(v)} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-card) px-1 py-1.5 text-left hover:bg-slate-50" data-testid="radar-video-row">
        <Thumb v={v} noThumb={noThumb} className="w-24 shrink-0 sm:w-28" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-sub line-clamp-2 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{v.title}</span>
          <span className="t-meta truncate text-slate-500">
            {v.channelName} · 구독자 {shortNum(v.channelSubs)} · {v.isShort ? '쇼츠' : '롱폼'}
          </span>
          <RatioChip v={v} />
        </span>
      </button>
    </li>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
      <span className="t-meta text-slate-500">{label}</span>
      <span className="t-sub font-bold break-keep text-slate-900 tabular-nums">{value}</span>
      {sub && <span className="t-meta break-keep text-slate-500">{sub}</span>}
    </div>
  )
}

const lengthText = (sec: number) => (sec < 60 ? `${sec}초` : sec < 3600 ? `${Math.floor(sec / 60)}분 ${sec % 60 ? `${sec % 60}초` : ''}`.trim() : `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`)

/**
 * 벤치마킹 영상 상세 — 숫자 · 평소 대비 · 조회 속도 · 채널 안 순위 · 주제 · 제목 구조 · 참고할 것(규칙 문장).
 * D-259 · D-260 study 를 주면(대표) 아래에 [대본 받아 적기] · [AI로 우리 회사 버전 만들기].
 */
export function VideoDetail({ v, clusters, onClose, noThumb, study }: { v: RadarVideo | null; clusters: readonly Cluster[]; onClose: () => void; noThumb?: boolean; study?: StudyProps }) {
  if (!v) return null
  const lessons = lessonsOf(v, clusters)
  const share = Math.round(expectedShare(v.ageDays) * 100)
  return (
    <Modal open title="벤치마킹 영상" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4" data-testid="radar-video-detail">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Thumb v={v} noThumb={noThumb} className="w-full sm:w-64 sm:shrink-0" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{v.title}</p>
            <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
              <span className="font-semibold text-slate-800">{v.channelName}</span>
              <Badge>{GROUP_LABEL[v.group]}</Badge>
              {!v.mine && (
                <Badge tone={v.added ? 'warning' : 'neutral'}>
                  <span data-testid="radar-detail-source" data-added={v.added ? '1' : '0'}>
                    {v.added ? '내가 추가' : '기본 벤치마킹'}
                  </span>
                </Badge>
              )}
              {v.mine && (
                <Badge tone="warning">
                  <UserRound aria-hidden="true" className="size-3" /> 내 채널
                </Badge>
              )}
            </p>
            <p className="t-sub text-slate-500">
              {dateKo(v.publishedAt)} · {v.isShort ? '쇼츠' : '롱폼'} {lengthText(v.durationSec)}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`t-sub rounded-full px-2.5 py-1 font-bold ${v.tier === 'breakout' ? 'bg-red-50 text-red-700' : v.tier === 'above' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`} data-testid="radar-detail-tier">
                {tierLabel[v.tier]} · {ratioLine(v)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="조회수" value={`${fmt(v.views)}회`} />
          <Stat label="좋아요 · 댓글" value={`${shortNum(v.likes)} · ${shortNum(v.comments)}`} sub={`좋아요율 ${v.likeRate.toFixed(1)}%`} />
          <Stat label="구독자" value={`${shortNum(v.channelSubs)}명`} sub={v.channelSubs > 0 ? `조회수가 구독자의 ${v.viewsPerSub.toFixed(1)}배` : undefined} />
          <Stat label="평소(같은 형식 중앙값)" value={v.baseline === null ? '기준 부족' : `${fmt(v.baseline)}회`} sub={v.baseline === null ? '7일 넘은 같은 형식 영상이 3편 안 됨' : `이 채널 7일 넘은 ${v.isShort ? '쇼츠' : '롱폼'} ${v.baselineN}편`} />
          <Stat label="조회 속도" value={`하루 평균 ${shortNum(Math.round(v.perDay))}회`} sub={`올린 지 ${Math.max(1, Math.floor(v.ageDays))}일`} />
          <Stat label="채널 안 순위" value={`${v.rank}위 / ${v.rankOf}편`} sub={`받아 온 ${v.isShort ? '쇼츠' : '롱폼'} 중`} />
        </div>

        {v.young && v.ratio !== null && (
          <p className="t-meta rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">
            올린 지 {Math.max(1, Math.floor(v.ageDays))}일 된 영상은 보통 평소의 {share}% 쯤까지 쌓입니다(받아 온 영상들로 잰 값) — 그 기준으로 보면 평소의 {(v.adjusted ?? 0).toFixed(1)}배 속도입니다.
          </p>
        )}

        {(v.topics.length > 0 || v.patterns.length > 0 || v.formats.length > 0) && (
          <div className="flex flex-wrap gap-1.5" data-testid="radar-detail-tags">
            {v.domains.map((d) => (
              <Badge key={d} tone={d === 'other' ? 'neutral' : 'success'}>
                영역 · {DOMAIN_LABEL[d]}
              </Badge>
            ))}
            {v.formats.map((f) => (
              <Badge key={f}>형식 · {FORMAT_LABEL[f]}</Badge>
            ))}
            {v.topics.map((t) => (
              <Badge key={t} tone="brand">
                주제 · {TOPIC_BY_ID.get(t)?.label ?? t}
              </Badge>
            ))}
            {v.patterns.map((p) => (
              <Badge key={p}>제목 · {PATTERN_LABEL[p] ?? p}</Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="t-sub font-bold text-slate-900">이 영상에서 참고할 것</p>
          <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="radar-lessons">
            {lessons.map((l) => (
              <li key={l} className="t-sub break-keep text-slate-700">
                {l}
              </li>
            ))}
          </ul>
          <p className="t-meta text-slate-400">제목 · 대사를 그대로 쓰지 않고 주제 · 구조 · 표현 방식만 참고합니다.</p>
        </div>

        {study && <VideoStudy key={v.id} v={v} lessons={lessons} study={study} />}

        <a href={v.url} target="_blank" rel="noopener noreferrer" className="tap t-sub inline-flex items-center justify-center gap-1.5 self-start rounded-(--radius-control) border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:border-brand-400" data-testid="radar-open-youtube">
          <ExternalLink aria-hidden="true" className="size-4" /> 유튜브에서 보기
        </a>
      </div>
    </Modal>
  )
}
