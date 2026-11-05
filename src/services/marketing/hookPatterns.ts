/**
 * D-546 첫마디 26가지(2026-11-05 대표 "다음 단계 고도화" — 마케팅 첫마디 방법 점검 뒤).
 *
 * 글 · 영상 맨 앞 한 줄(첫마디)을 쓰는 방법 26가지 — 쉬운 이름 · 언제 좋은지 · 우리 일 예시.
 *  - 주제 · 누구에게 · 방향을 넣으면 서로 다른 방법으로 10개를 바로 만든다(규칙 — AI 아님).
 *  - 숫자 · 기간 · 결과 · 비율은 지어내지 않는다 — [기간] · [결과] · [비율] 처럼 대괄호로 비워 둔다(사실로 채우기).
 *  - 부풀리는 말(역대급 · 대박 · 충격 · 무조건 · 꿀팁 · N분 컷 · 100% · 보장)은 틀에도 없고, AI 답에 있으면 표시한다.
 * [AI로 10개 새로 쓰기] 는 같은 26가지를 서버 단추(threads.hooks · shorts.hooks)에 보낸다.
 */
import { josa } from '../../lib/josa'
import type { AssistContext } from '../aiAssist/context'
import { isMarketingCustomer } from './persona'

export type HookAim = 'curious' | 'trust' | 'warn' | 'easy' | 'feel'
export type HookChannel = 'threads' | 'shorts'

export const HOOK_AIMS: ReadonlyArray<{ key: HookAim | ''; label: string; hint: string }> = [
  { key: '', label: '골고루', hint: '여러 방법을 고루 섞어서 — 처음이면 이것' },
  { key: 'curious', label: '궁금하게', hint: '끝까지 보고 싶게 — 아는 사람만 아는 것 · 상식 뒤집기 · 작은 차이' },
  { key: 'trust', label: '믿음 가게', hint: '결과 · 해 본 것 · 실제 사례로' },
  { key: 'warn', label: '손해 막기', hint: '하지 마세요 · 흔한 실수 · 꼭 알아야 할 것' },
  { key: 'easy', label: '쉽게 알려 주기', hint: '딱 세 가지 · 쉬운 순서 · 해결 방법' },
  { key: 'feel', label: '마음 알아주기', hint: '막막하셨죠 · 솔직한 말 · 나도 할 수 있다' },
]

export interface HookPattern {
  no: number
  /** 화면에 쓰는 쉬운 이름 */
  name: string
  /** 흔히 부르는 이름(설명에만) */
  aka: string
  /** 언제 좋은지 한 줄 */
  when: string
  aims: readonly HookAim[]
  /** 스레드 첫 줄(15~30자 안팎) — t = 주제 · p = 누구에게 */
  line: (t: string, p: string) => string
  /** 릴스 · 틱톡 첫마디(10자 안팎 · 2초 안) */
  short: (t: string, p: string) => string
  /** 쓸 때 조심할 것 */
  caution?: string
}

const ro = (t: string) => josa(t, '으로/로')
const eul = (t: string) => josa(t, '을/를')
const ga = (t: string) => josa(t, '이/가')

