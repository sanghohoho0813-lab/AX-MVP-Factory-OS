import type { FundingMatch, OutreachPlan } from '../../types/funding'
import type { CollectedFundingSources } from './evidenceCollector'
import { FUNDING_ISO } from './fundingTaxonomy'

/* ------------------------------------------------------------------ */
/* Stage 11 · 사전 문의 계획 빌더 (deterministic, pure data)            */
/*                                                                     */
/* 우선(primary) 후보에 대해 기관 사전 문의 계획을 하나씩 제안한다.       */
/* 이는 내부 준비용 계획일 뿐이며 실제 발송은 하지 않는다.               */
/* 승인 가능성·확률을 단정하지 않고 확인·검토 관점만 담는다.             */
/* ------------------------------------------------------------------ */

const PURPOSE = '기관 사전 문의 — 대상 요건·필요 서류·접수 방식 확인'
const TARGET_ROLE = '기업지원 담당자'

const KEY_QUESTIONS: string[] = [
  '현재 접수 중인 프로그램이 있는지',
  '필요 서류와 자격 요건',
  '심사 관점과 준비 시 유의사항',
  '접수 방식과 일정',
]

const NO_SEND_NOTE = '실제 이메일·문자 발송은 하지 않습니다 — 내부 준비용 계획입니다.'

function buildPreparationItems(match: FundingMatch): string[] {
  const items = [...match.officialConfirmationRequired]
  items.push('기업 개요·프로젝트 요약 준비')
  items.push('기초요건 근거 자료 정리')
  return items.filter((v) => v.trim().length > 0)
}

function buildTalkingPoints(match: FundingMatch, objective: string): string[] {
  const points = [...match.strengths]
  const trimmedObjective = objective.trim()
  if (trimmedObjective.length > 0) {
    points.push(`프로젝트 목적: ${trimmedObjective}`)
  }
  return points.filter((v) => v.trim().length > 0)
}

/**
 * 우선(primary) 후보별로 사전 문의 계획을 1건씩 생성한다.
 * watch/excluded 후보에는 계획을 만들지 않는다(과도한 접촉 방지).
 * strategyId는 오케스트레이터가 채운다.
 */
export function buildOutreachPlans(
  sources: CollectedFundingSources,
  matches: FundingMatch[],
): OutreachPlan[] {
  const objective = sources.project.objective ?? ''
  const primaryMatches = matches.filter((m) => m.priority === 'primary')

  return primaryMatches.map((match, i) => ({
    id: `plan-${match.id}`,
    strategyId: '',
    institutionId: match.institutionId,
    programId: match.programId,
    purpose: PURPOSE,
    targetRole: TARGET_ROLE,
    channel: 'phone',
    plannedDate: '',
    ownerId: '',
    preparationItems: buildPreparationItems(match),
    keyQuestions: [...KEY_QUESTIONS],
    talkingPoints: buildTalkingPoints(match, objective),
    status: 'planned',
    notes: i === 0 ? NO_SEND_NOTE : '',
    createdAt: FUNDING_ISO,
    updatedAt: FUNDING_ISO,
  }))
}
