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
  // D-144: 크레탑 보고서 · 4대보험 명부도 서류 올리기 한 번에 — 모듈이 저절로 읽는다
  cretopReport: [
    { re: /기업\s*종합\s*보고서/, weight: 3, say: "제목 '기업종합보고서'" },
    { re: /CRETOP|크레탑/i, weight: 2, say: "'CRETOP'" },
    { re: /한국평가데이터|KoDATA/i, weight: 2, say: "'한국평가데이터'" },
    { re: /신용\s*등급|재무\s*상태표|손익\s*계산서/, weight: 1, say: "'신용등급 · 재무상태표'" },
  ],
  payrollRoster: [
    { re: /가입자\s*명부|피보험자\s*명부|사업장\s*가입자/, weight: 3, say: "제목 '가입자 명부'" },
    { re: /4대\s*(?:사회)?보험/, weight: 2, say: "'4대보험'" },
    { re: /자격\s*취득일|취득\s*일자/, weight: 1, say: "'자격취득일'" },
    { re: /고용\s*보험|산재\s*보험|국민\s*연금/, weight: 1, say: "'고용보험 · 국민연금'" },
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
  cretopReport: /크레탑|cretop|기업\s*종합\s*보고서|kodata/i,
  payrollRoster: /가입자|4대\s*보험|피보험자|사원\s*명부|직원\s*명부/,
}

/**
 * 기본 10종에 없지만 자주 오는 서류.
 * 대표가 같은 이름의 칸을 만들어 두었으면 그 칸으로 가고, 없으면 "이 이름으로 칸을 만들까요" 가 된다.
 */
/**
 * D-147: validMonths — 이 서류로 새 칸을 만들 때 넣는 유효기간(발급일 기준 만료 알림).
 * 법정 기한이 아니라 기관들이 보통 요구하는 발급 기준이다: 인감 3개월 이내 · 납세 · 완납증명은 발급 후 30일 · 벤처확인 3년.
 */
