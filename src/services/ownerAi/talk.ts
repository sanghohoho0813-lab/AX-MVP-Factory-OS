/**
 * D-626 기획 대화 — 한 번 눌러서 답이 안 나오는 일을 이어서 묻는 대화(대표 지시 2026-11-17).
 *
 * 대표가 실제로 일하는 순서를 그대로 담는다:
 *   이어서 묻기 ↔ 리서치 ↔ 자체점검(반대 입장) 을 몇 번 주고받고 → 기획서 판으로 굳히고 → 개발 프롬프트를 뽑는다.
 * 전에는 이 과정을 다른 AI 창에서 했고, 창을 새로 열 때마다 앞 대화가 사라졌다. 여기서는
 *   - 대화 한 번 = 실행 한 줄(ai_runs) — 지워지지 않고 쌓이고 · 사용량에 잡히고 · 다른 기기에서도 보인다(DB 변경 0)
 *   - 다음 물음에는 앞 대화 · 지금 판이 같이 간다(서버가 [지금까지의 대화] 로 이어받는다)
 *   - 채택한 판은 다른 작업(MVP · 화면 · 제안서 · 특허 · 벤처)이 '대표가 채택한 결과' 로 이어받는다
 * 여기는 규칙(묶기 · 자르기 · 글로 바꾸기)만 — AI 는 서버 함수(/api/ai-run)가 부른다.
 */
import { TALK_SKILL_IDS, type AiRun, type SkillId, type TalkHistoryRow } from './types'
import { boardText, judgeVerdictLabel } from './render'

export type TalkMode = 'talk' | 'research' | 'judge' | 'lock' | 'prompt'
/** 무엇을 기획하는 대화인가 — ax: AX · 서비스 기획 / ip: 특허 · 벤처 기획 */
export type TalkField = 'ax' | 'ip'

export const TALK_SKILL: Record<TalkMode, SkillId> = {
  talk: 'PLAN_TALK',
  research: 'PLAN_RESEARCH',
  judge: 'PLAN_JUDGE',
  lock: 'PLAN_LOCK',
  prompt: 'DEV_PROMPT',
}

export const MODE_LABEL: Record<TalkMode, string> = {
  talk: '이어서 묻기',
  research: '리서치',
  judge: '자체점검',
  lock: '기획서 판',
  prompt: '개발 프롬프트',
}

/** 모드마다 한 줄 설명(단추 아래 · 마우스 안내) */
export const MODE_HINT: Record<TalkMode, string> = {
  talk: '앞에서 한 말을 이어받아 답해요',
  research: '시장 · 사례 · 제도를 웹에서 찾아 근거 등급과 함께',
  judge: '지금까지의 기획을 반대 입장에서 따져요',
  lock: '정해진 것을 기획서 한 판으로 굳혀요',
  prompt: '굳힌 판을 개발 AI 에 넘길 프롬프트로',
}

/** 묻는 말 없이 눌러도 되는 모드의 기본 물음 */
export const MODE_DEFAULT_ASK: Record<TalkMode, string> = {
  talk: '',
  research: '',
  judge: '지금까지의 기획을 반대 입장에서 따져 줘',
  lock: '지금까지 정해진 것을 기획서 판으로 굳혀 줘',
  prompt: '이 판으로 개발 프롬프트를 뽑아 줘',
}

export const FIELD_LABEL: Record<TalkField, string> = { ax: 'AX · 서비스 기획', ip: '특허 · 벤처 기획' }

export const isTalkRun = (r: Pick<AiRun, 'skillId'>): boolean => TALK_SKILL_IDS.includes(r.skillId)

export function modeOfRun(r: Pick<AiRun, 'skillId'>): TalkMode {
  return (Object.keys(TALK_SKILL) as TalkMode[]).find((m) => TALK_SKILL[m] === r.skillId) ?? 'talk'
}

type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean)

const THREAD_RE = /^th_[A-Za-z0-9]{6,24}$/
export const LEGACY_THREAD = 'th_first0'

export function newThreadId(): string {
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return `th_${Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12)}`
}

export function threadIdOf(r: Pick<AiRun, 'input'>): string {
  const t = str(obj(r.input?.options).thread)
  return THREAD_RE.test(t) ? t : LEGACY_THREAD
}

export function fieldOf(r: Pick<AiRun, 'input'>): TalkField {
  return str(obj(r.input?.options).field) === 'ip' ? 'ip' : 'ax'
}

