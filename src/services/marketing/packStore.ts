/**
 * D-251 콘텐츠 묶음 AI 결과를 이 브라우저(로그인한 사람별 금고 · axmvp.*)에 키워드별로 — 다시 열어도 다시 부르지 않게.
 * 저장이 막혀도(사생활 모드 · 가득 참) 화면은 그대로 된다.
 */
import { PACK_STORE_KEY, PACK_STORE_MAX, parsePackStore, putPackStore, type PackAiSaved } from './contentPack'
import { announceEvicted, evictedKeys, keyLabel } from './storeEvicted'

export function readPackStore(): Record<string, PackAiSaved> {
  try {
    return parsePackStore(window.localStorage.getItem(PACK_STORE_KEY))
  } catch {
    return {}
  }
}

/** false = 남기지 못함(가득 참 등) — 이번에 쓴 결과는 화면에 남는다 */
export function writePackStore(key: string, saved: PackAiSaved): boolean {
  try {
    const before = readPackStore()
    const after = putPackStore(before, key, saved)
    window.localStorage.setItem(PACK_STORE_KEY, JSON.stringify(after))
    // D-551 SYNC-4 한도(12개)에서 밀려난 주제가 있으면 한 줄로 알린다
    announceEvicted({ what: '콘텐츠 묶음', labels: evictedKeys(before, after, key).map(keyLabel), max: PACK_STORE_MAX })
    return true
  } catch {
    return false
  }
}

/** D-514 다른 기기 결과를 가져와 통째로 — false = 남기지 못함(이번 접속 동안은 메모리에) */
export function writePackStoreAll(store: Record<string, PackAiSaved>): boolean {
  try {
    window.localStorage.setItem(PACK_STORE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}
