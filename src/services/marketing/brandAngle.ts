/**
 * D-351 '이번 주 이렇게 찍으세요' 를 채널 설계 기준(본업)에 맞춘다 — 규칙(AI 아님).
 * 대표: "이번 주 1순위가 계속 Claude 활용으로 뜨는데 — 여기서도 AX 로 끌고 온다든지, 정책자금 신청할 때 이렇게 하세요 …
 *        나중에 구독료를 내며 쓸 컨설턴트들은 절세 · 자본거래 · 정부지원금 · 정책자금 · 기업인증 — 채널 설계 기준에 본인이 쓰면 거기에 맞게".
 *
 *  - 본업 목록 = 채널 설계 기준의 '우리가 실제로 하는 일' → '다루는 주제' → '접목 원칙' 에 나오는 순서(대표 계정 · 고객 계정 모두 같은 규칙).
 *  - AI 주제(axai)는 늘 본업으로 잇는다: 제목 숫자형 · 질문형 · 방법형 · 경고형 · 비교형 · 결과형 + 첫 문장 + 이렇게 말해요 + 썸네일.
 *    기본 본업은 그 AI 주제와 맞는 것(문서형 AI → 사업계획서 쓰는 본업 · 만들기형 → AX · 시제품)을 기준 순서대로, AI 후보마다 돌아가며.
 *  - 시장 주제(가업승계 · 정책자금 …)는 그대로(이미 본업 이야기) — 원하면 본업 칩을 눌러 이을 수 있다.
 *  - 쓰지 않는 말(N분 · N배 · 꿀팁 · 충격)을 제목에 넣지 않는다. 숫자 · 결과는 찍을 때 실제로 해 본 것만(이렇게 말해요에 적는다).
 */
import { josa, particle } from '../../lib/josa'
import type { ChannelBrief } from './radarStore'
import { TOPIC_BY_ID } from './radarPlaybook'
import { titlePatterns, type Opportunity } from './ytRadar'

type AiKind = 'doc' | 'build' | 'data'

export interface BrandCore {
  id: string
  label: string
  /** 채널 설계 기준 글에서 찾는 말 */
  match: RegExp
  /** AI 로 만드는 문서 · 결과물 */
  doc: string
  /** AI 로 하는 일 — '…하는' 꼴(뒤에 순서 · 장면이 붙는다) */
  task: string
  /** 대표가 얻는 것 */
  gain: string
  /** 사람이 꼭 확인할 것 */
  check: string
  fit: readonly AiKind[]
}

