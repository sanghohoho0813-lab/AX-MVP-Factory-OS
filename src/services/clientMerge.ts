/**
 * SYNC-2(D-547) 업체 기록 저장이 부딪혔을 때 — 읽은 판(base) · 내가 고친 것(mine) · 먼저 저장된 것(theirs) 셋을 합친다.
 *
 * 예전: 다른 창 · 다른 기기 · 팀장이 먼저 저장했으면 이쪽 저장이 막히고, 방금 고친 것은 화면이 다시 불러오며 사라졌다(다시 적어야 했다).
 * 지금: 서로 다른 칸을 고쳤으면 둘 다 살린 판으로 다시 저장한다. 같은 칸을 둘 다 다르게 고쳤을 때만 '겹친 칸' 으로 알려 고르게 한다.
 *
 * 합치는 법(규칙 — AI 아님)
 *  - 한쪽만 바꾼 값 → 바꾼 쪽. 둘 다 같게 바꿨으면 그 값.
 *  - 둘 다 다르게 바꿨을 때
 *     · 묶음(객체) → 칸마다 다시 견준다(업무 · 서류 · 사실 · 절세 현황 …).
 *     · id 가 있는 목록(메모 · 수수료 · 활동 기록 · 서류 요청 …) → id 마다. 한쪽이 더한 줄은 살리고, 한쪽이 지운 줄은 다른 쪽이 고치지 않았으면 지운다.
 *       내가 더한 줄은 내가 넣은 자리(맨 앞이면 맨 앞 · 아니면 맨 뒤)에.
 *     · 글자 · 숫자만 든 목록 → 더한 것 · 뺀 것을 각각 반영(합집합에서 뺀 것 빼기).
 *     · 그 밖(글자 칸 · 숫자 칸)은 겹친 칸 — 일단 먼저 저장된 값을 두고, 사람이 [내가 고친 것으로] 를 고르면 내 값.
 *  - updatedAt 은 견주지 않는다(판 표시) — 합친 판은 먼저 저장된 판 위에 얹는다.
 */
import type { ClientOpsRecord } from '../types/clientOps'

type Json = unknown
type Obj = Record<string, unknown>

export interface MergeConflict {
  /** 'contactPhone' · 'services.policy.status' · 'notes_list[n_1].text' 처럼 */
  path: string
  mine: Json
  theirs: Json
}

export interface MergeResult {
  merged: ClientOpsRecord
  conflicts: MergeConflict[]
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const hasId = (v: unknown): v is Obj & { id: string } => isObj(v) && typeof v.id === 'string' && v.id !== ''
const isIdList = (v: unknown): v is (Obj & { id: string })[] => Array.isArray(v) && v.every(hasId)
const isPrimList = (v: unknown): v is (string | number | boolean)[] => Array.isArray(v) && v.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x))

