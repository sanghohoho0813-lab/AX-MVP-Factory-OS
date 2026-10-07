/**
 * 주소 → 기능 (D-127) — 지금 화면이 카탈로그의 어느 기능인가.
 *
 * 기능의 주소는 이 파일에 다시 적지 않는다. 도구는 toolRegistry, 메뉴 줄은 moduleRegistry 에 있는
 * 주소를 그대로 읽는다(주소가 바뀌어도 여기는 손대지 않는다).
 */

import { FEATURE_CATALOG, type CatalogFeature } from './productCatalog'
import { TOOLS } from './toolRegistry'
import { MODULES, navFeatureDef } from './moduleRegistry'

/** 기능이 맡는 주소들 (접두) */
export function featurePaths(f: CatalogFeature): string[] {
  if (f.source === 'tool') {
    const t = TOOLS.find((x) => x.key === f.key)
    return t?.path ? [t.path] : []
  }
  // D-167: 메뉴에서 숨긴 기능(hidden)은 MODULES 에 없다 — 정의에서 주소를 읽는다(주소로는 열리고 요금제 잠금도 그대로)
  const m = MODULES.find((x) => x.key === f.key) ?? navFeatureDef(f.key)
  return m ? [m.path, ...(m.alsoPaths ?? [])] : []
}

/** 기능의 첫 주소 (없으면 null — 아직 없는 기능) */
export function featurePath(f: CatalogFeature): string | null {
  return featurePaths(f)[0] ?? null
}

/** 기능 이름 — 도구 · 메뉴 줄의 이름 그대로 */
export function featureLabel(f: CatalogFeature): string {
  if (f.source === 'tool') return TOOLS.find((x) => x.key === f.key)?.label ?? f.key
  return (MODULES.find((x) => x.key === f.key) ?? navFeatureDef(f.key))?.label ?? f.key
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** 이 주소를 맡는 기능 — 가장 긴 주소가 이긴다. 카탈로그에 없는 주소(기본 OS)는 null */
export function featureForPath(pathname: string): CatalogFeature | null {
  let best: CatalogFeature | null = null
  let len = 0
  for (const f of FEATURE_CATALOG) {
    for (const p of featurePaths(f)) {
      if (under(pathname, p) && p.length > len) {
        best = f
        len = p.length
      }
    }
  }
  return best
}

/** 업체로 여는 주소 — `{client}` 를 바꾸거나 `?client=` 를 붙인다 */
export function clientEntryHref(f: CatalogFeature, clientId: string): string | null {
  const path = f.clientEntry?.path ?? featurePath(f)
  if (!path) return null
  if (path.includes('{client}')) return path.replace('{client}', encodeURIComponent(clientId))
  return `${path}${path.includes('?') ? '&' : '?'}client=${encodeURIComponent(clientId)}`
}

/** 기능 한 줄 설명 — 도구는 도구 설명, 메뉴 줄은 도움말 */
export function featureDesc(f: CatalogFeature): string {
  if (f.summary) return f.summary
  if (f.source === 'tool') return TOOLS.find((x) => x.key === f.key)?.desc ?? ''
  return MODULES.find((x) => x.key === f.key)?.hint ?? ''
}

/** 기능 아이콘 */
export function featureIcon(f: CatalogFeature) {
  if (f.source === 'tool') return TOOLS.find((x) => x.key === f.key)?.icon
  return MODULES.find((x) => x.key === f.key)?.icon
}