export const HOOK_PATTERNS: readonly HookPattern[] = [
  { no: 1, name: '결과 먼저', aka: '결과 강조형', when: '보여 줄 결과가 있을 때 — 맨 앞에 결과부터', aims: ['trust'], line: (t) => `${t}, 결과부터 말할게요 — [결과]`, short: () => `결과부터: [결과]`, caution: '실제 있었던 결과만 — 부풀리는 말(역대급 · 대박) 없이' },
  { no: 2, name: '아는 사람만 아는 것', aka: '비밀 · 희소성형', when: '잘 알려지지 않은 정보가 있을 때', aims: ['curious'], line: (t, p) => `${p}, ${t} 이거 모르면 손해예요.`, short: () => `이거 모르면 손해예요`, caution: '지어낸 선착순 · 마감은 쓰지 않기' },
  { no: 3, name: '전문가 한 줄 정리', aka: '전문가 압축 전달형', when: '오래 해 온 일을 짧게 정리해 줄 때', aims: ['easy', 'trust'], line: (t) => `${t} 상담 [N]년, 핵심만 한 번에 정리할게요.`, short: (t) => `${t}, 핵심만 짚을게요` },
  { no: 4, name: '요즘 흐름 + 문제', aka: '트렌드 + 문제 제기형', when: '다들 이야기하는 주제일 때 — 놓치는 점을 짚기', aims: ['curious'], line: (t) => `요즘 다들 ${t} 얘기하는데, 정작 놓치는 게 있어요.`, short: (t) => `다들 놓치는 ${t} 하나` },
  { no: 5, name: '상식 뒤집기', aka: '상식 파괴형', when: '흔히 잘못 알려진 것이 있을 때', aims: ['curious'], line: (t) => `${t}에 대해 흔히 듣는 말, 사실은 반대예요.`, short: (t) => `${t}, 반대로 아세요` },
  { no: 6, name: '해결 방법', aka: '해결책 제시형', when: '막히는 지점이 분명할 때 — 푸는 길을 바로', aims: ['easy'], line: (t) => `${t}에서 막혔다면, 이렇게 풀면 돼요.`, short: (t) => `${t} 막혔다면 이것부터` },
  { no: 7, name: '나도 할 수 있다', aka: '가능성 확장형', when: '어렵게 느끼는 사람에게 — 해 볼 수 있다는 마음', aims: ['feel', 'easy'], line: (t, p) => `${p}도 ${t}, 생각보다 어렵지 않아요.`, short: (t) => `${t}, 생각보다 쉬워요`, caution: '자격이 정말 되는 경우만 — "누구나 받는" 같은 말은 쓰지 않기' },
  { no: 8, name: '회사가 달라진 이야기', aka: '브랜드 성장 사례형', when: '도와 드린 회사의 달라진 과정이 있을 때', aims: ['trust'], line: (t) => `작은 회사가 ${ro(t)} 달라진 과정, 그대로 보여 드릴게요.`, short: (t) => `${ro(t)} 달라진 회사`, caution: '고객 이름 · 매출 · 계약금액은 빼고 — 동의 받은 사례만' },
  { no: 9, name: '새 기회', aka: '새로운 기회 발견형', when: '새로 열리거나 바뀐 것이 있을 때', aims: ['curious'], line: (t) => `${t}, 지금 새로 볼 만한 기회가 하나 있어요.`, short: (t) => `${t} 새 기회 하나`, caution: '날짜 · 기관 · 바뀐 내용은 공식 공고로 확인한 뒤에' },
  { no: 10, name: '실제 결과 보여 주기', aka: '성과 인증형', when: '숫자로 보여 줄 수 있는 결과가 있을 때', aims: ['trust'], line: (t) => `${t}, 실제로 받은 결과를 그대로 보여 드려요: [결과]`, short: (t) => `${t} 실제 결과 공개`, caution: '실제 결과만 · 고객 동의 · 보장처럼 들리지 않게' },
  { no: 11, name: '마음 알아주기', aka: '감정 공감형', when: '막막함 · 걱정을 먼저 알아줄 때', aims: ['feel'], line: (t, p) => `${p}, ${t} 알아볼 때마다 막막하셨죠?`, short: (t) => `${t}, 막막하셨죠?` },
  { no: 12, name: '꼭 알아야 할 것', aka: '필수 개념 강조형', when: '시작 전에 알아야 할 것이 하나 있을 때', aims: ['warn', 'easy'], line: (t, p) => `${p}, ${t} 시작 전에 이것 하나는 꼭 알고 가세요.`, short: (t) => `${t} 전에 이것 하나` },
  { no: 13, name: '하지 마세요', aka: '경고형', when: '먼저 하면 손해인 순서가 있을 때', aims: ['warn'], line: (t, p) => `${p}, ${t} 이것 확인 전엔 시작하지 마세요.`, short: (t) => `${t}, 아직 하지 마세요` },
  { no: 14, name: '해 봤더니', aka: '실험 결과형', when: '직접 해 본 결과가 있을 때', aims: ['trust', 'curious'], line: (t) => `${eul(t)} [기간] 동안 직접 해 봤어요. 결과는 [결과].`, short: (t) => `${t} 직접 해 봤더니` },
  { no: 15, name: '흔한 실수', aka: '흔한 실수형', when: '많이 틀리는 것이 있을 때', aims: ['warn'], line: (t, p) => `${p}들이 ${t}에서 가장 많이 하는 실수 3가지.`, short: (t) => `${t} 실수 3가지` },
  { no: 16, name: '놀라운 숫자', aka: '통계 강조형', when: '공식 통계 숫자가 있을 때만', aims: ['curious', 'warn'], line: (t) => `${t}, [비율]의 회사가 이걸 놓치고 있어요.`, short: (t) => `[비율]가 놓치는 ${t}`, caution: '숫자는 공식 통계에 있을 때만 — 없으면 이 방법은 쓰지 않기' },
  { no: 17, name: '작은 차이 하나', aka: '디테일 분석형', when: '결과를 가른 작은 차이를 짚을 때', aims: ['curious'], line: (t) => `${t} 결과를 가른 건 아주 작은 차이 하나였어요.`, short: (t) => `${t}, 차이는 딱 하나` },
  { no: 18, name: '솔직한 현실', aka: '현실 직시형', when: '듣기 좋은 말 대신 사실을 말할 때', aims: ['feel', 'warn'], line: (t) => `${t}, 솔직히 말하면 아무나 되는 건 아니에요.`, short: (t) => `${t}, 솔직히 말할게요` },
  { no: 19, name: '전후 이야기', aka: '변화 스토리형', when: '처음과 지금이 분명히 다를 때', aims: ['trust', 'feel'], line: (t) => `[처음 상황]이던 회사가 ${ro(t)} [지금 결과]까지 온 과정.`, short: () => `[처음] → [지금], 이렇게요` },
  { no: 20, name: '지금이 기회인 까닭', aka: '시장 기회형', when: '왜 하필 지금인지 말할 수 있을 때', aims: ['curious'], line: (t, p) => `${p}에게 지금 ${ga(t)} 기회인 까닭.`, short: (t) => `지금 ${ga(t)} 기회인 까닭` },
  { no: 21, name: '작은 것 하나로 큰 차이', aka: '작은 행동 큰 결과형', when: '작은 행동으로 달라지는 것이 있을 때', aims: ['easy'], line: (t) => `${t}, 작은 것 하나만 바꿔도 결과가 달라져요.`, short: (t) => `${t}, 이것만 바꿔도` },
  { no: 22, name: '딱 세 가지', aka: '빠른 이해형', when: '짧게 이해시키고 싶을 때', aims: ['easy'], line: (t) => `${t}, 딱 세 가지만 알면 돼요.`, short: (t) => `${t} 딱 세 가지`, caution: '"N분 컷" 같은 과장 대신 "딱 세 가지"' },
  { no: 23, name: '반대 의견', aka: '반대 의견형', when: '흔한 조언과 다르게 생각할 때', aims: ['curious'], line: (t) => `다들 ${t}부터 하라는데, 저는 반대로 말해요.`, short: (t) => `${t}, 저는 반대예요` },
  { no: 24, name: '기간 안에 낸 결과', aka: '기간 성과형', when: '얼마 만에 무엇을 했는지 말할 수 있을 때', aims: ['trust'], line: (t) => `[기간] 만에 [결과]. ${t}, 이렇게 했어요.`, short: () => `[기간] 만에 [결과]` },
  { no: 25, name: '이렇게 써요', aka: '기능 활용형', when: '요즘 말 많은 것을 우리 일에 쓰는 법', aims: ['easy'], line: (t) => `요즘 말 많은 ${t}, 우리 회사 일에 이렇게 써요.`, short: (t) => `${t}, 이렇게 써요` },
  { no: 26, name: '쉬운 순서', aka: '쉬운 방법 제시형', when: '따라 하기 쉬운 순서가 있을 때', aims: ['easy'], line: (t) => `${t}, 누구나 따라 하는 쉬운 순서 3단계.`, short: (t) => `${t} 쉬운 순서 3단계` },
]

