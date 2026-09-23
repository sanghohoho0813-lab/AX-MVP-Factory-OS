/**
 * 브라우저 저장 공간이 가득 찼을 때 (D-95).
 *
 * 로컬 모드는 기록을 브라우저 저장소(약 5MB)에 둔다. 가득 차면 저장이 실패하는데,
 * 모듈 기록은 전에 그 실패를 삼키고 메모리에만 담아 '저장된 것처럼' 보였다 — 새로고침하면 사라졌다.
 * 이제 실패하면 신호를 한 번 쏘고, OS 가 화면 위에 띠로 알린다(무엇을 하면 되는지까지).
 */

export const STORAGE_FULL_EVENT = 'axmvp:storage-full'

/** 저장 공간 초과 오류인가 (브라우저마다 이름·번호가 다르다) */
export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; code?: number; message?: string }
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message ?? '')
}

export class StorageFullError extends Error {
  constructor() {
    super('브라우저 저장 공간이 가득 차 저장하지 못했습니다. 백업을 내려받고 오래된 첨부·기록을 정리해 주세요.')
    this.name = 'StorageFullError'
  }
}

/** 가득 찼다고 알린다 — OS 띠가 듣는다 */
export function announceStorageFull(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_FULL_EVENT, { detail: { key } }))
  } catch {
    /* 알림을 못 보내도 저장 실패는 호출한 쪽이 받는다 */
  }
}

/** 이 브라우저가 이 사이트에 쓰는 저장 공간(글자 수) — 브라우저 한도(약 5MB)도 글자 수로 센다 */
export function localStorageChars(): number {
  try {
    let n = 0
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? ''
      n += k.length + (localStorage.getItem(k)?.length ?? 0)
    }
    return n
  } catch {
    return 0
  }
}
