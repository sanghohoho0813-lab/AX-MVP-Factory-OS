/**
 * D-263 대표가 정의한 /악마판사 스킬 — 붙여 넣은 글을 기억해 두었다가 판사 · 명세서/사업계획서 쓰기 단추마다 서버로 같이 보낸다.
 * 대표: "GPT 의 경우 /악마판사 스킬 내가 정의 내린 거 있거든 — GPT API 끌고 오면 스킬 설명 안 하더라도 잘 적용되게."
 *
 *  - 이 브라우저(axmvp. 키 — 로그인 경계에서 사람마다 금고로 옮겨짐)에 바로 쓰고, 작업공간 모듈 기록(ai · skills)에도 올려
 *    휴대폰 · PC 어디서 열어도 같은 정의를 쓴다. 클라우드 표가 없으면 이 브라우저에만.
 *  - 비어 있으면 서버의 기본 정의(Master v2.9 §40~42 · 명세서 §12~14 에서 만든 악마판사)만 쓴다.
 */
import { listRows, saveRow } from '../moduleData'

const KEY = 'axmvp.ai.judgeSkill.v1'
const MODULE = 'ai'
const BUCKET = 'skills'
const ROW_ID = 'devil-judge'
export const JUDGE_SKILL_MAX = 8000
export const JUDGE_SKILL_EVENT = 'axmvp:judge-skill'

let cache: string | null = null

export function readJudgeSkill(): string {
  if (cache != null) return cache
  try {
    cache = (localStorage.getItem(KEY) ?? '').slice(0, JUDGE_SKILL_MAX)
  } catch {
    cache = ''
  }
  return cache
}

function remember(text: string) {
  cache = text
  try {
    if (text) localStorage.setItem(KEY, text)
    else localStorage.removeItem(KEY)
  } catch {
    // 저장 못 해도 이번 접속 동안은 쓴다
  }
  try {
    window.dispatchEvent(new CustomEvent(JUDGE_SKILL_EVENT, { detail: text }))
  } catch {
    // 알림을 못 보내도 다음 부름부터 새 정의
  }
}

/** 붙여 넣은 정의 저장 — 클라우드에 못 올려도 이 브라우저에는 남는다(그때 false) */
export async function saveJudgeSkill(workspaceId: string | null, text: string): Promise<boolean> {
  const t = String(text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, JUDGE_SKILL_MAX)
  remember(t)
  try {
    await saveRow(workspaceId, MODULE, BUCKET, { id: ROW_ID, data: { text: t, updatedAt: new Date().toISOString() } })
    return true
  } catch {
    return false
  }
}

/** 클라우드에 올려 둔 정의를 읽어 이 브라우저에 맞춘다(다른 기기에서 고친 것) */
export async function syncJudgeSkill(workspaceId: string | null): Promise<string> {
  try {
    const rows = await listRows(workspaceId, MODULE, BUCKET)
    const row = rows.find((r) => r.id === ROW_ID)
    const t = typeof row?.data?.text === 'string' ? (row.data.text as string).slice(0, JUDGE_SKILL_MAX) : null
    if (t != null && t !== readJudgeSkill()) remember(t)
  } catch {
    // 못 읽으면 이 브라우저 것 그대로
  }
  return readJudgeSkill()
}

/** 시험용 */
export function __resetJudgeSkill() {
  cache = null
}
