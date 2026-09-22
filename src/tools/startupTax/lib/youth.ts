import type { YouthStatus } from '../types'

// 청년 기준은 법마다 다르다.
// - 조특법(청년창업중소기업 세액감면): 만 15~34세, 병역 기간 최대 6년까지 차감 가능
// - 중소기업창업 지원법(창업기업 확인): 만 39세 이하
export function buildYouthStatus(age: number | null): YouthStatus {
  // 조특법
  let taxLaw: boolean | null
  let taxLawNote: string
  if (age === null) {
    taxLaw = null
    taxLawNote = '생년월일을 입력하면 조특법 청년(만 15~34세) 해당 여부를 확인할 수 있습니다.'
  } else if (age >= 15 && age <= 34) {
    taxLaw = true
    taxLawNote = '만 15~34세로 조특법상 청년 요건에 해당할 수 있습니다.'
  } else if (age >= 35 && age <= 40) {
    taxLaw = null
    taxLawNote = `만 ${age}세이지만 병역 기간(최대 6년) 차감 시 조특법 청년 요건에 해당할 수 있습니다.`
  } else {
    taxLaw = false
    taxLawNote = '연령 기준상 조특법 청년 요건에는 해당하지 않습니다. (병역 차감 포함)'
  }

  // 창업지원법
  let startupLaw: boolean | null
  let startupLawNote: string
  if (age === null) {
    startupLaw = null
    startupLawNote = '생년월일을 입력하면 창업지원법 청년(만 39세 이하) 해당 여부를 확인할 수 있습니다.'
  } else if (age <= 39) {
    startupLaw = true
    startupLawNote = '만 39세 이하로 창업지원법상 청년 요건에 해당할 수 있습니다.'
  } else {
    startupLaw = false
    startupLawNote = '만 39세를 초과하여 창업지원법 청년 요건에는 해당하지 않습니다.'
  }

  return { age, taxLaw, taxLawNote, startupLaw, startupLawNote }
}