export interface TalkThread {
  id: string
  title: string
  field: TalkField
  /** 오래된 것부터 */
  turns: AiRun[]
  updatedAt: string
  /** 가장 최근에 굳힌 판(형식이 맞은 것만) */
  board: AiRun | null
  /** 판이 몇 번째인가(이 대화에서 굳힌 횟수) */
  boardVersion: number
  /** 가장 최근에 뽑은 개발 프롬프트 */
  prompt: AiRun | null
  /** 가장 최근 자체점검 */
  judge: AiRun | null
}

const ok = (r: AiRun) => r.status === 'succeeded' && !!r.structured

/** 대화 제목 — 판 이름 > AI 가 붙인 대화 제목 > 첫 물음 */
function titleOf(turns: readonly AiRun[]): string {
  const board = [...turns].reverse().find((r) => r.skillId === 'PLAN_LOCK' && ok(r))
  const t1 = str(obj(board?.structured).title)
  if (t1) return t1.slice(0, 40)
  const named = turns.find((r) => r.skillId === 'PLAN_TALK' && ok(r) && str(obj(r.structured).title))
  const t2 = str(obj(named?.structured).title)
  if (t2) return t2.slice(0, 40)
  const first = str(turns[0]?.input?.task).split('\n')[0]
  return first ? (first.length > 28 ? `${first.slice(0, 28)}…` : first) : '새 대화'
}

