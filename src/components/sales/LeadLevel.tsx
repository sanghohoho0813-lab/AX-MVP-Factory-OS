/**
 * 영업 중요도 5단계 (D-123) — 점수(예: 64점) 대신 색 다섯 칸.
 *
 * 대표 지시: "점수로 하는 거는 별로. 5단계로 나눠서 색깔별로 — 제일 중요한 것은 빨간색, 그 다음 주황 · 노랑 · 초록 · 파랑."
 * 계산은 그대로(원본 규칙 scoreLead → scoreTier 다섯 등급). 숫자는 화면에 보이지 않는다(시험용으로 data-score 에만).
 */
import type { ScoreTierKey } from '../../services/salesEngine'

interface LeadLevelInfo {
  n: 1 | 2 | 3 | 4 | 5
  label: string
  hint: string
  dot: string
  pill: string
}

const LEAD_LEVELS: Record<ScoreTierKey, LeadLevelInfo> = {
  high: { n: 1, label: '계약 가능성 높음', hint: '지금 바로 챙기세요', dot: 'bg-red-600', pill: 'border-red-300 bg-red-50 text-red-800' },
  chase: { n: 2, label: '적극 추적', hint: '자주 연락하세요', dot: 'bg-orange-500', pill: 'border-orange-300 bg-orange-50 text-orange-800' },
  nurture: { n: 3, label: '관심 끌기', hint: '관심을 키울 자료를 보내세요', dot: 'bg-yellow-400', pill: 'border-yellow-300 bg-yellow-50 text-yellow-900' },
  long: { n: 4, label: '길게 보기', hint: '가끔 소식을 전하세요', dot: 'bg-green-600', pill: 'border-green-300 bg-green-50 text-green-800' },
  low: { n: 5, label: '지켜보기', hint: '지금은 서두르지 않아도 됩니다', dot: 'bg-blue-600', pill: 'border-blue-300 bg-blue-50 text-blue-800' },
}

const ORDER: ScoreTierKey[] = ['high', 'chase', 'nurture', 'long', 'low']

export function LeadLevel({ tier, score, withHint = false }: { tier: ScoreTierKey; score: number; withHint?: boolean }) {
  const lv = LEAD_LEVELS[tier]
  return (
    <span
      data-testid="lead-score"
      data-level={lv.n}
      data-score={score}
      title={`영업 중요도 ${lv.n}단계(5단계 중) — ${lv.hint}`}
      className={`t-sub inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-bold ${lv.pill}`}
    >
      {/* 다섯 칸 — 지금 단계만 진하게 */}
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {ORDER.map((k) => (
          <span key={k} className={`rounded-full ${LEAD_LEVELS[k].dot} ${k === tier ? 'size-2.5 ring-2 ring-white' : 'size-1.5 opacity-35'}`} />
        ))}
      </span>
      {lv.label}
      {withHint && <span className="font-medium opacity-80">· {lv.hint}</span>}
    </span>
  )
}
