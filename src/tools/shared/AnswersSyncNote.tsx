/**
 * D-621 모듈에서 답한 것이 '이 기기에만' 있는지 · '업체 기록에 붙어' 있는지 한 줄 — 연구소(D-619)와 같은 글.
 *
 * 답만 하고 붙이지 않으면 그 답은 이 브라우저에만 남는다(다른 기기 · 같이 쓰는 사람 화면의 카드는 예전 판정).
 * 그 사실을 붙이기 단추 옆에서 바로 알린다 — 붙이면 답도 같이 붙는다(D-619 · D-620).
 */
export type AnswersSync = 'record' | 'device' | null

/** 키 순서와 상관없이 같은 답인지 — 붙여 둔 답 ↔ 지금 화면의 답 */
export function sameAnswers(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = norm(o[k])
      return out
    }
    return v
  }
  try {
    return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
  } catch {
    return false
  }
}

export function AnswersSyncNote({ state, testId, className = '' }: { state: AnswersSync; testId: string; className?: string }) {
  if (!state) return null
  return (
    <p className={`no-print w-full text-sm break-keep text-slate-600 ${className}`} data-testid={testId} data-state={state}>
      {state === 'record'
        ? '✓ 이 답은 업체 기록에 붙어 있어요 — 다른 기기 · 같이 쓰는 사람 화면에서도 같은 판정이 보여요.'
        : '지금 답은 이 기기에만 있어요 — [기록에 붙이기]를 누르면 다른 기기에서도 같은 판정이 보여요.'}
    </p>
  )
}
