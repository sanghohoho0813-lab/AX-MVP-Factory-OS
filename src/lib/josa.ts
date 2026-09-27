/**
 * 조사 붙이기 (D-127) — '할 일는' · '모듈을(를)' 같은 어색한 말을 없앤다.
 *
 * 마지막 글자의 받침을 보고 고른다. 한글이 아니면 읽는 소리로(숫자 1 '일' · 영문 L '엘').
 * 괄호로 끝나면 괄호 앞 글자를 본다 — '재무 분석(크레탑)' → '재무 분석(크레탑)은'.
 */

type Pair = '은/는' | '이/가' | '을/를' | '과/와' | '으로/로' | '이에요/예요'

const DIGIT_BATCHIM: Record<string, boolean> = { '0': true, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false }
// 영문 한 글자를 읽을 때 받침이 있는 것: L(엘) M(엠) N(엔) R(알)
const LATIN_BATCHIM = new Set(['l', 'm', 'n', 'r'])

/** 받침이 있나 — 모르면 null. 'ㄹ' 받침이면 'rieul' */
export function batchimOf(word: string): 'none' | 'some' | 'rieul' | null {
  const trimmed = word.replace(/[\s)\]}'"’”·.,!?]+$/u, '').replace(/\([^()]*\)$/u, '').trimEnd()
  const ch = trimmed.slice(-1)
  if (!ch) return null
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28
    if (jong === 0) return 'none'
    return jong === 8 ? 'rieul' : 'some'
  }
  if (ch in DIGIT_BATCHIM) return ch === '1' || ch === '7' || ch === '8' ? 'rieul' : DIGIT_BATCHIM[ch] ? 'some' : 'none'
  if (/[a-z]/i.test(ch)) return LATIN_BATCHIM.has(ch.toLowerCase()) ? (ch.toLowerCase() === 'l' || ch.toLowerCase() === 'r' ? 'rieul' : 'some') : 'none'
  return null
}

/** 조사만 — 받침을 모르면 뒤 것(는 · 가 · 를 …) */
export function particle(word: string, pair: Pair): string {
  const [withB, withoutB] = pair.split('/')
  const b = batchimOf(word)
  if (pair === '으로/로') return b === 'some' ? withB : withoutB
  return b === 'some' || b === 'rieul' ? withB : withoutB
}

/** 낱말 + 조사 */
export function josa(word: string, pair: Pair): string {
  return `${word}${particle(word, pair)}`
}
