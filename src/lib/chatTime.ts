/** D-634 대화 말풍선 옆 시각 — 카카오톡처럼 '오후 3:12' */
export function chatTime(at?: string | number | Date | null): string {
  if (at == null || at === '') return ''
  const d = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`
}
