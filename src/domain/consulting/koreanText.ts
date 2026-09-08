/**
 * 한국어 문장 조립 도우미.
 *
 * 시스템이 초안 문장을 만들 때 "…확인한다을 대신하는" 같은 말이 나오면
 * 사용자는 그 순간 시스템을 믿지 않는다. 조사와 어미는 규칙으로 정확히 맞춘다.
 *
 * 순수 함수다. 사전이 아니라 한글 자모 계산이므로 어떤 낱말에도 동작한다.
 */

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** 마지막 글자에 받침이 있는가. 한글이 아니면 null(판단 불가) */
export function hasFinalConsonant(word: string): boolean | null {
  const s = word.trim().replace(/[)\]}"'’”·.\s]+$/, '')
  if (s === '') return null
  const code = s.charCodeAt(s.length - 1)
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28 !== 0
  // 숫자로 끝나면 읽는 소리로 판단한다 (0·1·3·6·7·8 은 받침 있음)
  if (code >= 0x30 && code <= 0x39) return '01346780'.includes(s[s.length - 1]) && s[s.length - 1] !== '2'
  return null
}

/**
 * 받침에 맞는 조사를 붙인다. 판단할 수 없으면 '을(를)' 처럼 둘 다 적는다 —
 * 틀린 조사를 자신 있게 붙이는 것보다 낫다.
 */
export function withParticle(word: string, withBatchim: string, withoutBatchim: string): string {
  const b = hasFinalConsonant(word)
  if (b === null) return `${word}${withBatchim}(${withoutBatchim})`
  return `${word}${b ? withBatchim : withoutBatchim}`
}

export const objectParticle = (w: string): string => withParticle(w, '을', '를')
export const subjectParticle = (w: string): string => withParticle(w, '이', '가')
export const topicParticle = (w: string): string => withParticle(w, '은', '는')

/** 문장 끝의 종결어미를 떼어 다른 문장에 끼울 수 있는 명사구로 만든다 */
export function toPhrase(sentence: string): string {
  let s = sentence.replace(/\s+/g, ' ').trim().replace(/[.]+$/, '')
  // 앞에 붙은 회사 소개("… 현장에서")를 떼어 낸다 — 초안끼리 겹쳐 쓰이지 않게
  s = s.replace(/^.*?현장에서\s+/, '')
  // 뒤에 붙은 판정문을 떼어 낸다
  s = s.replace(/\s*문제가\s*반복.*$/, '')
  // 흔한 종결어미 제거
  s = s.replace(/(하고\s*있습니다|되고\s*있습니다|입니다|습니다|합니다|됩니다|있습니다|한다|된다|있다|진다)$/, '')
  return s.replace(/\s*[,·]\s*$/, '').trim()
}

/** 화면·문장에 넣기 전에 길이를 자른다 — 초안이 문단이 되면 아무도 안 읽는다 */
export function clip(s: string, max: number): string {
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, '')}…`
}
