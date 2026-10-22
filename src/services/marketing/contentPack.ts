/**
 * D-251 이번 주 키워드 하나 → 콘텐츠 묶음 한 번에(규칙 · AI 아님).
 * 대표: "버튼 누르면 참고한 외부 방법 방식을 활용해서 유튜브 대본부터 릴스 대본 · 블로그 글 등 다 한 번에 쫙".
 *
 * 참고한 외부 방법 규칙집(D-207 · D-228~D-234)에서 가져온 구조 — 문장은 우리가 새로 쓴다:
 *  - 유튜브(롱폼): 썸네일 문구 · 제목 · 도입부 3~5문장 · 체크포인트 3 + 마무리 · 다리 문장 · 끝맺음(채널 설계 기준)
 *  - 쇼츠 · 릴스: 상단 고정 문구 14~22자 · 인사 없이 바로 첫 번째 · 컷 15개 이하 · 끝은 3줄 요약 · 캡션 · 해시태그 5개
 *  - 블로그: 키워드 맨 앞 제목 · 도입(공감) → 기준 2개 + 정리 → 한눈에 정리 표 → 다리 문장 → 소개 · 문의 · 사진 자리
 *  - 카드뉴스 7장: 표지 → 고민 공감 → 핵심 셋 → 체크리스트 → 마지막 장(실제로 하는 일만)
 *  - 올릴 때 글: 설명란 · 고정 댓글 · 인스타 캡션 · 블로그 태그
 * 숫자 · 금액 · 날짜 · 조건은 지어내지 않는다 — '[공식 자료 확인: …]' 빈칸으로 남기고 [발행 전 확인] 에서 센다.
 * 레이더가 센 숫자(채널 수 · 영상 수)는 우리가 고른 근거일 뿐 — 시청자에게 하는 말에는 넣지 않는다.
 * AI 로 다듬기는 화면이 따로 부른다(대표만 · packContext 가 보낼 자료).
 */
import { particle } from '../../lib/josa'
import type { ContentAxis } from './radarPlaybook'
import type { Opportunity } from './ytRadar'
import { shootKit } from './shootKit'
import { DEFAULT_BRIEF, type ChannelBrief } from './radarStore'

type Pair = '은/는' | '이/가' | '을/를' | '과/와' | '으로/로'
const j = (w: string, p: Pair) => `${w}${particle(w, p)}`

/** 묶음을 만드는 재료 — 레이더 후보 또는 대표가 직접 쓴 주제 */
export interface PackSource {
  /** 레이더 후보 키('축:주제') 또는 'custom:주제' */
  key: string
  topic: string
  axis: ContentAxis
  /** 왜 지금(규칙으로 이어 붙인 한 문장) */
  why: string
  /** 근거(레이더가 센 숫자 — 우리만 보는 것) */
  facts: string[]
  /** 이렇게 말해요(찍을 때 말할 각도) */
  view: string
  titles: string[]
  thumbs: string[]
  /** 첫 문장(찍기 키트) */
  hook: string
  /** 참고만 할 잘된 영상 제목(베끼지 않기) */
  refs: string[]
  custom: boolean
}

export type PackSectionId = 'titles' | 'video' | 'shorts' | 'blog' | 'cards' | 'upload' | 'checks'

export interface PackBlock {
  label: string
  text: string
}

export interface PackSection {
  id: PackSectionId
  label: string
  /** 어디에 쓰나 — 화면 한 줄 */
  hint: string
  blocks: PackBlock[]
}

export interface ContentPack {
  key: string
  topic: string
  /** 추천 제목(유튜브 · 블로그 공통 머리) */
  headline: string
  why: string
  view: string
  sections: PackSection[]
  /** 아직 채울 '[공식 자료 확인]' · '[실제 사례]' 빈칸 수 */
  holes: number
  source: PackSource
}

export const PACK_SECTIONS: readonly { id: PackSectionId; label: string; hint: string }[] = [
  { id: 'titles', label: '제목 · 썸네일', hint: '유튜브 · 블로그 제목 후보와 썸네일 문구' },
  { id: 'video', label: '유튜브 대본', hint: '8~10분 롱폼 — 그대로 읽는 말 + 화면에 띄울 것' },
  { id: 'shorts', label: '릴스 · 쇼츠 대본', hint: '인스타 릴스 · 유튜브 쇼츠 2편(50초 · 25초)' },
  { id: 'blog', label: '블로그 글', hint: '네이버 블로그 한 편 — 사진 자리 · 정리 표 포함' },
  { id: 'cards', label: '카드뉴스', hint: '인스타 카드뉴스 7장 — 장마다 큰 글자 · 작은 글자 · 그림' },
  { id: 'upload', label: '올릴 때 글', hint: '유튜브 설명란 · 고정 댓글 · 인스타 캡션 · 태그' },
  { id: 'checks', label: '발행 전 확인', hint: '올리기 전에 꼭 볼 것' },
]

export const PACK_LABEL: Record<PackSectionId, string> = Object.fromEntries(PACK_SECTIONS.map((s) => [s.id, s.label])) as Record<PackSectionId, string>

/** 비워 둔 칸 — 사람이 공식 자료 · 실제 사례로 채운다 */
export const HOLE = /\[(?:공식 자료 확인|실제 사례|실제 숫자)[^\]]*\]/g
const official = (what: string) => `[공식 자료 확인: ${what}]`
const CASE_HOLE = '[실제 사례 — 상담에서 본 회사 하나(이름은 빼고 업종 · 규모만)]'

