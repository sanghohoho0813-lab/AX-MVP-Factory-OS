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

/** 1주일치 결과를 남기는 이 브라우저 칸(weekPlan 이 같은 이름을 쓴다) */
export const WEEK_STORE_KEY = 'axmvp.mkweek.v1'

/**
 * 오늘 화면 '오늘 올릴 것' 이 보일 수 있는가 — 이 브라우저에 남긴 1주일치가 있거나, 이번 접속에서 1주일치를 다뤘을 때(클라우드에서 읽은 주까지)만.
 * 아니면 그 한 줄 부품(1주일치 · 홍보 글 엔진을 함께 받는다)을 받아 오지 않는다 — 어차피 보일 것이 없다.
 */
export function hasWeekData(): boolean {
  if (loaded) return true
  try {
    const raw = window.localStorage.getItem(WEEK_STORE_KEY)
    return !!raw && raw !== '{}' && raw !== 'null'
  } catch {
    return false
  }
}
