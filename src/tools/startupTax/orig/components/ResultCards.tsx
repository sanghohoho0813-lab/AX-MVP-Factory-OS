import { useState, type ReactNode } from 'react'
import type { JudgementResult } from '../../types'
import { DISCLAIMER, DISCLAIMER_FRAMEWORK } from '../../lib/judgement'
import { Accordion } from './ui'
import OverallCard from './OverallCard'
import KeyReasonsCard from './KeyReasonsCard'
import SavingsLevelCard from './SavingsLevelCard'
import FrameworkTabs from './FrameworkTabs'
import LineageCard from './LineageCard'
import YouthCard from './YouthCard'
import ExpertReviewCard from './ExpertReviewCard'
import SavingsCard from './SavingsCard'
import ConsultCard from './ConsultCard'
import MissedPointsCard from './MissedPointsCard'
import ContractCta from './ContractCta'
import ExclusionCard from './ExclusionCard'
import ItemCard from './ItemCard'
import RegistrationReference from './RegistrationReference'

interface Props {
  result: JudgementResult
  summaryText: string
  onBack: () => void
  onPrint: () => void
  // 이 OS 에서 더함 — '업체 기록에 붙이기' 줄
  extras?: ReactNode
}

export default function ResultCards({ result, summaryText, onBack, onPrint, extras }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = summaryText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  // 초기 노출(중요도순): 종합결론 → 핵심 이유 → 예상 절세 규모 → 검토 추천도 → 절세 포인트
  //                    → 복사/PDF → 추가 확인 항목
  // 접힘: 상담 예상 질문 / 대표님들이 놓치는 부분 / 세부 판정 근거
  return (
    <div className="flex flex-col gap-3">
      <OverallCard result={result} />
      <KeyReasonsCard reasons={result.keyReasons} />
      <SavingsLevelCard data={result.savingsLevel} />
      <LineageCard lineage={result.lineage} />
      <FrameworkTabs frameworks={result.frameworks} />
      <YouthCard youth={result.youth} />
      <ExpertReviewCard review={result.expertReview} />
      <SavingsCard points={result.savingsPoints} advice={result.savingsAdvice} />

      {/* 액션 버튼 — 항상 화면 폭에 맞게 */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleCopy}
          className="col-span-2 rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-white shadow-card transition-colors hover:bg-brand-dark"
        >
          {copied ? '✓ 복사됨' : '결과 복사하기'}
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="rounded-2xl border border-brand bg-white px-6 py-4 text-lg font-bold text-brand shadow-card transition-colors hover:bg-brand/5"
        >
          PDF 출력
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-lg font-bold text-gray-600 shadow-card transition-colors hover:bg-gray-50"
        >
          다시 입력
        </button>
      </div>

      {extras}

      {/* 추가 확인 항목 (초기 노출) */}
      {result.keyChecks.length > 0 && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-card sm:p-6">
          <h3 className="text-lg font-bold text-gray-900">추가 확인 항목</h3>
          <ul className="mt-3 space-y-1.5">
            {result.keyChecks.map((c) => (
              <li key={c} className="flex gap-2 text-base leading-relaxed text-gray-600">
                <span className="text-brand">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 접힘 영역 1: 상담 예상 질문 */}
      <Accordion title="상담 예상 질문">
        <ConsultCard questions={result.consultQuestions} />
      </Accordion>

      {/* 접힘 영역 2: 대표님들이 놓치는 부분 */}
      <Accordion title="대표님들이 놓치는 부분">
        <MissedPointsCard points={result.missedPoints} />
      </Accordion>

      {/* 접힘 영역 3: 세부 판정 근거 */}
      <Accordion title="세부 판정 근거">
        <div className="flex flex-col gap-3">
          {result.coreItems.map((item) => (
            <ItemCard key={item.key} item={item} />
          ))}

          {result.registration && <RegistrationReference data={result.registration} />}

          <ExclusionCard reasons={result.exclusionReasons} />

          {/* 카카오톡 요약 미리보기 */}
          <details className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card">
            <summary className="cursor-pointer text-lg font-bold text-gray-800">
              카카오톡 전송용 요약문 보기
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-gray-50 p-4 text-base leading-relaxed text-gray-700">
              {summaryText}
            </pre>
          </details>
        </div>
      </Accordion>

      {/* 상담 전환 CTA */}
      <ContractCta checklist={result.consultChecklist} checkCount={result.keyChecks.length} />

      {/* 주의 문구 */}
      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
        <div className="mb-1 text-base font-bold text-gray-500">⚠️ 안내</div>
        <p className="text-base leading-relaxed text-gray-500">{DISCLAIMER}</p>
        <p className="mt-3 border-t border-gray-200 pt-3 text-base leading-relaxed text-gray-500">
          {DISCLAIMER_FRAMEWORK}
        </p>
      </div>
    </div>
  )
}
