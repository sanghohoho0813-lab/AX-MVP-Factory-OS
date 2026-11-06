/**
 * D-551 SYNC-4 AI 결과 보관 한도에서 밀려날 때 한 줄로 알린다.
 *
 * 콘텐츠 묶음 AI 결과(최근 12개) · '이렇게 찍으세요' AI 추천(최근 40개)은 한도를 넘으면 가장 오래된 것부터 빠졌다 — 알림 없이.
 * 빠진 주제를 다시 열면 규칙 초안만 보이고, 다시 부르면 사용량이 또 든다. 이제 새 결과를 남길 때 빠진 것이 있으면
 * 무엇이 빠졌는지 화면 위에 한 줄(EvictedNotice)로 알린다. 규칙 계산 — AI 아님.
 */
export const EVICTED_EVENT = 'axmvp:ai-store-evicted'

export interface EvictedDetail {
  /** '콘텐츠 묶음' · '이렇게 찍으세요 추천' */
  what: string
  /** 빠진 주제(사람이 읽는 이름) */
  labels: string[]
  max: number
}

/** 남기기 전 · 뒤를 견줘 빠진 키 — 방금 넣은 키는 빼고 */
export function evictedKeys(before: Record<string, unknown>, after: Record<string, unknown>, added: string): string[] {
  return Object.keys(before).filter((k) => k !== added && !(k in after))
}

/** 'axis:주제' · '2026-W45:axis:주제' · 'custom:주제' → '주제' */
export function keyLabel(key: string): string {
  const last = key.split(':').pop() ?? key
  return (last.trim() || key).slice(0, 40)
}

export function announceEvicted(detail: EvictedDetail): void {
  if (!detail.labels.length || typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent<EvictedDetail>(EVICTED_EVENT, { detail }))
  } catch {
    /* 알림을 못 보내도 결과는 남았다 */
  }
}

/** 한 줄 글 — '콘텐츠 묶음은 최근 12개까지만 보관해요 — 가장 오래된 '…' 결과가 빠졌어요' */
export function evictedLine(d: EvictedDetail): string {
  const names = d.labels.slice(0, 2).map((l) => `'${l}'`).join(' · ')
  const more = d.labels.length > 2 ? ` 외 ${d.labels.length - 2}개` : ''
  return `${d.what}은 최근 ${d.max}개까지만 보관해요 — 가장 오래된 ${names}${more} 결과가 빠졌어요. 다시 열면 규칙으로 만든 초안이 보여요(내 콘텐츠에 담아 둔 글은 그대로).`
}
