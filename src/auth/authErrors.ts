/**
 * Supabase 인증 오류를 사용자에게 보여줄 안전한 한국어 메시지로 변환한다.
 * 계정 존재 여부가 드러나지 않도록(계정 열거 방지) 일반화된 문구를 사용한다.
 */

export interface FriendlyAuthError {
  message: string
  /** 원인 분류(로그·분기용, 사용자에게 원문 노출 안 함) */
  kind: 'invalid_credentials' | 'rate_limited' | 'network' | 'weak_password' | 'email_taken' | 'unknown'
}

interface RawErrorLike {
  message?: string
  status?: number
  code?: string
}

export function toFriendlyAuthError(error: unknown): FriendlyAuthError {
  const raw = (error ?? {}) as RawErrorLike
  const msg = (raw.message ?? '').toLowerCase()
  const status = raw.status

  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return { message: '이메일 또는 비밀번호가 올바르지 않습니다.', kind: 'invalid_credentials' }
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return { message: '요청이 많습니다. 잠시 후 다시 시도해 주세요.', kind: 'rate_limited' }
  }
  if (msg.includes('password') && (msg.includes('should be') || msg.includes('weak') || msg.includes('at least'))) {
    return { message: '비밀번호는 6자 이상으로 설정해 주세요.', kind: 'weak_password' }
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
    // 계정 열거를 피하기 위해 중립적으로 안내
    return { message: '가입을 완료할 수 없습니다. 입력한 이메일을 다시 확인해 주세요.', kind: 'email_taken' }
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return { message: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.', kind: 'network' }
  }
  return { message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', kind: 'unknown' }
}