/** undefined · 없는 칸은 같게 본다 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return a === b
  if (a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => sameValue(x, b[i]))
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) if (!sameValue(a[k], b[k])) return false
    return true
  }
  return false
}

function mergeValue(base: unknown, mine: unknown, theirs: unknown, path: string, out: MergeConflict[]): unknown {
  if (sameValue(mine, base)) return theirs
  if (sameValue(theirs, base)) return mine
  if (sameValue(mine, theirs)) return mine
  // 둘 다 다르게 바꿨다
  if (isObj(mine) && isObj(theirs) && (base === undefined || base === null || isObj(base))) return mergeObject(isObj(base) ? base : {}, mine, theirs, path, out)
  if (isIdList(mine) && isIdList(theirs) && (base === undefined || base === null || isIdList(base))) return mergeIdList(isIdList(base) ? base : [], mine, theirs, path, out)
  if (isPrimList(mine) && isPrimList(theirs) && (base === undefined || base === null || isPrimList(base))) return mergePrimList(isPrimList(base) ? base : [], mine, theirs)
  out.push({ path, mine, theirs })
  return theirs
}

function mergeObject(base: Obj, mine: Obj, theirs: Obj, path: string, out: MergeConflict[]): Obj {
  const res: Obj = {}
  const keys = new Set([...Object.keys(theirs), ...Object.keys(mine), ...Object.keys(base)])
  for (const k of keys) {
    const v = mergeValue(base[k], mine[k], theirs[k], path ? `${path}.${k}` : k, out)
    if (v !== undefined) res[k] = v
  }
  return res
}

function mergeIdList(base: (Obj & { id: string })[], mine: (Obj & { id: string })[], theirs: (Obj & { id: string })[], path: string, out: MergeConflict[]): Obj[] {
  const b = new Map(base.map((x) => [x.id, x]))
  const m = new Map(mine.map((x) => [x.id, x]))
  const res: Obj[] = []
  for (const t of theirs) {
    const bx = b.get(t.id)
    const mx = m.get(t.id)
    const p = `${path}[${t.id}]`
    if (!bx) {
      // 먼저 저장된 쪽이 더한 줄 — 나도 같은 id 로 더했으면 견준다
      res.push(mx ? (mergeValue(undefined, mx, t, p, out) as Obj) : t)
      continue
    }
    if (!mx) {
      // 내가 지운 줄 — 먼저 저장된 쪽이 고치지 않았으면 지운다
      if (sameValue(t, bx)) continue
      out.push({ path: p, mine: undefined, theirs: t })
      res.push(t)
      continue
    }
    res.push(mergeValue(bx, mx, t, p, out) as Obj)
  }
  // 먼저 저장된 쪽이 지운 줄 — 내가 고쳤으면 겹침(일단 지운 쪽), 아니면 그대로 지움
  const inTheirs = new Set(theirs.map((x) => x.id))
  for (const bx of base) {
    if (inTheirs.has(bx.id)) continue
    const mx = m.get(bx.id)
    if (mx && !sameValue(mx, bx)) out.push({ path: `${path}[${bx.id}]`, mine: mx, theirs: undefined })
  }
  // 내가 더한 줄 — 내가 넣은 자리(맨 앞 묶음이면 앞 · 아니면 뒤)
  const added = mine.filter((x) => !b.has(x.id) && !inTheirs.has(x.id))
  if (added.length === 0) return res
  const front = mine.length > 0 && !b.has(mine[0].id) && !inTheirs.has(mine[0].id)
  return front ? [...added, ...res] : [...res, ...added]
}

function mergePrimList(base: unknown[], mine: unknown[], theirs: unknown[]): unknown[] {
  const removed = new Set(base.filter((x) => !mine.includes(x)))
  const added = mine.filter((x) => !base.includes(x) && !theirs.includes(x))
  return [...theirs.filter((x) => !removed.has(x)), ...added]
}

/** 읽은 판 · 내가 고친 것 · 먼저 저장된 것 → 합친 판 + 겹친 칸(겹친 칸은 먼저 저장된 값) */
export function mergeClientEdits(base: ClientOpsRecord, mine: ClientOpsRecord, theirs: ClientOpsRecord): MergeResult {
  const conflicts: MergeConflict[] = []
  const strip = (r: ClientOpsRecord): Obj => {
    const o = { ...(r as unknown as Obj) }
    delete o.updatedAt
    return o
  }
  const merged = mergeObject(strip(base), strip(mine), strip(theirs), '', conflicts) as unknown as ClientOpsRecord
  return { merged: { ...merged, id: theirs.id, workspaceId: theirs.workspaceId, updatedAt: theirs.updatedAt }, conflicts }
}

/* ------------------------------------------------------------------ */
/* 겹친 칸에 내 값 넣기 · 이름 붙이기                                      */
/* ------------------------------------------------------------------ */

type Step = { key: string } | { id: string }

function stepsOf(path: string): Step[] {
  const steps: Step[] = []
  const re = /([^.[\]]+)|\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path))) steps.push(m[1] !== undefined ? { key: m[1] } : { id: m[2] })
  return steps
}

