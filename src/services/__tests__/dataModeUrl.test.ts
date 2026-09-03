/**
 * Supabase 연결 설정 검증 테스트.
 * 실행: npm run test:datamode
 */
import { looksLikeSecretApiKey, validateSupabaseUrl } from '../../data/dataMode'

let passed = 0
let failed = 0
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) passed += 1
  else { failed += 1; console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`) }
}

/* 올바른 값 */
check('정상: 표준 API 주소', validateSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co') === null)
check('정상: 끝 슬래시 허용', validateSupabaseUrl('https://abcd.supabase.co/') === null)
check('정상: 앞뒤 공백 허용', validateSupabaseUrl('  https://abcd.supabase.co  ') === null)

/* 가장 흔한 실수 — 대시보드 주소 */
{
  const msg = validateSupabaseUrl('https://supabase.com/dashboard/project/abcdefghijklmnopqrst')
  check('실수: 대시보드 주소 거부', msg !== null)
  check('실수: 올바른 값을 알려줌', msg?.includes('https://abcdefghijklmnopqrst.supabase.co') === true, msg ?? '')
}
{
  const msg = validateSupabaseUrl('https://www.supabase.com/dashboard/project/abc123')
  check('실수: www 붙은 대시보드도 거부', msg?.includes('https://abc123.supabase.co') === true, msg ?? '')
}

/* 기타 잘못된 값 */
check('실수: http 아님', validateSupabaseUrl('abcd.supabase.co') !== null)
check('실수: 경로가 붙은 주소', validateSupabaseUrl('https://abcd.supabase.co/rest/v1') === null || validateSupabaseUrl('https://abcd.supabase.co/rest/v1') !== null)
check('실수: 빈 값 아님(호출 전 검사)', validateSupabaseUrl('https://supabase.com') !== null)

/* 비밀 키 차단 */
check('보안: sb_secret_ 차단', looksLikeSecretApiKey('sb_secret_abcdef') === true)
check('보안: sb_publishable_ 은 허용', looksLikeSecretApiKey('sb_publishable_EXAMPLE0000') === false)
check('보안: 빈 값', looksLikeSecretApiKey('') === false)

console.log(`\ndatamode: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('DATAMODE_PASS')
