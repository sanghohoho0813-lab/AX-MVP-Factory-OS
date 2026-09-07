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

/** 정보 묶음 — 화면에서 이 순서·이 제목으로 나눈다 */
export type ProfileGroup = 'identity' | 'people' | 'contact' | 'credential'

export const PROFILE_GROUP_LABEL: Record<ProfileGroup, string> = {
  identity: '회사',
  people: '사람',
  contact: '연락처',
  credential: '인증서',
}

export interface ProfileField {
  key: string
  label: string
  value: string
  /** 비어 있으면 채우라고 표시 */
  empty: boolean
  /** 복사 버튼을 붙일지 (번호·주소처럼 붙여넣기 자주 하는 값) */
  copyable: boolean
  group: ProfileGroup
  /** 한 줄을 다 쓰는 긴 값 (주소·지분 구성) */
  wide?: boolean
}

/**
 * 공동인증서 — "받았는지" 와 "어디에 두었는지" 만 말한다.
 *
 * 비밀번호는 이 시스템 어디에도 저장하지 않는다. 저장하면 이 화면을 볼 수 있는
 * 사람이 곧 고객사 계정을 쓸 수 있는 사람이 되고, 백업 파일에도 그대로 남는다.
 * 그 위험은 "매번 물어보는 번거로움" 과 바꿀 만한 것이 아니다.
 */
function certificateValue(record: ClientOpsRecord): string {
  const doc = record.documents.jointCertificate
  // "미입력" 이 아니라 "아직 안 받음" 이다 — 안 받았다는 것도 답이다
  if (!doc || !doc.received) return '아직 안 받음'
  const where = doc.note.trim()
  const when = doc.issuedAt.trim()
  return ['받음', when ? `발급 ${when}` : '', where ? `보관: ${where}` : ''].filter(Boolean).join(' · ')
}

/** 자주 찾아보는 정보를 한 줄씩 정리한다 */
export function profileFields(
  record: ClientOpsRecord,
  today: string = todayLocalDate(),
): ProfileField[] {
  const y = yearsInBusiness(record.establishedAt, today)
  const age = ageFrom(record.representativeBirth, today)
  // 예전 기록은 대표 이름을 담당자 칸에 넣어 두었다 — 비어 있으면 그것을 쓴다
  const repName = record.representativeName.trim() || record.contactName.trim()

  const f = (
    key: string,
    label: string,
    value: string,
    group: ProfileGroup,
    opts: { copyable?: boolean; wide?: boolean } = {},
  ): ProfileField => ({
    key,
    label,
    value: value.trim(),
    empty: value.trim() === '',
    copyable: opts.copyable === true,
    group,
    wide: opts.wide,
  })

  return [
    // 회사 — 서류에 그대로 옮겨 적는 값들
    f('companyName', '회사명', record.companyName, 'identity', { copyable: true }),
    f(
      'establishedAt',
      '설립일 · 업력',
      record.establishedAt ? `${record.establishedAt}${y ? ` · ${y.nthYear}년차 (만 ${y.fullYears}년)` : ''}` : '',
      'identity',
    ),
    f('businessNumber', '사업자등록번호', record.businessNumber, 'identity', { copyable: true }),
    f('corporateNumber', '법인등록번호', record.corporateNumber, 'identity', { copyable: true }),
    f('businessCategory', '업태', record.businessCategory, 'identity'),
    f('businessItem', '종목', record.businessItem, 'identity'),
    f('businessAddress', '사업장 주소', record.businessAddress, 'identity', { copyable: true, wide: true }),

    // 사람 — 심사에서 매번 묻는 것들
    f(
      'representativeName',
      '대표자',
      repName ? `${repName}${record.representativeBirth ? ` · ${record.representativeBirth}${age !== null ? ` (만 ${age}세)` : ''}` : ''}` : '',
      'people',
    ),
    f(
      'contactName',
      '담당자',
      record.contactName ? `${record.contactName}${record.contactTitle ? ` ${record.contactTitle}` : ''}` : '',
      'people',
    ),
    f('employeeCount', '상시근로자', record.employeeCount, 'people'),
    f('shareholders', '주주·임원 구성', record.shareholders, 'people', { wide: true }),

    // 연락처
    f('contactPhone', '담당자 휴대폰', record.contactPhone, 'contact', { copyable: true }),
    f('companyPhone', '회사 대표번호', record.companyPhone, 'contact', { copyable: true }),
    f('contactEmail', '이메일', record.contactEmail, 'contact', { copyable: true }),
    f('homepage', '홈페이지', record.homepage, 'contact', { copyable: true }),

    // 인증서 — 받았는지·어디에 두었는지만. 비밀번호는 저장하지 않는다.
    f('jointCertificate', '공동인증서', certificateValue(record), 'credential', { wide: true }),
  ]
}

/** 묶음 순서대로 나눠 준다 (빈 묶음은 빼지 않는다 — 무엇이 비었는지도 정보다) */
export function profileFieldsByGroup(
  record: ClientOpsRecord,
  today: string = todayLocalDate(),
): { group: ProfileGroup; label: string; fields: ProfileField[] }[] {
  const all = profileFields(record, today)
  const order: ProfileGroup[] = ['identity', 'people', 'contact', 'credential']
  return order.map((g) => ({
    group: g,
    label: PROFILE_GROUP_LABEL[g],
    fields: all.filter((x) => x.group === g),
  }))
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