/** 실행들 → 대화 목록(최근에 이어 간 대화 먼저) */
export function threadsOf(runs: readonly AiRun[]): TalkThread[] {
  const m = new Map<string, AiRun[]>()
  for (const r of runs) {
    if (!isTalkRun(r)) continue
    const id = threadIdOf(r)
    const list = m.get(id)
    if (list) list.push(r)
    else m.set(id, [r])
  }
  const out: TalkThread[] = []
  for (const [id, list] of m) {
    const turns = [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    const boards = turns.filter((r) => r.skillId === 'PLAN_LOCK' && ok(r))
    const last = <T,>(xs: T[]): T | null => (xs.length ? xs[xs.length - 1] : null)
    out.push({
      id,
      title: titleOf(turns),
      field: fieldOf(turns[0]),
      turns,
      updatedAt: turns[turns.length - 1].createdAt,
      board: last(boards),
      boardVersion: boards.length,
      prompt: last(turns.filter((r) => r.skillId === 'DEV_PROMPT' && ok(r))),
      judge: last(turns.filter((r) => r.skillId === 'PLAN_JUDGE' && ok(r))),
    })
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}

/** 답 한 번 → 글(복사 · 다음 물음에 '앞 대화' 로 보내는 글). 모양이 안 맞은 답은 원문 */
export function turnText(r: AiRun): string {
  const s = obj(r.structured)
  if (!ok(r)) return (r.rendered || '').trim()
  switch (r.skillId) {
    case 'PLAN_TALK':
      return [str(s.answer), strs(s.questions).length ? `정해야 할 것: ${strs(s.questions).join(' / ')}` : '', strs(s.keep).length ? `정해진 것: ${strs(s.keep).join(' / ')}` : ''].filter(Boolean).join('\n')
    case 'PLAN_RESEARCH':
      return [
        str(s.answer),
        ...arr(s.findings)
          .map(obj)
          .slice(0, 8)
          .map((f) => `- [${str(f.grade) || '?'}] ${str(f.claim)}${str(f.source) ? ` (${str(f.source)})` : ''}`),
        strs(s.unknowns).length ? `못 찾은 것: ${strs(s.unknowns).join(' / ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    case 'PLAN_JUDGE':
      return [
        `판정: ${judgeVerdictLabel(s.verdict)}${str(s.oneLine) ? ` — ${str(s.oneLine)}` : ''}`,
        strs(s.mustFix).length ? `꼭 고칠 것: ${strs(s.mustFix).join(' / ')}` : '',
        ...arr(s.attacks)
          .map(obj)
          .slice(0, 8)
          .map((a) => `- [${str(a.level) || 'P1'}] ${str(a.point)}${str(a.fix) ? ` → ${str(a.fix)}` : ''}`),
      ]
        .filter(Boolean)
        .join('\n')
    case 'PLAN_LOCK':
      // 판 전체는 '지금 기획서 판' 으로 따로 간다 — 대화 줄에는 무엇이 바뀌었는지만
      return [`기획서 판을 굳힘: ${str(s.title)}`, strs(s.changed).length ? `바뀐 것: ${strs(s.changed).join(' / ')}` : '', strs(s.open).length ? `미정: ${strs(s.open).join(' / ')}` : ''].filter(Boolean).join('\n')
    case 'DEV_PROMPT':
      return [`개발 프롬프트를 뽑음 — 저장소 ${str(s.repoName)}`, strs(s.missing).length ? `비어 있는 것: ${strs(s.missing).join(' / ')}` : ''].filter(Boolean).join('\n')
    default:
      return (r.rendered || '').trim()
  }
}

/** 서버에 같이 보낼 앞 대화 — 최근 16번(오래된 것부터). 실패한 줄은 뺀다 */
export const HISTORY_TURNS = 16
export function historyFor(turns: readonly AiRun[]): TalkHistoryRow[] {
  return turns
    .filter((r) => r.status !== 'failed')
    .slice(-HISTORY_TURNS)
    .map((r) => ({ q: str(r.input?.task).slice(0, 1500), a: turnText(r).slice(0, 2500), mode: MODE_LABEL[modeOfRun(r)] }))
}

/** 서버에 같이 보낼 '지금 기획서 판' 글 — 대표가 고친 판이 있으면 그것 */
export function boardFor(board: AiRun | null, revised?: unknown): string {
  if (!board) return ''
  const s = revised && typeof revised === 'object' ? revised : board.structured
  return boardText(s).slice(0, 6000)
}

/** 다음에 무엇을 하면 좋은가(규칙) — 대표가 실제로 하는 순서대로 한 걸음 */
export interface TalkNext {
  mode: TalkMode
  label: string
  why: string
}
export function nextStep(t: Pick<TalkThread, 'turns' | 'board' | 'judge' | 'prompt'> | null): TalkNext | null {
  if (!t || !t.turns.length) return null
  const talks = t.turns.filter((r) => r.skillId === 'PLAN_TALK' || r.skillId === 'PLAN_RESEARCH').length
  const after = (a: AiRun | null, b: AiRun | null) => !!a && (!b || a.createdAt > b.createdAt)
  if (!t.board) {
    if (talks >= 3) return { mode: 'lock', label: '기획서 판으로 굳히기', why: `${talks}번 주고받았어요 — 정해진 것을 한 판으로 모아 두면 다음 물음이 그 판을 이어받아요` }
    return null
  }
  // 판이 있다 — 판을 굳힌 뒤 자체점검을 안 했으면 점검, 점검 뒤 판을 다시 안 굳혔으면 다시 굳히기, 다 됐으면 프롬프트
  if (!after(t.judge, t.board) && !t.judge) return { mode: 'judge', label: '자체점검 돌리기', why: '굳힌 판을 반대 입장에서 한 번 따져 보세요 — 약한 곳을 고친 뒤 개발로 넘깁니다' }
  if (after(t.judge, t.board)) {
    const v = str(obj(t.judge?.structured).verdict).toUpperCase()
    if (v !== 'GO') return { mode: 'lock', label: '고친 내용으로 판 다시 굳히기', why: '자체점검에서 고칠 곳이 나왔어요 — 대화로 고친 뒤 판을 다시 굳히세요' }
  }
  if (!after(t.prompt, t.board)) return { mode: 'prompt', label: '개발 프롬프트 뽑기', why: '판이 굳었어요 — 저장소 이름 · 처음 붙여 넣을 말까지 한 번에 뽑습니다' }
  return null
}

/** 대화 전체 → 글(내려받기 · 복사). 물음과 답을 순서대로 */
export function threadText(t: TalkThread, companyName: string): string {
  const head = [`# ${t.title}`, `${companyName} · ${FIELD_LABEL[t.field]} · 대화 ${t.turns.length}번`, '']
  const body = t.turns.flatMap((r, i) => [`## ${i + 1}. [${MODE_LABEL[modeOfRun(r)]}] ${str(r.input?.task) || MODE_DEFAULT_ASK[modeOfRun(r)]}`, '', r.rendered || turnText(r), ''])
  return [...head, ...body].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 다른 AI 창에서 하던 대화를 붙여 넣을 때 — 자료 제목(첫 줄에서) */
export function pastedTitle(text: string, today: string): string {
  const first = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return `가져온 대화 ${today}${first ? ` — ${first.slice(0, 24)}` : ''}`
}
