/**
 * D-273 릴스 · 틱톡(유튜브 쇼츠 포함) — 대표 "릴스 틱톡 파트도 따로 · 60대도 쓸 수 있게 쉽고 간편하게".
 * 대표가 준 숏폼 실측 공식(틱톡 · 릴스 승 · 패 비교)을 그대로:
 *  - 어디에(틱톡 · 쇼츠 / 릴스) → 무엇을(많이 보이게 / 문의 · 댓글) → 형식 5가지(리스트 · 대화 · 화면 시연 · 댓글형 글자 · 금지형 한 화면)
 *  - 대본 · 캡션 · 해시태그를 규칙으로 바로 확인(lintShort — 규칙 계산, AI 아님): 첫마디 10자 · 인사 없이 · 5초 안 숫자 · 길이 · CTA · 캡션 · 해시태그 수.
 *  - 올린 뒤 숫자 → 점수(좋아요 + 댓글×3 — 실측 판정과 같은 계산) · 저장 · 공유율 · 형식별 평균.
 * 저장은 기존 모듈 기록(moduleData · marketing / shorts). 출처 이름 · 남의 계정은 두지 않는다.
 */
import { generateId } from '../../storage/localStore'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { AX_AS_MONEY, AX_DENIED, HYPE, LINK, numberLint, principleLint } from './snsRules'
import { isMarketingCustomer, mkText } from './persona'

export const SHORTS_MODULE = 'marketing'
export const SHORTS_BUCKET = 'shorts'

export type ShortPlatform = 'tiktok' | 'reels'
/** reach = 많이 보이게(틱톡 노출형 · 릴스 조회형), convert = 문의로(틱톡 전환형 · 릴스 댓글형) */
export type ShortAim = 'reach' | 'convert'
export type ShortFormatKey = 'list' | 'talk' | 'demo' | 'comment' | 'ban'

export const PLATFORMS: ReadonlyArray<{ key: ShortPlatform; label: string; hint: string; length: string }> = [
  { key: 'tiktok', label: '틱톡 · 유튜브 쇼츠', hint: '말로 설명하는 40~60초', length: '40~70초' },
  { key: 'reels', label: '인스타 릴스', hint: '20초 안팎 · 글자 화면만도 됨', length: '20~25초' },
]

export const AIMS: Readonly<Record<ShortPlatform, ReadonlyArray<{ key: ShortAim; label: string; hint: string }>>> = {
  tiktok: [
    { key: 'reach', label: '많이 보이게', hint: '끝에 권유 없이 — 저장 · 공유가 붙어요' },
    { key: 'convert', label: '문의로 잇기', hint: '끝에 한 줄만 — 노출 3번에 1번' },
  ],
  reels: [
    { key: 'reach', label: '많이 보이게', hint: '끝에 권유 없이 — 짧게' },
    { key: 'convert', label: '댓글 받기', hint: "'키워드 댓글 남기면 정리본' 하나만 — 자료가 있을 때" },
  ],
}

export interface ShortFormat {
  key: ShortFormatKey
  name: string
  platforms: ShortPlatform[]
  aims: ShortAim[]
  /** 릴스에서는 목적이 다를 때(화면 시연 25초판은 많이 보이게) */
  reelsAims?: ShortAim[]
  seconds: string
  /** 한 줄로 — 어떻게 찍나 */
  how: string
  /** 실측 */
  why: string
  caution?: string
  /** 우리 버전 예시 대본(사실 목록에 있는 것만 · [대괄호]는 확인 후) */
  example: string
  exampleCaption: string
  exampleTags: string
  /** 릴스용 예시(짧은 판)가 따로 있을 때 */
  reelsExample?: string
  reelsCaption?: string
}