/** 규칙집 '쓰지 않는 말' — 묶음 글에 들어가면 안 된다(시험이 센다) */
export const PACK_AVOID = /꿀팁|충격|무조건|대박|100\s*%|최고의|퇴근이 빨라|분\s*컷|배\s*빨라/

/* ------------------------------------------------------------------ */
/* 재료                                                                 */
/* ------------------------------------------------------------------ */

/** 레이더 후보 → 재료(찍기 키트의 첫 문장 · 관점 · 제목 그대로) */
export function packSourceOf(o: Opportunity): PackSource {
  const kit = shootKit(o)
  return {
    key: o.key,
    topic: o.topic,
    axis: o.axis,
    why: o.summary,
    facts: [...o.facts],
    view: o.view,
    titles: o.titles.map((t) => t.text),
    thumbs: [...o.thumbs],
    hook: kit.hook,
    refs: o.benchmarks.map((b) => b.title).slice(0, 3),
    custom: false,
  }
}

const TOPIC_MAX = 40
export const cleanTopic = (raw: string) => raw.replace(/\s+/g, ' ').replace(/[<>{}[\]]/g, '').trim().slice(0, TOPIC_MAX)

/** 대표가 직접 쓴 주제 — 레이더 근거 없이 같은 틀로 */
export function customSource(raw: string): PackSource | null {
  const topic = cleanTopic(raw)
  if (topic.length < 2) return null
  return {
    key: `custom:${topic}`,
    topic,
    axis: /ai|gpt|chatgpt|클로드|claude|제미나이|gemini|자동화|ax|인공지능/i.test(topic) ? 'axai' : 'market',
    why: '대표님이 직접 고른 주제예요 — 레이더 근거 없이 같은 틀로 만들었어요.',
    facts: [],
    view: `${j(topic, '을/를')} 중소기업 대표님 입장에서 — 우리 회사에 해당되는지 · 많이 놓치는 것 · 지금 할 일 순서로`,
    titles: [`${topic}, 우리 회사도 해당될까요`, `${topic} 전에 꼭 확인할 3가지`, `${topic}, 상담에서 가장 많이 놓치는 것`],
    thumbs: [`${topic} 3가지만`, '우리 회사도 될까?'],
    hook: `${topic}, 우리 회사에는 무엇이 달라질까요? 오늘 딱 3가지만 짚어 드리겠습니다.`,
    refs: [],
    custom: true,
  }
}

/** 'BRIDGE' 머리 '정책자금 × 공고 자동 수집' → 시장 주제 · 장치 */
function split(topic: string): { market: string; device: string } {
  const [a, b] = topic.split(/\s*×\s*/)
  return { market: (a ?? topic).trim(), device: (b ?? '').trim() }
}

