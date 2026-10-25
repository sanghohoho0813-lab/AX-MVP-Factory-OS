/**
 * SAAS-2 마케팅 · 브랜딩을 대표가 아닌 계정(구독 고객 · 팀장)에게 열 때의 서버 쪽 고객판.
 *
 * 대표 계정 마케팅 AI 는 지금 그대로(이 파일을 거치지 않는다). 대표가 아닌 계정은
 *  - 채널 규칙(레이더 · 스레드 · 릴스/틱톡): '화자 = 김팀장' · '미래AI랩이 실제로 하는 일' 대신 [내 브랜드] 의 화자 · 분야
 *  - 단추 지시: 끝인사 "김팀장이었습니다" · "김팀장:" 대화 줄 · "미래AI랩 소개" → 그 사람 끝인사 · 컨설턴트 · 적은 소개만
 *    카드뉴스는 1차 상품에서 빼서 고객 단추에서 그 줄을 지운다(대표 화면 · 코드 · 기록은 그대로)
 *  - 기준 문서(마케팅 실측 공식): 대표 사실 목록(mk_facts) · 대표 운영 원칙(mk_principles)은 빼고,
 *    나머지 공식에서 대표 계정 실측 숫자 · 대표 완성 예시 · 대표 고객 사례 줄을 지운다(남의 실적이 고객 글에 사실처럼 들어가지 않게)
 *  - 화면이 보낸 자료에 대표 이름 · 대표 사실이 섞여 있으면(옛 화면 · 기본값) 그 줄을 빼고 보낸다 — 바꿔 쓰지 않고 뺀다
 *    (이름만 바꾸면 대표 경력이 고객 경력처럼 된다)
 *  - 답에 대표 이름이 나오면 그 사람 이름 · 회사로 바꾼다(마지막 그물)
 * 고객이 자기 설정에 직접 적은 이름(예: 팀장 본인 이름)은 그 사람 것이라 지우지 않는다.
 */
import { OWNER_IDENTITY_WORDS } from './brand.js'

/** 대표 개인 사실 표시(이름 없이 써도 대표 것) — 고객 지시문 · 자료에서 이 줄은 뺀다 */
export const OWNER_FACT_MARKERS = ['리틀펭귄', '의료폐기물', '폐기물 운반', 'litt.ly', 'kimteamjang', 'miraeailab', '2.4천', '107명', '100억+', '사례 250건', '9년째', '9년 차', '특허 5건', '11월 오픈']

/** 이 고객에게 '대표 것' 으로 볼 낱말 — 그 사람이 자기 이름 · 회사로 적은 낱말은 뺀다 */
export function ownerWordsFor(brand) {
  const own = [brand?.name, brand?.company].filter(Boolean).join(' ')
  return [...OWNER_IDENTITY_WORDS, ...OWNER_FACT_MARKERS].filter((w) => !own.includes(w))
}

export const hasOwnerWord = (text, words) => {
  const s = String(text ?? '')
  return words.some((w) => s.includes(w))
}

/* ------------------------------------------------------------------ */
/* 채널 규칙 — 대표 판(assists.js)과 같은 순서 · 대표 개인 줄만 고객판으로                */
/* ------------------------------------------------------------------ */

const SPEAKER_CUSTOMER = '화자 = 사용자 본인([내 브랜드] 의 부르는 이름 · 말투 — 적혀 있지 않으면 이름 없이 "저는" · 컨설턴트로).'
const FACTS_CUSTOMER = '사용자의 경력 · 사례 수 · 금액 · 성과는 [내 브랜드] 의 확인된 사실과 [자료] 에 있는 것만 — 없으면 [대괄호] 로 비우고 확인할 것에 적는다.'

