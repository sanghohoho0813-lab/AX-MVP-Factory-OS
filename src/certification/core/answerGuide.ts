/**
 * 실사 답변 '말하기 가이드' (P2) — 외우는 대본이 아니라 현장에서 읽는 메모.
 *   핵심 답 1~3문장 · 꼭 말할 것 2~4개 · 증빙 · 대표 확인
 *
 * 규칙(엄격): 문장마다 근거(basis)가 붙는다. 근거가 되는 것은
 *   ① 확인된 사실(서류 · 회사 정보 확인 · 연구소 관리 기록) ② 서류함에 실제로 있는 증빙 ③ 컨설턴트가 직접 고른 값(칩)
 *   ④ 컨설턴트가 고쳐 적은 답 뿐이다. '확인 전' 값 · 모르는 값으로는 문장을 만들지 않고 '대표 확인' 으로 돌린다.
 * 수치는 근거 값에 있는 것만 쓴다. '업계 최고' 같은 평가 말은 쓰지 않는다.
 */
import type { BasisField, CertificationClientContext } from './types'
import { eunNeun } from './josa'
import type { InspectionQuestion, PreparedAnswer } from './inspection'

/** 근거가 붙은 한 문장 */
export interface Sourced {
  text: string
  /** 어디서 — 비어 있으면 안 된다(시험으로 확인) */
  basis: string
}

/** 질문마다 규칙이 만드는 조각 */
export interface GuideParts {
  core: Sourced[]
  points: Sourced[]
  /** 근거가 없어 대표에게 물어야 할 것(질문 꼴) */
  ownerAsk: string[]
}

export interface AnswerGuide extends GuideParts {
  /** 핵심 답을 만들 근거가 하나도 없음 — 화면은 '대표 확인 후 보완' 한 줄만 */
  needsOwner: boolean
  /** 컨설턴트가 고친 답을 그대로 씀 */
  edited: boolean
  evidenceHave: string[]
  evidenceMissing: string[]
}

/** 사실 하나 — 쓸 수 있는 것만(확인됨 · 컨설턴트 선택). '확인 전' 은 null */
export interface KitFact {
  value: string
  basis: string
  /** 컨설턴트가 칩으로 고른 값(회사 정보 미확인) */
  chip: boolean
}

export interface FactKit {
  ctx: CertificationClientContext
  /** 확인된 사실 · 컨설턴트 선택만 — 그 밖은 null */
  fact: (f: BasisField) => KitFact | null
  /** 서류함에 쓸 수 있는 증빙이 있는가 */
  hasEvidence: (id: string) => boolean
  /** 보유 인증(인증서 칸 · 진행 기록) 이름들 */
  held: string[]
}

const CERT_NAME: Record<string, string> = { venture: '벤처기업', lab: '기업부설연구소', innobiz: '이노비즈', mainbiz: '메인비즈', iso9001: 'ISO 9001', iso14001: 'ISO 14001', iso45001: 'ISO 45001' }

export function factKit(c: CertificationClientContext): FactKit {
  const usable = (f: BasisField): KitFact | null => {
    const b = (c.basis ?? []).find((x) => x.field === f)
    if (!b || b.state === 'missing' || !b.value) return null
    const chip = b.from.startsWith('컨설턴트')
    // '확인 전'(입력만 된 값 · 추정)은 답변 문장에 쓰지 않는다 — 컨설턴트가 직접 고른 칩은 쓴다
    if (b.state === 'estimated' && !chip) return null
    return { value: b.value, basis: b.from, chip }
  }
  return {
    ctx: c,
    fact: usable,
    hasEvidence: (id) => c.evidence.some((e) => e.id === id && e.have && !e.stale),
    held: c.held.map((h) => CERT_NAME[h.key] ?? h.key),
  }
}

/** 대표가 답한 것(컨설턴트가 받아 적음)의 근거 이름 */
export const OWNER_BASIS = '대표 답(컨설턴트 기록)'

/** 금지 말 — 근거 없는 평가 · 과장 */
export const BANNED_WORDS = /업계\s*최고|국내\s*최고|최고\s*수준|세계\s*최초|국내\s*최초|유일|독보적|1위|압도적|완벽/

export function buildAnswerGuide(q: InspectionQuestion, c: CertificationClientContext, labelOf: (id: string) => string, prep?: PreparedAnswer): AnswerGuide {
  const kit = factKit(c)
  const parts: GuideParts = q.guide ? q.guide(kit) : { core: [], points: [], ownerAsk: [] }
  const have = q.evidence.filter((id) => kit.hasEvidence(id))
  const evidenceHave = have.map(labelOf)
  const evidenceMissing = q.evidence.filter((id) => !have.includes(id)).map(labelOf)
  // 컨설턴트가 고쳐 적은 답은 그대로(컨설턴트가 직접 확인한 내용)
  if (prep?.state === 'edited' && prep.text?.trim()) {
    return { core: [{ text: prep.text.trim(), basis: '컨설턴트가 고쳐 적은 답(직접 확인)' }], points: parts.points.slice(0, 4), ownerAsk: [], needsOwner: false, edited: true, evidenceHave, evidenceMissing }
  }
  const clean = (xs: Sourced[]) => xs.filter((x) => x.basis.trim() !== '' && x.text.trim() !== '' && !BANNED_WORDS.test(x.text))
  const core = clean(parts.core).slice(0, 3)
  const points = clean(parts.points).slice(0, 4)
  return { core, points, ownerAsk: [...new Set(parts.ownerAsk)].slice(0, 4), needsOwner: core.length === 0, edited: false, evidenceHave, evidenceMissing }
}

/** 핵심 답 근거가 없을 때 화면 · 글에 쓰는 한 줄 */
export function ownerPlaceholder(q: InspectionQuestion): string {
  return `${eunNeun(q.topic ?? '이 질문')} 대표 확인 후 보완이 필요합니다.`
}
