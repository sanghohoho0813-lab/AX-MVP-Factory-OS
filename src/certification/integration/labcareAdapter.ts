/**
 * 연구소 관리(labcare) → 기업인증 (P1). 연구소 관리 화면이 이미 아는 것(인정 여부 · 인정일 · 번호 · 연구전담요원 수)을
 * 다시 묻지 않는다. labcare 는 모듈 기록 'labcare/orig' 에 저장 키 하나당 한 줄로 두고, 업체 목록은 'pmsaas:clients:v1' 줄에 있다.
 * 연구소 관리의 업체 id 는 OS 업체 id 그대로다.
 */
export interface LabcareFacts {
  unit: 'lab' | 'dept'
  /** 인정(설립 신고)일 — 형식이 맞을 때만 */
  recognizedAt: string
  number: string
  name: string
  /** 연구전담요원 수 — 0 이하이거나 숫자가 아니면 null */
  researchers: number | null
}

const CLIENTS_KEY = 'pmsaas:clients:v1'

export function labcareFactsOf(rows: readonly { data: Record<string, unknown> }[] | null, clientId: string): LabcareFacts | null {
  if (!rows) return null
  const row = rows.find((r) => r.data?.key === CLIENTS_KEY)
  const list = Array.isArray(row?.data?.value) ? (row!.data.value as Record<string, unknown>[]) : []
  const c = list.find((x) => x && x.id === clientId && x.isSample !== true && x.source !== 'sample')
  if (!c) return null
  const date = typeof c.certifiedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.certifiedDate) ? c.certifiedDate : ''
  // 인정일이 없으면 '인정됨' 으로 보지 않는다(연구소 관리 화면도 같은 기준 — 설립 준비 중일 수 있다)
  if (!date) return null
  const n = typeof c.researcherCount === 'number' && Number.isFinite(c.researcherCount) && c.researcherCount > 0 ? Math.floor(c.researcherCount) : null
  return {
    unit: c.labType === '연구개발전담부서' ? 'dept' : 'lab',
    recognizedAt: date,
    number: typeof c.labRegistrationNumber === 'string' ? c.labRegistrationNumber.trim() : '',
    name: typeof c.labName === 'string' ? c.labName.trim() : '',
    researchers: n,
  }
}