const hostName = (b: ChannelBrief) => (b.host.split(/[(—,]/)[0] ?? '').trim() || '미래AI랩'
const channelName = (b: ChannelBrief) => (b.channel.split(' — ')[0] ?? '').trim() || '미래AI랩'

/** 체크포인트 셋 — 축마다 다르게(제목 · 요지 · 말) */
interface Point {
  head: string
  say: string
  screen: string
}

function points(s: PackSource): Point[] {
  const { market, device } = split(s.topic)
  if (s.axis === 'axai') {
    return [
      {
        head: `${s.topic}, 한 줄로 말하면`,
        say: `${j(s.topic, '은/는')} 한마디로 ${official(`${s.topic}로 무엇을 할 수 있는지 — 공식 소개 한 줄`)} 입니다. 기능을 다 외울 필요는 없습니다. 대표님 회사에서 매주 반복되는 일 하나에 붙일 수 있느냐, 그것만 보시면 됩니다.`,
        screen: `${s.topic} 첫 화면 · 한 줄 정의 자막`,
      },
      {
        head: '우리 회사 어떤 일에 쓰나',
        say: `상담해 보면 견적서 정리, 지원사업 공고 읽기, 직원 교육 자료 만들기처럼 매주 몇 시간씩 드는 일이 꼭 있습니다. ${CASE_HOLE} 이런 회사라면 ${j(s.topic, '을/를')} 이렇게 씁니다. 직접 해 본 화면을 보여 드릴게요.`,
        screen: '실제 업무 화면 녹화(고객 정보는 지우기)',
      },
      {
        head: '따라 하기 3단계와 주의할 점',
        say: '첫째, 맡길 일을 한 문장으로 적습니다. 둘째, 예시 자료 하나를 같이 넣습니다. 셋째, 결과를 사람이 한 번 확인하고 고칩니다. 주의할 점은 두 가지입니다. 회사 기밀 · 개인정보는 넣지 않을 것, 그리고 숫자는 원본과 꼭 맞춰 볼 것.',
        screen: '단계마다 자막 ① ② ③ · 주의 2가지 박스',
      },
    ]
  }
  if (s.axis === 'bridge') {
    return [
      {
        head: `${market}, 손으로 챙기면 생기는 일`,
        say: `${j(market, '을/를')} 손으로 챙기시는 대표님이 대부분입니다. 그런데 공고는 여러 곳에 흩어져 있고, 마감은 생각보다 빨리 옵니다. ${CASE_HOLE} 이런 식으로 알고도 놓치는 경우가 제일 아깝습니다.`,
        screen: '흩어진 공고 화면 여러 개 · 놓친 마감 예시',
      },
      {
        head: `${j(device || '자동으로 받는 장치', '으로/로')} 바꾸면`,
        say: `그래서 저희는 ${j(device || '자동으로 받는 장치', '을/를')} 씁니다. 회사 조건을 한 번 넣어 두면 맞는 것만 골라서 알려 줍니다. 사람은 고르고 확인하는 일만 하면 됩니다.`,
        screen: `${device || '자동화 장치'} 완성 화면 시연`,
      },
      {
        head: '만드는 순서 3단계',
        say: `첫째, 우리 회사 조건(업종 · 지역 · 업력)을 정리합니다. 둘째, 받을 곳과 알림 방법을 정합니다. 셋째, 일주일 돌려 보고 빠진 것을 고칩니다. 달라진 점은 ${official('실제로 줄어든 시간 · 놓친 건수(우리 기록)')} 입니다.`,
        screen: '만드는 순서 화면 녹화 · 전후 비교 자막',
      },
    ]
  }
  return [
    {
      head: `${s.topic}, 누가 받을 수 있나`,
      say: `${j(s.topic, '은/는')} ${official(`${s.topic} 대상 · 조건`)} 에 해당하는 회사가 대상입니다. 상담해 보면 '우리 회사는 안 되겠지' 하고 그냥 지나치시는 대표님이 가장 많습니다. 조건을 하나씩 맞춰 보면 생각보다 해당되는 경우가 꽤 있습니다.`,
      screen: '대상 · 조건 표(공식 자료 캡처)',
    },
    {
      head: '가장 많이 놓치는 것',
      say: `가장 흔한 실수는 시기를 놓치는 것입니다. ${official('신청 기간 · 마감')}. ${CASE_HOLE} 이분도 서류는 다 있었는데 시기를 놓쳐서 다음 해까지 기다리셔야 했습니다. 서류보다 순서가 먼저입니다.`,
      screen: '놓친 사례 자막 · 달력에 마감 표시',
    },
    {
      head: '지금 할 일 3가지',
      say: `첫째, 우리 회사 기본 숫자(업력 · 직원 수 · 매출)를 한 장에 적어 둡니다. 둘째, ${official('필요 서류')}를 미리 챙깁니다. 셋째, 해당되는지 애매하면 혼자 판단하지 말고 확인부터 받으세요. 확인은 오래 걸리지 않습니다.`,
      screen: '체크리스트 3줄 · 서류 목록',
    },
  ]
}

/** 축마다 다른 짧은 말 — 쇼츠 3줄 요약 · 25초 쇼츠 · 카드뉴스 체크리스트(시장 주제 말이 AI 주제에 섞이지 않게) */
function axisLines(s: PackSource, ps: Point[]) {
  const first = (t: string) => t.split('. ')[0].replace(/\.$/, '')
  if (s.axis === 'axai') {
    return {
      recap: ['매주 반복되는 일 하나 고르기', '예시 하나 같이 넣기', '결과는 사람이 한 번 확인'],
      labelB: '② 먼저 해 볼 것 하나 (25초)',
      fixedB: fit(`${s.topic} 먼저 해 볼 것 하나`, 22),
      hookB: `${s.topic}, 어디부터 쓰면 될까요? 딱 하나만 말씀드릴게요.`,
      sayB: '맡길 일을 한 문장으로 적고, 예시 자료 하나를 같이 넣어 보세요',
      sceneB: ps[2].screen,
      check: ['□ 매주 반복되는 일 하나 고르기', '□ 예시 자료 하나 준비', '□ 회사 기밀 · 개인정보는 넣지 않기'],
    }
  }
  if (s.axis === 'bridge') {
    return {
      recap: ['손으로 챙기면 놓친다', '조건 한 번 넣어 두기', '일주일 돌려 보고 고치기'],
      labelB: '② 손으로 하면 생기는 일 (25초)',
      fixedB: fit(`${split(s.topic).market} 손으로 하면 놓쳐요`, 22),
      hookB: `${split(s.topic).market}, 아직 손으로 챙기세요? 이것 때문에 놓칩니다.`,
      sayB: first(ps[0].say),
      sceneB: ps[0].screen,
      check: ['□ 우리 회사 조건(업종 · 지역 · 업력) 정리', '□ 받을 곳 · 알림 방법 정하기', '□ 일주일 돌려 보고 빠진 것 고치기'],
    }
  }
  return {
    recap: ['해당되는지 확인', '시기 먼저', '서류는 미리'],
    labelB: '② 놓치는 것 하나 (25초)',
    fixedB: fit(`${s.topic} 가장 많이 놓치는 것`, 22),
    hookB: `${s.topic}, 이것 때문에 놓치는 회사가 제일 많습니다.`,
    sayB: first(ps[1].say),
    sceneB: ps[1].screen,
    check: ['□ 회사 기본 숫자 정리', '□ 시기 · 마감 확인', '□ 애매하면 확인 먼저'],
  }
}

/* ------------------------------------------------------------------ */
/* 칸마다                                                               */
/* ------------------------------------------------------------------ */

function titlesOf(s: PackSource): { titles: string[]; thumbs: string[] } {
  const base = s.titles.filter(Boolean)
  const extra = [`${s.topic}, 우리 회사도 해당될까요`, `${s.topic} 전에 꼭 확인할 3가지`, `${s.topic}, 상담에서 가장 많이 놓치는 것`, `대표님이 ${s.topic}에서 손해 보는 이유`]
  const titles: string[] = []
  for (const t of [...base, ...extra]) if (!titles.includes(t) && titles.length < 5) titles.push(t)
  const thumbs: string[] = []
  for (const t of [...s.thumbs, `${s.topic} 3가지만`, '우리 회사도 될까?']) if (t && !thumbs.includes(t) && thumbs.length < 3) thumbs.push(t)
  return { titles, thumbs }
}

function videoBlocks(s: PackSource, b: ChannelBrief, headline: string): PackBlock[] {
  const host = hostName(b)
  const ch = channelName(b)
  const ps = points(s)
  const opening = [
    s.hook,
    `안녕하세요, ${ch} ${host}입니다.`,
    `오늘은 ${j(s.topic, '을/를')} 대표님 회사 입장에서 딱 세 가지로 정리해 드리겠습니다. ${ps.map((p, i) => `${i + 1}. ${p.head}`).join(', ')}.`,
    '끝까지 보시면 우리 회사가 해당되는지, 지금 무엇부터 하면 되는지가 정리됩니다.',
  ].join('\n')
  const whyNow = s.custom
    ? `왜 지금 이 이야기를 하느냐 — 요즘 상담에서 ${j(s.topic, '을/를')} 묻는 대표님이 늘었기 때문입니다. ${official('최근 바뀐 점 · 발표 날짜')}.`
    : `왜 지금 이 이야기를 하느냐 — 최근 경영 · 경제 채널에서 ${s.topic} 이야기가 연달아 나오고 있습니다. 그만큼 대표님들이 궁금해하신다는 뜻입니다. ${official('최근 바뀐 점 · 발표 날짜')}.`
  const closing = [
    `정리하겠습니다. ${ps.map((p, i) => `${i + 1}. ${p.head}`).join(' ')}`,
    `저희 관점에서 한 가지 더 말씀드리면 — ${s.view}`,
    `다음 영상에서는 ${j(s.topic, '을/를')} 실제로 준비하는 순서를 회사 예시 하나로 끝까지 보여 드리겠습니다.`,
    b.ending,
  ].join('\n')
  const at = ['0:00', '0:40', '1:30', '3:30', '5:30', '7:30']
  return [
    { label: '확정 제목', text: headline },
    { label: `${at[0]} 오프닝 (첫 3초 + 오늘 다룰 것)`, text: `${opening}\n\n[화면] 썸네일 문구 크게 → 오늘 다룰 3가지 자막` },
    { label: `${at[1]} 왜 지금`, text: `${whyNow}\n\n[화면] 관련 기사 · 공고 제목 캡처(출처 표시)` },
    ...ps.map((p, i) => ({ label: `${at[i + 2]} 체크포인트 ${i + 1} — ${p.head}`, text: `${p.say}\n\n[화면] ${p.screen}` })),
    { label: `${at[5]} 마무리 · 다음 영상 · 상담 안내`, text: `${closing}\n\n[화면] 3줄 요약 자막 · 설명란 링크 안내` },
  ]
}

/** 길면 줄이되 '[공식 자료 확인: …]' 같은 빈칸 한가운데서 자르지 않는다(닫는 ] 가 없으면 빈칸으로 안 세짐) */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text
  let cut = text.slice(0, max - 1)
  const open = cut.lastIndexOf('[')
  if (open >= 0 && cut.indexOf(']', open) < 0) cut = cut.slice(0, open)
  return `${cut.trimEnd()}…`
}

