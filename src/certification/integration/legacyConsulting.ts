/**
 * LEGACY — 예전 '특허+벤처'(컨설팅 프로젝트) 기록을 기업인증 벤처가 읽는 어댑터 (AX Hotfix).
 *
 * 새 벤처 업무는 cert-os/venture 에서 한다. 예전 화면(/studio · 업체 상세 ?tab=consulting)의 UI 는 다시 앞에 내지 않고,
 * 거기 저장된 값(특허 출원 · 등록, 사업계획 초안 진행, 신청일, 현재 자금조달)만 읽어 다시 묻지 않게 한다.
 * 데이터는 지우지도 고치지도 않는다(읽기만).
 */
import type { ConsultingProject } from '../../types/consulting'
import type { LegacyVentureFacts } from '../core/types'

/** 이 업체의 컨설팅 프로젝트 중 특허 · 벤처 기록이 가장 많이 남은 최근 것 하나(보관된 것 제외) */
export function legacyVentureFactsOf(projects: readonly ConsultingProject[] | null | undefined, clientId: string): LegacyVentureFacts | null {
  const mine = (projects ?? []).filter((p) => p.clientId === clientId && p.status !== 'archived')
  if (!mine.length) return null
  const score = (p: ConsultingProject) => {
    const plan = Object.values(p.venture?.sections ?? {}).filter((s) => s?.done).length
    return (p.patent?.filingStatus && p.patent.filingStatus !== 'none' ? 2 : 0) + plan + (p.venture?.submittedAt ? 3 : 0)
  }
  const best = [...mine].sort((a, b) => score(b) - score(a) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const sections = Object.values(best.venture?.sections ?? {})
  const facts: LegacyVentureFacts = {
    projectTitle: best.title || '컨설팅 프로젝트',
    patentStatus: best.patent?.filingStatus ?? 'none',
    applicationNumber: (best.patent?.applicationNumber ?? '').trim(),
    filedAt: (best.patent?.filedAt ?? '').trim(),
    planDone: sections.filter((s) => s?.done).length,
    planTotal: sections.length || 7,
    submittedAt: (best.venture?.submittedAt ?? '').trim(),
    fundingNow: (best.factsheet?.fundingNow?.value ?? '').trim().slice(0, 80),
  }
  const empty = facts.patentStatus === 'none' && !facts.applicationNumber && facts.planDone === 0 && !facts.submittedAt && !facts.fundingNow
  return empty ? null : facts
}