/** 합친 판의 겹친 칸들에 내가 고친 값을 넣는다(지운 줄은 지우고, 되살린 줄은 넣는다) */
export function applyMine(merged: ClientOpsRecord, conflicts: readonly MergeConflict[]): ClientOpsRecord {
  const root = structuredClone(merged) as unknown as Obj
  for (const c of conflicts) {
    const steps = stepsOf(c.path)
    let cur: unknown = root
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const last = i === steps.length - 1
      if ('key' in s) {
        if (!isObj(cur)) break
        if (last) {
          if (c.mine === undefined) delete cur[s.key]
          else cur[s.key] = structuredClone(c.mine)
        } else cur = cur[s.key]
      } else {
        if (!Array.isArray(cur)) break
        const list = cur as Obj[]
        const at = list.findIndex((x) => hasId(x) && x.id === s.id)
        if (last) {
          if (c.mine === undefined) {
            if (at >= 0) list.splice(at, 1)
          } else if (at >= 0) list[at] = structuredClone(c.mine) as Obj
          else list.push(structuredClone(c.mine) as Obj)
        } else cur = at >= 0 ? list[at] : undefined
      }
    }
  }
  return root as unknown as ClientOpsRecord
}

const FIELD_LABEL: Record<string, string> = {
  companyName: '회사 이름',
  contactName: '담당자',
  contactPhone: '담당자 연락처',
  contactEmail: '이메일',
  contactTitle: '담당자 직급',
  businessNumber: '사업자등록번호',
  corporateNumber: '법인등록번호',
  businessAddress: '주소',
  industry: '업종',
  status: '상태',
  nextAction: '다음 할 일',
  nextActionDueDate: '다음 할 일 날짜',
  notes: '메모',
  representativeName: '대표자',
  representativeBirth: '대표자 생년월일',
  representativeGender: '대표자 성별',
  employeeCount: '직원 수',
  shareholders: '주주 · 임원',
  establishedAt: '설립일',
  businessCategory: '업태',
  businessItem: '종목',
  businessItemsExtra: '그 밖의 종목',
  companyPhone: '대표번호',
  homepage: '홈페이지',
  services: '업무',
  documents: '서류',
  contract: '계약',
  customFields: '직접 만든 칸',
  customDocuments: '직접 만든 서류 칸',
  fees: '수수료',
  notes_list: '상담 메모',
  fundingApplications: '신청 건',
  toolResults: '붙인 계산 결과',
  sales: '영업 정보',
  activity: '활동 기록',
  factMeta: '회사 정보 출처',
  factValues: '회사 정보',
  factInbox: '확인할 정보',
  shareholderRegister: '주주명부',
  taxProfile: '절세 현황',
  care: '안부 연락',
  decided: '확인한 것',
  docUploads: '서류 올리기 기록',
  diagnosisGiven: '진단서 드린 기록',
  docRequests: '서류 요청',
  archivedAt: '보관',
}

/** 겹친 칸 → 사람이 읽는 이름(같은 이름은 한 번만) — '담당자 연락처' · '업무' · '상담 메모' */
export function conflictLabels(conflicts: readonly MergeConflict[]): string[] {
  const seen: string[] = []
  for (const c of conflicts) {
    const top = c.path.split(/[.[]/)[0]
    const label = FIELD_LABEL[top] ?? top
    if (!seen.includes(label)) seen.push(label)
  }
  return seen
}

/** 겹친 값 한 줄 보기 — 짧은 글 · 숫자는 그대로, 묶음 · 목록 · 지움은 쉬운 말로 */
export function conflictValueText(v: unknown): string {
  if (v === undefined || v === null) return '(지움)'
  if (typeof v === 'string') return v.trim() ? (v.length > 40 ? `${v.slice(0, 40)}…` : v) : '(비움)'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (isObj(v)) {
    const t = ['text', 'title', 'label', 'memo', 'status'].map((k) => v[k]).find((x) => typeof x === 'string' && x.trim())
    return typeof t === 'string' ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : '(여러 칸)'
  }
  return '(목록)'
}