function shortsBlocks(s: PackSource, b: ChannelBrief): PackBlock[] {
  const ps = points(s)
  const ax = axisLines(s, ps)
  const fixedA = fit(`${s.topic}, 이것만 보세요`, 22)
  const fixedB = ax.fixedB
  const a = [
    `상단 고정 문구: ${fixedA}`,
    '',
    `0~3초  말: "${s.hook}"  /  자막: ${s.thumbs[0] ?? fixedA}  /  장면: 얼굴 클로즈업, 인사 없이 바로`,
    `3~15초  말: "첫째, ${ps[0].head}."  /  자막: ① ${ps[0].head}  /  장면: ${ps[0].screen}`,
    `15~30초  말: "둘째, ${ps[1].head}."  /  자막: ② ${ps[1].head}  /  장면: ${ps[1].screen}`,
    `30~45초  말: "셋째, ${ps[2].head}."  /  자막: ③ ${ps[2].head}  /  장면: ${ps[2].screen}`,
    `45~52초  말: "정리하면 — ${ax.recap.join(', ')}. 자세한 건 긴 영상에서."  /  자막: 3줄 요약  /  장면: 정면`,
  ].join('\n')
  const bText = [
    `상단 고정 문구: ${fixedB}`,
    '',
    `0~3초  말: "${ax.hookB}"  /  자막: ${fixedB}  /  장면: 손가락으로 화면 가리키기`,
    `3~18초  말: "${ax.sayB}."  /  자막: ${ax.labelB.replace(/^② | \(25초\)$/g, '')}  /  장면: ${ax.sceneB}`,
    `18~25초  말: "우리 회사는 해당되는지 — 설명란에서 확인해 보세요."  /  자막: 설명란 확인  /  장면: 정면`,
  ].join('\n')
  const caption = [
    `${s.topic}, 대표님 회사에도 해당될 수 있습니다.`,
    `오늘 영상에서는 ${ps.map((p, i) => `${['①', '②', '③'][i]} ${p.head}`).join(' ')}까지 짧게 정리했어요.`,
    `금액 · 조건은 해마다 바뀌어서 꼭 공식 자료로 확인하세요.`,
    `${b.ending}`,
  ].join('\n')
  return [
    { label: '① 핵심 셋 (50초)', text: a },
    { label: ax.labelB, text: bText },
    { label: '캡션 (릴스 · 쇼츠 공통)', text: `${caption}\n\n${hashtags(s, 5).join(' ')}` },
  ]
}

