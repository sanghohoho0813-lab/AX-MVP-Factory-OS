/**
 * D-647 화면 · 기능 이름 찾기(D-592 · D-638 오늘 대화창 바로 가기)를 앱 뼈대 · 첫 화면 밖에서 받는 훅.
 * 표(content/guideGroups)와 찾기(content/screenSearch)는 안내 글 묶음(메뉴 · 기능 안내 — 압축 19KB)을 끌어오므로
 * 처음 그릴 때 받지 않는다 — 화면을 그린 뒤 한가할 때, 또는 글을 적기 시작하면(want) 받는다.
 * 표를 만드는 입력은 useGuideGroups 와 같다(이 계정에 보이는 화면만).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { useCustomerAudience } from '../../config/customerAudience'
import { usePilotMarketingScreens } from '../../config/pilotMarketing'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import type { guideGroupsFor } from '../../content/guideGroups'
import type { ScreenHit, searchScreens } from '../../content/screenSearch'

interface ScreenSearchMod {
  guideGroupsFor: typeof guideGroupsFor
  searchScreens: typeof searchScreens
}
export type ScreenSearchFn = (query: string, limit?: number) => ScreenHit[]

let mod: ScreenSearchMod | null = null
let loading: Promise<ScreenSearchMod> | null = null
function loadScreenSearch(): Promise<ScreenSearchMod> {
  if (mod) return Promise.resolve(mod)
  if (!loading) {
    loading = Promise.all([import('../../content/guideGroups'), import('../../content/screenSearch')]).then(([g, s]) => {
      mod = { guideGroupsFor: g.guideGroupsFor, searchScreens: s.searchScreens }
      return mod
    })
    // 못 받으면 다음에 다시
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}

/** search: 받은 뒤의 찾기(아직이면 null) · ensure: 지금 꼭 필요할 때(보내기 누름) 받아서 돌려준다 */
export function useLazyScreenSearch(want: boolean): { search: ScreenSearchFn | null; ensure: () => Promise<ScreenSearchFn> } {
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  const basic = useCustomerAudience()
  const pilotMarketing = usePilotMarketingScreens()
  // 고급 기능 보기를 켜고 끄면 다시 그린다 — 표도 그때 다시 만든다
  const version = useStoreVersion()
  const advanced = isAdvancedVisible()
  const [loaded, setLoaded] = useState<ScreenSearchMod | null>(mod)

  // 적기 시작하면 바로, 아니면 화면을 그린 뒤 한가할 때
  useEffect(() => {
    if (loaded) return
    let alive = true
    const go = () =>
      void loadScreenSearch()
        .then((m) => {
          if (alive) setLoaded(m)
        })
        .catch(() => {})
    if (want) {
      go()
      return () => {
        alive = false
      }
    }
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const id = hasIdle ? window.requestIdleCallback(go, { timeout: 3000 }) : window.setTimeout(go, 1500)
    return () => {
      alive = false
      if (hasIdle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [want, loaded])

  const opts = useMemo(() => ({ advanced, pilot, caps, basic, pilotMarketing }), [advanced, pilot, caps, basic, pilotMarketing])
  const groups = useMemo(
    () => (loaded ? loaded.guideGroupsFor(opts) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, opts, version],
  )
  const search = useMemo<ScreenSearchFn | null>(() => (loaded && groups ? (q, limit) => loaded.searchScreens(q, groups, { pilot, basic }, limit) : null), [loaded, groups, pilot, basic])

  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  }, [opts])
  const ensure = useCallback(async (): Promise<ScreenSearchFn> => {
    const m = await loadScreenSearch()
    const o = optsRef.current
    const g = m.guideGroupsFor(o)
    return (q, limit) => m.searchScreens(q, g, { pilot: o.pilot, basic: o.basic }, limit)
  }, [])

  return { search, ensure }
}
