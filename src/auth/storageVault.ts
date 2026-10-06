/**
 * 브라우저 저장소 사용자별 금고 (D-162 · 1인 Pilot).
 *
 * 이 OS 는 도구 입력값 · 작성 중인 글 · 쉬는 날 · 예전 로컬 자료 같은 것을 브라우저(localStorage · sessionStorage)에도 둔다.
 * 그 키들은 사람마다 나뉘어 있지 않아서, 한 브라우저에서 A 가 로그아웃하고 B 가 로그인하면 B 가 A 의 값을 볼 수 있었다.
 *
 * 각 키를 고치는 대신 **로그인 경계에서 통째로 바꿔 끼운다**:
 *   - 지금 '꺼내 놓은' 사람(live)이 아닌 사람이 로그인하면, 꺼내 놓은 키를 그 사람 금고(`axmvp.u.<id>.<원래 키>`)로 옮기고,
 *     로그인한 사람 금고에 있던 키를 원래 자리로 꺼낸다.
 *   - 로그아웃하면 꺼내 놓은 키를 그 사람 금고로 넣는다(다음 사람에게는 빈 자리).
 *   - **아무것도 지우지 않는다** — 옮기기만 한다. 옮기다 실패하면(저장 공간 가득) 그 키는 제자리에 두고 '막힘' 으로 알린다.
 *   - 주인을 모르는 예전 자료(이 기능 전부터 있던 것)는 'full'(대표 · 기존 구성원) 계정에게만 준다. Pilot 에게는 절대 주지 않는다.
 *
 * Supabase 로그인 토큰(sb-*)과 공용 값(화면 판 번호 · 공개 공고 캐시 등)은 옮기지 않는다.
 */

export type VaultTier = 'full' | 'pilot'

const LIVE_KEY = 'axmvp.vault.live'
const UNCLAIMED = 'unclaimed'
const VAULT_PREFIX = 'axmvp.u.'

/** 사람과 상관없는 공용 값 — 옮기지 않는다 */
const GLOBAL_KEYS = new Set(['axmvp.schema_version', 'axmvp.staleChunkReloadAt', 'axmvp.grants.feed.v1', LIVE_KEY])

/** 이 앱이 쓰는 키인가(사람마다 옮길 것) — 'axmvp.' 로 시작하는 것 + 옛 도구가 쓰는 이름들 */
export function isUserScopedKey(key: string): boolean {
  if (!key || key.startsWith('sb-') || key.startsWith(VAULT_PREFIX) || GLOBAL_KEYS.has(key)) return false
  if (key.startsWith('axmvp.') || key.startsWith('axmvp:')) return true
  // 옛 도구(연구소 · 정책자금)가 쓰는 이름 — 회사 이름이 키에 들어간 것도 있다
  return /^(planChecklist:|assessment:|setupdoc:|changes:|survey:|pm:|scroll:|guide:)/.test(key)
}

function vaultKey(owner: string, key: string): string {
  return `${VAULT_PREFIX}${owner}.${key}`
}

function keysOf(store: Storage): string[] {
  const out: string[] = []
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k !== null) out.push(k)
  }
  return out
}

/** 꺼내 놓은 키를 owner 금고로 옮긴다. 못 옮긴 키 수 */
function stash(store: Storage, owner: string): number {
  let failed = 0
  for (const k of keysOf(store).filter(isUserScopedKey)) {
    const v = store.getItem(k)
    if (v === null) continue
    try {
      store.setItem(vaultKey(owner, k), v)
      store.removeItem(k)
    } catch {
      failed += 1
    }
  }
  return failed
}