function hashtags(s: PackSource, n: number): string[] {
  const words = [s.topic, ...split(s.topic).device.split(/\s+/)].map((w) => w.replace(/[^0-9A-Za-z가-힣]/g, '')).filter((w) => w.length >= 2)
  const base = s.axis === 'axai' ? ['업무자동화', 'AI활용', '중소기업', '대표님'] : ['중소기업', '대표님', '경영', '지원사업', '절세']
  const out: string[] = []
  for (const w of [...words, ...base, '미래AI랩']) if (!out.includes(`#${w}`) && out.length < n) out.push(`#${w}`)
  return out
}

function blogBlocks(s: PackSource, b: ChannelBrief): PackBlock[] {
  const ps = points(s)
  const title = fit(`${s.topic}, ${s.axis === 'axai' ? '우리 회사 업무에 붙이는 법 3가지' : '대표님이 먼저 확인할 3가지'}`, 35)
  const intro = [
    `"${s.topic}, 우리 회사도 해당될까?"`,
    `상담실에서 요즘 자주 듣는 질문입니다. 막상 알아보려고 하면 말이 어렵고, 어디서부터 봐야 할지 막막하시죠.`,
    `이 글에서는 ${j(s.topic, '을/를')} 중소기업 대표님 입장에서 꼭 봐야 할 것만 세 가지로 정리했습니다. 읽고 나면 우리 회사가 무엇부터 하면 되는지 보이실 거예요.`,
    '',
    '[사진: 상담 장면 또는 주제 대표 이미지]',
  ].join('\n')
  const body = ps
    .map((p, i) => [`${i + 1}. ${p.head}`, '', p.say, '', `[사진: ${p.screen}]`].join('\n'))
    .join('\n\n')
  const table = [
    '한눈에 정리',
    '',
    '| 볼 것 | 확인할 내용 |',
    '| --- | --- |',
    ...ps.map((p) => `| ${p.head} | ${p.screen.replace(/\|/g, '/')} |`),
    '',
    `※ 금액 · 조건 · 마감은 해마다 바뀝니다 — ${official('최신 공고 · 고시')}로 꼭 확인하세요.`,
  ].join('\n')
  const bridge = `${j(s.topic, '은/는')} 혼자 판단하면 '안 되겠지' 하고 넘기기 쉽습니다. 조건을 하나씩 맞춰 보는 것만으로도 놓치는 돈이 줄어듭니다.`
  const outro = [
    `${hostName(b)}(미래AI랩)은 정책자금 · 고용지원금 · 기업부설연구소 · 절세 · 지원사업까지 중소기업 대표님 상담을 해 왔습니다.`,
    b.ending,
    '',
    '[사진: 상담 신청 안내 이미지]',
  ].join('\n')
  return [
    { label: '제목 (키워드 맨 앞 · 25~35자)', text: title },
    { label: '도입 (공감)', text: intro },
    { label: '본문 (기준 2개 + 정리)', text: body },
    { label: '한눈에 정리 (표)', text: table },
    { label: '다리 문장 · 소개 · 문의', text: `${bridge}\n\n${outro}` },
  ]
}

function cardsBlocks(s: PackSource, b: ChannelBrief): PackBlock[] {
  const ps = points(s)
  const ax = axisLines(s, ps)
  const cards: [string, string, string][] = [
    [`${s.topic}\n우리 회사도 될까?`, '대표님이 먼저 볼 3가지', '표지 — 큰 글자 두 줄 · 회사 로고'],
    ['"우리는 안 되겠지"', '상담에서 가장 많이 듣는 말이에요', '고민하는 대표님 그림'],
    [`① ${ps[0].head}`, fit(ps[0].say.split('. ')[0], 60), ps[0].screen],
    [`② ${ps[1].head}`, fit(ps[1].say.split('. ')[0], 60), ps[1].screen],
    [`③ ${ps[2].head}`, fit(ps[2].say.split('. ')[0], 60), ps[2].screen],
    ['지금 할 일 체크', ax.check.join('\n'), '체크리스트 그림'],
    ['우리 회사는 해당될까?', fit(b.ending, 60), '미래AI랩 상담 안내(실제로 하는 일만 · 혜택 약속 없이)'],
  ]
  return cards.map(([big, small, img], i) => ({ label: `${i + 1}장`, text: `큰 글자: ${big}\n작은 글자: ${small}\n그림: ${img}` }))
}

