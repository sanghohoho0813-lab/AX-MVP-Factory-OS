import type { FormData, JudgementResult } from '../../types'
import { VERDICT_LABEL } from '../../lib/judgement'
import { VERDICT_PRINT_COLOR } from '../../lib/verdictStyle'
import { LABEL, labelOf } from '../../lib/options'
import { formatDate, formatKoreanDate } from '../../lib/date'

interface Props {
  form: FormData
  result: JudgementResult
  baseDate: Date
}

// A4 1페이지 「창업감면 사전진단 결과서」 — 고객 발송 가능한 보고서 수준
// 화면에서는 숨기고(hidden) 인쇄 시에만 표시(print:block)된다.
export default function PrintSheet({ form, result, baseDate }: Props) {
  const today = formatDate(baseDate)
  const verdictColor = VERDICT_PRINT_COLOR[result.overall]

  return (
    <div className="print-area hidden bg-white text-[11px] leading-snug text-gray-900 print:block">
      {/* 머리글 */}
      <div className="flex items-end justify-between border-b-[2.5px] border-gray-900 pb-2.5">
        <div>
          <div className="text-[10px] font-bold tracking-wide text-gray-500">
            세무·법인컨설팅 상담용 사전진단
          </div>
          <h1 className="mt-0.5 text-[20px] font-extrabold tracking-tight">
            창업감면 사전진단 결과서
          </h1>
        </div>
        <div className="text-right text-[10px] text-gray-600">
          <div>진단일</div>
          <div className="text-[12px] font-bold text-gray-900">{today}</div>
        </div>
      </div>

      {/* 종합판정 + 한줄결론 (대표 박스) */}
      <div
        className="mt-3 rounded-md border-l-[6px] px-4 py-3"
        style={{ borderColor: verdictColor, backgroundColor: '#f8fafc' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500">종합 판정</span>
          <span className="text-[10px] font-bold text-gray-500">
            전문가 검토 추천도 {result.expertReview.grade}등급
          </span>
        </div>
        <div className="mt-0.5 text-[18px] font-extrabold" style={{ color: verdictColor }}>
          {VERDICT_LABEL[result.overall]}
        </div>
        <p className="mt-1 text-[12px] font-semibold text-gray-800">→ {result.oneLineConclusion}</p>
        <div className="mt-1.5 flex items-center gap-2 border-t border-gray-200 pt-1.5 text-[11px]">
          <span className="font-bold text-gray-500">예상 절세 규모</span>
          <span className="font-extrabold text-amber-700">
            💰 LEVEL {result.savingsLevel.level} · {result.savingsLevel.label}
          </span>
        </div>
        {result.keyReasons.length > 0 && (
          <p className="mt-1 text-[10px] text-gray-600">
            <b>핵심 이유 · </b>
            {result.keyReasons.map((r) => `✓ ${r}`).join('   ')}
          </p>
        )}
      </div>

      {/* 입력 요약 */}
      <table className="mt-3 w-full border-collapse text-[10px]">
        <tbody>
          <Row
            cells={[
              ['사업자 유형', labelOf(LABEL.businessType, form.businessType)],
              ['대표자 나이', result.age !== null ? `만 ${result.age}세` : '-'],
            ]}
          />
          <Row
            cells={[
              ['창업일', form.startupDate ? formatKoreanDate(form.startupDate) : '-'],
              ['청년 여부', result.isYouth === null ? '-' : result.isYouth ? '해당 가능' : '미해당'],
            ]}
          />
          <Row
            cells={[
              ['사업장 지역', labelOf(LABEL.region, form.region)],
              ['과밀억제권역', labelOf(LABEL.overconcentration, form.overconcentration)],
            ]}
          />
          <Row
            cells={[
              ['업종', labelOf(LABEL.industry, form.industry)],
              ['창업 형태', labelOf(LABEL.startupForm, form.startupForm)],
            ]}
          />
        </tbody>
      </table>

      {/* 2단 레이아웃: 예상 절세 포인트 / 확인 필요사항 */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <SectionTitle>예상 절세 포인트</SectionTitle>
          <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed">
            {result.savingsPoints.map((p, i) => (
              <li key={i} style={{ color: p.tone === 'bad' ? '#dc2626' : '#15803d' }}>
                ● {p.text}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionTitle>확인 필요사항</SectionTitle>
          <ul className="mt-1 list-disc pl-4 text-[10px] leading-relaxed text-gray-700">
            {result.keyChecks.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 항목별 판정 */}
      <div className="mt-3">
        <SectionTitle>항목별 감면 판정 (종합판정 기준)</SectionTitle>
        <table className="mt-1 w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="w-[28%] border border-gray-300 px-2 py-1 text-left">항목</th>
              <th className="w-[20%] border border-gray-300 px-2 py-1 text-left">판정</th>
              <th className="border border-gray-300 px-2 py-1 text-left">주요 사유</th>
            </tr>
          </thead>
          <tbody>
            {result.coreItems.map((item) => (
              <tr key={item.key}>
                <td className="border border-gray-300 px-2 py-1 font-semibold">{item.title}</td>
                <td
                  className="border border-gray-300 px-2 py-1 font-bold"
                  style={{ color: VERDICT_PRINT_COLOR[item.verdict] }}
                >
                  {VERDICT_LABEL[item.verdict]}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-gray-700">
                  {item.reasons[0] ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.registration && (
          <p className="mt-1 text-[9px] text-gray-500">※ {result.registration.title}: {result.registration.note}</p>
        )}
      </div>

      {/* 법 기준별 판정 */}
      <div className="mt-3">
        <SectionTitle>법 기준별 판정</SectionTitle>
        <table className="mt-1 w-full border-collapse text-[10px]">
          <tbody>
            {result.frameworks.map((f) => (
              <tr key={f.key}>
                <td className="w-[34%] border border-gray-300 px-2 py-1 font-semibold">{f.title}</td>
                <td
                  className="w-[18%] border border-gray-300 px-2 py-1 font-bold"
                  style={{ color: VERDICT_PRINT_COLOR[f.verdict] }}
                >
                  {VERDICT_LABEL[f.verdict]}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-gray-700">{f.conclusion}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[9px] text-gray-600">
          청년 기준 · 조특법(만 15~34, 병역차감): {youthShort(result.youth.taxLaw)} / 창업지원법(만
          39 이하): {youthShort(result.youth.startupLaw)}
        </p>
      </div>

      {/* 상담 권장사항 */}
      <div className="mt-3">
        <SectionTitle>상담 권장사항</SectionTitle>
        <p className="mt-1 text-[10px] font-semibold text-gray-800">
          [{result.expertReview.grade}등급] {result.expertReview.label} —{' '}
          {result.expertReview.description}
        </p>
        <p className="mt-1 text-[10px] text-gray-700">
          <b>전문가 검토 시 확인 가능한 항목 · </b>
          {result.consultChecklist.map((c) => `✓ ${c}`).join('   ')}
        </p>
      </div>

      {/* 주의 문구 */}
      <p className="mt-4 border-t border-gray-300 pt-2 text-[9px] leading-relaxed text-gray-500">
        ※ 본 결과는 상담용 1차 판정이며, 실제 감면 적용 여부는 조세특례제한법·지방세특례제한법,
        업종코드, 창업 형태, 과밀억제권역 여부, 지자체 해석에 따라 달라질 수 있습니다. 최종 적용
        전 세무사 또는 관할 지자체 확인이 필요합니다.
      </p>
      <p className="mt-1 text-[9px] leading-relaxed text-gray-500">
        ※ 조특법상 창업 인정과 중소기업창업 지원법상 창업기업 확인은 판단 목적과 기준이 다를 수
        있으며, 세액감면·정책자금·창업기업확인은 각각 별도 검토가 필요합니다.
      </p>
    </div>
  )
}

function youthShort(state: boolean | null): string {
  if (state === true) return '해당 가능'
  if (state === false) return '미해당'
  return '확인 필요'
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-gray-900 pl-2 text-[12px] font-bold text-gray-900">
      {children}
    </div>
  )
}

function Row({ cells }: { cells: [string, string][] }) {
  return (
    <tr>
      {cells.map(([k, v], i) => (
        <td key={i} className="border border-gray-200 px-2 py-1">
          <span className="font-semibold text-gray-500">{k}</span>
          <span className="ml-2 text-gray-900">{v}</span>
        </td>
      ))}
    </tr>
  )
}
