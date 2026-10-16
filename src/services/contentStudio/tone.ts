/**
 * 말투 (D-203) — 견본은 모두 '해요' 로 쓰고, '격식 있게' 를 고르면 문장 끝만 '합니다' 로 바꾼다.
 *
 * 바꾸는 곳: 마침표 · 느낌표 · 줄바꿈 · 글 끝 바로 앞의 '…요' 하나. 물음표 앞(…나요? · …까요?)과
 * '…세요'(부탁 · 권유)는 그대로 둔다 — 격식 있는 글에서도 자연스럽다.
 * 글자 단위로 받침을 계산한다(했어요 → 했습니다 · 줄어요 → 줍니다 · 쉬워요 → 쉽습니다 · 보여요 → 보입니다).
 */

export type Tone = 'friendly' | 'formal'

export const TONE_LABEL: Record<Tone, string> = { friendly: '부드럽게(~해요)', formal: '격식 있게(~합니다)' }

const BASE = 0xac00
const RIEUL = 8
const BIEUP = 17

interface Syl {
  cho: number
  jung: number
  jong: number
}

function split(ch: string): Syl | null {
  const c = ch.charCodeAt(0) - BASE
  if (c < 0 || c > 11171) return null
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 }
}

function join(s: Syl): string {
  return String.fromCharCode(BASE + s.cho * 588 + s.jung * 28 + s.jong)
}

// 모음 번호(중성)
const V = { a: 0, ae: 1, eo: 4, yeo: 6, o: 8, wa: 9, wae: 10, oe: 11, u: 13, wo: 14, i: 20 } as const
const CHO_IEUNG = 11

/** 한 낱말(… 요 로 끝남)을 '…니다' 로. 못 바꾸면 null */
export function formalWord(word: string): string | null {
  if (!word.endsWith('요') || word.length < 2) return null
  // 부탁(…세요) · 물음(…나요 · …까요 · …가요)은 그대로 — 물음표를 빠뜨린 제목도 안전하게
  if (/(세요|나요|까요|인가요|는가요)$/.test(word)) return null
  if (/거예요$/.test(word)) return word.replace(/거예요$/, '것입니다')
  if (/아니에요$/.test(word)) return word.replace(/아니에요$/, '아닙니다')
  if (/이에요$/.test(word)) return word.replace(/이에요$/, '입니다')
  if (/예요$/.test(word)) return word.replace(/예요$/, '입니다')
  if (/도와요$/.test(word)) return word.replace(/도와요$/, '돕습니다')
  if (/해요$/.test(word)) return word.replace(/해요$/, '합니다')

  const stem = word.slice(0, -1)
  const last = stem.slice(-1)
  const s = split(last)
  if (!s) return null
  const head = stem.slice(0, -1)

  // …어요 · …아요 (따로 쓴 '어' · '아')
  if (s.cho === CHO_IEUNG && s.jong === 0 && (s.jung === V.eo || s.jung === V.a)) {
    const prev = split(head.slice(-1))
    if (!prev || prev.jong === 0) return null
    const before = head.slice(0, -1)
    if (prev.jong === RIEUL) return `${before}${join({ ...prev, jong: BIEUP })}니다`
    return `${head}습니다`
  }
  if (s.jong !== 0) return null
  // ㅂ 불규칙: 쉬워요 → 쉽습니다 · 고마워요 → 고맙습니다
  if (s.cho === CHO_IEUNG && s.jung === V.wo) {
    const prev = split(head.slice(-1))
    if (!prev || prev.jong !== 0) return null
    return `${head.slice(0, -1)}${join({ ...prev, jong: BIEUP })}습니다`
  }
  const to: Record<number, number> = { [V.yeo]: V.i, [V.wa]: V.o, [V.wo]: V.u, [V.wae]: V.oe }
  const jung = to[s.jung] ?? s.jung
  return `${head}${join({ cho: s.cho, jung, jong: BIEUP })}니다`
}

/** 글 전체 — 문장 끝 '…요' 만 바꾼다 */
export function toFormal(text: string): string {
  return text.replace(/([가-힣]+요)(?=[.!"'”’)\]\n]|$)/g, (m) => formalWord(m) ?? m)
}

export function applyTone(text: string, tone: Tone): string {
  return tone === 'formal' ? toFormal(text) : text
}
