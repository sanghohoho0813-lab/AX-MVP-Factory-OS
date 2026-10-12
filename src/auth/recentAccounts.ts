/**
 * 이 기기에서 로그인했던 계정 (D-184) — 대표가 대표 계정 ↔ 팀장 계정을 쉽게 오가게.
 *
 * - **이메일 · 이름 · 직함만** 둔다. 비밀번호는 절대 두지 않는다 — 비밀번호는 브라우저의 '비밀번호 저장' 이 채운다.
 * - 사람과 상관없는 '이 기기' 값이라 금고(storageVault)로 옮기지 않는다 — 로그아웃한 뒤 로그인 화면에서 읽어야 한다.
 * - 내부 OS 를 쓸 수 있는 계정(full · pilot)이 열렸을 때만 남긴다(AuthProvider) — 접근 없는 가입자는 남기지 않는다.
 * - '이 기기에서 지우기' 로 언제든 뺄 수 있다. 다시 로그인하면 다시 남는다.
 *
 * 이 파일은 계산 · 브라우저 저장만 한다 — Supabase 를 부르지 않는다.
 */

export const RECENT_ACCOUNTS_KEY = 'axmvp.auth.recent'
/** 메뉴에서 '○○ 계정으로 바꾸기' 를 누르면 로그인 화면이 그 이메일을 미리 넣는다(로그인하면 · 10분 지나면 잊는다) */
export const SWITCH_TO_KEY = 'axmvp.auth.switch_to'
export const RECENT_LIMIT = 4

export interface RecentAccount {
  email: string
  /** 화면 이름(대표 · 팀장이 설정 › 내 정보에 적은 것) — 없으면 빈 칸 */
  name: string
  title: string
  /** 마지막으로 이 기기에서 연 때 */
  at: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function storeOf(s?: Storage | null): Storage | null {
  if (s) return s
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function normalizeEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return EMAIL_RE.test(e) && e.length <= 200 ? e : ''
}

/** 남긴 계정 — 최근에 연 것부터, 많아야 RECENT_LIMIT 개. 깨진 값은 건너뛴다 */
export function readRecentAccounts(s?: Storage | null): RecentAccount[] {
  const st = storeOf(s)
  if (!st) return []
  let raw: unknown
  try {
    raw = JSON.parse(st.getItem(RECENT_ACCOUNTS_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RecentAccount[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const email = normalizeEmail(o.email)
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ email, name: clean(o.name, 30), title: clean(o.title, 20), at: typeof o.at === 'string' ? o.at : '' })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_LIMIT)
}

function write(st: Storage, list: RecentAccount[]): boolean {
  try {
    // 이메일 · 이름 · 직함 · 시각 네 칸만 쓴다(다른 값이 섞여 들어와도 저장하지 않는다)
    st.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(list.map(({ email, name, title, at }) => ({ email, name, title, at }))))
    return true
  } catch {
    return false
  }
}

/** 이 기기에서 이 계정이 열렸다 — 맨 앞으로(이미 있으면 이름만 새로) */
export function rememberAccount(a: { email?: string | null; name?: string | null; title?: string | null }, now: Date = new Date(), s?: Storage | null): RecentAccount[] {
  const st = storeOf(s)
  const email = normalizeEmail(a.email)
  if (!st || !email) return readRecentAccounts(st)
  const prev = readRecentAccounts(st)
  const old = prev.find((x) => x.email === email)
  // 이름을 모르면(아직 안 적음) 예전에 남긴 이름 · 직함을 그대로 둔다
  const named = clean(a.name, 30)
  const name = named || old?.name || ''
  const title = named ? clean(a.title, 20) : old?.title || ''
  const next = [{ email, name, title, at: now.toISOString() }, ...prev.filter((x) => x.email !== email)].slice(0, RECENT_LIMIT)
  write(st, next)
  return next
}

/** 이 기기에서 지우기 */
export function forgetAccount(email: string, s?: Storage | null): RecentAccount[] {
  const st = storeOf(s)
  const e = normalizeEmail(email)
  if (!st) return []
  const next = readRecentAccounts(st).filter((x) => x.email !== e)
  write(st, next)
  if (peekSwitchTarget(st) === e) clearSwitchTarget(st)
  return next
}

/** 지금 계정이 아닌 남긴 계정 — 메뉴의 '○○ 계정으로 바꾸기' */
export function otherAccounts(list: RecentAccount[], currentEmail: string | null | undefined): RecentAccount[] {
  const me = normalizeEmail(currentEmail)
  return list.filter((x) => x.email !== me)
}

/** 보이는 이름 — '최은혜 팀장' · 이름이 없으면 이메일 */
export function accountLabel(a: RecentAccount): string {
  const who = `${a.name} ${a.title}`.trim()
  return who || a.email
}

/** 바꿀 계정 표시는 잠깐만 — 누르고 10분 안에 로그인 화면을 열지 않으면 잊는다 */
export const SWITCH_TTL_MS = 10 * 60 * 1000

/**
 * 메뉴에서 '○○ 계정으로 바꾸기' 를 눌렀다. 로그아웃하면 화면이 한 번 새로 열리므로(D-162) 읽어도 바로 지우지 않고,
 * 로그인에 성공하거나(clearSwitchTarget) 시간이 지나면 잊는다.
 */
export function setSwitchTarget(email: string | null, s?: Storage | null, now: Date = new Date()): void {
  const st = storeOf(s)
  if (!st) return
  try {
    const e = normalizeEmail(email)
    if (e) st.setItem(SWITCH_TO_KEY, JSON.stringify({ email: e, at: now.getTime() }))
    else st.removeItem(SWITCH_TO_KEY)
  } catch {
    /* 저장이 막혀도 로그인 화면에서 직접 고르면 된다 */
  }
}

/** 로그인 화면이 미리 넣을 이메일 — 없거나 오래됐으면 '' */
export function peekSwitchTarget(s?: Storage | null, now: Date = new Date()): string {
  const st = storeOf(s)
  if (!st) return ''
  try {
    const raw = JSON.parse(st.getItem(SWITCH_TO_KEY) ?? 'null') as { email?: unknown; at?: unknown } | null
    if (!raw || typeof raw.at !== 'number') return ''
    const age = now.getTime() - raw.at
    if (age < 0 || age > SWITCH_TTL_MS) return ''
    return normalizeEmail(raw.email)
  } catch {
    return ''
  }
}

export function clearSwitchTarget(s?: Storage | null): void {
  setSwitchTarget(null, s)
}
