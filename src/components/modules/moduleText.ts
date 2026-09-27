/** 잠긴 모듈 문구 · 주소 (D-127) — 모든 모듈이 같은 말을 쓴다 */

import type { EntitlementSource } from '../../services/entitlements'

/** 왜 잠겼는지 — 한 문장 (…습니다) */
export function lockedSentence(source: EntitlementSource): string {
  if (source === 'locked') return '대표가 잠가 두었습니다'
  if (source === 'trial-ended') return '체험 기간이 끝났습니다'
  if (source === 'needs-dependency') return '함께 필요한 모듈이 없습니다'
  return '지금 요금제에 들어 있지 않습니다'
}

/** 업체로 연 화면이면 모듈 살펴보기에도 그 업체를 들고 간다 */
export function withClient(path: string, clientId: string | null): string {
  if (!clientId) return path
  return `${path}${path.includes('?') ? '&' : '?'}client=${encodeURIComponent(clientId)}`
}
