/**
 * Supabase 인증 오류를 사용자에게 보여줄 안전한 한국어 메시지로 변환한다.
 * 계정 존재 여부가 드러나지 않도록(계정 열거 방지) 일반화된 문구를 사용한다.
 */

export interface FriendlyAuthError {
  message: string
  /** 원인 분류(로그·분기용, 사용자에게 원문 노출 안 함) */
  kind:
    | 'invalid_credentials'
    | 'rate_limited'
    | 'network'
    | 'weak_password'
    | 'email_taken'
    | 'signup_disabled'
    | 'invalid_email'
    | 'email_not_confirmed'
    | 'unknown'
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
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already') ||
    raw.code === 'user_already_exists'
  ) {
    // 계정이 있는지 단정하지 않으면서도, 다음에 무엇을 할지는 알려준다.
    return {
      message: '이미 가입된 이메일일 수 있습니다. 아래 “로그인”으로 들어가 보시거나 비밀번호 찾기를 이용해 주세요.',
      kind: 'email_taken',
    }
  }
  if (
    msg.includes('signups not allowed') ||
    msg.includes('signup is disabled') ||
    msg.includes('signups are disabled') ||
    raw.code === 'signup_disabled'
  ) {
    return {
      message:
        'Supabase에서 회원가입이 꺼져 있습니다. Supabase > Authentication > Sign In / Providers 에서 “Allow new users to sign up”을 켜거나, Authentication > Users 에서 계정을 직접 만들어 주세요.',
      kind: 'signup_disabled',
    }
  }
  if (msg.includes('email address') && msg.includes('invalid')) {
    return {
      message:
        '이 이메일 주소를 사용할 수 없습니다. 주소를 다시 확인하시고, 계속 안 되면 Supabase > Authentication > Users 에서 계정을 직접 만들어 주세요.',
      kind: 'invalid_email',
    }
  }
  if (msg.includes('email not confirmed') || raw.code === 'email_not_confirmed') {
    return {
      message:
        '메일 인증이 아직 끝나지 않았습니다. 받은 메일의 링크를 눌러 인증한 뒤 로그인해 주세요. (Supabase > Authentication > Users 에서 직접 승인할 수도 있습니다.)',
      kind: 'email_not_confirmed',
    }
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return { message: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.', kind: 'network' }
  }
  return { message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', kind: 'unknown' }
}
