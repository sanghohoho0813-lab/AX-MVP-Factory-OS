/**
 * D-629 자동 모델 — 대표(2026-11-18): "대화창에서 물을 때마다 코인이 나간다. '이제 기획 시작해 줘' 처럼 진짜 일을 시킬 때는
 * 고급 모델을 써야 하지만, '이거 어떻게 해야 돼?', '사업자등록증 들어가 있나?' 같은 단순 질문에 비싼 모델을 쓸 이유가 없다 — 제일 싼 모델."
 *
 * 여기는 순수 함수만(저장 · 서버 호출 없음 · 규칙으로 가른다):
 *   classifyAsk  이번 요청이 물음(light)인가 일을 시키는 것(heavy)인가 — 단추의 종류(쓰기 · 기획 · 명세서 …)와 적은 말로. 모르겠으면 물음
 *   pickAuto     물음 → 가장 싼 모델 · 일 → 그보다 한 단계 좋은 모델. 늘 서버가 이 계정에 준 목록 안에서만
 *
 * 자동은 서버 기본 회사(보통 Gemini) 안에서만 고른다 — 물음에 쓰는 모델이 예전 기본(가장 싼 모델)과 같게.
 * 팀장 · 구독 고객 화면은 올려 쓰지 않는다(upgrade false · 서버가 준 role 이 pilot) — 늘 가장 싼 모델 그대로.
 */
import { betterModel } from './modelUpgrade'
import type { AssistStatus, ModelInfo, ProviderId, ProviderInfo } from './client'
import { ASSIST_PRESETS } from './presets'

export type AskWeight = 'light' | 'heavy'

/* ------------------------------------------------------------------ */
/* 물음인가 · 일을 시키는 것인가                                           */
/* ------------------------------------------------------------------ */

/** 대화 · 직접 묻기 단추(이름이 .ask · .chat 으로 끝남) — 단추만으로는 모른다. 적은 말로 가른다 */
const CHAT_ID = /\.(?:ask|chat)$/
/** 단추 이름에 이 말이 있으면 만드는 일(기획 대화 · 명세서 · 사업계획서 단계는 목록형이어도 좋은 모델로) */
const LABEL_WORK = /기획|설계|초안|제안서|사업\s*계획서|명세서|대본/
/** 옮겨 적기만 하는 단추(영상 대본 받아 적기) — 쓰기 종류여도 만드는 일이 아니다 */
const LABEL_COPY = /받아\s*적/

/** 단추(질문 단추 서재) 하나의 무게 — 서재에 없는 단추는 물음으로 */
export function presetWeight(assistId: string): AskWeight {
  const p = ASSIST_PRESETS.find((x) => x.id === assistId)
  if (!p || CHAT_ID.test(p.id) || LABEL_COPY.test(p.label)) return 'light'
  return p.kind === 'write' || LABEL_WORK.test(p.label) ? 'heavy' : 'light'
}

/** '써 줘' 가 아닌 '써' · 서류 이름의 '명세서' — 가르기 전에 뺀다 */
const NOT_WRITING = /신경\s*써|마음\s*써|애써|힘써/g
const PAPER_NAMES = /(?:급여|임금|거래|납품|지급|원천징수)\s*명세서/g

