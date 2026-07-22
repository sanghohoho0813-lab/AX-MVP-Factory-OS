import { useMemo } from 'react'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { useOnboarding } from '../../components/onboarding/onboardingContext'
import { useDemoTour } from '../../components/demo/demoTour'
import { onboardingPreferencesRepository } from '../../repositories/onboardingPreferencesRepository'
import { todayLocalDate } from '../../lib/appClock'

/**
 * 처음 사용 가이드 설정 (§19).
 * "가이드 진행 초기화"는 안내 읽음 상태만 지우고 도메인 데이터는 절대 건드리지 않는다.
 * 샘플 흐름 시작은 Guided Demo 초기화와 분리되어 있다.
 */
export function OnboardingSettingsPanel() {
  const version = useStoreVersion()
  const { showToast } = useToast()
  const { openGuide } = useOnboarding()
  const demoTour = useDemoTour()

  const prefs = useMemo(() => {
    void version
    return onboardingPreferencesRepository.get()
  }, [version])

  const snoozedToday = prefs.snoozedUntilDate !== null && todayLocalDate() <= prefs.snoozedUntilDate

  return (
    <Panel title="처음 사용 가이드">
      <HelpNote summary="처음 사용 가이드는 매일 첫 접속 때 오늘 할 일을 안내합니다. 여기서 자동 노출을 끄거나, 안내 진행 상태를 초기화할 수 있습니다. 초기화해도 고객사·프로젝트 등 실제 데이터는 삭제되지 않습니다." />

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-(--radius-control) border border-slate-200 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[0.95rem] font-semibold text-slate-800">매일 자동으로 안내 열기</span>
          <span className="block text-[0.88rem] break-keep text-slate-500">
            {prefs.autoShowEnabled
              ? '접속한 날 처음 한 번, 오늘 할 일을 자동으로 안내합니다.'
              : '자동 노출이 꺼져 있습니다. 상단 “처음 사용 가이드”로 언제든 열 수 있습니다.'}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="매일 자동으로 안내 열기"
          checked={prefs.autoShowEnabled}
          onChange={(e) => {
            onboardingPreferencesRepository.setAutoShow(e.target.checked)
            showToast(e.target.checked ? '매일 자동 안내를 켰습니다.' : '매일 자동 안내를 껐습니다.')
          }}
          className="size-5 shrink-0 accent-brand-600"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="md" className="text-[1rem]" onClick={() => openGuide()}>
          가이드 다시 보기
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="text-[1rem]"
          onClick={() => {
            const resume = prefs.lastOpenedChapterId
            openGuide(resume ?? undefined)
          }}
        >
          마지막으로 본 안내 이어보기
        </Button>
        <Button variant="secondary" size="md" className="text-[1rem]" onClick={() => demoTour.start()}>
          샘플로 전체 흐름 체험하기
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="text-[1rem]"
          disabled={!snoozedToday}
          onClick={() => {
            onboardingPreferencesRepository.clearSnooze()
            showToast('오늘 미루기를 해제했습니다.')
          }}
        >
          오늘 미루기 해제
        </Button>
        <Button
          variant="ghost"
          size="md"
          className="text-[1rem]"
          onClick={() => {
            onboardingPreferencesRepository.resetGuideProgress()
            showToast('가이드 진행 상태를 초기화했습니다. (실제 데이터는 그대로입니다)')
          }}
        >
          가이드 진행 초기화
        </Button>
      </div>
      <p className="mt-2 text-[0.85rem] break-keep text-slate-400">
        “가이드 진행 초기화”는 안내를 읽은 표시만 지웁니다. 고객사·프로젝트·진단·설계 등 실제 데이터와 샘플 데이터는 삭제되지 않습니다.
      </p>
    </Panel>
  )
}
