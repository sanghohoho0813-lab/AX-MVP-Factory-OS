/**
 * D-638 화면이 닫혀도 답을 다시 받는다 — 대화창마다 '묻는 중' 줄에 요청 번호(rid)를 같이 적어 두고,
 * 다시 열리면(새로 고침 · 휴대폰이 탭을 버렸다 다시 엶 · 다른 화면에서 돌아옴) 그 번호의 답을 서버에 묻는다.
 *   서버가 답을 다 만들었으면(보관 0030 · 같은 서버 기억) 그대로 받아 그 줄을 채운다 — AI 를 다시 부르지 않는다(사용량도 안 셈).
 *   30분이 넘은 줄 · 서버에 없는 줄은 예전처럼 '다시 물어봐 주세요'.
 */
import { fetchAssistResult, type AssistRun } from './client'

/** 이만큼 지난 '묻는 중' 줄은 다시 받지 않는다(서버 기억 15분 · 보관은 남지만 대화 흐름이 이미 지났다) */
export const RESUME_WINDOW_MS = 30 * 60_000

/** 다시 받을 만한가 — 요청 번호가 있고 30분 안 */
export function resumable(t: { rid?: string; at?: string }, now = Date.now()): boolean {
  if (!t.rid || !/^[A-Za-z0-9_-]{8,80}$/.test(t.rid)) return false
  const at = Date.parse(t.at ?? '')
  return Number.isFinite(at) && now - at < RESUME_WINDOW_MS
}

/** 그 번호의 답 — 답 · 'pending'(아직 쓰는 중 · 잠깐 끊김 → 다음에 다시) · null(서버에 없음 · 막힘 → 다시 물어보기) */
export async function resumeRun(rid: string): Promise<AssistRun | 'pending' | null> {
  const got = await fetchAssistResult(rid)
  if (got.state === 'done') return got.run
  if (got.state === 'pending') return 'pending'
  if (got.state === 'error' && got.error.code === 'network') return 'pending'
  return null
}

/** 같은 화면이 여러 번 열려도 같은 번호는 한 번에 하나만 묻는다 */
const asking = new Set<string>()
export async function resumeOnce(rid: string): Promise<AssistRun | 'pending' | null> {
  if (asking.has(rid)) return 'pending'
  asking.add(rid)
  try {
    return await resumeRun(rid)
  } finally {
    asking.delete(rid)
  }
}
