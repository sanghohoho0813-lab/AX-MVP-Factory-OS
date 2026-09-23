/**
 * 배포 뒤 열려 있던 탭 살리기 (D-95).
 *
 * 화면 조각(청크)은 필요할 때 받아 온다. 새로 배포하면 조각 이름이 바뀌어, 배포 전에 열어 둔 탭이
 * 옛 이름을 찾다 실패한다("Failed to fetch dynamically imported module"). 그러면 화면이 비었다.
 * 이런 실패는 새로고침 한 번이면 풀린다 — 그래서 한 번만 자동으로 새로고침한다(무한 새로고침은 막는다).
 */

const KEY = 'axmvp.staleChunkReloadAt'
const WINDOW_MS = 30_000

/** 조각을 못 받아 생긴 오류인가 */
export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(msg)
}

/**
 * 30초 안에 이미 한 번 새로고침했으면 false (다시 하지 않는다). 아니면 새로고침하고 true.
 * `now`·`reload` 는 시험용으로 바꿀 수 있다.
 */
export function reloadOnceForNewVersion(
  now: number = Date.now(),
  reload: () => void = () => window.location.reload(),
  store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof sessionStorage === 'undefined' ? null : sessionStorage,
): boolean {
  try {
    const last = Number(store?.getItem(KEY) ?? 0)
    if (last && now - last < WINDOW_MS) return false
    store?.setItem(KEY, String(now))
  } catch {
    /* 저장소를 못 쓰면 그냥 한 번 시도 */
  }
  reload()
  return true
}

/** Vite 가 조각 미리 받기에 실패했을 때 알려 주는 신호 — 앱 시작 때 한 번 붙인다 */
export function installStaleChunkReload(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForNewVersion()) event.preventDefault()
  })
}
