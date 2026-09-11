/**
 * 기업 기본 정보 파생값 — 업력(몇 년차), 대표자 나이 등.
 * 매번 계산해서 보여주므로 저장하지 않는다(날짜가 지나면 자동으로 바뀐다).
 */

import type { ClientOpsRecord, ProfileGroupKey } from '../types/clientOps'
import { todayLocalDate } from '../lib/appClock'
import { digitsOf, formatNumberOf, type NumberKind } from '../lib/format'

/**
 * 날짜 읽기 — 실제로 들어오는 모양을 모두 받는다.
 *
 * 등기부·홈택스에서 옮겨 적은 값은 `2002-02-16` 만이 아니라 `20020216` · `2002.02.16` ·
 * `2002/2/16` 로도 들어온다. 예전에는 하이픈 형식만 읽어서 나머지는 "업력을 알 수 없음" 이 되고,
 * 화면에는 `20020216` 이라는 날것이 그대로 찍혔다.
 */
function ymd(s: string): [number, number, number] | null {
  const t = s.trim()
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t)
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return [y, mo, d]
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

/**
 * 기록에 어떤 모양으로 들어와 있든 화면에는 `2002-02-16` 으로 보여 준다.
 * 못 읽으면 원문 그대로 둔다 — 날짜를 지어내지 않는다. (D-62 · D-64 와 같은 규칙)
 */
export function formatYmd(value: string): string {
  const p = ymd(value)
  if (!p) return value.trim()
  return `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`
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

/**
 * 주소에서 지역만 뽑는다 — "경기도 남양주시 순화궁로 282, …" → "경기 남양주시".
 *
 * 목록에서는 주소 전체가 필요 없다. 어느 지역 업체인지만 보이면 되고,
 * 그 이상은 줄을 잡아먹는다. 규칙에 맞지 않으면 첫 낱말만 돌려준다.
 */
const REGION_SHORT: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원도: '강원',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주도: '제주',
  제주특별자치도: '제주',
}

export function regionOf(address: string): string {
  const parts = address.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return ''
  const wide = REGION_SHORT[parts[0]] ?? parts[0]
  const city = parts[1] ?? ''
  // 두 번째 낱말이 시·군·구일 때만 붙인다 (도로명이 붙으면 오히려 길어진다)
  return /[시군구]$/.test(city) ? `${wide} ${city}` : wide
}

/** 정보 묶음 — 화면에서 이 순서·이 제목으로 나눈다 (정본은 types/clientOps) */
export type ProfileGroup = ProfileGroupKey

export const PROFILE_GROUP_LABEL: Record<ProfileGroup, string> = {
  identity: '회사',
  people: '사람',
  contact: '연락처',
  credential: '인증서',
}