/**
 * 골고루일 때 순서 — 우리 스레드 실측에서 센 첫 줄(고백 · 숫자 · 결과 · 대상 부르기 · 금지 · 반전)을 앞에,
 * 서로 다른 방향이 번갈아 나오게.
 */
const MIX_ORDER = [11, 1, 2, 13, 5, 15, 22, 14, 9, 18, 24, 12, 20, 23, 17, 6, 26, 21, 19, 8, 10, 3, 4, 7, 16, 25]

export function hookPattern(no: number): HookPattern | undefined {
  return HOOK_PATTERNS.find((p) => p.no === no)
}

/** 방향에 맞는 방법 먼저, 나머지는 골고루 순서대로 — 26가지 전부(겹침 없이) */
export function hookOrder(aim: HookAim | ''): number[] {
  if (!aim) return [...MIX_ORDER]
  const first = MIX_ORDER.filter((n) => hookPattern(n)?.aims.includes(aim))
  return [...first, ...MIX_ORDER.filter((n) => !first.includes(n))]
}

export interface HookLine {
  no: number
  name: string
  line: string
  when: string
  caution?: string
}

export function defaultTarget(): string {
  return isMarketingCustomer() ? '사장님' : '대표님'
}

/** 대상 칩 — 대표 계정은 우리 고객(중소기업 대표), 다른 계정은 넓게 */
export function targetChips(): readonly string[] {
  return isMarketingCustomer() ? ['사장님', '처음 알아보는 분', '단골 손님'] : ['대표님', '창업 3년 안 된 대표님', '직원 5명 넘는 회사 대표님', '제조업 대표님']
}