function uploadBlocks(s: PackSource, b: ChannelBrief, headline: string, titles: string[]): PackBlock[] {
  const ps = points(s)
  const desc = [
    `${headline}`,
    '',
    `오늘은 ${j(s.topic, '을/를')} 중소기업 대표님 입장에서 세 가지로 정리했습니다.`,
    ...ps.map((p, i) => `${i + 1}. ${p.head}`),
    '',
    '0:00 오프닝',
    '0:40 왜 지금',
    ...ps.map((p, i) => `${['1:30', '3:30', '5:30'][i]} ${p.head}`),
    '7:30 정리 · 상담 안내',
    '',
    `※ 금액 · 조건은 해마다 바뀝니다. 최신 공고로 꼭 확인하세요.`,
    `${b.ending}`,
    '',
    hashtags(s, 5).join(' '),
  ].join('\n')
  const pinned = `${s.topic}, 우리 회사는 어디에 해당되는지 댓글로 업종 · 직원 수만 남겨 주세요. 다음 영상 사례로 다뤄 드리겠습니다. (회사 이름 · 연락처는 적지 마세요)`
  const insta = [
    `${s.topic}, 우리 회사도 해당될까요?`,
    '',
    ...ps.map((p, i) => `${['①', '②', '③'][i]} ${p.head}`),
    '',
    '조건 · 마감은 해마다 바뀌어요. 저장해 두고 신청 전에 다시 확인하세요.',
    b.ending,
    '',
    hashtags(s, 5).join(' '),
  ].join('\n')
  const tags = Array.from(new Set([s.topic.replace(/\s+/g, ''), ...hashtags(s, 10).map((h) => h.slice(1)), '중소기업대표', '정책자금', '지원사업', '미래AI랩'])).slice(0, 10)
  return [
    { label: '유튜브 설명란', text: desc },
    { label: '고정 댓글', text: pinned },
    { label: '인스타 캡션', text: insta },
    { label: '블로그 태그 10개', text: tags.join(', ') },
    { label: '다른 제목 후보', text: titles.slice(1).map((t, i) => `${i + 1}. ${t}`).join('\n') },
  ]
}

/* ------------------------------------------------------------------ */
/* 묶음                                                                 */
/* ------------------------------------------------------------------ */

export function makePack(s: PackSource, brief: ChannelBrief | null = null): ContentPack {
  const b = brief ?? DEFAULT_BRIEF
  const { titles, thumbs } = titlesOf(s)
  const headline = titles[0] ?? s.topic
  const sections: PackSection[] = [
    {
      id: 'titles',
      label: PACK_LABEL.titles,
      hint: PACK_SECTIONS[0].hint,
      blocks: [
        { label: '제목 후보 5개', text: titles.map((t, i) => `${i + 1}. ${t}`).join('\n') },
        { label: '썸네일 문구', text: thumbs.join('\n') },
        { label: '첫 문장 (영상 시작 3초)', text: s.hook },
      ],
    },
    { id: 'video', label: PACK_LABEL.video, hint: PACK_SECTIONS[1].hint, blocks: videoBlocks(s, b, headline) },
    { id: 'shorts', label: PACK_LABEL.shorts, hint: PACK_SECTIONS[2].hint, blocks: shortsBlocks(s, b) },
    { id: 'blog', label: PACK_LABEL.blog, hint: PACK_SECTIONS[3].hint, blocks: blogBlocks(s, b) },
    { id: 'cards', label: PACK_LABEL.cards, hint: PACK_SECTIONS[4].hint, blocks: cardsBlocks(s, b) },
    { id: 'upload', label: PACK_LABEL.upload, hint: PACK_SECTIONS[5].hint, blocks: uploadBlocks(s, b, headline, titles) },
  ]
  const holes = countHoles(sections)
  sections.push({ id: 'checks', label: PACK_LABEL.checks, hint: PACK_SECTIONS[6].hint, blocks: checkBlocks(s, holes) })
  return { key: s.key, topic: s.topic, headline, why: s.why, view: s.view, sections, holes, source: s }
}

export function countHoles(sections: readonly PackSection[]): number {
  return sections.filter((x) => x.id !== 'checks').reduce((n, x) => n + x.blocks.reduce((m, bl) => m + (bl.text.match(HOLE)?.length ?? 0), 0), 0)
}

function checkBlocks(s: PackSource, holes: number): PackBlock[] {
  return [
    {
      label: '채울 빈칸',
      text: holes
        ? `[공식 자료 확인] · [실제 사례] 빈칸 ${holes}곳 — 공고 · 보도자료 · 실제 상담 기록으로 채운 뒤 올리세요. 빈칸을 그대로 두거나 짐작한 숫자를 넣지 마세요.`
        : '빈칸 없음 — 그래도 금액 · 조건 · 날짜는 공식 자료와 한 번 더 맞춰 보세요.',
    },
    {
      label: '올리기 전 확인',
      text: [
        '□ 금액 · 조건 · 마감은 최신 공고로 확인했다',
        '□ 실제 사례는 회사 이름 · 연락처를 뺐다',
        `□ "꿀팁 · 충격 · 무조건 · 대박" 같은 말이 없다`,
        '□ 혜택을 약속하지 않았다(받을 수 있다 ≠ 받는다)',
        ...(s.refs.length ? [`□ 참고한 영상(${s.refs.length}편)의 제목 · 대사를 그대로 쓰지 않았다`] : []),
      ].join('\n'),
    },
    ...(s.facts.length ? [{ label: '이 키워드를 고른 근거(우리만 보기)', text: s.facts.map((f) => `- ${f}`).join('\n') }] : []),
  ]
}

/* ------------------------------------------------------------------ */
/* 복사 글                                                              */
/* ------------------------------------------------------------------ */

export function sectionText(x: PackSection): string {
  return [`■ ${x.label}`, ...x.blocks.map((bl) => `\n[${bl.label}]\n${bl.text}`)].join('\n')
}

