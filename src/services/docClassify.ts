/**
 * 서류 종류 판별 — 파일 하나를 읽어 "이건 어느 칸인가" 를 답한다 (D-84).
 *
 * 대표는 서류를 한꺼번에 받는다. 폴더째 넣으면 알아서 사업자등록증은 사업자등록증 칸에,
 * 등기부등본은 등기부등본 칸에 가고, 애매한 것만 사람이 본다 — 그것이 이 파일의 일이다.
 *
 * 방법은 **낱말 맞추기**다. 서류마다 제목·고정 문구가 있다("등기사항전부증명서", "자격득실확인서").
 * 제목이 맞으면 확실, 문구 몇 개가 맞으면 확인 필요, 아무것도 없으면 모름.
 * 파일 이름도 본다 — "사업자등록증.pdf" 는 그 자체로 힌트다. 규칙 계산이며 외부 호출은 없다.
 *
 * 순수 함수. 단위 시험으로 고정한다.
 */

import type { DocumentMeta } from '../content/clientOpsCatalog'
import type { DocumentKey } from '../types/clientOps'
import { parseKoreanDate } from './koreanDocParser'

export type ClassifyConfidence = 'sure' | 'maybe' | 'unknown'

export interface ClassifyResult {
  /** 고른 칸. 모르면 null */
  key: DocumentKey | null
  confidence: ClassifyConfidence
  /** 사람 말로 된 근거 — 화면에 그대로 보여 준다 */
  reason: string
  /** 서류에서 읽은 발급일 (YYYY-MM-DD). 못 읽으면 null */
  issuedAt: string | null
  /** 칸은 없지만 어떤 서류인지 알 때 — 그 이름으로 칸을 만들어 올릴 수 있다 */
  suggestedLabel: string | null
  /** 칸별 점수 (시험·디버그용) */
  scores: Record<string, number>
}

export const CONFIDENCE_LABEL: Record<ClassifyConfidence, string> = {
  sure: '확실',
  maybe: '확인 필요',
  unknown: '모름',
}

interface Signal {
  re: RegExp
  weight: number
  /** 근거 문구 — 맞았을 때 화면에 보여 줄 말 */
  say: string
}

