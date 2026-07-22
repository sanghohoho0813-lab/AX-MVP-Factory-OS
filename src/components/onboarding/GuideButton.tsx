import { LifeBuoy } from 'lucide-react'
import { useOnboarding } from './onboardingContext'

/**
 * 항상 접근 가능한 "처음 사용 가이드" 버튼 (§2-B).
 * 데스크톱에서는 글자를 함께 보여준다("?"만 두지 않는다).
 */
export function GuideButton() {
  const { openGuide } = useOnboarding()
  return (
    <button
      type="button"
      data-tour="guide-button"
      onClick={() => openGuide()}
      className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-2.5 text-[0.95rem] font-semibold text-brand-700 hover:border-brand-300 hover:bg-brand-100 sm:px-3"
    >
      <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
      <span className="hidden sm:inline">처음 사용 가이드</span>
      <span className="sr-only">처음 사용 가이드 열기</span>
    </button>
  )
}
