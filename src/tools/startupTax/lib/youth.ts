import type { YouthStatus } from '../types'

// 청년 기준은 법마다 다르다.
// - 조특법(청년창업중소기업 세액감면): "창업 당시" 만 15~34세, 병역 기간 최대 6년까지 차감 가능
//   (조특법 시행령 §5 — D-136: 오늘 나이가 아니라 창업일 나이로 본다)
// - 중소기업창업 지원법(청년 우대 · 정책자금): 만 39세 이하 — 신청 때 나이라 오늘 나이로 안내한다
//
// 만 35~40세는 병역 기간을 빼야 알 수 있으므로 "확인 필요"(null) — 판정에서는 청년으로 보지 않는다.
export function buildYouthStatus(age: number | null, ageNow: number | null = age): YouthStatus {
  // 조특법
  let taxLaw: boolean | null
  let taxLawNote: string
  if (age === null) {
    taxLaw = null
    taxLawNote = '생년월일과 창업일을 입력하면 조특법 청년(창업 당시 만 15~34세) 해당 여부를 확인할 수 있습니다.'
  } else if (age >= 15 && age <= 34) {
    taxLaw = true
    taxLawNote = `창업 당시 만 ${age}세로 조특법상 청년 요건에 해당할 수 있습니다.`
  } else if (age >= 35 && age <= 40) {
    taxLaw = null
    taxLawNote = `창업 당시 만 ${age}세 — 병역 기간(최대 6년)을 빼야 청년인지 알 수 있어 확인이 필요합니다. 확인 전에는 청년으로 보지 않고 판정했습니다.`
  } else {
    taxLaw = false
    taxLawNote = `창업 당시 만 ${age}세로 조특법 청년 요건에는 해당하지 않습니다. (병역 차감 포함)`
  }

  // 창업지원법
  let startupLaw: boolean | null
  let startupLawNote: string
  if (ageNow === null) {
    startupLaw = null
    startupLawNote = '생년월일을 입력하면 창업지원법 청년(만 39세 이하) 해당 여부를 확인할 수 있습니다.'
  } else if (ageNow <= 39) {
    startupLaw = true
    startupLawNote = '만 39세 이하로 창업지원법상 청년 요건에 해당할 수 있습니다.'
  } else {
    startupLaw = false
    startupLawNote = '만 39세를 초과하여 창업지원법 청년 요건에는 해당하지 않습니다.'
  }

  return { age, ageNow, taxLaw, taxLawNote, startupLaw, startupLawNote }
}