export const SHORT_FORMATS: readonly ShortFormat[] = [
  {
    key: 'list',
    name: '리스트형',
    platforms: ['tiktok'],
    aims: ['reach'],
    seconds: '약 35초',
    how: '첫마디 → "딱 세 가지만" → 첫째 · 둘째 · 셋째(숫자) → 끝',
    why: '리스트 · 화면 시연이 틱톡 저장 · 공유 1위.',
    // 규칙집 19: 말로 하는 저장 유도는 쓰지 않는다 — 예시 끝 줄을 그에 맞췄다
    example:
      '[0:00] 창업 3년 안이면,  (화면 큰 글자: 창업 3년 안)\n[0:01] 이거 모르면 세금 더 낼 수 있어요.\n[0:04] 벤처기업확인, 딱 세 가지만 보세요.\n[0:07] 첫째, 시점. 창업 3년 안에 확인받아야 법인세·소득세 5년 50% 감면 요건이 됩니다.\n[0:15] 둘째, 숫자. 한 해 이익 1억, 5년 같다고 단순 계산하면 법인은 약 1,650만 원, 개인사업자는 약 4,890만 원 차이예요.\n[0:25] 셋째, 근거. 우리 기술을 보여 줄 특허 출원이나 작동하는 화면이 있는지.\n[0:32] 세 개 다 걸리면, 지금 따져 볼 때예요.',
    exampleCaption: '창업 3년 안 대표님만 (요건 충족 시 · 결과는 확인기관이 정합니다)',
    exampleTags: '#벤처기업확인 #창업 #세금',
  },
  {
    key: 'talk',
    name: '대화형',
    platforms: ['tiktok'],
    aims: ['reach'],
    seconds: '약 30초',
    how: '대표가 묻고 김팀장이 짧게 답하기 — 화면 큰 글자에 같은 말',
    why: '혼자 설명보다 대화가 끝까지 봐요(사람 모으기).',
    caution: '실제 상담에서 나온 질문만 — 지어낸 대사 금지.',
    example:
      '대표: AX 하면 정책자금 나와요?  (화면 큰 글자 같은 말)\n김팀장: 그건 따로예요.\n대표: 그럼 왜 해요?\n김팀장: 요즘 서류가 다 비슷하거든요. 직접 눌러 볼 수 있는 화면 하나가 비슷한 회사들 사이에서 눈에 띄는 자료가 돼요.\n대표: 자금은요?\n김팀장: 그건 대표님 신용, 재무, 체납 같은 기본 컨디션이 먼저예요. 그것부터 같이 봐요.\n대표: …솔직하시네요.',
    exampleCaption: 'AX는 자금 받는 수단이 아닙니다 (결과는 기관 심사로 정해집니다)',
    exampleTags: '#AX #정책자금 #중소기업',
  },
  {
    key: 'demo',
    name: '화면 시연형',
    platforms: ['tiktok', 'reels'],
    aims: ['convert', 'reach'],
    reelsAims: ['reach'],
    seconds: '약 40초 (릴스는 25초판)',
    how: '손으로 하던 일 → 실제 만든 화면 → 바뀐 것 → 끝 한 줄',
    why: '틱톡 저장률 1위 · 릴스 승 19% 대 패 6%.',
    caution: '실제로 만든 화면만 · 고객사 이름 · 숫자는 가림.',
    example:
      '[0:00] 이거 아직 손으로 해요?  (화면: 주문서 보며 엑셀에 옮겨 적는 손)\n[0:02] 주문서 보고 엑셀, 엑셀 보고 견적서.\n[0:05] 마지막엔 대표님이 하나하나 확인하고요.\n[0:08] 이걸 화면 하나로 바꾸면 이렇게 돼요.  (화면: 실제 만든 입력 화면 · 고객사 정보 가림)\n[0:11] [주문을 한 번 넣으면 생기는 것 — 실제 기능만]\n[0:22] 큰 시스템 말고, 매일 반복되는 일 하나부터.\n[0:26] 이런 첫 화면은 2주면 만들어요.\n[0:30] 우리 회사는 어디부터인지, 프로필에서 3분 진단부터 해 보세요.',
    exampleCaption: '매일 반복되는 일 하나부터 화면으로',
    exampleTags: '#AX #업무자동화 #중소기업',
    // 릴스 25초판 — 0:22 까지(끝에 권유 없이)
    reelsExample:
      '[0:00] 이거 아직 손으로 해요?  (화면: 주문서 보며 엑셀에 옮겨 적는 손)\n[0:02] 주문서 보고 엑셀, 엑셀 보고 견적서.\n[0:05] 마지막엔 대표님이 하나하나 확인하고요.\n[0:08] 이걸 화면 하나로 바꾸면 이렇게 돼요.  (화면: 실제 만든 입력 화면 · 고객사 정보 가림)\n[0:11] [주문을 한 번 넣으면 생기는 것 — 실제 기능만]\n[0:22] 큰 시스템 말고, 매일 반복되는 일 하나부터.',
    reelsCaption: '매일 반복되는 일 하나부터 — 큰 시스템 말고, 화면 한 장으로 바꾼 모습입니다.',
  },
  {
    key: 'comment',
    name: '댓글형 글자 영상',
    platforms: ['reels'],
    aims: ['convert'],
    seconds: '약 12초',
    how: '글자 화면 4장 → 마지막 장 "댓글에 ○○" · 캡션에 요약 3줄 + 같은 키워드',
    why: '자금 · 세금 분야에서 잘 된 릴스의 71%가 이 방식(받는 것이 크고 구체적일 때만).',
    caution: '자료를 실제로 만든 뒤에만 · DM 은 직접.',
    example:
      "화면 1 (0~3초) 창업 3년 지나면 못 받는 세금 혜택\n화면 2 (3~7초) 요건 맞으면 법인세·소득세 5년 50%  (한 해 이익 1억 · 5년 단순 계산: 법인 약 1,650만 원 / 개인 약 4,890만 원)\n화면 3 (7~10초) 내가 해당되는지 4가지 체크\n화면 4 (10~12초) 체크리스트 받기 → 댓글에 '체크'",
    exampleCaption: "창업 3년 안 대표님만 보세요.\n벤처기업확인은 '언제' 받느냐에 따라 세금 혜택이 갈립니다.\n업종 제한 · 유형 · 기술 근거 · 조직, 4가지만 먼저 체크해 보세요.\n체크리스트가 필요하면 댓글에 '체크' 남겨 주세요.\n(요건 충족 시 · 결과는 확인기관이 정합니다)",
    exampleTags: '#벤처기업확인 #창업',
  },
  {
    key: 'ban',
    name: '금지형 한 화면',
    platforms: ['reels', 'tiktok'],
    aims: ['reach'],
    seconds: '약 9초',
    how: '한 화면에 "○○ 전에 이것부터 하지 마세요" + ✕ 둘 · ○ 둘',
    why: "'금지 + 순서' 틀은 같은 소재가 다른 두 계정에서 모두 터졌어요.",
    caution: '✕ · ○ 항목은 사실 확인 후.',
    example: '화면 (한 장, 0~9초) 벤처기업확인 전에 이것부터 하지 마세요\n✕ 서류부터 쓰기\n✕ 무작정 신청부터\n○ 업종 제한 여부 먼저 확인\n○ 보여 줄 기술 근거(특허 출원 · 작동하는 화면) 먼저',
    exampleCaption: '순서만 바꿔도 덜 헤맵니다.',
    exampleTags: '#벤처기업확인',
  },
]

