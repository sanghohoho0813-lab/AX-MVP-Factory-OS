/**
 * 받침에 맞는 조사 (FV) — '이노비즈은(는)' 같은 기계 말투를 없앤다.
 * 마지막 한글 글자의 받침을 본다(괄호 · 숫자 뒤는 마지막 한글 글자 기준). 한글이 없으면 받침 없는 쪽.
 */
function lastHangul(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const code = word.charCodeAt(i)
    if (code >= 0xac00 && code <= 0xd7a3) return code
    if (/[0-9]/.test(word[i])) return DIGIT[word[i]]
    if (/[A-Za-z]/.test(word[i])) return null
  }
  return null
}
/** 숫자 읽는 소리의 받침(0 영 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 → 받침 있음) */
const DIGIT: Record<string, number> = { '0': 0xc601, '1': 0xc77c, '2': 0xc774, '3': 0xc0bc, '4': 0xc0ac, '5': 0xc624, '6': 0xc721, '7': 0xce60, '8': 0xd314, '9': 0xad6c }
const jong = (code: number | null) => (code === null ? 0 : (code - 0xac00) % 28)

/** 은/는 */
export const eunNeun = (w: string) => `${w}${jong(lastHangul(w)) ? '은' : '는'}`
/** 이/가 */
export const iGa = (w: string) => `${w}${jong(lastHangul(w)) ? '이' : '가'}`
/** 으로/로(ㄹ 받침은 '로') */
export const euroRo = (w: string) => {
  const j = jong(lastHangul(w))
  return `${w}${j && j !== 8 ? '으로' : '로'}`
}