/** 레이더 — 4번째 줄(대표 회사가 하는 일)만 바뀐다 */
export function customerRadarRules(rules) {
  return rules.map((r) =>
    /미래AI랩이 실제로 하는 일/.test(r)
      ? `모든 기획은 [내 브랜드] 의 업종 · 전문분야(적혀 있지 않으면 중소기업 대표의 돈 문제 — 정책자금 · 지원금 · 절세 같은 것) 가운데 하나와 이어지고, 사용자가 실제 상담에서 본 장면 · 실수 · 숫자로 푼다. ${FACTS_CUSTOMER}`
      : r,
  )
}

/** 스레드 · 숏폼 — '화자 = 김팀장 …' 줄만 바뀐다 */
export function customerChannelRules(rules, kind) {
  return rules.map((r) => {
    if (!/화자\s*=\s*김팀장/.test(r)) return r
    const tone = kind === 'threads' ? '반말 기본 · "대표님" 호칭(말투가 적혀 있으면 그 말투)' : '존댓말 · 대표님께(말투가 적혀 있으면 그 말투)'
    const shows = kind === 'shorts' ? ' 화면 시연은 사용자가 실제로 만든 화면만(고객사 정보 가림).' : ''
    return `${SPEAKER_CUSTOMER} ${tone}. ${FACTS_CUSTOMER}${shows} 지어낸 숫자 · 대사 · 반응 · 후기 · 선착순 · 사례 금지.`
  })
}

/* ------------------------------------------------------------------ */
/* 단추 지시                                                             */
/* ------------------------------------------------------------------ */

const SIGN_OFF = /"김팀장이었습니다\.?\s*감사합니다\."/g
const INSTRUCTION_SWAPS = [
  [SIGN_OFF, '끝인사 한 줄([내 브랜드] 의 끝인사가 있으면 그 말 · 없으면 "감사합니다.")'],
  [/"김팀장:\s*…"/g, '"컨설턴트: …"'],
  [/미래AI랩이 직접 쓰는 글/g, '사용자 회사가 직접 쓰는 글'],
  [/\+\s*미래AI랩 소개\s*\+/g, '+ 하는 일 소개([내 브랜드] 에 적은 것만 · 없으면 한 줄로 비움) +'],
  [/쇼츠 · 릴스 대본 2편 · 카드뉴스 7장 · 올릴 때 글/g, '쇼츠 · 릴스 대본 2편 · 올릴 때 글'],
  [/릴스 · 카드뉴스 · 올릴 때 글/g, '릴스 · 올릴 때 글'],
]

/** 고객 단추 지시 — 끝인사 · 대화 줄 · 회사 소개 · 카드뉴스 줄 */
export function customerInstruction(lines) {
  return lines
    .filter((l) => !/tag\s*=\s*"카드뉴스"/.test(l))
    .map((l) => INSTRUCTION_SWAPS.reduce((s, [re, rep]) => s.replace(re, rep), l))
    .map((l) => l.replace(/항목 5~6\(tag = "올릴 때 글"\)/, '항목 4~5(tag = "올릴 때 글")'))
}

/** 고객 단추 이름 — '미래AI랩 맞춤 · 미래AI랩이 따라 할' 같은 이름은 '내 채널' 로 */
export function customerLabel(label) {
  return String(label ?? '')
    .replace(/카드뉴스 · /g, '')
    .replace(/미래AI랩 맞춤/g, '내 채널 맞춤')
    .replace(/미래AI랩이 따라 할/g, '내가 따라 할')
    .replace(/미래AI랩이 참고할/g, '내가 참고할')
}

/* ------------------------------------------------------------------ */
/* 기준 문서(마케팅 실측 공식)                                              */
/* ------------------------------------------------------------------ */

/** 고객에게 붙이지 않는 묶음 — 대표 사실 목록 · 대표 운영 원칙 */
export const CUSTOMER_KB_EXCLUDE = new Set(['mk_facts', 'mk_principles'])