export const formatOf = (k: string): ShortFormat | undefined => SHORT_FORMATS.find((f) => f.key === k)
export const aimsOf = (f: ShortFormat, p: ShortPlatform): ShortAim[] => (p === 'reels' && f.reelsAims ? f.reelsAims : f.aims)
export const formatsFor = (p: ShortPlatform, a: ShortAim | ''): ShortFormat[] => SHORT_FORMATS.filter((f) => f.platforms.includes(p) && (!a || aimsOf(f, p).includes(a)))
/** 이 플랫폼의 예시 대본 · 캡션 */
/** SAAS-2 고객 예시 — 대표 상품 문장(2주 첫 화면 · 3분 진단)은 [대괄호] 빈칸으로, '김팀장:' 은 그 사람 이름으로. 대표 계정은 그대로 */
const CUSTOMER_SWAPS: ReadonlyArray<[RegExp, string]> = [
  [/이런 첫 화면은 2주면 만들어요\./g, '[우리가 실제로 해 주는 것 한 줄 — 사실만]'],
  [/프로필에서 3분 진단부터 해 보세요\./g, '프로필에서 [상담 · 자료 안내 — 실제로 있는 것만].'],
  [/3분 진단/g, '상담 신청'],
]
export const exampleText = (s: string): string => (isMarketingCustomer() ? mkText(CUSTOMER_SWAPS.reduce((t, [re, rep]) => t.replace(re, rep), s)) : s)
export const exampleOf = (f: ShortFormat, p: ShortPlatform) => ({ script: exampleText(p === 'reels' && f.reelsExample ? f.reelsExample : f.example), caption: exampleText(p === 'reels' && f.reelsCaption ? f.reelsCaption : f.exampleCaption) })
export const aimLabel = (p: ShortPlatform, a: ShortAim) => AIMS[p].find((x) => x.key === a)?.label ?? ''

/** 한 줄 공식 — 화면 맨 위 "이것만 지키면 돼요" */
export const SHORT_BASICS: readonly string[] = [
  '첫마디는 10자 안팎 · 2초 안 · 인사 없이 (숫자 · 결과 / "○○ 하지 마세요" / "이거 모르면")',
  '누구나 해당되는 돈 이야기로 넓게 — 전문 용어는 결과로(벤처기업확인 → 세금 5년 50%)',
  '몸통은 2~3가지 + 숫자 · 답은 끝에',
  '영상 · 캡션에서 팔지 않기 — 상담 · 링크 · 업체 소개는 프로필로',
]

/** D-298 '이것만 지키면 돼요' 를 한눈에 — 굵은 한마디 · 짧은 설명 · 마우스를 올리면 예시(SHORT_BASICS 와 같은 내용) */
export const SHORT_BASICS_EASY: ReadonlyArray<{ title: string; detail: string; example: string }> = [
  { title: '첫마디는 짧게', detail: '10자 안팎 · 2초 안 · 인사 없이', example: '"창업 3년 안이면," · "이거 모르면 세금 더 내요" — "안녕하세요" 로 시작하지 않아요.' },
  { title: '누구나 아는 돈 이야기로', detail: '어려운 말은 결과로 바꿔 말해요', example: '"벤처기업확인" 대신 "세금 5년 동안 절반"' },
  { title: '몸통은 2~3가지 + 숫자', detail: '답은 맨 끝에', example: '"딱 세 가지만 보세요. 첫째 … 둘째 … 셋째 …"' },
  { title: '영상에서 팔지 않기', detail: '상담 · 링크 · 회사 소개는 프로필로', example: '"상담 신청하세요" 는 빼고, 궁금한 사람이 프로필을 눌러 보게 해요.' },
]