/** 기본 서류 중 파일을 받는 다섯 종의 고정 문구 */
const BUILTIN_SIGNALS: Record<string, Signal[]> = {
  businessRegistration: [
    { re: /사업자등록증/, weight: 3, say: "제목 '사업자등록증'" },
    { re: /개업\s*연월일/, weight: 2, say: "'개업연월일'" },
    { re: /사업장\s*소재지/, weight: 1, say: "'사업장 소재지'" },
    { re: /교부\s*일자/, weight: 1, say: "'교부일자'" },
    { re: /법인명\s*\(?\s*단체명/, weight: 1, say: "'법인명(단체명)'" },
    { re: /업\s*태/, weight: 1, say: "'업태'" },
  ],
  corporateRegistry: [
    { re: /등기사항\s*전부\s*증명서/, weight: 3, say: "제목 '등기사항전부증명서'" },
    { re: /회사\s*성립\s*연월일/, weight: 2, say: "'회사성립연월일'" },
    { re: /임원에\s*관한\s*사항/, weight: 2, say: "'임원에 관한 사항'" },
    { re: /등기\s*기록/, weight: 1, say: "'등기기록'" },
    { re: /1\s*주의\s*금액/, weight: 1, say: "'1주의 금액'" },
    { re: /등기\s*번호/, weight: 1, say: "'등기번호'" },
    { re: /대표\s*이사/, weight: 1, say: "'대표이사'" },
  ],
  representativeId: [
    { re: /주민\s*등록증/, weight: 3, say: "제목 '주민등록증'" },
    { re: /운전\s*면허증/, weight: 3, say: "제목 '운전면허증'" },
    { re: /여권|PASSPORT/i, weight: 2, say: "'여권'" },
    { re: /\d{6}\s*-\s*[1-4]\d{6}/, weight: 1, say: '주민등록번호 모양의 숫자' },
    { re: /발급\s*기관|시장\s*·?\s*군수|경찰청장/, weight: 1, say: "'발급기관'" },
  ],
  smeCertificate: [
    { re: /중소기업\s*확인서/, weight: 3, say: "제목 '중소기업확인서'" },
    { re: /중소벤처기업부/, weight: 2, say: "'중소벤처기업부'" },
    { re: /소기업|중기업|소상공인/, weight: 1, say: "'소기업·중기업'" },
    { re: /확인서\s*번호|확인\s*번호/, weight: 1, say: "'확인서 번호'" },
    { re: /유효\s*기간/, weight: 1, say: "'유효기간'" },
  ],
  healthInsurance: [
    { re: /자격\s*득실\s*확인서/, weight: 3, say: "제목 '자격득실확인서'" },
    { re: /국민건강보험공단/, weight: 2, say: "'국민건강보험공단'" },
    { re: /건강보험/, weight: 1, say: "'건강보험'" },
    { re: /자격\s*취득일|자격\s*상실일|가입자\s*구분/, weight: 1, say: "'자격취득일'" },
  ],
}

/** 파일 이름에서 잡는 힌트 — 글자를 못 읽어도 이름은 있다 */
const BUILTIN_NAME_HINTS: Record<string, RegExp> = {
  businessRegistration: /사업자\s*등록증|사업자등록/,
  corporateRegistry: /등기부|등기사항|등기\s*전부/,
  representativeId: /신분증|주민등록증|운전면허|여권/,
  smeCertificate: /중소기업\s*확인/,
  healthInsurance: /건강보험|득실/,
}

/**
 * 기본 10종에 없지만 자주 오는 서류.
 * 대표가 같은 이름의 칸을 만들어 두었으면 그 칸으로 가고, 없으면 "이 이름으로 칸을 만들까요" 가 된다.
 */
export const KNOWN_EXTRA_DOCS: { label: string; signals: Signal[]; nameHint: RegExp }[] = [
  {
    label: '법인인감증명서',
    signals: [
      { re: /인감\s*증명서/, weight: 3, say: "제목 '인감증명서'" },
      { re: /인감/, weight: 1, say: "'인감'" },
    ],
    nameHint: /인감/,
  },
  {
    label: '납세증명서',
    signals: [
      { re: /납세\s*증명서/, weight: 3, say: "제목 '납세증명서'" },
      { re: /국세\s*완납|체납액?\s*없음|징수\s*유예/, weight: 1, say: "'체납액 없음'" },
    ],
    nameHint: /납세|국세\s*완납/,
  },
  {
    label: '지방세 납세증명서',
    signals: [{ re: /지방세\s*납세\s*증명/, weight: 3, say: "제목 '지방세 납세증명서'" }],
    nameHint: /지방세/,
  },
  {
    label: '4대보험 완납증명서',
    signals: [
      { re: /4대\s*(?:사회)?보험/, weight: 2, say: "'4대보험'" },
      { re: /완납\s*증명/, weight: 2, say: "'완납증명'" },
    ],
    nameHint: /4대\s*보험|완납/,
  },
  {
    label: '재무제표',
    signals: [{ re: /재무제표|재무상태표|손익계산서/, weight: 3, say: "'재무제표'" }],
    nameHint: /재무제표|재무상태표|손익/,
  },
  {
    label: '주주명부',
    signals: [{ re: /주주\s*명부/, weight: 3, say: "제목 '주주명부'" }],
    nameHint: /주주명부/,
  },
  {
    label: '정관',
    signals: [
      { re: /정\s*관/, weight: 2, say: "'정관'" },
      { re: /제\s*1\s*조|총\s*칙/, weight: 1, say: "'제1조·총칙'" },
    ],
    nameHint: /^정관|_정관|정관\./,
  },
  {
    label: '벤처기업확인서',
    signals: [{ re: /벤처기업\s*확인서/, weight: 3, say: "제목 '벤처기업확인서'" }],
    nameHint: /벤처기업\s*확인/,
  },
  {
    label: '특허증',
    signals: [{ re: /특허증|특허\s*제\s*\d+\s*호/, weight: 3, say: "'특허증'" }],
    nameHint: /특허증/,
  },
  {
    label: '기업부설연구소 인정서',
    signals: [{ re: /기업부설연구소|연구개발전담부서/, weight: 3, say: "'기업부설연구소'" }],
    nameHint: /연구소|전담부서/,
  },
  {
    label: '통장 사본',
    signals: [{ re: /계좌\s*번호|예금주/, weight: 2, say: "'계좌번호·예금주'" }],
    nameHint: /통장/,
  },
]

function compact(s: string): string {
  return s.replace(/\s+/g, '')
}

/** 서류의 발급일 — 라벨 뒤의 날짜를 먼저, 없으면 마지막에 나오는 'YYYY년 MM월 DD일' */
export function findIssuedDate(text: string): string | null {
  const labeled = /(?:발급\s*일자?|발행\s*일자?|교부\s*일자?|출력\s*일자?)\s*[:：]?\s*([0-9년월일.\-/\s]{6,24})/.exec(text)
  const fromLabel = labeled ? parseKoreanDate(labeled[1]) : undefined
  if (fromLabel && plausible(fromLabel)) return fromLabel
  const all = [...text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)]
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const d = parseKoreanDate(all[i][0])
    if (d && plausible(d)) return d
  }
  return null
}

function plausible(ymd: string): boolean {
  const y = Number(ymd.slice(0, 4))
  return y >= 2000 && y <= new Date().getFullYear() + 1
}