export const BRAND_CORES: readonly BrandCore[] = [
  { id: 'ax', label: 'AX', match: /\bAX\b|AI\s*업무\s*자동화|업무\s*자동화\s*시스템/i, doc: '업무 흐름', task: '반복 업무 하나를 AI 로 넘기는', gain: '대표가 직접 확인해야 돌아가던 일을 줄이는 것', check: '사람이 꼭 확인할 단계', fit: ['build', 'doc', 'data'] },
  { id: 'mvp', label: '시제품(MVP)', match: /MVP|기술\s*사업화/i, doc: '작동하는 시제품 화면', task: '아이디어를 작동하는 화면으로 만드는', gain: '말이 아니라 화면으로 보여 주는 사업 아이디어', check: '실제 고객 · 시장 확인', fit: ['build'] },
  { id: 'venture', label: '벤처기업확인', match: /벤처/, doc: '벤처확인 사업계획서', task: '기술 · 사업 내용을 심사 기준에 맞춰 정리하는', gain: '창업 3년 안이면 세금 감면까지 이어지는 확인', check: '확인 요건과 기관 심사', fit: ['doc', 'build'] },
  { id: 'policy', label: '정책자금', match: /정책\s*자금/, doc: '사업계획서', task: '사업계획서 · 재무 설명 초안을 잡는', gain: '심사에서 우리 회사를 보여 줄 근거', check: '대표자 신용 · 재무 · 체납 같은 기본 컨디션', fit: ['doc', 'data'] },
  { id: 'cert', label: '기업인증', match: /이노비즈|메인비즈|기업\s*인증|인증\s*컨설팅/, doc: '인증 신청 서류', task: '인증 신청 서류와 증빙 목록을 정리하는', gain: '입찰 · 자금 · 지원사업에서 쓰이는 인증', check: '인증 기준과 현장 평가', fit: ['doc'] },
  { id: 'employ', label: '고용지원금', match: /고용\s*지원금|고용\s*장려금|채용\s*지원금/, doc: '채용 계획서', task: '채용 계획과 지원 요건을 한 장으로 정리하는', gain: '채용 · 인건비 부담을 줄이는 지원금 설계', check: '고용보험 · 채용 시기 같은 요건', fit: ['doc', 'data', 'build'] },
  { id: 'lab', label: '기업부설연구소', match: /연구소|연구\s*개발\s*전담/, doc: '연구 과제 · 연구노트', task: '연구 과제와 연구노트를 정리하는', gain: '연구 인력 세액공제와 정부 과제의 바탕', check: '인정 요건(전담 인력 · 공간)', fit: ['doc', 'data'] },
  { id: 'startup', label: '창업감면', match: /창업\s*감면/, doc: '창업 감면 점검표', task: '창업 감면 요건을 우리 회사 숫자로 점검하는', gain: '5년 동안 줄어드는 세금', check: '업종 · 지역 · 창업 형태 요건', fit: ['data'] },
  { id: 'tax', label: '절세', match: /절세|세무\s*컨설팅|법인세/, doc: '절세 설계표', task: '회사 숫자를 정리해 절세할 곳을 찾는', gain: '몰라서 더 내던 세금', check: '세법 요건과 세무사 확인', fit: ['data', 'doc'] },
  { id: 'capital', label: '자본거래', match: /자본\s*거래|가지급금|주식\s*이동|자기\s*주식|차등\s*배당|증자|감자/, doc: '주주 · 자본거래 정리표', task: '가지급금 · 지분 숫자를 한눈에 정리하는', gain: '가지급금 · 지분 문제를 세금 적게 푸는 순서', check: '주식 가치 평가와 세무 신고', fit: ['data'] },
  { id: 'succession', label: '가업승계 · 증여', match: /가업\s*승계|증여|상속/, doc: '승계 계획표', task: '승계 · 증여 시나리오를 숫자로 비교하는', gain: '승계 때 세금 부담을 줄이는 순서', check: '세법 요건과 전문가 확인', fit: ['data'] },
  { id: 'grant', label: '정부지원사업', match: /(?<!고용\s?)지원\s*금|지원\s*사업/, doc: '지원사업 사업계획서', task: '공고문을 읽고 사업계획서 초안을 잡는', gain: '몰라서 놓치던 지원금 · 사업', check: '공고 원문의 자격 · 마감', fit: ['doc', 'data'] },
  { id: 'patent', label: '특허', match: /특허/, doc: '발명 아이디어 정리', task: '발명 아이디어와 기존 기술의 차이를 정리하는', gain: '기술력을 보여 주는 권리', check: '변리사 검토와 선행기술 확인', fit: ['doc'] },
]
const CORE_BY_ID = new Map(BRAND_CORES.map((c) => [c.id, c]))
export const coreOf = (id: string): BrandCore | undefined => CORE_BY_ID.get(id)

/** 기준에 본업이 하나도 없을 때 — 중소기업 대표의 돈 문제 */
const FALLBACK = ['policy', 'grant', 'tax']

