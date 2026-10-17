/**
 * D-224 HTML 로 내보내는 보고서(내부 보고서 · 수수료 정산서 · 고객 보고서)용 — 글자를 그대로 보이게(태그로 해석되지 않게).
 * 예전에는 엑셀로 들어온 이름에 `<img onerror=…>` 가 있으면 보고서 창에서 그대로 실행됐다.
 */
export function escHtml(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** 객체 · 배열 안의 글자만 escHtml (숫자 · 참거짓 · 날짜 계산용 값은 그대로) */
export function escDeep<T>(v: T, depth = 0): T {
  if (typeof v === 'string') return escHtml(v) as unknown as T
  if (!v || typeof v !== 'object' || depth > 8) return v
  if (Array.isArray(v)) return v.map((x) => escDeep(x, depth + 1)) as unknown as T
  const o: Record<string, unknown> = {}
  for (const k of Object.keys(v as Record<string, unknown>)) o[k] = escDeep((v as Record<string, unknown>)[k], depth + 1)
  return o as T
}