/** 시키는 끝말 — 줘 · 주세요 · 줄래 · 줄 수 (있어?) · 봐 · 보자. '써 줘야 해?' · '써 줘서' · '고쳐 봐야 해?' 는 시키는 말이 아니다 */
const END = '(?:줘(?!야|서|도)|주세요|주십시오|주라|줄래|주실래|주시겠|줄\\s*수|주실\\s*수|줬으면|봐(?!도|야|서)|보자|볼래)'
/** 만들라고 시키는 말 — 써 줘 · 작성해 주세요 · 만들어 줄래 · 기획해 봐 · 고쳐 줘 · 쓰자 · 작성합시다 */
const ORDER = new RegExp(
  `(?:써|작성\\s*해|만들어|기획\\s*해|설계\\s*해|구성\\s*해|완성\\s*해|제작\\s*해|다듬어|고쳐|수정\\s*해|보완\\s*해)\\s*${END}` +
    '|(?:쓰|만들|작성하|기획하|설계하)자(?![가-힣])|(?:작성|기획|설계)\\s*합시다',
)
/** 시작하라는 말 — (기획) 시작해 줘 · 시작하자 · 이대로 진행해 줘 */
const START = new RegExp(`시작\\s*해\\s*${END}|시작하자(?![가-힣])|시작합시다|진행\\s*해\\s*${END}|진행하자(?![가-힣])|진행합시다`)
/** 만드는 일 · 만들 것을 가리키는 말 — 묻는 말이 아닐 때만 일로 본다("제안서 초안" · "사업계획서 작성 부탁") */
const WORK = /기획(?!재정)|설계(?!사)|작성(?!일|자)|초안|집필|제안서|사업\s*계획서|명세서|대본|스크립트|원고|보도\s*자료|(?:블로그|홍보|소개)\s*글/
/** 묻는 말 · 있는지 보는 말 · 알려 달라는 말 · 했다고 알리는 말 — 만들 것 이름이 섞여 있어도 물음 */
const ASKING = new RegExp(
  [
    '[?？]',
    '뭐|뭘|무엇|무슨|어떻게|어떡|어디|언제|누구|누가|왜|얼마|몇|어느|어떤|어때',
    '(?:있|없|됐|했|맞|갔|왔)(?:나요?|니|냐|는지|을까요?|습니까)(?![가-힣])',
    '(?:인가|인지|는지|은지|까|까요|가요|나요|입니까|맞아|맞지)\\s*[.!~]*$',
    '알려|보여|찾아|확인|설명|열어|요약|비교|검토|살펴|읽어|계산|봐\\s*(?:줘|주세요)',
    '올렸|올려\\s*(?:놨|뒀|둠)|받았|보냈|넣었|넣어\\s*(?:놨|뒀|둠)|냈어|했어|했다|됐어|됐다|끝났|왔어|왔다|들어가\\s*있|들어\\s*있|있어|있다|없어|없다|완료|고마워|고맙|감사',
  ].join('|'),
)

