/**
 * D-479 '1주일치 쓰는 중' 진행 표시(WeekRunDock)는 1주일치 실행 모듈(weekRun)이 불린 뒤에만 뜰 수 있다 — 진행 상태가 그 모듈 안에만 있다.
 * 그래서 앱 바깥 틀(AppShell)은 이 깃발만 보고, 깃발이 서면 그때 표시 부품을 받아 온다(첫 접속에 1주일치 · AI 지시문 · 판정 엔진을 함께 받지 않게).
 */
let loaded = false
const subs = new Set<() => void>()

/** weekRun 모듈이 처음 읽힐 때 부른다 */
export function markWeekRunLoaded(): void {
  if (loaded) return
  loaded = true
  for (const f of subs) f()
}

export const weekRunLoaded = (): boolean => loaded

export function subscribeWeekRunLoaded(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