/**
 * 판별.
 * `metas` 는 그 업체의 서류 전부(기본 + 직접 만든 칸). 파일을 받지 않는 칸(휴대폰번호 같은)은 뺀다.
 */
export function classifyDocument(input: { text: string; fileName: string }, metas: DocumentMeta[]): ClassifyResult {
  const text = input.text ?? ''
  const name = input.fileName ?? ''
  const hasText = compact(text).length >= 10
  const scores: Record<string, number> = {}
  const reasons: Record<string, string[]> = {}
  const bump = (key: string, w: number, say: string) => {
    scores[key] = (scores[key] ?? 0) + w
    ;(reasons[key] ??= []).push(say)
  }

  const fileMetas = metas.filter((m) => m.needsFile)
  const labelOf = new Map(fileMetas.map((m) => [m.key, m.label]))

  for (const m of fileMetas) {
    const builtin = BUILTIN_SIGNALS[m.key]
    if (builtin) {
      for (const s of builtin) if (s.re.test(text)) bump(m.key, s.weight, s.say)
      const hint = BUILTIN_NAME_HINTS[m.key]
      if (hint && hint.test(name)) bump(m.key, 2, `파일 이름에 '${m.label}'`)
      continue
    }
    // 직접 만든 칸 — 알려진 서류면 그 문구로, 아니면 칸 이름 자체로
    const known = KNOWN_EXTRA_DOCS.find((k) => compact(k.label) === compact(m.label))
    if (known) {
      for (const s of known.signals) if (s.re.test(text)) bump(m.key, s.weight, s.say)
      if (known.nameHint.test(name)) bump(m.key, 2, `파일 이름에 '${m.label}'`)
    }
    const core = compact(m.label)
    if (core.length >= 2) {
      if (compact(text).includes(core)) bump(m.key, 3, `본문에 '${m.label}'`)
      if (compact(name).includes(core)) bump(m.key, 2, `파일 이름에 '${m.label}'`)
    }
  }

  // 칸은 없는데 무엇인지는 아는 서류
  let suggested: { label: string; score: number; say: string[] } | null = null
  for (const k of KNOWN_EXTRA_DOCS) {
    if (fileMetas.some((m) => compact(m.label) === compact(k.label))) continue
    let sc = 0
    const say: string[] = []
    for (const s of k.signals) if (s.re.test(text)) { sc += s.weight; say.push(s.say) }
    if (k.nameHint.test(name)) { sc += 2; say.push(`파일 이름에 '${k.label}'`) }
    if (sc > (suggested?.score ?? 0)) suggested = { label: k.label, score: sc, say }
  }

  // 사업자등록증과 등기부등본은 서로를 밀어낸다 — 둘 다 보이면 제목이 있는 쪽
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  const second = ranked[1]
  const issuedAt = hasText ? findIssuedDate(text) : null

  if (!top || top[1] === 0) {
    if (suggested && suggested.score >= 3) {
      return {
        key: null,
        confidence: 'maybe',
        reason: `'${suggested.label}' 로 보입니다 — 이 업체에 그 칸이 없습니다 (${suggested.say.join(', ')})`,
        issuedAt,
        suggestedLabel: suggested.label,
        scores,
      }
    }
    return {
      key: null,
      confidence: 'unknown',
      reason: hasText ? '아는 문구가 없습니다' : '글자를 읽지 못했습니다 — 파일 이름에도 힌트가 없습니다',
      issuedAt,
      suggestedLabel: null,
      scores,
    }
  }

  const [key, score] = top
  const margin = score - (second?.[1] ?? 0)
  const why = (reasons[key] ?? []).join(', ')
  // 칸이 없는 알려진 서류가 더 강하면 그쪽을 말한다
  if (suggested && suggested.score > score && suggested.score >= 3) {
    return {
      key: null,
      confidence: 'maybe',
      reason: `'${suggested.label}' 로 보입니다 — 이 업체에 그 칸이 없습니다 (${suggested.say.join(', ')})`,
      issuedAt,
      suggestedLabel: suggested.label,
      scores,
    }
  }
  // 글자를 못 읽고 이름만 맞으면 확인이 필요하다
  if (!hasText) {
    return { key, confidence: 'maybe', reason: `${why} — 글자는 읽지 못했습니다`, issuedAt, suggestedLabel: null, scores }
  }
  if (score >= 3 && margin >= 2) {
    return { key, confidence: 'sure', reason: why, issuedAt, suggestedLabel: null, scores }
  }
  if (score >= 2) {
    const rival = second ? ` (${labelOf.get(second[0]) ?? second[0]} 일 수도 있습니다)` : ''
    return { key, confidence: 'maybe', reason: `${why}${rival}`, issuedAt, suggestedLabel: null, scores }
  }
  return { key, confidence: 'unknown', reason: `${why} — 근거가 약합니다`, issuedAt, suggestedLabel: null, scores }
}
