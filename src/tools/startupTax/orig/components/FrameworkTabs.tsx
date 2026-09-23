import { useState } from 'react'
import type { FrameworkResult, SavingsTone } from '../../types'
import { VERDICT_LABEL } from '../../lib/judgement'
import { VERDICT_STYLE } from '../../lib/verdictStyle'

const TONE_EMOJI: Record<SavingsTone, string> = { good: '🟢', caution: '🟡', bad: '🔴' }

// 법 기준별 판정 탭 (조특법 / 창업지원법 / 지방세)
export default function FrameworkTabs({ frameworks }: { frameworks: FrameworkResult[] }) {
  const [active, setActive] = useState(0)
  const fw = frameworks[active]
  if (!fw) return null
  const s = VERDICT_STYLE[fw.verdict]

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">⚖️</span>
        <h3 className="text-xl font-bold text-gray-900">법 기준별 판정</h3>
      </div>

      {/* 탭 버튼 */}
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {frameworks.map((f, i) => {
          const on = i === active
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(i)}
              className={[
                'whitespace-pre-line rounded-2xl px-2 py-3 text-center text-sm font-bold leading-tight transition-colors sm:text-base',
                on ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              ].join(' ')}
            >
              {TAB_LABEL[f.key]}
            </button>
          )
        })}
      </div>

      {/* 활성 탭 내용 */}
      <div className="mt-4">
        <div className="text-base font-bold text-gray-900">{fw.title}</div>
        <div className="text-sm text-gray-400">{fw.subtitle}</div>

        {/* 판정 + 결론 */}
        <div className={`mt-3 rounded-2xl border ${s.border} ${s.bg} p-4`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{s.emoji}</span>
            <span className={`text-xl font-extrabold ${s.text}`}>{VERDICT_LABEL[fw.verdict]}</span>
          </div>
          <p className={`mt-1.5 text-lg font-bold leading-snug ${s.text}`}>{fw.conclusion}</p>
        </div>

        {/* 항목별 포인트 */}
        {fw.points.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {fw.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-base font-semibold text-gray-800">
                <span>{TONE_EMOJI[p.tone]}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 핵심 리스크 */}
        {fw.risks.length > 0 && (
          <div className="mt-3 rounded-2xl bg-amber-50 p-4">
            <div className="mb-1.5 text-base font-bold text-amber-800">핵심 리스크</div>
            <ul className="space-y-1.5">
              {fw.risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-base leading-relaxed text-amber-800">
                  <span>⚠️</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 확인 필요 */}
        {fw.checkPoints.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-base font-bold text-gray-800">확인 필요사항</div>
            <ul className="space-y-1.5">
              {fw.checkPoints.map((c, i) => (
                <li key={i} className="flex gap-2 text-base leading-relaxed text-gray-600">
                  <span className="text-gray-300">▸</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 기준 차이 안내 */}
        <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm leading-relaxed text-gray-500">
          {fw.note}
        </p>
      </div>
    </div>
  )
}

const TAB_LABEL: Record<string, string> = {
  taxLaw: '조특법\n(세액감면)',
  startupLaw: '창업지원법\n(정책자금)',
  localTax: '지방세\n(참고)',
}