/** 채널 설계 기준 → 본업 목록(기준에 먼저 나온 순 · 최대 8) */
export function briefCores(brief: Pick<ChannelBrief, 'services' | 'covers' | 'bridge'>): BrandCore[] {
  const text = [brief.services, brief.covers, brief.bridge].map((x) => x ?? '').join(' || ')
  const found = BRAND_CORES.map((c) => ({ c, at: text.search(c.match) })).filter((x) => x.at >= 0)
  const list = found.sort((a, b) => a.at - b.at).map((x) => x.c)
  return (list.length ? list : FALLBACK.map((id) => CORE_BY_ID.get(id)!)).slice(0, 8)
}

/** AI 주제 → 말할 때 부르는 이름('Claude 활용' → 'Claude' · 'AI 문서 · 보고서' → 'AI') */
export function toolOf(label: string): string {
  const latin = /(ChatGPT|Claude|Gemini|Codex|NotebookLM|Astra|\bSol\b|GPT)/i.exec(label)?.[0]
  if (latin) return latin
  if (/에이전트/.test(label)) return 'AI 에이전트'
  if (/자동화/.test(label)) return 'AI 자동화'
  return 'AI'
}

const kindOf = (o: Pick<Opportunity, 'topicId'>): AiKind => {
  const def = TOPIC_BY_ID.get(o.topicId)
  if (def?.area === 'ax' || /직접\s*만들|codex/i.test(def?.label ?? '')) return 'build'
  return o.topicId === 'notebooklm' ? 'data' : 'doc'
}

const isAi = (o: Pick<Opportunity, 'axis'>) => o.axis === 'axai'

/** 이 후보가 이미 본업 주제인가(시장 주제가 본업 목록에 있으면 그대로 둔다) */
const isCore = (o: Pick<Opportunity, 'topic'>, cores: readonly BrandCore[]) => cores.some((c) => c.match.test(o.topic))

export interface BrandedKit {
  core: BrandCore
  /** AI 주제를 본업으로 이었나(아니면 시장 주제를 본업으로) */
  from: 'ai' | 'market'
  view: string
  hook: string
  titles: string[]
  thumbs: [string, string]
  outline: { at: string; what: string }[]
}

/** 제목 여섯 — 숫자형 · 질문형 · 방법형 · 경고형 · 비교형 · 결과형(틀마다 하나) */
function aiTitles(tool: string, c: BrandCore): string[] {
  const ro = josa(tool, '으로/로')
  const reul = josa(tool, '을/를')
  if (c.id === 'ax')
    return [
      `${ro} 우리 회사 반복 업무 3가지를 넘기는 순서`,
      `${tool}, 우리 회사 업무에 붙이면 무엇이 달라질까?`,
      `개발자 없이 ${reul} 회사 업무 흐름에 붙이는 방법`,
      `${tool} 도입하고 손해 보는 회사들의 공통점`,
      `${tool} 기능 소개 vs 우리 회사에 붙인 장면 — 무엇이 다를까`,
      `대표가 직접 확인하던 일, ${ro} 줄였습니다`,
    ]
  if (c.id === 'mvp')
    return [
      `${ro} 아이디어를 작동하는 시제품으로 만드는 순서 3단계`,
      `개발자 없이 ${ro} 시제품을 만들 수 있을까?`,
      `${ro} 만든 시제품을 사업계획서 · 심사 자료로 쓰는 방법`,
      `시제품 없이 사업계획서만 내면 손해 보는 이유`,
      `기획서 vs 작동하는 화면 — 심사에서 무엇이 다를까`,
      `아이디어를 ${ro} 작동하는 화면까지 만들어 봤습니다`,
    ]
  return [
    `${c.label} 준비, ${ro} 먼저 해 둘 3가지`,
    `${ro} ${c.doc} 써도 될까? ${c.label}에서 실제로 보는 것`,
    `${ro} ${c.task} 순서 — ${c.label} 편`,
    `${c.doc}, ${tool}에 그냥 맡기면 손해 보는 이유`,
    `${ro} 할 일 vs 대표가 할 일 — ${c.label} 편`,
    `${c.label} 준비에 ${reul} 써 봤더니 달라진 것`,
  ]
}

