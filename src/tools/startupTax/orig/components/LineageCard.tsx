import type { Lineage } from '../../types'
import { formatAge } from '../../lib/lineage'
import { formatKoreanDate } from '../../lib/date'

// 창업일 승계 분석 — 법인전환·양수·승계 시 실질 창업일과 업력/잔여 감면기간
export default function LineageCard({ lineage }: { lineage: Lineage }) {
  // 신규 창업이고 업력도 7년 이내면 특별히 알릴 내용이 없어 숨긴다
  if (!lineage.inherited && lineage.within7Years !== false) return null

  const warn = lineage.needsOriginalDate || lineage.within7Years === false

  return (
    <div
      className={`rounded-3xl border p-5 shadow-card sm:p-6 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-indigo-200 bg-indigo-50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🔗</span>
        <h3 className="text-xl font-bold text-gray-900">창업일 승계 분석</h3>
      </div>

      <p className="mt-2 text-base leading-relaxed text-gray-700">{lineage.effectiveStartLabel}</p>

      {!lineage.needsOriginalDate && lineage.effectiveStartDate && (
        <div className="mt-3.5 space-y-2">
          <Row label="실질 창업일" value={formatKoreanDate(lineage.effectiveStartDate)} />
          <Row label="업력" value={formatAge(lineage.businessAgeYears)} />
          <Row
            label="창업기업 업력 7년"
            value={lineage.within7Years ? '이내 (요건 충족 가능)' : '초과 (요건 미충족 가능성)'}
            tone={lineage.within7Years ? 'good' : 'bad'}
          />
          <Row
            label="세액감면 5년 잔여"
            value={
              lineage.hasTaxRemaining
                ? `약 ${formatAge(lineage.taxRemainingYears)} 남음`
                : '기간 경과 가능성'
            }
            tone={lineage.hasTaxRemaining ? 'good' : 'bad'}
          />
        </div>
      )}

      {lineage.needsOriginalDate && (
        <p className="mt-3 rounded-2xl bg-white/80 p-3.5 text-base font-medium text-amber-800">
          상세 입력에서 <b>기존 개인사업 최초 개시일</b>을 넣으면 업력과 감면 잔여기간을 계산해
          드립니다.
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900'
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3">
      <span className="text-base font-medium text-gray-500">{label}</span>
      <span className={`text-base font-bold ${color}`}>{value}</span>
    </div>
  )
}