export const KNOWN_EXTRA_DOCS: { label: string; signals: Signal[]; nameHint: RegExp; validMonths?: number }[] = [
  {
    label: '법인인감증명서',
    validMonths: 3,
    signals: [
      { re: /인감\s*증명서/, weight: 3, say: "제목 '인감증명서'" },
      { re: /인감/, weight: 1, say: "'인감'" },
    ],
    nameHint: /인감/,
  },
  {
    label: '납세증명서',
    validMonths: 1,
    signals: [
      { re: /납세\s*증명서/, weight: 3, say: "제목 '납세증명서'" },
      { re: /국세\s*완납|체납액?\s*없음|징수\s*유예/, weight: 1, say: "'체납액 없음'" },
    ],
    nameHint: /납세|국세\s*완납/,
  },
  {
    label: '지방세 납세증명서',
    validMonths: 1,
    signals: [{ re: /지방세\s*납세\s*증명/, weight: 3, say: "제목 '지방세 납세증명서'" }],
    nameHint: /지방세/,
  },
  {
    label: '4대보험 완납증명서',
    validMonths: 1,
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
    validMonths: 36,
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

/** D-147: 알려진 서류 이름 → 새 칸 유효기간(개월). 모르면 null */
export function knownDocValidMonths(label: string): number | null {
  const c = label.replace(/\s+/g, '').replace(/\(\d+\)$/, '')
  return KNOWN_EXTRA_DOCS.find((k) => k.label.replace(/\s+/g, '') === c)?.validMonths ?? null
}

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

/* ------------------------------------------------------------------ */
/* D-146: 서류 제목으로 칸 정하기                                          */
/* ------------------------------------------------------------------ */

/**
 * 대표 지시(D-146): 서류는 맨 위에 무슨 서류인지 적혀 있다(사업자등록증 · 등기사항전부증명서 …).
 * 그 제목으로 칸을 정하고, 맞는 칸이 없으면 그 이름으로 새 칸을 만들어 올린다. 도무지 모르겠으면 '기타 · 확인 필요'.
 * 이름이 맞지 않는 칸(대표자 신분증 칸에 졸업증명서)에는 넣지 않는다 — 낱말 점수만으로 기본 칸을 고르지 않는다.
 */

export const OTHER_DOC_LABEL = '기타 · 확인 필요'

/** 기본 칸의 제목 — 이 제목이 보이면 그 칸 */
const TITLE_TO_KEY: [RegExp, DocumentKey][] = [
  [/^사업자등록증$/, 'businessRegistration'],
  [/^(?:법인)?등기사항(?:전부|일부)?증명서|^(?:법인)?등기부등본/, 'corporateRegistry'],
  [/^(?:주민등록증|운전면허증|여권)(?:사본)?$|^(?:대표자)?신분증(?:사본)?$/, 'representativeId'],
  [/^중소기업(?:\(소상공인\))?확인서/, 'smeCertificate'],
  [/자격득실확인서$|^건강보험자격득실/, 'healthInsurance'],
  [/가입자명부$|^4대(?:사회)?보험(?:사업장)?가입자|피보험자명부$/, 'payrollRoster'],
  [/기업종합보고서$|^CRETOP/i, 'cretopReport'],
  [/^(?:표준)?재무제표(?:증명(?:원)?)?$|^재무상태표$|^손익계산서$/, 'financialStatements'],
]

/** 제목이 끝나는 모양 — '…증명서' '…확인서' '…등본' '…명부' … */
const TITLE_END = /(증명서|증명원|증명|확인서|확인원|인정서|인증서|등록증|등본|초본|명부|보고서|계약서|신고서|신청서|명세서|내역서|결과서|계획서|통지서|사본|정관|원부|대장|면허증|허가증|자격증|증서|재무제표|계산서|상태표|등록증명)$/
/** 제목이 아닌 줄(머리 · 안내 문구) */
const NOT_TITLE = /^(발급번호|문서확인번호|접수번호|확인번호|페이지|쪽|page|발행|민원|정부24|홈택스|국세청|대법원|인터넷등기소|본증명서|이증명서|위와같이|아래와같이)/i

function compactTitle(s: string): string {
  return s.replace(/[\s·ㆍ.,:：\-_()（）\[\]「」『』<>《》"'“”]/g, '')
}

/** 서류 글 맨 위에서 제목을 찾는다(없으면 null) */
export function documentTitle(text: string): string | null {
  const lines = (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 18)
  for (const line of lines) {
    // '사 업 자 등 록 증' 처럼 띄어 쓴 제목도 붙여서 본다 · 괄호 안 부제(법인사업자)는 뺀다
    const c = compactTitle(line.replace(/\([^)]{0,20}\)/g, ''))
    if (c.length < 3 || c.length > 22) continue
    if (NOT_TITLE.test(c)) continue
    if (!/^[가-힣A-Za-z0-9]+$/.test(c)) continue
    if (!/[가-힣]{2}/.test(c)) continue
    if (TITLE_END.test(c) || TITLE_TO_KEY.some(([re]) => re.test(c))) return c
  }
  return null
}

/** 파일 이름에서 서류 이름 — '사업자등록증_샤인디자인_2026.pdf' → 사업자등록증 */
export function titleFromFileName(fileName: string): string | null {
  const base = (fileName ?? '').replace(/\.[A-Za-z0-9]{1,5}$/, '')
  for (const part of base.split(/[\s_\-.()\[\]]+/)) {
    const c = compactTitle(part)
    if (c.length >= 3 && c.length <= 22 && /[가-힣]{2}/.test(c) && (TITLE_END.test(c) || TITLE_TO_KEY.some(([re]) => re.test(c)))) return c
  }
  return null
}

export type DocPlacement =
  | { kind: 'existing'; key: DocumentKey; label: string; sure: boolean; reason: string; issuedAt: string | null }
  | { kind: 'new'; label: string; sure: boolean; reason: string; issuedAt: string | null }

/** 서류 하나 → 어느 칸(있는 칸 · 새 칸 · 기타) */
export function placeDocument(input: { text: string; fileName: string }, metas: DocumentMeta[]): DocPlacement {
  const text = input.text ?? ''
  const hasText = compact(text).length >= 10
  const issuedAt = hasText ? findIssuedDate(text) : null
  const fileMetas = metas.filter((m) => m.needsFile)
  const fromText = hasText ? documentTitle(text) : null
  const title = fromText ?? titleFromFileName(input.fileName)
  const how = fromText ? '서류 제목' : '파일 이름'
  if (title) {
    const builtin = TITLE_TO_KEY.find(([re]) => re.test(title))
    const meta = builtin ? fileMetas.find((m) => m.key === builtin[1]) : null
    if (meta) return { kind: 'existing', key: meta.key, label: meta.label, sure: Boolean(fromText), reason: `${how} '${title}'`, issuedAt }
    // 이름이 같은 칸(직접 만든 칸 · 기본 칸 이름)
    const same = fileMetas.find((m) => compactTitle(m.label) === title || (title.length >= 4 && compactTitle(m.label).replace(/\(\d+\)$/, '') === title))
    if (same) return { kind: 'existing', key: same.key, label: same.label, sure: Boolean(fromText), reason: `${how} '${title}' — 같은 이름의 칸`, issuedAt }
    const known = KNOWN_EXTRA_DOCS.find((k) => compactTitle(k.label) === title || k.signals.some((sg) => sg.weight >= 3 && sg.re.test(title)))
    return { kind: 'new', label: known?.label ?? title, sure: Boolean(fromText), reason: `${how} '${title}' — 그 이름으로 새 칸`, issuedAt }
  }
  // 제목이 없으면 — 낱말 판별이 '확실' 할 때만 기본 칸, 아니면 기타
  const r = classifyDocument(input, metas)
  if (r.key && r.confidence === 'sure') return { kind: 'existing', key: r.key, label: fileMetas.find((m) => m.key === r.key)?.label ?? '', sure: true, reason: r.reason, issuedAt }
  if (r.suggestedLabel && r.confidence !== 'unknown') return { kind: 'new', label: r.suggestedLabel, sure: false, reason: r.reason, issuedAt }
  return { kind: 'new', label: OTHER_DOC_LABEL, sure: false, reason: hasText ? '제목을 찾지 못했어요 — 열어 보고 맞는 이름으로 바꿔 주세요' : '글자를 읽지 못했어요 — 열어 보고 맞는 이름으로 바꿔 주세요', issuedAt }
}
