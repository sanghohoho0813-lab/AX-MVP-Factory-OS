/**
 * 연구소 — 오늘 챙길 것 (D-91).
 *
 * 원본의 '오늘 할 일' 화면이 하던 판단을 계산만 따로 떼어 놓은 것이다.
 * 화면은 이 목록을 그리기만 한다. 시험이 이 함수를 직접 붙든다.
 *
 * 무엇을 보는가
 *   1. 이번 달 연구노트를 아직 안 쓴 업체 — 실사에서 가장 먼저 보는 것
 *   2. 올해 연구개발활동조사를 아직 안 낸 업체 — 안 내면 인정 취소 사유가 된다
 *   3. 연구전담요원이 모자라 보이는 업체
 *   4. 현장조사 준비가 덜 된 업체(핵심 항목이 빠진 곳)
 */

import { dedicatedCount, minResearchers, type LabInfoData } from './labInfo'

export type LabTaskKind = 'note' | 'survey' | 'researcher' | 'inspection'

export interface LabTask {
  kind: LabTaskKind
  clientId: string
  clientName: string
  /** 한 줄 — 무엇을 해야 하는가 */
  title: string
  /** 왜 해야 하는가 */
  detail: string
  /** 급한 순 (작을수록 급하다) */
  rank: number
  /** 눌렀을 때 갈 곳 */
  to: string
}

export interface LabTaskInput {
  clients: readonly { id: string; name: string }[]
  /** 업체별 연구소 정보 (없으면 이 모듈이 아직 안 보는 업체) */
  labInfo: ReadonlyMap<string, LabInfoData>
  /** 이번 달 연구노트가 있는 업체 id */
  notedThisMonth: ReadonlySet<string>
  /** 올해 활동조사를 낸 업체 id */
  surveyedThisYear: ReadonlySet<string>
  /** 업체별 현장조사 체크 (없으면 아직 아무것도 안 함) */
  inspectionChecked: ReadonlyMap<string, readonly string[]>
  /** 현장조사에서 특히 급한 항목 키 */
  urgentInspectionKeys: readonly string[]
  month: string
  year: number
}

export function buildLabTasks(input: LabTaskInput): LabTask[] {
  const out: LabTask[] = []

  for (const c of input.clients) {
    const info = input.labInfo.get(c.id)
    if (!info) continue // 연구소 정보가 없는 업체는 이 모듈의 일이 아니다

    if (!input.notedThisMonth.has(c.id)) {
      out.push({
        kind: 'note',
        clientId: c.id,
        clientName: c.name,
        title: `${input.month} 연구노트가 없습니다`,
        detail: '실사에서 가장 먼저 보는 것이 월별 연구노트입니다.',
        rank: 0,
        to: `/tools/labcare/notes?client=${c.id}`,
      })
    }

    if (!input.surveyedThisYear.has(c.id)) {
      out.push({
        kind: 'survey',
        clientId: c.id,
        clientName: c.name,
        title: `${input.year}년 연구개발활동조사 미제출`,
        detail: '제출하지 않으면 인정이 취소될 수 있습니다.',
        rank: 1,
        to: `/tools/labcare/survey?client=${c.id}`,
      })
    }

    const need = minResearchers(info.labType)
    if (dedicatedCount(info) < need) {
      out.push({
        kind: 'researcher',
        clientId: c.id,
        clientName: c.name,
        title: `연구전담요원 ${dedicatedCount(info)}명 — ${need}명 필요`,
        detail: '인원이 모자라면 변경신고 또는 충원이 필요합니다.',
        rank: 2,
        to: `/tools/labcare/clients?client=${c.id}`,
      })
    }

    const checked = new Set(input.inspectionChecked.get(c.id) ?? [])
    const missingUrgent = input.urgentInspectionKeys.filter((k) => !checked.has(k))
    if (missingUrgent.length > 0) {
      out.push({
        kind: 'inspection',
        clientId: c.id,
        clientName: c.name,
        title: `현장조사 핵심 항목 ${missingUrgent.length}건 미준비`,
        detail: '현장조사는 통보 뒤에 준비하면 늦습니다.',
        rank: 3,
        to: `/tools/labcare/inspection?client=${c.id}`,
      })
    }
  }

  return out.sort((a, b) => (a.rank === b.rank ? a.clientName.localeCompare(b.clientName) : a.rank - b.rank))
}

/** 올해 (연구개발활동조사는 해마다) */
export function currentYear(at: Date = new Date()): number {
  return at.getFullYear()
}