/** owner 금고의 키를 원래 자리로 꺼낸다(자리에 이미 값이 있으면 금고에 그대로 둔다). 꺼낸 수 */
function unstash(store: Storage, owner: string): number {
  const prefix = `${VAULT_PREFIX}${owner}.`
  let n = 0
  for (const vk of keysOf(store).filter((k) => k.startsWith(prefix))) {
    const k = vk.slice(prefix.length)
    const v = store.getItem(vk)
    if (v === null || store.getItem(k) !== null) continue
    try {
      store.setItem(k, v)
      store.removeItem(vk)
      n += 1
    } catch {
      // 못 꺼내면 금고에 그대로 둔다
    }
  }
  return n
}

function hasScoped(store: Storage): boolean {
  return keysOf(store).some(isUserScopedKey)
}

export interface VaultResult {
  /** 무언가를 옮겼다 — 화면이 예전 값을 기억하지 않게 새로 불러야 한다 */
  changed: boolean
  /** 다른 사람 값을 다 옮기지 못했다 — 이 사람에게 앱을 열면 안 된다 */
  blocked: boolean
}

/**
 * userId 가 로그인했다 — 이 브라우저의 사람별 값을 그 사람 것으로 바꿔 끼운다.
 * tier 를 모르면(접근 목록 SQL 전) 'full' 로 본다(지금까지와 같음).
 */
export function vaultSwitchTo(userId: string, tier: VaultTier, local: Storage = window.localStorage, session: Storage = window.sessionStorage): VaultResult {
  const live = local.getItem(LIVE_KEY)
  if (live === userId) return { changed: false, blocked: false }
  let failed = 0
  let changed = false
  if (live) {
    // 앞사람 것을 앞사람 금고로
    if (hasScoped(local) || hasScoped(session)) changed = true
    failed += stash(local, live) + stash(session, live)
  } else if (hasScoped(local) || hasScoped(session)) {
    // 주인을 모르는 예전 자료 — full 계정이면 그 사람 것으로 두고, 아니면 '주인 모름' 금고로
    if (tier === 'full') {
      try {
        local.setItem(LIVE_KEY, userId)
      } catch {
        return { changed: false, blocked: true }
      }
      // 그 사람 금고에 남은 것도 꺼낸다(예전에 다른 브라우저 기능으로 넣어 둔 것은 없지만 안전하게)
      unstash(local, userId)
      unstash(session, userId)
      return { changed: false, blocked: false }
    }
    changed = true
    failed += stash(local, UNCLAIMED) + stash(session, UNCLAIMED)
  }
  if (failed > 0) return { changed, blocked: true }
  // 이 사람 금고를 꺼내고 · full 이면 주인 모름 자료도
  if (unstash(local, userId) + unstash(session, userId) > 0) changed = true
  if (tier === 'full' && unstash(local, UNCLAIMED) + unstash(session, UNCLAIMED) > 0) changed = true
  try {
    local.setItem(LIVE_KEY, userId)
  } catch {
    return { changed, blocked: true }
  }
  return { changed, blocked: false }
}

/**
 * 로그아웃 — 꺼내 놓은 값을 지금 사람 금고로(다음 사람에게는 빈 자리). 못 옮긴 키 수.
 * knownUser: 이 창이 알고 있던 사람. 다른 창이 먼저 로그아웃해 '꺼내 놓은 사람' 표시가 지워졌거나 다른 사람으로 바뀌었어도
 * 이 창의 sessionStorage(창마다 따로)는 그 사람 금고로 넣는다. 다른 사람이 이미 꺼내 놓은 localStorage 는 건드리지 않는다.
 */
export function vaultSignOut(local: Storage = window.localStorage, session: Storage = window.sessionStorage, knownUser?: string | null): number {
  const live = local.getItem(LIVE_KEY)
  if (live && knownUser && live !== knownUser) return stash(session, knownUser)
  const owner = live ?? knownUser ?? null
  if (!owner) return 0
  const failed = stash(local, owner) + stash(session, owner)
  if (failed === 0 && live) {
    try {
      local.removeItem(LIVE_KEY)
    } catch {
      /* 무시 */
    }
  }
  return failed
}