export function packText(p: ContentPack): string {
  return [`[콘텐츠 묶음] ${p.topic}`, `추천 제목: ${p.headline}`, `이렇게 말해요: ${p.view}`, '', ...p.sections.map((x) => `${sectionText(x)}\n`)].join('\n').trim()
}

/* ------------------------------------------------------------------ */
/* AI 로 다듬기 — 보낼 규칙 · 받은 답을 칸으로                              */
/* ------------------------------------------------------------------ */

/** AI 가 지킬 규칙집(참고한 외부 방법 규칙집에서 미래AI랩 채널용으로) — 서버 지시와 함께 [규칙집] 으로 간다 */
export const PACK_RULES: readonly string[] = [
  '— 공통 —',
  '화자 · 말투 · 끝맺음은 [자료 · 채널 설계 기준] 그대로. 대표님께 상담실에서 말하듯 쉬운 말, 존댓말.',
  '금액 · 비율 · 날짜 · 조건 · 통계는 [자료] 에 있는 것만. 없으면 "[공식 자료 확인: ○○]" 로 비워 둔다. 실제 사례는 "[실제 사례 — …]" 로 비워 둔다.',
  '참고 영상의 제목 · 대사는 쓰지 않는다(구조만 참고). 혜택을 약속하지 않는다(받을 수 있다 ≠ 받는다).',
  '쓰지 않는 말: 꿀팁 · 충격 · 무조건 · 대박 · 100% · 최고의 · N배 빨라진다 · N분 컷 · 퇴근이 빨라진다.',
  '— 유튜브 롱폼 —',
  '썸네일 문구 20~35자(숫자 하나) · 제목 괄호 없이 25~35자 · 도입부 3~5문장(첫 문장에 시청자가 얻는 것) · 체크포인트 3개 + 마무리.',
  '말 분량 2,500~3,500자(8~10분) · 구간마다 "0:00 오프닝" 처럼 시간 + 이름 · 마무리는 3줄 요약 → 다음 영상 예고 한 줄 → 채널 끝맺음.',
  '— 쇼츠 · 릴스 —',
  '상단 고정 문구 14~22자 · 인사 없이 바로 첫 번째 · 컷 15개 이하 · 컷마다 초 · 말 · 자막 · 장면 · 끝은 3줄 요약(회사 말은 한 줄만).',
  '캡션 230~300자 · 해시태그 5개(주제 + 중소기업 · 대표 고민).',
  '— 블로그 —',
  '제목 25~35자 · 주제 키워드를 제목 맨 앞에(바로 뒤 쉼표) · 도입부는 대표님이 자주 하는 질문으로 공감 → 소제목 3개(기준 2개 + 정리) → 한눈에 정리 표 1개 → 다리 문장 → 미래AI랩 소개 · 문의.',
  '공백 포함 2,100~3,000자 · 사진 자리 4~7곳("[사진: …]") · 작성자 소개 표는 넣지 않는다.',
  '— 카드뉴스 —',
  '7장 · 장마다 큰 글자 1줄(20~35자) + 작은 글자 1줄 + 그림 지시 1줄 · 순서: 표지 → 고민 공감 → 핵심 셋 → 체크리스트 → 마지막 장(실제로 하는 일만 · 기간 한정 문구 없이).',
]

/** AI 갈래 — 한 번에 쓰면 60초를 넘겨 셋으로 나눠 동시에 부른다 */
export type PackAiPart = 'video' | 'short' | 'blog'
export const PACK_AI_PARTS: readonly { part: PackAiPart; assistId: string; sections: PackSectionId[]; label: string }[] = [
  { part: 'video', assistId: 'radar.pack.video', sections: ['video', 'titles'], label: '유튜브 대본 · 제목' },
  { part: 'short', assistId: 'radar.pack.short', sections: ['shorts', 'cards', 'upload'], label: '릴스 · 카드뉴스 · 올릴 때 글' },
  { part: 'blog', assistId: 'radar.pack.blog', sections: ['blog'], label: '블로그 글' },
]

/** AI 답 한 항목 */
export interface PackAiItem {
  title: string
  tag?: string
  detail?: string
  outline?: string[]
  body?: string
}

const itemText = (i: PackAiItem) =>
  [i.body?.trim(), i.outline?.length ? i.outline.map((o) => `- ${o}`).join('\n') : '', i.detail?.trim()].filter(Boolean).join('\n\n')

/**
 * AI 답(항목 목록) → 그 갈래가 맡은 칸들. 항목 tag 가 칸 이름(유튜브 대본 · 제목 · 릴스 · 카드뉴스 · 올릴 때 글 · 블로그).
 * tag 를 먼저 본다(대본 구간 제목에 '제목' 이 들어가도 대본 칸에 남게) — tag 가 없거나 모르면 title, 그래도 모르면 그 갈래의 첫 칸.
 * next 줄은 갈래마다 한 칸으로(유튜브 = 찍기 전 준비물 · 블로그 = 블로그 태그). 빈 칸은 만들지 않는다(그 칸은 규칙 초안 그대로).
 */
