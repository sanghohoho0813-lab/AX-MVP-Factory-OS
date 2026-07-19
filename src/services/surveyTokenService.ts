/**
 * 설문 접근 토큰 생성·검증.
 * localStorage 구현에서는 토큰 원문을 저장하지만, 향후 Supabase 전환 시
 * 해시 저장으로 바꿀 수 있도록 이 서비스에서만 토큰을 다룬다.
 */

const URLSAFE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** URL-safe 고엔트로피 토큰 (24바이트 → 32자) */
export function generateSecureAccessToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // 미지원 환경 대체 (테스트 목적)
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += URLSAFE_ALPHABET[bytes[i] % URLSAFE_ALPHABET.length]
  }
  return out
}

/** 기존 토큰과 겹치지 않는 토큰 생성 */
export function generateUniqueAccessToken(
  isTaken: (token: string) => boolean,
): string {
  let token = generateSecureAccessToken()
  let guard = 0
  while (isTaken(token) && guard < 10) {
    token = generateSecureAccessToken()
    guard += 1
  }
  return token
}

/** 절대 URL 생성 (origin 기준) */
export function buildSurveyUrl(accessToken: string): string {
  const origin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : ''
  return `${origin}/survey/${accessToken}`
}