/** D-298 형식마다 쉽게 말하면 · 예시 첫마디(마우스를 올리면) */
export const FORMAT_EASY: Readonly<Record<ShortFormatKey, { plain: string; sample: string }>> = {
  list: { plain: '"딱 세 가지만" 하고 첫째 · 둘째 · 셋째를 말로 알려 주는 영상이에요.', sample: '"[대상]이면, 딱 세 가지만 보세요. 첫째, …"' },
  talk: { plain: '한 사람이 묻고 다른 사람이 짧게 답하는 대화 영상이에요.', sample: '"이거 진짜 받을 수 있어요?" — "네, 근데 조건이 하나 있어요."' },
  demo: { plain: '손으로 하던 일이 화면 하나로 바뀌는 모습을 직접 보여 주는 영상이에요.', sample: '"매일 [N]분 하던 일, 이제 버튼 하나예요." → 실제 화면' },
  comment: { plain: '글자 화면 몇 장만 넘기고, 마지막에 "댓글 남기면 자료 드려요" 하는 짧은 영상이에요.', sample: '1장 "[주제] 점검표" → … → 마지막 장 "댓글에 [키워드]"' },
  ban: { plain: '"○○ 전에 이것부터 하지 마세요" 를 한 화면에 보여 주는 아주 짧은 영상이에요.', sample: '"[할 일] 전에 이것부터 하지 마세요" ✕ 둘 · ○ 둘' },
}

/* ------------------------------------------------------------------ */
/* 대본 읽기 · 규칙 검사(규칙 계산)                                       */
/* ------------------------------------------------------------------ */

const TIME_TAG = /^\s*\[(\d{1,2}):(\d{2})\]\s*/
const SCREEN_TAG = /^\s*화면\s*\d*\s*\((?:한\s*장,?\s*)?(\d+)\s*~\s*(\d+)\s*초\)\s*/
const RANGE_TAG = /^\s*(\d+)\s*~\s*(\d+)\s*초\s*/
const SPEAKER = /^\s*(?:대표|김팀장|진행자|고객)\s*[:：]?\s+/

