/**
 * D-251 콘텐츠 묶음 AI 결과를 이 브라우저(로그인한 사람별 금고 · axmvp.*)에 키워드별로 — 다시 열어도 다시 부르지 않게.
 * 저장이 막혀도(사생활 모드 · 가득 참) 화면은 그대로 된다.
 */
import { PACK_STORE_KEY, parsePackStore, putPackStore, type PackAiSaved } from './contentPack'

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
    window.localStorage.setItem(PACK_STORE_KEY, JSON.stringify(putPackStore(readPackStore(), key, saved)))
    return true
  } catch {
    return false
  }
}

/** 첫 화면 키워드 단추의 'AI로 써 둠' 표시 */
export function packAiKeys(): Set<string> {
  return new Set(Object.keys(readPackStore()))
}