/** 적은 말만으로 — 만들라고 시키면 일 · 묻거나 확인하면 물음 · 모르겠으면 물음 */
export function askWeight(text: string | null | undefined): AskWeight {
  const t = String(text ?? '')
    .replace(NOT_WRITING, ' ')
    .replace(PAPER_NAMES, ' 서류 ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return 'light'
  if (ORDER.test(t) || START.test(t)) return 'heavy'
  return WORK.test(t) && !ASKING.test(t) ? 'heavy' : 'light'
}

/**
 * 이번 요청의 무게.
 *   heavy  쓰기 · 기획 · 명세서 · 사업계획서 단추 / 자체점검 기준(skill)이 같이 가는 명세서 · 사업계획서 작업 / 적은 말이 만들라고 시킬 때
 *   light  그 밖 — 물음 · 확인 · 짧은 설명 · 목록 정리
 */
export function classifyAsk(req: { assistId: string; skill?: string | null; ask?: string | null }): AskWeight {
  if (presetWeight(req.assistId) === 'heavy') return 'heavy'
  if (String(req.skill ?? '').trim()) return 'heavy'
  return askWeight(req.ask)
}

/* ------------------------------------------------------------------ */
/* 어느 모델로                                                           */
/* ------------------------------------------------------------------ */

export interface AutoOptions {
  /** 이 화면에서 쓸 수 있는 AI 회사(없으면 서버 목록 전부) */
  providers?: readonly ProviderId[]
  /** 일을 시킬 때 좋은 모델로 올려 써도 되는 화면인가(팀장 · 구독 고객 화면은 false — 늘 가장 싼 모델) */
  upgrade?: boolean
  /** 이 회사 안에서 고르기([가장 싼 모델] · [좋은 모델] 단추가 지금 고른 회사를 따르게) — 없거나 못 쓰면 서버 기본 회사 */
  prefer?: ProviderId | null
}

type Pick = { provider: ProviderId; model: string }

const cost = (m: ModelInfo): number | null => (m.price ? m.price[0] + m.price[1] : null)

/** 자동이 고르는 회사 — 서버 기본 회사(키가 있을 때) · 없으면 키가 있는 첫 회사 */
function homeProvider(status: AssistStatus | null, o: AutoOptions): ProviderInfo | null {
  if (!status || !Array.isArray(status.providers)) return null
  const usable = status.providers.filter((p) => p && p.configured && Array.isArray(p.models) && p.models.length > 0 && (!o.providers || o.providers.includes(p.id)))
  return usable.find((p) => p.id === o.prefer) ?? usable.find((p) => p.id === status.defaultChoice?.provider) ?? usable[0] ?? null
}

/** 그 회사의 가장 싼 모델 — 서버가 '빠르게(cheap)' 로 정한 모델 · 없으면 가격표에서 가장 싼 것 · 가격도 모르면 첫 모델 */
function cheapestOf(p: ProviderInfo): ModelInfo {
  const byTier = p.models.find((m) => m.tier === 'cheap')
  if (byTier) return byTier
  const priced = p.models.filter((m) => cost(m) != null).sort((a, b) => cost(a)! - cost(b)!)
  return priced[0] ?? p.models[0]
}

/**
 * 가장 싼 모델보다 한 단계 좋은 모델 — [더 잘 쓰는 모델로 다시](betterModel)가 권하는 그 모델(빠르게 → 보통).
 * 보통 단계가 없는 회사는 더 나은 것 가운데 가장 싼 것(가장 비싼 단계는 그것 하나뿐일 때만). 없으면 가장 싼 모델 그대로.
 */
function goodOf(status: AssistStatus, p: ProviderInfo, cheap: ModelInfo): ModelInfo {
  const up = betterModel(status, { provider: p.id, model: cheap.id })
  const hit = up ? p.models.find((m) => m.id === up.model) : undefined
  if (hit) return hit
  const base = cost(cheap)
  const better = p.models
    .filter((m) => m.id !== cheap.id && (m.tier === 'standard' || m.tier === 'deep' || (base != null && cost(m) != null && cost(m)! > base)))
    .sort((a, b) => (cost(a) ?? Infinity) - (cost(b) ?? Infinity))
  return better[0] ?? cheap
}

export interface AutoPlan {
  /** 물음에 쓰는 모델(가장 싼 모델) */
  light: Pick
  /** 일을 시킬 때 쓰는 모델(올려 쓸 수 없으면 light 와 같다) */
  heavy: Pick
  /** 일을 시킬 때 더 좋은 모델로 올려 쓰는가 — false 면 자동이라고 말하지 않는다(모델이 하나뿐 · 팀장 · 고객) */
  upgrades: boolean
}

/** 이 계정의 자동 계획 — 서버 목록을 못 받았거나 키가 있는 회사가 없으면 null(예전 기본 그대로: 고른 것 없이 보냄) */
export function autoPlan(status: AssistStatus | null, o: AutoOptions = {}): AutoPlan | null {
  const p = homeProvider(status, o)
  if (!p || !status) return null
  const cheap = cheapestOf(p)
  // 서버가 팀장 등급이라고 한 계정은 올려 쓰지 않는다(화면이 대표 모양으로 잘못 알고 있어도)
  const may = o.upgrade !== false && status.role !== 'pilot'
  const good = may ? goodOf(status, p, cheap) : cheap
  return { light: { provider: p.id, model: cheap.id }, heavy: { provider: p.id, model: good.id }, upgrades: good.id !== cheap.id }
}

/** 이번 요청에 쓸 모델 — 물음은 가장 싼 모델 · 일은 좋은 모델. null 이면 고른 것 없이 보낸다(서버 기본 = 예전 그대로) */
export function pickAuto(status: AssistStatus | null, weight: AskWeight, o: AutoOptions = {}): Pick | null {
  const plan = autoPlan(status, o)
  return plan ? (weight === 'heavy' ? plan.heavy : plan.light) : null
}