/** 한 줄에서 말(또는 화면 글자)만 — 시간 표시 · (화면: …) · 화자 이름을 뺀다 */
export function spokenOf(line: string): string {
  return line
    .replace(TIME_TAG, '')
    .replace(SCREEN_TAG, '')
    .replace(/^\s*화면\s*\([^)]*\)\s*/, '')
    .replace(RANGE_TAG, '')
    .replace(SPEAKER, '')
    .replace(/^\s*(?:말|자막)\s*[:：]\s*/, '')
    .replace(/\((?:화면|장면|자막)[^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const noSpace = (s: string) => s.replace(/\s/g, '')

/** 길이(초) — 시간 표시가 있으면 마지막 표시 + 마지막 줄 말 길이, 없으면 말 글자 ÷ 초당 6자 */
export function secondsOf(script: string): number {
  const lines = script.split('\n').filter((l) => l.trim())
  let last = -1
  let lastLine = ''
  for (const l of lines) {
    const t = TIME_TAG.exec(l)
    const s = SCREEN_TAG.exec(l) ?? RANGE_TAG.exec(l)
    if (t) {
      last = Math.max(last, Number(t[1]) * 60 + Number(t[2]))
      lastLine = l
    } else if (s) {
      last = Math.max(last, Number(s[2]))
      lastLine = ''
    } else if (last >= 0 && lastLine) lastLine += l
  }
  if (last >= 0) return Math.round(last + (lastLine ? noSpace(spokenOf(lastLine)).length / 6 : 0))
  const chars = lines.map((l) => noSpace(spokenOf(l)).length).reduce((a, b) => a + b, 0)
  return Math.round(chars / 6)
}

export const firstWordsOf = (script: string) => (script.split('\n').map(spokenOf).find(Boolean) ?? '').trim()
export const hashtagsOf = (s: string) => [...new Set(s.match(/#[^\s#,]+/g) ?? [])]

export type LintLevel = 'ok' | 'warn' | 'bad'
export interface LintLine {
  key: string
  level: LintLevel
  text: string
}

const GREETING = /^(?:안녕|반갑|저는|제가\s|오늘은|여러분)/
const STING = /아직도\s.*(?:모르|안\s*해)|이것도\s*모르|모르면\s*바보|한심|창피/
const NUM5 = /\d|세\s*가지|두\s*가지|네\s*가지|첫째|[일이삼사오]\s*(?:년|억|만)/
const CTA = /상담|문의|프로필|링크|DM|디엠|신청\s*(?:하세요|해\s*보세요)|진단부터|댓글(?:에|로)?\s*['"‘“][^'"’”]{1,10}['"’”]/
const KEYWORD_COMMENT = /댓글(?:에|로)?\s*['"‘“][^'"’”]{1,10}['"’”]/
const OTHER_CTA = /상담|문의|프로필|링크|DM|디엠|신청\s*(?:하세요|해\s*보세요)/
const SPOKEN_SAVE = /저장\s*해\s*두세요|저장하세요|저장\s*필수|저장\s*해\s*둬/
const JARGON = /보증료율|연구전담부서|연구개발전담부서|업력|가점|기술평가\s*등급|출연금|매출채권|TCB|R&D\s*과제/
const NARROW = /보유\s*법인|입찰\s*업체|연구소\s*(?:보유|있는)\s*(?:법인|기업)|법인\s*대표님만/
const CAPTION_SELL = /DM|디엠|상담|문의\s*주세요|전화|카톡|링크/
const EXPERT_BRAG = /\d+\s*년\s*(?:경력|차\s*전문가)|전문가|전문\s*컨설턴트|베테랑/

export function lintShort(input: { platform: ShortPlatform; aim: ShortAim | ''; script: string; caption: string; hashtags: string; facts?: string }): { lines: LintLine[]; seconds: number; firstWords: string; tags: string[]; bad: number; warn: number } {
  const script = input.script.replace(/\r\n?/g, '\n').trim()
  const caption = input.caption.trim()
  const out: LintLine[] = []
  const add = (key: string, level: LintLevel, text: string) => out.push({ key, level, text })
  const first = firstWordsOf(script)
  const fw = noSpace(first).length
  const seconds = script ? secondsOf(script) : 0
  const tags = hashtagsOf(`${input.hashtags} ${caption}`)
  const all = `${script}\n${caption}`
  const tiktok = input.platform === 'tiktok'

  if (script) {
    if (GREETING.test(first)) add('greet', 'bad', '인사 · 자기소개로 시작 — 잘 된 영상은 4%만 그랬어요. 숫자 · 결과로 바로')
    else add('first', fw <= 12 ? 'ok' : 'warn', fw <= 12 ? `첫마디 ${fw}자` : `첫마디 ${fw}자 — 10자 안팎 · 2초 안이 잘 됐어요`)
    if (STING.test(first)) add('sting', 'warn', '자존심 긁는 첫마디는 안 된 쪽에 더 많았어요(3% 대 12%)')
    const early = script.split('\n').filter((l) => l.trim()).slice(0, 2).map(spokenOf).join(' ')
    add('num5', NUM5.test(early) ? 'ok' : 'warn', NUM5.test(early) ? '5초 안에 숫자' : '5초 안에 숫자가 없어요 — 숫자가 있으면 더 봐요(48% 대 31%)')
    const okLen = tiktok ? seconds >= 20 && seconds <= 70 : seconds <= 30
    add('length', okLen ? 'ok' : 'warn', `약 ${seconds}초${okLen ? '' : tiktok ? ' — 틱톡 · 쇼츠 정보형은 40~70초(이미지형 25~30초)' : ' — 릴스는 20~25초 · 40초 넘는 글자 영상은 안 됐어요'}`)
    const cta = CTA.test(script)
    if (input.aim === 'reach' && cta) add('cta', 'bad', '많이 보이게 할 영상은 끝에 권유 없이 — 상담 · 링크 · 댓글 안내 빼기(CTA 13% 대 44%)')
    if (input.aim === 'convert' && !tiktok) {
      if (!KEYWORD_COMMENT.test(all)) add('keyword', 'warn', "댓글 받기는 \"댓글에 '○○' 남기면 정리본\" 한 가지를 화면 · 캡션에")
      if (OTHER_CTA.test(all)) add('cta', 'bad', '댓글 받기도 상담 · 링크 · DM 안내는 빼기 — 여러 단계면 안 됐어요')
    }
    if (input.aim === 'convert' && tiktok) add('cta', cta ? 'ok' : 'warn', cta ? '문의로 잇기 — 끝에 한 줄' : `문의로 잇기 — 끝에 한 줄(예: 프로필에서 ${isMarketingCustomer() ? '상담 신청' : '3분 진단'})`)
    if (SPOKEN_SAVE.test(script)) add('save', 'warn', '말로 하는 "저장해 두세요" 는 거의 안 됐어요(1%) — 빼도 돼요')
    const jargon = JARGON.exec(all)
    if (jargon) add('jargon', 'warn', `업계 용어 "${jargon[0]}" — 결과 언어로(예: 세금 5년 50%)`)
    if (NARROW.test(all)) add('narrow', 'warn', '대상을 좁게 불렀어요 — "사장님 누구나" 처럼 넓게')
    const hype = HYPE.exec(all)
    if (hype) add('hype', 'bad', `"${hype[0]}" — 보장 · 과장 · 지어낸 선착순은 쓰지 않아요`)
    if (AX_AS_MONEY.test(all) && !AX_DENIED.test(all)) add('ax-money', 'bad', 'AX · 화면을 자금 받는 수단처럼 썼어요 — 자금은 기관 심사')
    if (/벤처/.test(all) && /감면|혜택|세금/.test(all) && !/확인\s*기관|기관\s*심사/.test(all)) add('venture', 'warn', '벤처 세금 이야기 — 캡션에 "(요건 충족 시 · 결과는 확인기관이 정합니다)"')
    // D-274 대표 운영 원칙 · 사실 목록에 없는 숫자(말 · 화면 글자 · 캡션만 — 시간 표시는 빼고)
    out.push(...principleLint(all), ...numberLint(`${script.split('\n').map(spokenOf).join('\n')}\n${caption}`, input.facts ?? ''))
    const brackets = script.match(/\[[^\]\n]{1,40}\]/g)?.filter((b) => !/^\[\d{1,2}:\d{2}\]$/.test(b)) ?? []
    if (brackets.length) add('brackets', 'warn', `[대괄호] ${brackets.length}칸 남음 — 사실을 확인해 채우기: ${brackets.slice(0, 2).join(' ')}`)
  }
  if (caption) {
    const n = caption.replace(/#[^\s#]+/g, '').trim().length
    const max = tiktok ? 45 : input.aim === 'convert' ? 230 : 130
    add('caption', n <= max ? 'ok' : 'warn', n <= max ? `캡션 ${n}자` : `캡션 ${n}자 — ${tiktok ? '틱톡은 한 줄' : input.aim === 'convert' ? '댓글형은 200자 안팎(요약 3줄 + 키워드)' : '조회형은 100자 안팎'}`)
    if (LINK.test(caption) || CAPTION_SELL.test(caption)) add('caption-sell', 'bad', '캡션에 링크 · DM · 상담 · 연락처 — 캡션에서 팔지 않기(프로필로)')
    if (EXPERT_BRAG.test(caption)) add('brag', 'warn', '캡션에 경력 · 전문가 자랑 — 안 된 쪽에 더 많았어요(8% 대 32%)')
  } else if (script) add('caption', 'warn', tiktok ? '캡션 한 줄을 적어요' : '캡션을 적어요(조회형 100자 · 댓글형 200자 안팎)')
  if (script) {
    const n = tags.length
    const ok = tiktok ? n >= 1 && n <= 5 : n <= 3
    add('tags', ok ? 'ok' : 'warn', ok ? `해시태그 ${n}개` : tiktok ? `해시태그 ${n}개 — 틱톡은 3~5개` : `해시태그 ${n}개 — 릴스는 0~3개(5개는 안 된 쪽에 더 많았어요)`)
  }
  return { lines: out, seconds, firstWords: first, tags, bad: out.filter((l) => l.level === 'bad').length, warn: out.filter((l) => l.level === 'warn').length }
}

/* ------------------------------------------------------------------ */
/* 저장 · 기록표                                                        */
/* ------------------------------------------------------------------ */

export interface ShortStats {
  views: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
  inquiries: number | null
}
export const SHORT_STAT_KEYS: ReadonlyArray<{ key: keyof ShortStats; label: string }> = [
  { key: 'views', label: '조회' },
  { key: 'likes', label: '좋아요' },
  { key: 'comments', label: '댓글' },
  { key: 'saves', label: '저장' },
  { key: 'shares', label: '공유' },
  { key: 'inquiries', label: '문의' },
]
export const EMPTY_SHORT_STATS: ShortStats = { views: null, likes: null, comments: null, saves: null, shares: null, inquiries: null }

export interface ShortPost {
  id: string
  savedAt: string
  platform: ShortPlatform
  aim: ShortAim | ''
  format: ShortFormatKey | ''
  topic: string
  script: string
  caption: string
  hashtags: string
  checks: string[]
  status: 'draft' | 'posted'
  postedOn: string
  stats: ShortStats
  source: 'hand' | 'ai' | 'example'
}

const str = (v: unknown, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)

export function normalizeShortPost(raw: unknown, id: string): ShortPost | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const script = str(r.script, 6000)
  if (!script.trim()) return null
  const s = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>
  const f = str(r.format, 10)
  return {
    id,
    savedAt: str(r.savedAt, 40) || nowIso(),
    platform: r.platform === 'reels' ? 'reels' : 'tiktok',
    aim: r.aim === 'reach' || r.aim === 'convert' ? r.aim : '',
    format: (formatOf(f) ? f : '') as ShortFormatKey | '',
    topic: str(r.topic, 300),
    script,
    caption: str(r.caption, 1200),
    hashtags: str(r.hashtags, 300),
    checks: Array.isArray(r.checks) ? r.checks.filter((x): x is string => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 200)) : [],
    status: r.status === 'posted' ? 'posted' : 'draft',
    postedOn: /^\d{4}-\d{2}-\d{2}$/.test(str(r.postedOn, 10)) ? str(r.postedOn, 10) : '',
    stats: { views: num(s.views), likes: num(s.likes), comments: num(s.comments), saves: num(s.saves), shares: num(s.shares), inquiries: num(s.inquiries) },
    source: r.source === 'ai' || r.source === 'example' ? r.source : 'hand',
  }
}

export function sortShortPosts(xs: readonly ShortPost[]): ShortPost[] {
  return [...xs].sort((a, b) => (a.status !== b.status ? (a.status === 'posted' ? -1 : 1) : (b.postedOn || b.savedAt).localeCompare(a.postedOn || a.savedAt) || b.savedAt.localeCompare(a.savedAt)))
}

export async function listShortPosts(workspaceId: string | null): Promise<ShortPost[]> {
  const rows = await listRows(workspaceId, SHORTS_MODULE, SHORTS_BUCKET)
  return sortShortPosts(rows.map((r) => normalizeShortPost(r.data, r.id)).filter((x): x is ShortPost => x !== null))
}
export type ShortInput = Omit<ShortPost, 'id' | 'savedAt'> & Partial<Pick<ShortPost, 'id' | 'savedAt'>>
export async function saveShortPost(workspaceId: string | null, input: ShortInput): Promise<ShortPost> {
  const id = input.id ?? `sht_${generateId()}`
  const clean = normalizeShortPost({ ...input, savedAt: input.savedAt ?? nowIso() }, id)
  if (!clean) throw new Error('대본이 비어 있습니다.')
  const { id: _i, ...data } = clean
  void _i
  await saveRow(workspaceId, SHORTS_MODULE, SHORTS_BUCKET, { id, data: data as unknown as Record<string, unknown> })
  return clean
}
export async function removeShortPost(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, SHORTS_MODULE, SHORTS_BUCKET, id)
}

/** 점수 = 좋아요 + 댓글×3 (실측에서 승 · 패를 가른 계산과 같음) */
export function shortScore(s: ShortStats): number | null {
  if (s.likes == null && s.comments == null) return null
  return (s.likes ?? 0) + (s.comments ?? 0) * 3
}
/** 저장 · 공유율(%) — 조회가 있을 때만 */
export function keepRate(s: ShortStats): number | null {
  if (!s.views || (s.saves == null && s.shares == null)) return null
  return Math.round((((s.saves ?? 0) + (s.shares ?? 0)) / s.views) * 1000) / 10
}

export interface FormatRecord {
  key: string
  platform: ShortPlatform
  format: ShortFormatKey | ''
  label: string
  posts: number
  scored: number
  avgScore: number | null
  avgViews: number | null
  inquiries: number
}
export function formatRecords(posts: readonly ShortPost[]): FormatRecord[] {
  const by = new Map<string, ShortPost[]>()
  for (const p of posts) if (p.status === 'posted') by.set(`${p.platform}:${p.format}`, [...(by.get(`${p.platform}:${p.format}`) ?? []), p])
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  return [...by.entries()]
    .map(([key, xs]) => {
      const scores = xs.map((p) => shortScore(p.stats)).filter((x): x is number => x != null)
      const views = xs.map((p) => p.stats.views).filter((x): x is number => x != null)
      const { platform, format } = xs[0]
      return { key, platform, format, label: `${PLATFORMS.find((x) => x.key === platform)?.label ?? ''} · ${formatOf(format)?.name ?? '형식 없음'}`, posts: xs.length, scored: scores.length, avgScore: avg(scores), avgViews: avg(views), inquiries: xs.reduce((a, p) => a + (p.stats.inquiries ?? 0), 0) }
    })
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || b.posts - a.posts)
}

/** 이번 주(월~일) 플랫폼 · 목적별 개수 — 권장: 틱톡 노출 3 : 전환 1 · 릴스 조회 2 : 댓글 2 */
export function weekMix(posts: readonly ShortPost[], today: string = todayLocalDate()): Record<ShortPlatform, Record<ShortAim, number>> {
  const d = new Date(`${today}T00:00:00`)
  const mon = new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400000)
  const from = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
  const out: Record<ShortPlatform, Record<ShortAim, number>> = { tiktok: { reach: 0, convert: 0 }, reels: { reach: 0, convert: 0 } }
  for (const p of posts) if (p.status === 'posted' && p.postedOn >= from && p.postedOn <= today && p.aim) out[p.platform][p.aim] += 1
  return out
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function shortsCsv(posts: readonly ShortPost[]): string {
  const head = ['날짜', '플랫폼', '목적', '형식', '첫마디', '조회', '좋아요', '댓글', '저장', '공유', '문의', '점수', '저장·공유율(%)']
  const rows = posts.filter((p) => p.status === 'posted').map((p) => [p.postedOn, PLATFORMS.find((x) => x.key === p.platform)?.label, p.aim ? aimLabel(p.platform, p.aim) : '', formatOf(p.format)?.name ?? '', firstWordsOf(p.script), p.stats.views, p.stats.likes, p.stats.comments, p.stats.saves, p.stats.shares, p.stats.inquiries, shortScore(p.stats), keepRate(p.stats)])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

/* ------------------------------------------------------------------ */
/* AI 부르기                                                            */
/* ------------------------------------------------------------------ */

export interface ShortDraft {
  firstWords: string
  format: ShortFormatKey | ''
  seconds: string
  script: string
  caption: string
  hashtags: string
}

const FORMAT_HINT: ReadonlyArray<[RegExp, ShortFormatKey]> = [
  [/리스트|목록형/, 'list'],
  [/대화/, 'talk'],
  [/시연/, 'demo'],
  [/댓글/, 'comment'],
  [/금지|한\s*화면/, 'ban'],
]

/** shorts.write 답 → 대본 2개(대본이 빈 것은 버림) · 올리기 전 확인할 것 */
export function parseShortDrafts(a: AssistAnswer | null): { drafts: ShortDraft[]; checks: string[] } {
  if (!a) return { drafts: [], checks: [] }
  const drafts = a.items
    .map((it) => {
      const tag = String(it.tag ?? '')
      const script = String(it.body ?? '').replace(/\r\n?/g, '\n').trim()
      return {
        firstWords: String(it.title ?? '').trim() || firstWordsOf(script),
        format: FORMAT_HINT.find(([re]) => re.test(tag))?.[1] ?? '',
        seconds: String(it.when ?? '').trim(),
        script,
        caption: String(it.detail ?? '').trim(),
        hashtags: hashtagsOf((it.outline ?? []).join(' ')).slice(0, 5).join(' '),
      } satisfies ShortDraft
    })
    .filter((d) => d.script)
    .slice(0, 2)
  return { drafts, checks: (a.next ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 8) }
}

export function shortsContext(input: { platform: ShortPlatform; aim: ShortAim | ''; format: ShortFormatKey | ''; topic: string; facts: string; recent: readonly ShortPost[]; today?: string }): AssistContext {
  const today = input.today ?? todayLocalDate()
  const p = PLATFORMS.find((x) => x.key === input.platform)
  const f = input.format ? formatOf(input.format) : undefined
  const fits = formatsFor(input.platform, input.aim).map((x) => x.name).join(' · ')
  const recent = input.recent.filter((x) => x.status === 'posted').slice(0, 6)
  const facts = input.facts.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12)
  return {
    title: '릴스 · 틱톡 대본 쓰기',
    today,
    purpose: isMarketingCustomer() ? '내 숏폼 — 실측 공식대로 첫마디 10자 · 2~3가지 + 숫자 · 영상 · 캡션에서 팔지 않기' : '김팀장(미래AI랩) 숏폼 — 실측 공식대로 첫마디 10자 · 2~3가지 + 숫자 · 영상 · 캡션에서 팔지 않기',
    sections: [
      {
        name: '만들 영상',
        rows: [
          {
            플랫폼: p ? `${p.label} — ${p.length} · ${p.hint}` : '',
            목적: input.aim ? `${aimLabel(input.platform, input.aim)} — ${AIMS[input.platform].find((x) => x.key === input.aim)?.hint ?? ''}` : '(고르지 않음 — 많이 보이게)',
            고른형식: f ? `${f.name} — ${f.how} · ${f.seconds}` : '(고르지 않음)',
            맞는형식: fits,
            소재: input.topic.trim() || '(비어 있음 — 창업 3년 안 벤처확인 세금 · AI 업무자동화 · 정책자금 기본 컨디션 가운데)',
          },
        ],
      },
      { name: '최근 올린 영상', rows: recent.map((x) => ({ 날짜: x.postedOn, 플랫폼: x.platform === 'reels' ? '릴스' : '틱톡', 형식: formatOf(x.format)?.name ?? '', 첫마디: firstWordsOf(x.script).slice(0, 40) })) },
    ],
    ...(facts.length ? { facts: facts.map((x) => `이번 영상에 더 쓸 사실: ${x}`) } : {}),
  }
}