/** 이 칸을 고치면 어느 값이 바뀌는가 (없으면 화면에서 직접 못 고치는 칸) */
export type ProfileEditKey =
  | 'companyName'
  | 'establishedAt'
  | 'businessNumber'
  | 'corporateNumber'
  | 'businessCategory'
  | 'businessItem'
  | 'businessItemsExtra'
  | 'businessAddress'
  | 'representativeName'
  | 'representativeBirth'
  | 'contactName'
  | 'contactTitle'
  | 'employeeCount'
  | 'shareholders'
  | 'contactPhone'
  | 'companyPhone'
  | 'contactEmail'
  | 'homepage'

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
  /**
   * 서식이 정해진 번호인가 (사업자등록번호·법인등록번호·전화).
   * 있으면 화면에는 하이픈을 넣어 보여 주고, 복사할 때 '그대로 / 숫자만' 을 고를 수 있다.
   */
  numberKind?: NumberKind
  /**
   * 눌러서 바로 고칠 수 있는 칸이면 고칠 값의 이름.
   * 서류를 첨부해야만 채워지는 일이 없도록, 거의 모든 칸이 여기에 해당한다.
   * '대표자' 처럼 여러 값을 합쳐 보여 주는 칸은 대표 값 하나만 고친다.
   */
  edit?: ProfileEditKey
  /** 입력칸에 넣을 예시 */
  placeholder?: string
  /**
   * 대표가 직접 만든 칸이면 그 칸의 id.
   * 표준 칸과 달리 **칸 자체를 지울 수 있다** — 표준 칸은 값만 비운다.
   */
  custom?: string
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
    opts: { copyable?: boolean; wide?: boolean; edit?: ProfileEditKey; placeholder?: string; numberKind?: NumberKind } = {},
  ): ProfileField => {
    const raw = value.trim()
    // 기록에 하이픈이 없어도(3138112508) 화면에는 서류에 적히는 모양(313-81-12508)으로 보여 준다
    const shown = opts.numberKind ? formatNumberOf(opts.numberKind, raw) : raw
    return {
      key,
      label,
      value: shown,
      empty: raw === '',
      copyable: opts.copyable === true,
      group,
      wide: opts.wide,
      edit: opts.edit,
      placeholder: opts.placeholder,
      numberKind: opts.numberKind,
    }
  }

  const out: ProfileField[] = [
    // 회사 — 서류에 그대로 옮겨 적는 값들
    f('companyName', '회사명', record.companyName, 'identity', { copyable: true, edit: 'companyName' }),
    f(
      'establishedAt',
      '설립일 · 업력',
      record.establishedAt ? `${formatYmd(record.establishedAt)}${y ? ` · ${y.nthYear}년차 (만 ${y.fullYears}년)` : ''}` : '',
      'identity',
      { edit: 'establishedAt', placeholder: '2019-03-05' },
    ),
    f('businessNumber', '사업자등록번호', record.businessNumber, 'identity', {
      copyable: true,
      numberKind: 'business',
      edit: 'businessNumber',
      placeholder: '000-00-00000',
    }),
    f('corporateNumber', '법인등록번호', record.corporateNumber, 'identity', {
      copyable: true,
      numberKind: 'corporate',
      edit: 'corporateNumber',
      placeholder: '000000-0000000',
    }),
    f('businessCategory', '업태', record.businessCategory, 'identity', { edit: 'businessCategory', placeholder: '예: 제조업' }),
    f('businessItem', '종목', record.businessItem, 'identity', {
      edit: 'businessItem',
      placeholder: '예: 간판 및 광고물 제조업',
    }),
  ]

  // 종목이 여럿인 회사만 — 없으면 줄 자체를 두지 않는다
  if (record.businessItemsExtra.trim() !== '') {
    out.push(
      f('businessItemsExtra', '종목(그 외)', record.businessItemsExtra, 'identity', {
        wide: true,
        edit: 'businessItemsExtra',
      }),
    )
  }

  out.push(
    f('businessAddress', '본점 주소', record.businessAddress, 'identity', {
      copyable: true,
      wide: true,
      edit: 'businessAddress',
    }),

    // 사람 — 심사에서 매번 묻는 것들
    f(
      'representativeName',
      '대표자',
      repName ? `${repName}${record.representativeBirth ? ` · ${record.representativeBirth}${age !== null ? ` (만 ${age}세)` : ''}` : ''}` : '',
      'people',
      { edit: 'representativeName' },
    ),
    f('representativeBirth', '대표자 생년월일', record.representativeBirth, 'people', {
      edit: 'representativeBirth',
      placeholder: '1980-12-31',
    }),
    f(
      'contactName',
      '담당자',
      record.contactName ? `${record.contactName}${record.contactTitle ? ` ${record.contactTitle}` : ''}` : '',
      'people',
      { edit: 'contactName' },
    ),
    f('employeeCount', '상시근로자', record.employeeCount, 'people', {
      edit: 'employeeCount',
      placeholder: '예: 5명(대표 포함)',
    }),
    f('shareholders', '주주·임원 구성', record.shareholders, 'people', {
      wide: true,
      edit: 'shareholders',
      placeholder: '예: 대표 60% · 배우자 40% / 등기임원 2명',
    }),

    // 연락처
    f('contactPhone', '담당자 휴대폰', record.contactPhone, 'contact', {
      copyable: true,
      numberKind: 'phone',
      edit: 'contactPhone',
      placeholder: '010-0000-0000',
    }),
    f('companyPhone', '회사 대표번호', record.companyPhone, 'contact', { copyable: true, edit: 'companyPhone', numberKind: 'phone' }),
    f('contactEmail', '이메일', record.contactEmail, 'contact', { copyable: true, edit: 'contactEmail' }),
    f('homepage', '홈페이지', record.homepage, 'contact', { copyable: true, edit: 'homepage' }),

    // 인증서 — 받았는지·어디에 두었는지만. 비밀번호는 저장하지 않는다.
    // 여기만 직접 고칠 수 없다: 값이 '서류' 탭의 받음 표시에서 나오기 때문이다.
    f('jointCertificate', '공동인증서', certificateValue(record), 'credential', { wide: true }),
  )

  // 대표가 직접 만든 칸은 각 묶음 끝에 붙는다 (표준 칸 사이에 끼우지 않는다)
  for (const c of record.customFields) {
    const raw = c.value.trim()
    out.push({
      key: `custom:${c.id}`,
      label: c.label,
      value: raw,
      empty: raw === '',
      copyable: true,
      group: c.group,
      wide: raw.length > 24,
      custom: c.id,
    })
  }

  return out
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
/**
 * 전체 복사용 텍스트.
 * `plainNumbers` 를 켜면 번호에서 하이픈을 뺀다 — 신청서 입력칸이 숫자만 받는 곳이 많다.
 */
export function profileAsText(
  record: ClientOpsRecord,
  today: string = todayLocalDate(),
  opts: { plainNumbers?: boolean } = {},
): string {
  return profileFields(record, today)
    .filter((x) => !x.empty)
    .map((x) => `${x.label}: ${opts.plainNumbers && x.numberKind ? digitsOf(x.value) : x.value}`)
    .join('\n')
}

/** 아직 안 채운 항목 수 */
export function missingProfileCount(record: ClientOpsRecord, today: string = todayLocalDate()): number {
  return profileFields(record, today).filter((x) => x.empty).length
}
