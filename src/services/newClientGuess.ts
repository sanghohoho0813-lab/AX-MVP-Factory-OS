/**
 * 새 업체 등록 창 칸 — 모양(타입 · 안내 글)과 '찾은 값 → 칸' 넣기(D-187).
 * 서류를 읽는 무거운 쪽(newClientFromDocs — 서류 분류 · 글자 읽기)과 떼어, 고객 관리 화면이 처음 그릴 때 그 묶음을 받지 않게 했다(D-646).
 */
import type { ReadMethod } from './docAutoFill'
import type { HandoffDoc } from './docHandoff'

export type NewClientField = 'companyName' | 'contactName' | 'businessNumber'

export const NEW_CLIENT_FIELDS: readonly NewClientField[] = ['companyName', 'contactName', 'businessNumber']

export const NEW_CLIENT_FIELD_LABEL: Record<NewClientField, string> = {
  companyName: '업체명',
  contactName: '대표자',
  businessNumber: '사업자등록번호',
}

export interface NewClientFound {
  value: string
  fileName: string
  /** 어느 서류에서 — '사업자등록증' · '법인등기부등본' · '크레탑 보고서' */
  docLabel: string
  /** 한 번 봐야 하는 까닭 — 없으면 '' */
  note: string
  /**
   * D-255: 사업자등록번호를 확실히 못 읽었을 때 — 칸은 비워 두고(value '') 고를 후보만 보인다(국세청 검증 숫자가 맞는 것).
   * 하나를 누르면 그 번호가 들어간다. 숫자 하나 틀리면 컨설턴트에게 치명적이라 저절로 넣지 않는다.
   */
  choices?: string[]
}

export type NewClientGuess = Partial<Record<NewClientField, NewClientFound>>

/** 등록 창에서 읽은 파일 하나 */
export interface ReadForNewClient {
  fileName: string
  text: string
  method: ReadMethod
}

/** 크레탑 보고서에서 읽은 회사(salesCretop.cretopCompany 모양에서 셋만) */
export interface CretopCompanyLite {
  fileName: string
  method: ReadMethod
  name: string
  bizNo: string
  ceo: string
}

/** 파일마다 무엇으로 읽었나 — 등록 창 목록에 '사업자등록증 · 업체명 · 대표자' 처럼 보인다 */
export interface NewClientFileNote {
  fileName: string
  /** 알아본 서류 이름 — 모르면 '' (등록하면 서류함에서 칸을 정한다) */
  docLabel: string
  found: NewClientField[]
}

/** 등록 창이 받는 것 — 넘길 서류 · 칸에 넣을 값 · 파일마다 알아본 것 · 아직 읽는 중인가 */
export interface NewClientDocsRead {
  docs: HandoffDoc[]
  guess: NewClientGuess
  files: NewClientFileNote[]
  reading: boolean
}

export const EMPTY_DOCS_READ: NewClientDocsRead = { docs: [], guess: {}, files: [], reading: false }

export const NOTE_FROM_PHOTO = '사진 · 스캔에서 읽은 글자라 틀릴 수 있어요 — 한 번 봐 주세요'
export const NOTE_BIZNO_CHECK = '번호 검증이 맞지 않아요 — 서류와 한 글자씩 비교해 주세요'
export const NOTE_BIZNO_UNREAD = '번호를 또렷하게 읽지 못했어요 — 서류를 보고 적어 주세요'
export const NOTE_DOC_UNSURE = '서류 종류가 확실하지 않아요 — 맞는지 봐 주세요'
export const NOTE_DIFFERS = '서류마다 적힌 값이 달라요 — 맞는 것으로 고쳐 주세요'

/** 비교용 — 번호는 숫자만, 글은 띄어쓰기 · (주) 표기를 뺀다(docAutoFill 과 같은 규칙) */
export function sameKey(field: NewClientField, value: string): string {
  if (field === 'businessNumber') return value.replace(/\D/g, '')
  return value.replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사/g, '').toLowerCase()
}

/**
 * 찾은 값 → 등록 창 칸. 빈 칸 · 앞서 서류로 채운 그대로인 칸만 바꾼다(사람이 적은 것은 덮지 않는다).
 * 사람이 적은 값과 다르면 '다름' 으로 돌려준다 — 칸 밑에 [서류 값으로] 를 보인다.
 * 서류를 빼서 더 이상 찾지 못한 값은, 서류로 채운 그대로면 비운다.
 * locked: 사람이 손댄 칸 — 비워 두었어도 저절로 채우지 않는다(다시 적으려고 지운 칸을 되채우지 않게).
 */
export function applyNewClientGuess<F extends Record<NewClientField, string>>(
  form: F,
  guess: NewClientGuess,
  prevFilled: NewClientGuess,
  locked: ReadonlySet<NewClientField> = new Set(),
): { form: F; filled: NewClientGuess; differs: NewClientGuess } {
  const next = { ...form }
  const filled: NewClientGuess = {}
  const differs: NewClientGuess = {}
  for (const field of NEW_CLIENT_FIELDS) {
    const g = guess[field]
    const now = form[field] ?? ''
    const prev = prevFilled[field]
    const untouched = !locked.has(field) && (now.trim() === '' || (prev !== undefined && now === prev.value))
    if (!g) {
      if (prev && now === prev.value && !locked.has(field)) next[field] = '' as F[typeof field]
      continue
    }
    if (g.value === '') {
      // D-255: 고를 후보만 — 칸은 채우지 않는다. 이미 후보 하나를 골라 두었으면 그대로 확인됨
      const picked = (g.choices ?? []).find((c) => sameKey(field, c) === sameKey(field, now))
      if (picked && now.trim() !== '') filled[field] = { ...g, value: now, note: '', choices: undefined }
      else if (now.trim() === '' || (prev !== undefined && now === prev.value && !locked.has(field))) {
        if (now.trim() !== '') next[field] = '' as F[typeof field]
        filled[field] = g
      } else differs[field] = g
      continue
    }
    if (untouched) {
      next[field] = g.value as F[typeof field]
      filled[field] = g
    } else if (sameKey(field, now) === sameKey(field, g.value)) {
      filled[field] = { ...g, value: now }
    } else {
      differs[field] = g
    }
  }
  return { form: next, filled, differs }
}