/**
 * 주제 · 누구에게 · 방향 → 서로 다른 방법으로 첫마디 n개(규칙). page 로 다음 10개(26가지를 돌아가며).
 */
export function draftFirstLines(input: { topic: string; target?: string; aim?: HookAim | ''; channel?: HookChannel; page?: number; n?: number }): HookLine[] {
  const t = input.topic.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!t) return []
  const p = (input.target ?? '').trim().replace(/\s+/g, ' ').slice(0, 30) || defaultTarget()
  const n = Math.max(1, Math.min(input.n ?? 10, HOOK_PATTERNS.length))
  const order = hookOrder(input.aim ?? '')
  const start = ((input.page ?? 0) * n) % order.length
  const picked = Array.from({ length: n }, (_, i) => order[(start + i) % order.length])
  return picked.map((no) => {
    const h = hookPattern(no) as HookPattern
    const line = (input.channel === 'shorts' ? h.short(t, p) : h.line(t, p)).replace(/\s+/g, ' ').trim()
    return { no, name: h.name, line, when: h.when, ...(h.caution ? { caution: h.caution } : {}) }
  })
}

/** 부풀리는 말 · 보장 말 — 첫마디에 있으면 화면이 표시한다(규칙) */
const HYPE = /역대급|대박|충격|무조건|꿀팁|\d+\s*분\s*컷|100\s*%|보장|누구나\s*받|공짜|선착순/
export function hookWarn(line: string): string {
  const m = HYPE.exec(line)
  return m ? `'${m[0]}' 같은 부풀리는 말은 빼 주세요` : ''
}

/** AI 단추에 보낼 자료 — 주제 · 누구에게 · 방향 · 어디에 + 26가지(이름 · 언제 · 예시 틀) */
export function hooksContext(input: { topic: string; target: string; aim: HookAim | ''; channel: HookChannel; facts?: string; today: string }): AssistContext {
  const aim = HOOK_AIMS.find((a) => a.key === input.aim)
  const t = input.topic.trim()
  const p = input.target.trim() || defaultTarget()
  const facts = (input.facts ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12)
  const customer = isMarketingCustomer()
  return {
    title: '첫마디 10개',
    today: input.today,
    purpose: input.channel === 'shorts' ? (customer ? '내 릴스 · 틱톡 영상 첫마디' : '김팀장(미래AI랩) 릴스 · 틱톡 영상 첫마디') : customer ? '내 스레드 글 첫 줄' : '김팀장(미래AI랩) 스레드 글 첫 줄',
    sections: [
      {
        name: '첫마디 만들기',
        rows: [
          {
            주제: t || '(비어 있음)',
            누구에게: p,
            방향: aim && aim.key ? `${aim.label} — ${aim.hint}` : '골고루(방향을 고르지 않음 — 서로 다른 방향을 섞어서)',
            어디에: input.channel === 'shorts' ? '릴스 · 틱톡 영상 첫마디(10자 안팎 · 2초 안)' : '스레드 글 첫 줄(15~25자)',
          },
        ],
      },
      {
        name: '첫마디 방법 26가지',
        rows: hookOrder(input.aim).map((no) => {
          const h = hookPattern(no) as HookPattern
          return { 방법: h.name, 언제: h.when, 예시틀: input.channel === 'shorts' ? h.short('[주제]', '[누구에게]') : h.line('[주제]', '[누구에게]'), ...(h.caution ? { 조심: h.caution } : {}) }
        }),
      },
    ],
    ...(facts.length ? { facts: facts.map((f) => `이번 글에 더 쓸 사실: ${f}`) } : {}),
  }
}

/** threads.hooks · shorts.hooks 답 → 첫마디 목록(빈 줄 · 같은 줄은 버림) */
export function parseHookAnswer(a: { items?: ReadonlyArray<{ title?: unknown; tag?: unknown; detail?: unknown; body?: unknown }> } | null): HookLine[] {
  if (!a || !Array.isArray(a.items)) return []
  const seen = new Set<string>()
  const out: HookLine[] = []
  for (const it of a.items) {
    const line = String(it.title ?? it.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!line || seen.has(line)) continue
    seen.add(line)
    const name = String(it.tag ?? '').trim().slice(0, 30)
    const known = HOOK_PATTERNS.find((h) => h.name === name)
    out.push({ no: known?.no ?? 0, name: name || '첫마디', line, when: String(it.detail ?? '').trim().slice(0, 120) })
    if (out.length >= 12) break
  }
  return out
}