function marketTitles(topic: string, c: BrandCore): string[] {
  return [
    `${topic} 소식, ${c.label} 준비하는 대표님이 확인할 3가지`,
    `${topic}, 우리 회사 ${c.label}에는 어떤 영향이 있을까?`,
    `${topic} 흐름에 맞춰 ${c.label} 준비하는 순서`,
    `${topic} 흐름, 모르면 ${c.label}에서 손해 보는 것`,
    `${topic} 전후 ${c.label} 준비 차이`,
  ]
}

/** 시청자 고민 첫 줄(기준의 '시청자 고민') — 없으면 일반 말 */
const firstPain = (pains: string) => (pains.split(/\s*\d\.\s*/).map((x) => x.trim()).filter(Boolean)[0] ?? '').replace(/[.。]$/, '').slice(0, 60)

/** 후보 하나 + 본업 하나 → 이렇게 찍으세요(규칙) */
export function brandKit(o: Pick<Opportunity, 'topic' | 'topicId' | 'axis'>, c: BrandCore, brief: Pick<ChannelBrief, 'pains' | 'ending'>): BrandedKit {
  const pain = firstPain(brief.pains ?? '')
  if (isAi(o)) {
    const tool = toolOf(o.topic)
    const view =
      c.id === 'ax'
        ? `${tool} 기능 소개로 끝내지 않습니다 — 대표님 회사의 반복 업무 하나를 실제로 넘기는 장면으로, ${c.gain}까지 보여 줍니다. 어디는 사람이 꼭 확인해야 하는지도 함께 말합니다.`
        : `${tool} 기능 소개로 끝내지 않습니다 — ${c.task} 장면에 붙여, 대표님이 ${josa(c.gain, '을/를')} 얻는 것까지 보여 주고, ${c.check}${particle(c.check, '은/는')} 사람이 확인한다고 분명히 말합니다.`
    const hook =
      c.id === 'ax'
        ? `${tool} 이야기 많이 들으셨죠? 오늘은 기능 말고, 우리 회사 반복 업무 하나를 실제로 넘기는 장면을 보여 드릴게요.`
        : `${tool} 이야기 많이 들으셨죠? 오늘은 기능 말고, 대표님 회사 ${c.label} 준비에 바로 붙이는 장면만 보여 드릴게요.`
    return {
      core: c,
      from: 'ai',
      view,
      hook,
      titles: aiTitles(tool, c),
      thumbs: [`${c.label} × ${tool}`, `${c.doc} 먼저`],
      outline: [
        { at: '0:00', what: `결과 먼저 — ${c.doc} 초안이 완성된 화면 5초 + 첫 문장 "${hook}"` },
        { at: '0:30', what: `대표님들이 ${c.label}에서 막히는 곳 — ${pain || '자료를 모으고 글로 정리하는 시간'}` },
        { at: '1:00', what: `${josa(tool, '으로/로')} ${c.task} 장면 — ① 자료 넣기 ② 초안 ③ 사람이 고칠 곳(화면 녹화)` },
        { at: '4:00', what: `AI 에 맡기면 안 되는 것 — ${c.check}` },
        { at: '5:00', what: `이렇게 말해요 — ${view}` },
        { at: '6:00', what: `마무리 — ${brief.ending || '3줄 요약 + 상담 · 자료 안내 한 줄'}` },
      ],
    }
  }
  const view = `${o.topic} 이야기로 시작해, ${c.label}에서 대표님이 이번 주 할 일로 끝냅니다 — ${c.gain}.`
  const hook = `${o.topic} 소식, ${c.label} 준비하는 대표님은 이것부터 보셔야 합니다.`
  return {
    core: c,
    from: 'market',
    view,
    hook,
    titles: marketTitles(o.topic, c),
    thumbs: [`${o.topic} → ${c.label}`, '확인할 3가지'],
    outline: [
      { at: '0:00', what: `첫 문장 — "${hook}"` },
      { at: '0:30', what: `${o.topic} — 무엇이 바뀌나(숫자는 공식 자료로 확인)` },
      { at: '1:30', what: `${c.label}에는 — ${c.task} 순서로 보여 주기` },
      { at: '4:00', what: `꼭 확인할 것 — ${c.check}` },
      { at: '5:30', what: `마무리 — ${brief.ending || '3줄 요약 + 상담 · 자료 안내 한 줄'}` },
    ],
  }
}

