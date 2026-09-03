/**
 * 인증 오류 메시지 변환 테스트.
 * 실행: npm run test:autherrors
 */
import { toFriendlyAuthError } from '../../auth/authErrors'

let passed = 0, failed = 0
const check = (n: string, c: boolean, d?: string) => {
  if (c) passed += 1
  else { failed += 1; console.error(`FAIL: ${n}${d ? ` — ${d}` : ''}`) }
}

/* 이미 가입된 이메일 — 다음에 할 일을 알려줘야 한다 */
{
  const r = toFriendlyAuthError({ message: 'User already registered' })
  check('중복가입: 분류', r.kind === 'email_taken', r.kind)
  check('중복가입: 로그인 안내 포함', r.message.includes('로그인'), r.message)
  check('중복가입: 비밀번호 찾기 안내', r.message.includes('비밀번호 찾기'))
}
{
  const r = toFriendlyAuthError({ code: 'user_already_exists', message: 'x' })
  check('중복가입: code 로도 인식', r.kind === 'email_taken')
}

/* 회원가입 차단 */
{
  const r = toFriendlyAuthError({ message: 'Signups not allowed for this instance' })
  check('가입차단: 분류', r.kind === 'signup_disabled', r.kind)
  check('가입차단: 켜는 위치 안내', r.message.includes('Allow new users to sign up'))
}

/* 잘못된 이메일 */
{
  const r = toFriendlyAuthError({ message: 'Email address "a@b" is invalid' })
  check('이메일오류: 분류', r.kind === 'invalid_email', r.kind)
  check('이메일오류: 대안 안내', r.message.includes('Users'))
}

/* 미인증 */
{
  const r = toFriendlyAuthError({ message: 'Email not confirmed' })
  check('미인증: 분류', r.kind === 'email_not_confirmed', r.kind)
  check('미인증: 해결 방법', r.message.includes('메일'))
}

/* 기존 동작 유지 */
check('로그인실패 유지', toFriendlyAuthError({ message: 'Invalid login credentials' }).kind === 'invalid_credentials')
check('요청과다 유지', toFriendlyAuthError({ status: 429, message: 'x' }).kind === 'rate_limited')
check('약한비번 유지', toFriendlyAuthError({ message: 'Password should be at least 6 characters' }).kind === 'weak_password')
check('네트워크 유지', toFriendlyAuthError({ message: 'Failed to fetch' }).kind === 'network')
check('알수없음 유지', toFriendlyAuthError({ message: 'something odd' }).kind === 'unknown')

/* 원문 노출 금지 */
{
  const r = toFriendlyAuthError({ message: 'Invalid login credentials' })
  check('보안: 영문 원문 노출 안 함', !r.message.includes('Invalid login credentials'))
}

console.log(`\nauth-errors: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('AUTH_ERRORS_PASS')
