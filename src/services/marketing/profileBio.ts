/**
 * D-588 프로필 소개 글 — 글에서는 팔지 않고 '상담 · 연락은 프로필로' 보내라고 하는데, 정작 프로필에 뭐라고 쓸지에서 막힌다.
 *
 * 내 브랜드에 적은 것(이름 · 분야 · 전문분야 · 주요 고객 · 끝인사)으로 채널별 소개 글 초안 세 가지를 만든다.
 *  - 적지 않은 칸은 [대괄호] 로 비운다 — 지어내지 않는다. 숫자 · 경력은 '확인된 사실' 에 적은 한 줄만 쓴다.
 *  - 채널마다 길이 한도가 다르다: 스레드 · 인스타그램 150자 · 틱톡 80자 · 유튜브 채널 설명 1,000자(첫 두 줄이 먼저 보인다).
 *  - 한도를 넘으면 덜 중요한 것부터 뺀다(사실 한 줄 → 전문분야 셋째 · 둘째). 그래도 넘으면 넘는다고 알려 준다(사람이 줄인다).
 * 규칙 계산이다 — AI 가 아니다. 저장하지 않는다.
 */
import type { BrandProfile } from '../brandProfile'

export type BioChannel = 'sns' | 'tiktok' | 'youtube'

export const BIO_CHANNELS: ReadonlyArray<{ key: BioChannel; label: string; limit: number; hint: string }> = [
  { key: 'sns', label: '스레드 · 인스타그램', limit: 150, hint: '150자까지 — 누구를 돕는지 한눈에 보이게' },
  { key: 'tiktok', label: '틱톡', limit: 80, hint: '80자까지 — 한두 줄로' },
  { key: 'youtube', label: '유튜브 채널 설명', limit: 1000, hint: '첫 두 줄이 먼저 보여요 — 누구를 위한 채널인지부터' },
]

export interface BioInput {
  /** 부르는 이름 · 회사(프로필에 보일 이름) */
  name: string
  /** 분야 한마디(예: 정책자금 컨설팅) */
  field: string
  /** 도와주는 일 — ' · ' 나 쉼표로 여러 개 */
  helps: string
  /** 누구를 돕나(예: 제조업 중소기업 대표) */
  audience: string
  /** 연락 받는 길 한 줄(예: 문의는 프로필 링크로) */
  contact: string
  /** 확인된 사실 한 줄(없으면 빈 글 — 지어내지 않는다) */
  fact: string
}

export const BIO_FIELDS: ReadonlyArray<{ key: keyof BioInput; label: string; placeholder: string; blank: string }> = [
  { key: 'name', label: '이름 · 회사', placeholder: '예: 박 컨설턴트 · ○○경영컨설팅', blank: '[이름]' },
  { key: 'field', label: '분야', placeholder: '예: 정책자금 컨설팅', blank: '[분야]' },
  { key: 'helps', label: '도와주는 일', placeholder: '예: 정책자금 · 고용지원금 · 기업부설연구소', blank: '[도와주는 일]' },
  { key: 'audience', label: '누구를 돕나요', placeholder: '예: 제조업 중소기업 대표', blank: '[주요 고객]' },
  { key: 'contact', label: '연락 받는 길', placeholder: '예: 문의는 프로필 링크(카카오톡 채널)로', blank: '[연락 받는 길]' },
  { key: 'fact', label: '확인된 사실 한 줄(없으면 비워 두세요)', placeholder: '예: 2015년부터 중소기업 상담', blank: '' },
]

export interface BioDraft {
  key: 'who' | 'list' | 'ask'
  /** 이 초안의 성격 한마디 */
  label: string
  text: string
  /** 글자 수(줄바꿈 포함) */
  length: number
  /** 한도를 넘었는가 */
  over: boolean
}

/** 내 브랜드 → 소개 글 재료. 끝인사가 '댓글로 남겨 주세요' 같은 글용 인사면 연락 받는 길로는 쓰지 않는다(프로필에는 댓글이 없다) */
export function bioInputFromBrand(b: BrandProfile | null): BioInput {
  const ending = (b?.ending ?? '').trim()
  const facts = (b?.facts ?? '')
    .split(/\s*(?:[·;\n]|\s\/\s)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    name: (b?.name || b?.company || '').trim(),
    field: (b?.industry ?? '').trim(),
    helps: (b?.specialties ?? '').trim(),
    audience: (b?.audience ?? '').trim(),
    contact: /댓글/.test(ending) ? '' : ending,
    fact: facts[0] ?? '',
  }
}

/** 받침에 맞는 조사 — 마지막 글자가 한글이 아니면(괄호 · 영문) 둘 다 적는다 */
export function josa(word: string, withBatchim: string, without: string): string {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  if (!ch || code < 0xac00 || code > 0xd7a3) return `${word}${withBatchim}(${without})`
  return `${word}${(code - 0xac00) % 28 === 0 ? without : withBatchim}`
}

