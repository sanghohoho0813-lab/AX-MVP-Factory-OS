/**
 * D-181: 고객 종류 — 중소기업 대표님 고객(지금까지 전부) · 컨설턴트 고객.
 *
 * 기록에는 컨설턴트 고객만 `clientType: 'consultant'` 가 남는다. 표시가 없으면 중소기업 대표님 고객이다
 * (예전 기록을 고치지 않아도 그대로 중소기업 쪽에 남는다).
 * 나누고 보는 것은 대표(full) 화면만 — 팀장(Pilot) 화면은 이 구분 없이 전부 보인다(화면에서 판단).
 */
import type { ClientOpsRecord } from '../types/clientOps'

export type ClientType = 'sme' | 'consultant'

export const CLIENT_TYPES: readonly ClientType[] = ['sme', 'consultant']

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  sme: '중소기업 고객',
  consultant: '컨설턴트 고객',
}

/** D-181: 고객 관리가 지난번에 보던 쪽(중소기업 · 컨설턴트) — 브라우저에만 남긴다 */
export const CLIENT_TYPE_VIEW_KEY = 'axmvp.clients.type'

/** D-182: 새로 만든 고객이 있는 쪽을 고객 관리가 열리자마자 보이게 — 저장 못 해도 등록은 된다 */
export function rememberClientTypeView(type: ClientType): void {
  try {
    localStorage.setItem(CLIENT_TYPE_VIEW_KEY, type)
  } catch {
    /* 기억 못 해도 된다 */
  }
}

export function isClientType(v: unknown): v is ClientType {
  return v === 'sme' || v === 'consultant'
}

export function clientTypeOf(r: Pick<ClientOpsRecord, 'clientType'>): ClientType {
  return r.clientType === 'consultant' ? 'consultant' : 'sme'
}

/**
 * D-182: 들어온 신청(상담신청 · 회원가입 · 진단)으로 고객 종류를 미리 골라 둔다 — 고르는 것은 사람이 한다.
 * 컨설턴트 쪽에서 온 신청(종류 칸 · 들어온 곳이 컨설턴트), 직업 칸에 '컨설턴트', 문의 글에 스스로 컨설턴트라고 밝힌 말이 있을 때만.
 * '컨설턴트님과 상담하고 싶어요' 처럼 우리 컨설턴트를 부르는 말로는 고르지 않는다. 모르면 중소기업(지금까지 고객).
 */
export function suggestClientType(payload: Record<string, unknown>, sourceType = ''): { type: ClientType; reason: string } {
  const str = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string).trim() : '')
  const isConsultantWord = (v: string) => /consultant|컨설턴트/i.test(v)
  const fromSide = '컨설턴트 쪽에서 들어온 신청이라 컨설턴트로 골라 두었습니다.'
  for (const k of ['client_type', 'customer_type', 'applicant_type', 'member_type', 'user_type', 'audience', 'segment']) {
    if (isConsultantWord(str(k))) return { type: 'consultant', reason: fromSide }
  }
  if (isConsultantWord(sourceType)) return { type: 'consultant', reason: fromSide }
  for (const k of ['job', 'occupation', 'role', 'position', 'job_title']) {
    if (isConsultantWord(str(k))) return { type: 'consultant', reason: `신청서 직업 칸에 '${str(k).slice(0, 20)}'(이)라고 적혀 있어 컨설턴트로 골라 두었습니다.` }
  }
  const message = [str('message'), str('body')].filter(Boolean).join(' ')
  if (/(저는|제가|본인은|현재)\s*[^.?!\n]{0,15}컨설턴트(?!님)|컨설턴트\s*(입니다|이에요|예요|로\s*(일하|활동|근무)|로서)/.test(message)) {
    return { type: 'consultant', reason: '문의 글에 스스로 컨설턴트라고 적혀 있어 컨설턴트로 골라 두었습니다.' }
  }
  return { type: 'sme', reason: '' }
}

/** 고객 종류 바꾸기 — 중소기업으로 되돌리면 표시를 지운다(예전 기록과 같은 모양) */
export function withClientType(r: ClientOpsRecord, type: ClientType): ClientOpsRecord {
  const rest = { ...r }
  delete rest.clientType
  return type === 'consultant' ? { ...rest, clientType: 'consultant' } : rest
}