/** 대표 완성 예시 · 대표 계정 운영안 — 장째 뺀다(끝 = 다음 장 머리글, 없으면 묶음 끝까지) */
const CUT_SECTIONS = [
  { start: /^\d+\.\s.*김팀장 (?:롱폼 기획|숏폼 대본|완성 글|계정 \d주 운영안)/, end: /^\d+\.\s(?:첫 줄 기법|끝 방식)/ },
]
const PACK_SWAPS = [
  [/\s*\(김팀장용\)/g, ''],
  [/김팀장 분야/g, '정책자금 · 지원사업 분야'],
]

/** 공식 묶음 하나 → 고객판(대표 예시 장 · 대표 이름 · 대표 사실 줄 없이) */
export function customerPack(text) {
  const words = [...OWNER_IDENTITY_WORDS, ...OWNER_FACT_MARKERS]
  const out = []
  let cut = null
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim()
    if (cut) {
      if (cut.end.test(line)) cut = null
      else continue
    }
    const sec = CUT_SECTIONS.find((c) => c.start.test(line))
    if (sec) {
      cut = sec
      continue
    }
    const swapped = PACK_SWAPS.reduce((s, [re, rep]) => s.replace(re, rep), raw)
    if (hasOwnerWord(swapped, words)) continue
    out.push(swapped)
  }
  return out.join('\n')
}

/* ------------------------------------------------------------------ */
/* 화면이 보낸 자료 · 모델 답                                               */
/* ------------------------------------------------------------------ */

/**
 * 화면 자료에서 대표 이름 · 대표 사실이 든 줄을 뺀다(목적 · 참고 · 규칙집 · 자료 줄).
 * 돌려주는 removed = 뺀 줄 수(기록 · 시험용). 고객이 자기 설정에 적은 이름은 빼지 않는다.
 */
export function stripOwnerContext(context, brand) {
  const c = context && typeof context === 'object' ? context : {}
  const words = ownerWordsFor(brand)
  let removed = 0
  const keep = (v) => {
    const bad = hasOwnerWord(typeof v === 'string' ? v : JSON.stringify(v ?? ''), words)
    if (bad) removed += 1
    return !bad
  }
  const out = { ...c }
  if (typeof c.purpose === 'string' && !keep(c.purpose)) out.purpose = ''
  if (typeof c.title === 'string' && !keep(c.title)) out.title = ''
  if (Array.isArray(c.facts)) out.facts = c.facts.filter(keep)
  if (Array.isArray(c.rules)) out.rules = c.rules.filter(keep)
  if (Array.isArray(c.sections)) out.sections = c.sections.map((s) => (s && Array.isArray(s.rows) ? { ...s, rows: s.rows.filter(keep) } : s))
  return { context: out, removed }
}

/** 답(구조 · 글)에 대표 이름이 나오면 그 사람 이름 · 회사로 — 마지막 그물 */
export function customerOutput(value, brand, depth = 0) {
  const words = ownerWordsFor(brand)
  const person = brand?.name || '담당 컨설턴트'
  const company = brand?.company || '이 컨설팅사'
  const fix = (s) => {
    if (!hasOwnerWord(s, words)) return s
    let t = s
    if (words.includes('경영노트')) t = t.replace(/김팀장의\s*경영\s*노트/g, brand?.company || '이 채널')
    if (words.includes('미래AI랩')) t = t.replace(/미래\s*AI\s*랩|미래에이아이랩|MIRAE\s*AI\s*LAB/gi, company)
    if (words.includes('MIRAE')) t = t.replace(/MIRAE/g, company)
    if (words.includes('김상호')) t = t.replace(/김상호(\s*대표)?/g, person)
    if (words.includes('김팀장')) t = t.replace(/김팀장/g, person)
    if (words.includes('최은혜')) t = t.replace(/최은혜(\s*팀장)?/g, '팀장')
    return t
  }
  if (depth > 8) return value
  if (typeof value === 'string') return fix(value)
  if (Array.isArray(value)) return value.map((v) => customerOutput(v, brand, depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, customerOutput(v, brand, depth + 1)]))
  return value
}
