/**
 * D-282 바로가기(앱 런처) — 오늘 화면 맨 위 · 휴대폰 '전체 기능'.
 *
 * 무엇이 보이는지는 **메뉴와 같은 표 · 같은 규칙**(enabledModulesByGroup: Pilot · 기능 권한 · 고급 운영 기능)으로 정한다.
 * 바로가기만 따로 열어 주는 길은 없다 — 대표 전용 줄(AI 전략실 · 특허·벤처 · 마케팅)은 팀장 화면에서 빠지고, 예비 줄이 자리를 채운다.
 * 잠긴 모듈(요금제)은 감추지 않고 '잠김'.
 */
import type { LucideIcon } from 'lucide-react'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { useEntitlements } from '../../lib/entitlementsStore'
import { enabledModulesByGroup } from '../../config/moduleRegistry'
import { LAUNCHER_ALL, LAUNCHER_ENTRIES, LAUNCHER_SLOTS, moduleTone, type FeatureTone } from '../../config/featureVisual'
import { useNavCounts } from './useNavCounts'
import { AppTile } from '../ui/visual'

export interface LauncherItem {
  key: string
  label: string
  sub: string
  path: string
  icon: LucideIcon
  tone: FeatureTone
  locked: boolean
  badge: string | null
}

export function useLauncherItems(): LauncherItem[] {
  useStoreVersion()
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  const { ent } = useEntitlements()
  const counts = useNavCounts()
  const visible = new Map(
    enabledModulesByGroup({ advanced: isAdvancedVisible(), pilot, caps })
      .flatMap((g) => g.items)
      .map((m) => [m.key, m] as const),
  )
  const entries = LAUNCHER_ENTRIES.filter((e) => visible.has(e.module)).slice(0, LAUNCHER_SLOTS)
  if (visible.has(LAUNCHER_ALL.module)) entries.push(LAUNCHER_ALL)
  return entries.map((e) => {
    const m = visible.get(e.module)!
    const clients = e.module === 'client-ops' && counts.clients !== null && counts.clients > 0 ? (counts.clients > 999 ? '999+' : String(counts.clients)) : null
    return {
      key: e.module,
      label: e.label,
      sub: e.sub,
      path: m.path,
      icon: m.icon,
      tone: e.module === LAUNCHER_ALL.module ? 'slate' : moduleTone(e.module),
      locked: m.moduleKey ? !ent.module(m.moduleKey).usable : false,
      badge: clients,
    }
  })
}

/** 바로가기 묶음 — PC 는 흰 카드 한 줄(넓으면 8칸), 휴대폰은 큰 아이콘 4칸 */
export function AppLauncher({ variant, onNavigate, testId = 'app-launcher' }: { variant: 'card' | 'icon'; onNavigate?: () => void; testId?: string }) {
  const items = useLauncherItems()
  if (!items.length) return null
  return (
    <ul
      className={variant === 'card' ? 'ax-stagger grid grid-cols-2 gap-2.5 md:grid-cols-4' : 'grid grid-cols-4 gap-x-1 gap-y-2'}
      data-testid={testId}
      aria-label="바로가기"
    >
      {items.map((it) => (
        <li key={it.key} className="min-w-0">
          <AppTile
            to={it.path}
            icon={it.icon}
            tone={it.tone}
            label={it.label}
            sub={it.sub}
            badge={it.badge}
            locked={it.locked}
            variant={variant}
            onClick={onNavigate}
            testId="app-tile"
            dataKey={it.key}
          />
        </li>
      ))}
    </ul>
  )
}
