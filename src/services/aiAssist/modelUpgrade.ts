/** W7(D-644) actions.ts 에서 뗐다 — 자동 모델 규칙(autoModel)이 가볍게 부르게. actions.ts 는 다시 내보낸다. */
import type { AssistStatus, ProviderId } from './client'
import type { AiChoice } from './store'

/**
 * D-241 같은 회사의 한 단계 위 모델(빠르게 → 보통 → 깊게). 키가 없거나 이미 가장 위면 null.
 * 대표: 싼 모델 답이 와닿지 않을 때 모델 설정을 열지 않고 한 번에 다시.
 */
export function betterModel(status: AssistStatus | null, run: { provider: ProviderId; model: string }): (AiChoice & { label: string }) | null {
  const p = status?.providers.find((x) => x.id === run.provider)
  if (!p || !p.configured) return null
  const now = p.models.find((m) => m.id === run.model)
  const cur = now?.tier
  if (!cur) {
    // D-244 단계를 모르는 모델 — 가격표로 견주어 더 비싼 단계 모델 중 가장 싼 것. 가격도 모르면 단추 없음(더 약한 모델을 권하지 않게)
    if (!now?.price) return null
    const cost = (x: [number, number]) => x[0] + x[1]
    const base = cost(now.price)
    const up = p.models.filter((x) => x.tier && x.price && cost(x.price) > base).sort((a, b) => cost(a.price!) - cost(b.price!))[0]
    return up ? { provider: p.id, model: up.id, label: up.label } : null
  }
  const want = cur === 'cheap' ? 'standard' : cur === 'standard' ? 'deep' : null
  const m = want ? p.models.find((x) => x.tier === want) : undefined
  return m ? { provider: p.id, model: m.id, label: m.label } : null
}