const splitHelps = (helps: string): string[] =>
  helps
    .split(/\s*[·,/、]\s*|\s+및\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

const len = (s: string) => [...s].length

interface Parts {
  name: string
  field: string
  helps: string[]
  audience: string
  contact: string
  fact: string
}

function partsOf(input: BioInput): Parts {
  const helps = splitHelps(input.helps)
  return {
    name: input.name.trim() || '[이름]',
    field: input.field.trim() || '[분야]',
    helps: helps.length ? helps : ['[도와주는 일]'],
    audience: input.audience.trim() || '[주요 고객]',
    contact: input.contact.trim() || '[연락 받는 길]',
    fact: input.fact.trim(),
  }
}

type Build = (p: Parts, nHelps: number, withFact: boolean) => string

/** 한도 안에 들어올 때까지 덜 중요한 것부터 뺀다 — 사실 한 줄 → 전문분야 수 */
function fit(p: Parts, limit: number, build: Build): { text: string; over: boolean } {
  const max = Math.min(3, p.helps.length)
  // 사실 한 줄은 전문분야를 줄이기 전에 먼저 뺀다(한 번 빼면 다시 넣지 않는다)
  const tries: Array<[number, boolean]> = p.fact ? [[max, true]] : []
  for (let n = max; n >= 1; n--) tries.push([n, false])
  let last = ''
  for (const [n, f] of tries) {
    last = build(p, n, f)
    if (len(last) <= limit) return { text: last, over: false }
  }
  return { text: last, over: true }
}

/** 줄 잇기 — false 는 빼고, 빈 글('')은 빈 줄(문단 띄움)로 남긴다 */
const lines = (...xs: Array<string | false>) => xs.filter((x): x is string => x !== false).join('\n')

/** '문의: …' 줄 — 연락 받는 길이 이미 '문의는 …' 처럼 시작하면 겹쳐 쓰지 않는다 */
const ask = (contact: string) => (/^\s*(문의|상담|연락)/.test(contact) ? contact : `문의: ${contact}`)

const SNS: Record<BioDraft['key'], Build> = {
  who: (p, n, f) => lines(`${p.audience}의 ${p.helps.slice(0, n).join(' · ')}, 쉬운 말로 알려 드려요.`, `${p.field} | ${p.name}`, f && p.fact ? p.fact : false, p.contact),
  list: (p, n, f) => lines(`${p.name} | ${p.field}`, ...p.helps.slice(0, n).map((h) => `· ${h}`), f && p.fact ? p.fact : false, p.contact),
  ask: (p, _n, f) => lines(`${josa(p.audience, '이라면', '라면')}, ${p.helps[0]} 놓치고 있진 않으세요?`, `${josa(p.name, '이', '가')} 하나씩 정리해 올려요.`, f && p.fact ? p.fact : false, p.contact),
}

const TIKTOK: Record<BioDraft['key'], Build> = {
  who: (p, n) => `${p.audience}의 ${p.helps.slice(0, Math.min(n, 2)).join(' · ')}, 쉬운 말로 | ${p.name}`,
  list: (p, n) => `${p.field} ${p.name} — ${p.helps.slice(0, Math.min(n, 2)).join(' · ')} 정리해 드려요`,
  ask: (p) => lines(`${p.helps[0]}, 놓치고 있진 않으세요?`, `${p.name} | ${p.contact}`),
}

const YOUTUBE: Record<BioDraft['key'], Build> = {
  who: (p, n, f) =>
    lines(
      `${josa(p.audience, '을', '를')} 위한 ${p.field} 채널입니다.`,
      `${josa(p.helps.slice(0, n).join(' · '), '을', '를')} 쉬운 말로 정리해 올립니다.`,
      '',
      '이런 분께 도움이 돼요',
      `· ${p.audience}`,
      `· ${josa(p.helps[0], '이', '가')} 궁금한데 어디서부터 봐야 할지 모르는 분`,
      '',
      '올라오는 것',
      ...p.helps.slice(0, n).map((h) => `· ${h}`),
      '',
      `${p.name} 소개`,
      f && p.fact ? p.fact : `${p.field} 일을 하고 있어요.`,
      '',
      ask(p.contact),
    ),
  list: (p, n, f) =>
    lines(
      `${p.name} — ${p.field}`,
      `${p.audience}께 ${josa(p.helps.slice(0, n).join(' · '), '을', '를')} 알려 드립니다.`,
      '',
      ...p.helps.slice(0, n).map((h) => `· ${h}`),
      f && p.fact ? `· ${p.fact}` : false,
      '',
      ask(p.contact),
    ),
  ask: (p, n, f) =>
    lines(
      `${p.helps[0]}, 우리 회사도 될까요?`,
      `${p.audience}께서 자주 묻는 것을 ${josa(p.name, '이', '가')} 하나씩 답합니다.`,
      '',
      '이 채널에서 다루는 것',
      ...p.helps.slice(0, n).map((h) => `· ${h}`),
      '',
      f && p.fact ? p.fact : false,
      ask(p.contact),
    ),
}

const BUILDERS: Record<BioChannel, Record<BioDraft['key'], Build>> = { sns: SNS, tiktok: TIKTOK, youtube: YOUTUBE }

const DRAFT_LABEL: Record<BioDraft['key'], string> = {
  who: '누구를 돕는지 먼저',
  list: '하는 일을 줄줄이',
  ask: '질문으로 시작',
}

/** 채널별 소개 글 초안 세 가지 */
export function bioDrafts(input: BioInput, channel: BioChannel): BioDraft[] {
  const p = partsOf(input)
  const limit = BIO_CHANNELS.find((c) => c.key === channel)?.limit ?? 150
  return (['who', 'list', 'ask'] as const).map((key) => {
    const { text, over } = fit(p, limit, BUILDERS[channel][key])
    return { key, label: DRAFT_LABEL[key], text, length: len(text), over }
  })
}

/** 아직 비어 있어 [대괄호] 로 나오는 칸 이름들(사실 한 줄은 비워도 된다) */
export function bioBlanks(input: BioInput): string[] {
  return BIO_FIELDS.filter((f) => f.blank && !input[f.key].trim()).map((f) => f.label)
}
