// qa:modconflict 전용 — moduleData 의 Supabase 연결 대신 로컬 PostgREST 에 바로 붙는 클라이언트(시험이 globalThis 로 주소 · 토큰을 준다)
import { PostgrestClient } from '@supabase/postgrest-js'

export function getSupabaseClient(): PostgrestClient {
  const g = globalThis as unknown as { __PGRST_URL: string; __PGRST_JWT: string }
  return new PostgrestClient(g.__PGRST_URL, { headers: { Authorization: `Bearer ${g.__PGRST_JWT}` } })
}