export function aiSections(part: PackAiPart, headline: string, items: readonly PackAiItem[], next: readonly string[] = []): Partial<Record<PackSectionId, PackBlock[]>> {
  const def = PACK_AI_PARTS.find((p) => p.part === part)!
  const has = (id: PackSectionId) => def.sections.includes(id)
  const out: Partial<Record<PackSectionId, PackBlock[]>> = {}
  const match = (raw: string): PackSectionId | null => {
    const t = raw.replace(/\s+/g, '')
    if (!t) return null
    if (/카드/.test(t) && has('cards')) return 'cards'
    if (/설명란|고정댓글|인스타캡션|태그|올릴/.test(t) && has('upload')) return 'upload'
    if (/릴스|쇼츠|캡션/.test(t) && has('shorts')) return 'shorts'
    if (/제목|썸네일|첫문장/.test(t) && has('titles')) return 'titles'
    if (/대본|유튜브|롱폼/.test(t) && has('video')) return 'video'
    if (/블로그/.test(t) && has('blog')) return 'blog'
    return null
  }
  for (const it of items) {
    const text = itemText(it)
    if (!it.title?.trim() || !text) continue
    const where = match(it.tag ?? '') ?? match(it.title) ?? def.sections[0]
    ;(out[where] ??= []).push({ label: it.title.trim().slice(0, 80), text })
  }
  if (part === 'video' && headline.trim() && out.video) out.video.unshift({ label: '확정 제목', text: headline.trim() })
  const extra = next.map((n) => n.trim()).filter(Boolean)
  if (extra.length && part === 'video' && out.video) out.video.push({ label: '찍기 전 준비물', text: extra.map((n) => `□ ${n}`).join('\n') })
  if (extra.length && part === 'blog' && out.blog) out.blog.push({ label: '블로그 태그', text: extra.join(', ') })
  return out
}

/** 규칙 초안 위에 AI 칸을 덮는다(AI 가 안 쓴 칸은 규칙 초안 그대로 · 발행 전 확인은 다시 센다) */
/** 제목 · 썸네일 · 올릴 때 글은 AI 가 일부만 쓴다 — AI 가 안 쓴 블록(인스타 캡션 · 블로그 태그 · 첫 문장 …)은 규칙 초안을 남긴다 */
const MERGE_SECTIONS: readonly PackSectionId[] = ['titles', 'upload']
const blockKind = (label: string) => label.replace(/\(.*?\)/g, '').replace(/\s+/g, '').slice(0, 4)

export function withAi(p: ContentPack, ai: Partial<Record<PackSectionId, PackBlock[]>>): ContentPack {
  const base = p.sections
    .filter((x) => x.id !== 'checks')
    .map((x) => {
      const got = ai[x.id]
      if (!got?.length) return x
      if (!MERGE_SECTIONS.includes(x.id)) return { ...x, blocks: got }
      const kinds = new Set(got.map((b) => blockKind(b.label)))
      return { ...x, blocks: [...got, ...x.blocks.filter((b) => !kinds.has(blockKind(b.label)))] }
    })
  const holes = countHoles(base)
  // AI 가 확정한 제목(유튜브 갈래 맨 앞 '확정 제목')이 있으면 머리 제목도 그것으로
  const top = ai.video?.[0]
  const headline = top?.label === '확정 제목' && top.text.trim() ? top.text.trim().slice(0, 120) : p.headline
  return { ...p, headline, sections: [...base, { id: 'checks', label: PACK_LABEL.checks, hint: PACK_SECTIONS[6].hint, blocks: checkBlocks(p.source, holes) }], holes }
}

/* ------------------------------------------------------------------ */
/* 이 브라우저에 남기는 AI 결과 — 같은 키워드를 다시 열어도 다시 부르지 않게    */
/* ------------------------------------------------------------------ */

export interface PackAiSaved {
  at: string
  model: string
  sections: Partial<Record<PackSectionId, PackBlock[]>>
}

/** 한 칸(axmvp.* — 로그인한 사람별 금고)에 키워드별 AI 결과 · 최근 12개만 */
export const PACK_STORE_KEY = 'axmvp.mkpack.v1'
export const PACK_STORE_MAX = 12

function parseSaved(v: unknown): PackAiSaved | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<PackAiSaved>
  if (typeof o.at !== 'string' || !o.sections || typeof o.sections !== 'object') return null
  const sections: Partial<Record<PackSectionId, PackBlock[]>> = {}
  for (const id of PACK_SECTIONS.map((x) => x.id)) {
    const list = (o.sections as Record<string, unknown>)[id]
    if (!Array.isArray(list)) continue
    const ok = list
      .filter((b): b is PackBlock => !!b && typeof (b as PackBlock).label === 'string' && typeof (b as PackBlock).text === 'string')
      .slice(0, 30)
      .map((b) => ({ label: b.label.slice(0, 80), text: b.text.slice(0, 12000) }))
    if (ok.length) sections[id] = ok
  }
  return Object.keys(sections).length ? { at: o.at, model: typeof o.model === 'string' ? o.model : '', sections } : null
}

/** 저장된 칸 읽기 — 깨진 값 · 모르는 칸은 버린다 */
export function parsePackStore(raw: string | null): Record<string, PackAiSaved> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, PackAiSaved> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const s = parseSaved(x)
      if (s && k.length <= 120) out[k] = s
    }
    return out
  } catch {
    return {}
  }
}

/** 한 키워드 결과를 넣고 오래된 것부터 버린다(최근 12개) */
export function putPackStore(store: Record<string, PackAiSaved>, key: string, saved: PackAiSaved, max = PACK_STORE_MAX): Record<string, PackAiSaved> {
  const all = Object.entries({ ...store, [key]: saved }).sort((a, b) => b[1].at.localeCompare(a[1].at))
  return Object.fromEntries(all.slice(0, max))
}
