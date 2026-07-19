/**
 * localStorage 접근을 한곳에 모은 저장 계층.
 * UI 컴포넌트는 이 모듈을 직접 사용하지 않고 Repository를 통해 접근한다.
 */

const KEY_PREFIX = 'axmvp'
export const SCHEMA_VERSION = 1
export const SCHEMA_VERSION_KEY = `${KEY_PREFIX}.schema_version`

export const STORAGE_KEYS = {
  organizations: `${KEY_PREFIX}.v${SCHEMA_VERSION}.organizations`,
  projects: `${KEY_PREFIX}.v${SCHEMA_VERSION}.projects`,
  activities: `${KEY_PREFIX}.v${SCHEMA_VERSION}.activities`,
} as const

export class StorageWriteError extends Error {
  constructor() {
    super('로컬 저장소에 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')
    this.name = 'StorageWriteError'
  }
}

/** localStorage 사용 불가 환경(사생활 보호 모드 등)을 위한 메모리 대체 저장소 */
const memoryFallback = new Map<string, string>()

function isStorageAvailable(): boolean {
  try {
    const probe = `${KEY_PREFIX}.__probe__`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const storageAvailable = typeof window !== 'undefined' && isStorageAvailable()

function rawGet(key: string): string | null {
  if (!storageAvailable) return memoryFallback.get(key) ?? null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return memoryFallback.get(key) ?? null
  }
}

function rawSet(key: string, value: string): void {
  if (!storageAvailable) {
    memoryFallback.set(key, value)
    return
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {
    throw new StorageWriteError()
  }
}

/** 손상된 JSON이 있어도 앱이 중단되지 않도록 안전하게 읽는다 */
export function readJson<T>(key: string, fallback: T): T {
  const raw = rawGet(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    if (import.meta.env.DEV) {
      console.warn(`[storage] ${key} 값이 손상되어 기본값을 사용합니다.`)
    }
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  rawSet(key, JSON.stringify(value))
}

export function readSchemaVersion(): number | null {
  const raw = rawGet(SCHEMA_VERSION_KEY)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function writeSchemaVersion(version: number): void {
  rawSet(SCHEMA_VERSION_KEY, String(version))
}

/** crypto.randomUUID 우선, 미지원 환경에서는 안전한 대체 ID */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/* ------------------------------------------------------------------ */
/* 변경 알림 — 화면이 저장 데이터 변경을 구독할 수 있게 한다              */
/* ------------------------------------------------------------------ */

type Listener = () => void
const listeners = new Set<Listener>()
let storeVersion = 0

export function subscribeStore(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getStoreVersion(): number {
  return storeVersion
}

export function notifyStoreChanged(): void {
  storeVersion += 1
  listeners.forEach((listener) => listener())
}
