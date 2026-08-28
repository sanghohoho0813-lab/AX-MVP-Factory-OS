/**
 * 기업 기본 정보 파생값 — 업력(몇 년차), 대표자 나이 등.
 * 매번 계산해서 보여주므로 저장하지 않는다(날짜가 지나면 자동으로 바뀐다).
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { todayLocalDate } from '../lib/appClock'

function ymd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** 만 나이 (생일 안 지났으면 -1) */
export function ageFrom(birth: string, today: string = todayLocalDate()): number | null {
  const b = ymd(birth)
  const t = ymd(today)
  if (!b || !t) return null
  let age = t[0] - b[0]
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age -= 1
  return age >= 0 && age < 150 ? age : null
}

/** 업력 — 만 몇 년, 그리고 "N년차" 표기 */
export function yearsInBusiness(
  establishedAt: string,
  today: string = todayLocalDate(),
): { fullYears: number; nthYear: number } | null {
  const e = ymd(establishedAt)
  const t = ymd(today)
  if (!e || !t) return null
  let full = t[0] - e[0]
  if (t[1] < e[1] || (t[1] === e[1] && t[2] < e[2])) full -= 1
  if (full < 0 || full > 200) return null
  return { fullYears: full, nthYear: full + 1 }
}

export interface ProfileField {
  key: string
  label: string
  value: string
  /** 비어 있으면 채우라고 표시 */
  empty: boolean
  /** 복사 버튼을 붙일지 (번호·주소처럼 붙여넣기 자주 하는 값) */
  copyable: boolean
}

/** 자주 찾아보는 정보를 한 줄씩 정리한다 */
export function profileFields(
  record: ClientOpsRecord,
  today: string = todayLocalDate(),
): ProfileField[] {
  const y = yearsInBusiness(record.establishedAt, today)
  const age = ageFrom(record.representativeBirth, today)

  const f = (key: string, label: string, value: string, copyable = false): ProfileField => ({
    key,
    label,
    value: value.trim(),
    empty: value.trim() === '',
    copyable,
  })

  return [
    f('companyName', '회사명', record.companyName, true),
    f('businessNumber', '사업자등록번호', record.businessNumber, true),
    f('corporateNumber', '법인등록번호', record.corporateNumber, true),
    f(
      'establishedAt',
      '설립일 (업력)',
      record.establishedAt ? `${record.establishedAt}${y ? ` · ${y.nthYear}년차 (만 ${y.fullYears}년)` : ''}` : '',
    ),
    f('businessCategory', '업태', record.businessCategory),
    f('businessItem', '종목', record.businessItem),
    f('businessAddress', '사업장 주소', record.businessAddress, true),
    f(
      'representative',
      '대표자',
      record.contactName
        ? `${record.contactName}${record.representativeBirth ? ` · ${record.representativeBirth}${age !== null ? ` (만 ${age}세)` : ''}` : ''}`
        : '',
    ),
    f('contactTitle', '담당자 직급', record.contactTitle),
    f('contactPhone', '담당자 휴대폰', record.contactPhone, true),
    f('companyPhone', '회사 대표번호', record.companyPhone, true),
    f('contactEmail', '이메일', record.contactEmail, true),
    f('homepage', '홈페이지', record.homepage, true),
  ]
}

/** 전체 정보를 한 번에 복사할 수 있는 텍스트 */
export function profileAsText(record: ClientOpsRecord, today: string = todayLocalDate()): string {
  return profileFields(record, today)
    .filter((x) => !x.empty)
    .map((x) => `${x.label}: ${x.value}`)
    .join('\n')
}

/** 아직 안 채운 항목 수 */
export function missingProfileCount(record: ClientOpsRecord, today: string = todayLocalDate()): number {
  return profileFields(record, today).filter((x) => x.empty).length
}