/** 이 후보의 기본 본업 — AI 주제만(시장 주제는 null = 그대로). AI 후보마다 맞는 본업을 기준 순서로 돌아가며(같은 본업만 열 번 나오지 않게) */
export function defaultCore(o: Pick<Opportunity, 'topic' | 'topicId' | 'axis'>, cores: readonly BrandCore[], aiIndex: number, used: ReadonlySet<string> = new Set()): BrandCore | null {
  if (!isAi(o) || cores.length === 0) return null
  const kind = kindOf(o)
  // 만들기형 AI(자동화 · 직접 만들기)는 만드는 본업(AX · 시제품 …)을, 문서형은 쓰는 본업(사업계획서 …)을 먼저
  const fit = cores.filter((c) => c.fit[0] === kind || (kind !== 'build' && c.fit.includes(kind)))
  const pool = (fit.length ? fit : cores).slice(0, 3)
  // 앞 AI 후보가 이미 쓴 본업은 건너뛴다(다 썼으면 차례로)
  for (let k = 0; k < pool.length; k++) {
    const c = pool[(aiIndex + k) % pool.length]
    if (!used.has(c.id)) return c
  }
  return pool[aiIndex % pool.length]
}

/** 본업 칩에 띄울 것 — AI 주제는 기준의 본업 전부 · 시장 주제는 그 주제가 본업이 아닐 때만(그대로 두기 + 본업) */
export function coreChoices(o: Pick<Opportunity, 'topic' | 'axis'>, cores: readonly BrandCore[]): BrandCore[] {
  if (isAi(o)) return [...cores]
  if (o.axis === 'bridge' || isCore(o, cores)) return []
  return cores.filter((c) => !c.match.test(o.topic))
}

/** 후보 → 본업으로 이은 후보(제목 · 관점 · 썸네일 · 첫 문장). core 가 null 이면 그대로 */
export function brandOpportunity(o: Opportunity, core: BrandCore | null, brief: Pick<ChannelBrief, 'pains' | 'ending'>): Opportunity {
  if (!core) return o
  const k = brandKit(o, core, brief)
  // 이번 달 잘된 제목 구조(원래 첫 제목의 틀)를 앞에
  const lead = o.titles[0]?.patterns[0]
  const titles = k.titles.map((text, i) => ({ text, patterns: titlePatterns(text), i }))
  titles.sort((a, b) => Number(!(lead && b.patterns.includes(lead))) - Number(!(lead && a.patterns.includes(lead))) || a.i - b.i)
  return { ...o, view: k.view, titles: titles.map(({ text, patterns }) => ({ text, patterns })), thumbs: [...k.thumbs], brand: { core: core.id, label: core.label, hook: k.hook, outline: k.outline } }
}

/** 이번 주 후보 전부 — 기본 본업으로(AI 주제만 · 대표가 칩으로 고른 것은 choice 로) */
export function brandPicks(picks: readonly Opportunity[], brief: ChannelBrief, choice: ReadonlyMap<string, string> = new Map()): Opportunity[] {
  const cores = briefCores(brief)
  let ai = 0
  const used = new Set<string>()
  return picks.map((o) => {
    const picked = choice.get(o.key)
    const def = isAi(o) ? defaultCore(o, cores, ai++, used) : null
    if (def) used.add(def.id)
    // '' = 그대로 두기
    const core = picked === undefined ? def : picked === '' ? null : (CORE_BY_ID.get(picked) ?? def)
    return brandOpportunity(o, core, brief)
  })
}
