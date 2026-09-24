/**
 * 화면에 보이는 '지금 쓰는 사람' 이름 (D-103).
 *
 * 순서
 *  1. 로그인한 사람이 프로필에 적은 이름(가입할 때 넣은 display_name 등) — 이메일 앞부분을 그대로 옮겨 둔 값은 이름으로 치지 않는다.
 *  2. 작업실 소유자(대표)인데 이름이 없으면 → 브랜드 설정의 대표 이름(김상호 대표).
 *  3. 그 밖의 구성원은 이메일 앞부분 + 역할.
 * 로컬(로그인 없음) 모드는 늘 2번이다.
 *
 * 이 파일은 계산만 한다 — 저장소·Supabase 를 부르지 않는다.
 */
import { brand } from '../brand/brand.config'

export interface UserIdentity {
  name: string
  /** 직함·역할 — '대표', '편집자' 등 */
  title: string
  /** 동그라미 안 한 글자 */
  initial: string
}

const ROLE_TITLE: Record<string, string> = { owner: '대표', admin: '관리자', editor: '편집자', viewer: '보기 전용' }

export function ownerIdentity(): UserIdentity {
  return { name: brand.ownerName, title: brand.ownerTitle, initial: brand.ownerName.slice(0, 1) }
}

export interface SessionUserLike {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function metaName(user: SessionUserLike, emailLocal: string): string | null {
  const meta = user.user_metadata ?? {}
  for (const k of ['display_name', 'full_name', 'name']) {
    const v = meta[k]
    if (typeof v === 'string') {
      const t = v.trim()
      if (t && t !== emailLocal) return t
    }
  }
  return null
}

export function identityFromSession(user: SessionUserLike | null | undefined, role: string | null | undefined): UserIdentity {
  if (!user) return ownerIdentity()
  const email = (user.email ?? '').trim()
  const emailLocal = email.split('@')[0] ?? ''
  const named = metaName(user, emailLocal)
  const title = role === 'owner' ? brand.ownerTitle : (role ? (ROLE_TITLE[role] ?? role) : '')
  if (named) return { name: named, title, initial: named.slice(0, 1) }
  if (role === 'owner') return ownerIdentity()
  const name = emailLocal || '사용자'
  return { name, title, initial: name.slice(0, 1).toUpperCase() }
}
