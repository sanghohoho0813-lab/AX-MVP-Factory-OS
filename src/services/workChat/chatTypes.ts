/**
 * D-250 대화창(특허 · 벤처 · 기업인증 첫 화면) — 대표 "LLM 채팅창처럼 앞에서 보이는 건 최대한 간편하게".
 *
 *   질문 하나 → 답 카드 하나. 답 카드는 짧은 글 몇 줄 + 단추(그 작업 화면으로 바로 · 복사 · 파일 올리기).
 *   시작 단추 · 쓴 말 → 주제 찾기 · 규칙 답은 여기와 pvChat/certChat (AI 아님). AI 답(대표만)은 화면이 /api/ai-assist 로.
 */
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistRow } from '../aiAssist/context'

export type ChatModule = 'pv' | 'cert'

/** 화면이 직접 처리하는 단추(주소 이동 · 복사가 아닌 것) */
export type ChatActKind = 'file' | 'sample' | 'new-spec' | 'pick-client' | 'ai'

export interface ChatAction {
  id: string
  label: string
  href?: string
  /** 누르면 이 글을 복사 */
  copy?: string
  act?: ChatActKind
  /** 누르면 이 말로 이어서 묻는다(정해진 답 · 비용 0) */
  ask?: string
  primary?: boolean
}

export interface ChatAnswer {
  /** 한 줄 답(결론 먼저) */
  title: string
  /** 근거 · 할 일 — 짧게 몇 줄 */
  lines: string[]
  tone: 'ok' | 'warn' | 'info'
  actions: ChatAction[]
  /** rule = 규칙으로 바로 계산(AI 아님) · ai = AI 답 */
  source: 'rule' | 'ai'
  /** 규칙 답의 주제 — [AI로 더 자세히] 를 누르면 이 주제로 다시 묻는다 */
  topic?: string
  next?: string[]
  caution?: string
  model?: string
}

export interface ChatTurn {
  id: string
  at: string
  /** 사람이 한 말(단추를 눌렀으면 그 단추 말) */
  q: string
  a: ChatAnswer | null
  status: 'done' | 'pending' | 'error'
  error?: string
}

export interface ChatStarter {
  id: string
  label: string
  /** 대화에 '내가 한 말' 로 남는 글 */
  ask: string
}

export interface ChatTopic {
  id: string
  words: RegExp
}

/** 쓴 말 → 주제(처음 맞는 것). 못 찾으면 null */
export function topicOf(text: string, topics: readonly ChatTopic[]): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  return topics.find((x) => x.words.test(t))?.id ?? null
}

export const HISTORY_MAX = 20

/** 저장 키 — 모듈 · 회사마다 따로(회사 없으면 none) */
export const historyKey = (module: ChatModule, clientId: string) => `axmvp.workchat.v1.${module}.${clientId || 'none'}`

/** 저장된 대화 읽기 — 깨졌거나 이상한 값은 버린다. 답을 기다리다 끊긴 것은 '끊김' 으로 */
export function parseHistory(raw: string | null): ChatTurn[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v
      .filter((t): t is ChatTurn => !!t && typeof t === 'object' && typeof (t as ChatTurn).id === 'string' && typeof (t as ChatTurn).q === 'string')
      .slice(-HISTORY_MAX)
      .map((t) => (t.status === 'pending' ? { ...t, status: 'error' as const, error: '화면을 떠나 답을 받지 못했어요 — 다시 물어봐 주세요' } : t))
  } catch {
    return []
  }
}

/** AI 답 → 답 카드 */
export function answerFromAi(ans: AssistAnswer | null, raw: string, model: string): ChatAnswer {
  if (!ans) {
    const text = String(raw ?? '').trim()
    return { title: text ? text.split('\n')[0].slice(0, 200) : 'AI 가 답을 정리하지 못했어요 — 다시 물어봐 주세요', lines: text.split('\n').slice(1, 8).filter((l) => l.trim()), tone: 'info', actions: [], source: 'ai', model }
  }
  return {
    title: ans.headline || '(답 없음)',
    lines: (ans.items ?? []).slice(0, 8).map((i) => [i.tag ? `[${i.tag}]` : '', i.title, i.detail ? `— ${i.detail}` : ''].filter(Boolean).join(' ')),
    tone: 'info',
    actions: [],
    source: 'ai',
    next: (ans.next ?? []).filter((n) => n && n.trim()).slice(0, 3),
    caution: ans.caution?.trim() || undefined,
    model,
  }
}

/** 답 카드 → 복사할 글 */
export function answerText(a: ChatAnswer): string {
  return [a.title, ...a.lines.map((l) => `- ${l}`), ...(a.next?.length ? ['', '다음:', ...a.next.map((n) => `- ${n}`)] : []), ...(a.caution ? ['', `확인: ${a.caution}`] : [])].join('\n')
}

/** AI 에 보낼 앞선 대화(최근 3개 · 질문은 가림 처리) */
export function historyRows(turns: readonly ChatTurn[]): AssistRow[] {
  return turns
    .filter((t) => t.status === 'done' && t.a)
    .slice(-3)
    .map((t) => ({ 질문: redactSensitive(t.q).text.slice(0, 200), 답: t.a!.title.slice(0, 200) }))
}

/** [사용 방법] 시트 한 단계 */
export interface ChatGuideStep {
  head: string
  body: string
}
