/**
 * 이 계정에 보이는 메뉴 · 화면 표를 화면에서 쓰는 훅 — 사용법 안내(D-565) · 찾기(D-592)가 같은 표를 쓴다.
 * 표 만들기는 content/guideGroups(순수 함수).
 */
import { useMemo } from 'react'
import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { useCustomerAudience } from '../../config/customerAudience'
import { usePilotMarketingScreens } from '../../config/pilotMarketing'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { guideGroupsFor, type GuideGroup } from '../../content/guideGroups'

export function useGuideGroups(): { groups: GuideGroup[]; pilot: boolean; basic: boolean } {
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  const basic = useCustomerAudience()
  const pilotMarketing = usePilotMarketingScreens()
  // 고급 기능 보기를 켜고 끄면 다시 그린다 — 표도 그때 다시 만든다
  const version = useStoreVersion()
  const advanced = isAdvancedVisible()
  const groups = useMemo(
    () => guideGroupsFor({ advanced, pilot, caps, basic, pilotMarketing }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advanced, pilot, caps, pilotMarketing, basic, version],
  )
  return { groups, pilot, basic }
}
